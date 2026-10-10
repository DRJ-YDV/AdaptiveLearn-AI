import { Question, ID, LearnerModel, Concept } from '../types/domain';
import { demoQuestions } from '../data/questionBank';
import { courseRepository } from './courseRepository';
import { learnerModelService, LearnerModelService } from './learnerModelService';

const isConceptInAssessmentScope = (concept: Concept, scopeId?: ID): boolean => {
  if (!scopeId) return true;
  if (scopeId.startsWith('source:')) {
    const sourceId = scopeId.slice('source:'.length);
    return concept.sourceReferences.some(reference => reference.sourceId === sourceId);
  }
  return concept.topicId === scopeId || concept.id === scopeId;
};

export interface AdaptiveSelection {
  question: Question;
  reason: string;
}

export class AdaptiveAssessmentService {
  constructor(private learners: LearnerModelService = learnerModelService) {}

  private shuffleOptions(question: Question): Question {
    if (!question.options || question.options.length < 2) return question;

    // Clone before shuffling so the shared demo bank and generated question set
    // keep their original order for any other consumers.
    const options = [...question.options];
    for (let index = options.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [options[index], options[swapIndex]] = [options[swapIndex], options[index]];
    }
    return { ...question, options };
  }

  async generateQuestionSet(userId: ID, courseId: ID, count: number, scopeId?: ID): Promise<Question[]> {
    const concepts = await courseRepository.getConceptsByCourse(courseId);
    const inScope = concepts.filter(concept => isConceptInAssessmentScope(concept, scopeId));
    if (inScope.some(concept => concept.id.startsWith('uploaded-'))) {
      const learner = this.learners.getLearnerModel(userId, courseId);
      const noveltyKey = `adaptivelearn:question-prompts:${courseId}`;
      let previousPrompts: string[] = [];
      try {
        const storedPrompts = localStorage.getItem(noveltyKey);
        if (storedPrompts) previousPrompts = JSON.parse(storedPrompts).slice(-50);
      } catch { /* Ignore a malformed local novelty cache and begin a fresh one. */ }
      const response = await fetch('http://localhost:3001/api/gemini/generate-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count,
          concepts: inScope,
          mastery: Object.fromEntries(inScope.map(concept => [concept.id, {
            score: learner.masteryStates[concept.id]?.masteryScore ?? null,
            activeMisconceptions: learner.masteryStates[concept.id]?.activeMisconceptions ?? []
          }])),
          excludePrompts: previousPrompts
        })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not generate questions from this course material.');
      if (!Array.isArray(data.questions) || data.questions.length === 0) throw new Error('The course excerpts did not support any verifiable questions for this scope.');
      const normalize = (prompt: string) => prompt.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const newQuestions = (data.questions as Question[]).filter(question => !previousPrompts.some(prompt => normalize(prompt) === normalize(question.prompt)));
      if (newQuestions.length === 0) throw new Error('The generator repeated questions from earlier assessments. Try again or choose another topic.');
      try {
        localStorage.setItem(noveltyKey, JSON.stringify([...previousPrompts, ...newQuestions.map(question => question.prompt)].slice(-100)));
      } catch { /* An unavailable novelty cache should not block an otherwise valid assessment. */ }
      return newQuestions;
    }
    const learner = this.learners.getLearnerModel(userId, courseId);
    const scopedQuestions = demoQuestions.filter(question => inScope.some(concept => concept.id === question.conceptId));
    if (scopedQuestions.length === 0) return [];

    // Prefer questions not seen recently across previous assessments. Once the
    // scoped bank has been exhausted, the least recently answered questions
    // become available again instead of restarting from the same first item.
    const lastAttemptByQuestion = new Map<ID, number>();
    learner.history.forEach((event, index) => lastAttemptByQuestion.set(event.questionId, index));
    const orderedQuestions = [...scopedQuestions].sort((a, b) => {
      const aAttempt = lastAttemptByQuestion.get(a.id);
      const bAttempt = lastAttemptByQuestion.get(b.id);
      if (aAttempt === undefined && bAttempt !== undefined) return -1;
      if (aAttempt !== undefined && bAttempt === undefined) return 1;
      if (aAttempt === undefined && bAttempt === undefined) return scopedQuestions.indexOf(a) - scopedQuestions.indexOf(b);
      return (aAttempt ?? -1) - (bAttempt ?? -1);
    });
    return orderedQuestions.slice(0, count);
  }

  async getNextQuestion(
    userId: ID, 
    courseId: ID, 
    attemptedQuestionIds: Set<ID>,
    isDiagnostic: boolean = false,
    scopeId?: ID,
    generatedQuestions?: Question[]
  ): Promise<AdaptiveSelection | null> {
    
    const concepts = await courseRepository.getConceptsByCourse(courseId);
    const demoConceptIds = new Set(demoQuestions.map(question => question.conceptId));
    const uploadedQuestions: Question[] = concepts
      .filter(concept => !demoConceptIds.has(concept.id) && concept.sourceReferences.length > 0)
      .map((concept, index) => {
        const otherConcepts = concepts.filter(candidate => candidate.id !== concept.id);
        const options = [
          { id: `${concept.id}-correct`, text: concept.name, isCorrect: true },
          ...otherConcepts.slice(0, 3).map((candidate, distractorIndex) => ({
            id: `${concept.id}-distractor-${distractorIndex}`,
            text: candidate.name,
            isCorrect: false
          }))
        ];
        return {
          id: `uploaded-question-${concept.id}-${index}`,
          type: 'MCQ',
          prompt: `Which concept is described by this course excerpt?\n\n“${concept.description.slice(0, 240)}”`,
          options,
          explanation: concept.description,
          conceptId: concept.id,
          topicId: concept.topicId,
          difficulty: 0.4,
          sourceReferences: concept.sourceReferences,
          tags: ['uploaded-course']
        } satisfies Question;
      })
      .filter(question => (question.options?.length ?? 0) >= 2);
    const questionPool = generatedQuestions ?? (uploadedQuestions.length > 0 ? uploadedQuestions : demoQuestions);
    const scopeConceptIds = concepts.length > 0
      ? new Set(concepts.filter(concept => isConceptInAssessmentScope(concept, scopeId)).map(concept => concept.id))
      : new Set(generatedQuestions?.map(question => question.conceptId) ?? []);
    const availableQuestions = questionPool.filter(q =>
      scopeConceptIds.has(q.conceptId) && !attemptedQuestionIds.has(q.id)
    );
    if (availableQuestions.length === 0) return null;

    const learnerModel = this.learners.getLearnerModel(userId, courseId);
    const recentlyAnsweredIds = new Set(learnerModel.history.slice(-5).map(event => event.questionId));
    const notRecentlyAnswered = availableQuestions.filter(question => !recentlyAnsweredIds.has(question.id));
    // A recency bonus alone can lose to a strong mastery/misconception score.
    // Make novelty a hard preference when this scope has another question.
    const lastAttemptByQuestion = new Map<ID, number>();
    learnerModel.history.forEach((event, index) => lastAttemptByQuestion.set(event.questionId, index));
    const oldestAttemptIndex = Math.min(...availableQuestions.map(question => lastAttemptByQuestion.get(question.id) ?? -1));
    const leastRecentlyAnswered = availableQuestions.filter(question => (lastAttemptByQuestion.get(question.id) ?? -1) === oldestAttemptIndex);
    const selectionPool = notRecentlyAnswered.length > 0 ? notRecentlyAnswered : leastRecentlyAnswered;

    if (isDiagnostic) {
      const selection = this.selectDiagnosticQuestion(selectionPool, learnerModel, concepts);
      return { ...selection, question: this.shuffleOptions(selection.question) };
    }

    // Normal adaptive logic (drill weaknesses)
    let bestQuestion = selectionPool[0];
    let highestScore = -Infinity;
    let selectedReason = "Default progression.";

    for (const q of selectionPool) {
      let score = 0;
      let reason = '';

      // Keep the practice focused on weak concepts while avoiding the same
      // item on consecutive assessment starts when alternatives exist.
      const lastAttempt = lastAttemptByQuestion.get(q.id);
      const questionAge = lastAttempt === undefined ? learnerModel.history.length + 1 : learnerModel.history.length - 1 - lastAttempt;
      score += Math.min(20, questionAge) * 1.5;
      
      const masteryState = learnerModel.masteryStates[q.conceptId];
      const currentMastery = masteryState ? masteryState.masteryScore : 0.5;
      
      if (currentMastery < 0.5) {
        score += (0.5 - currentMastery) * 10;
        reason = `Your mastery for this concept is low (${Math.round(currentMastery * 100)}%).`;
      } else {
        score -= (currentMastery - 0.5) * 5;
      }
      
      if (masteryState && masteryState.activeMisconceptions.length > 0 && q.options) {
         let targetsMisconception = false;
         for (const opt of q.options) {
           if (opt.misconceptionId && masteryState.activeMisconceptions.some(m => m.misconceptionId === opt.misconceptionId)) {
             targetsMisconception = true;
           }
         }
         if (targetsMisconception) {
           score += 25;
           reason = `Testing a specific concept area you've struggled with recently.`;
         }
      }

      const concept = concepts.find(c => c.id === q.conceptId);
      if (concept && concept.prerequisites.length > 0) {
        let hasWeakPrereq = false;
        for (const prereq of concept.prerequisites) {
          const prereqMastery = learnerModel.masteryStates[prereq.conceptId]?.masteryScore || 0.5;
          if (prereqMastery < 0.5) {
            hasWeakPrereq = true;
          }
        }
        
        if (hasWeakPrereq) {
          score -= 20; 
        } else {
          score += 2; 
          if (!reason) reason = `Prerequisites for this concept are strong, it's a good time to test it.`;
        }
      }

      const difficultyDiff = Math.abs(currentMastery - q.difficulty);
      score -= difficultyDiff * 5;

      if (score > highestScore) {
        highestScore = score;
        bestQuestion = q;
        if (!reason) {
          reason = `Difficulty matches your current level for this topic.`;
        }
        selectedReason = reason;
      }
    }

    return {
      question: this.shuffleOptions(bestQuestion),
      reason: selectedReason || 'Selected adaptively based on your recent performance.'
    };
  }

  private selectDiagnosticQuestion(
    availableQuestions: Question[], 
    learnerModel: LearnerModel,
    concepts: Concept[]
  ): AdaptiveSelection {
    
    // Diagnostic logic: Find concepts that are NOT yet assessed.
    // If all are assessed, pick ones with low confidence.
    // Prioritize prerequisites first to establish foundation.
    
    let bestQuestion = availableQuestions[0];
    let highestScore = -Infinity;

    for (const q of availableQuestions) {
      let score = 0;
      const state = learnerModel.masteryStates[q.conceptId];
      
      if (!state) {
        // High priority to completely unassessed concepts
        score += 50;
      } else {
        // If already assessed in this diagnostic, prefer picking another one for broad coverage
        score -= state.attempts * 20; 
        
        // Slightly favor low confidence
        if (state.confidenceScore < 0.5) {
          score += (0.5 - state.confidenceScore) * 10;
        }
      }

      const concept = concepts.find(c => c.id === q.conceptId);
      
      // Prerequisite priority: If this concept is a prerequisite for many others, it's critical to assess
      if (concept) {
        let downstreamDependents = 0;
        for (const c of concepts) {
          if (c.prerequisites.some(p => p.conceptId === concept.id)) {
            downstreamDependents++;
          }
        }
        score += downstreamDependents * 10;
      }

      // Medium difficulty preferred for initial probing
      const difficultyDiff = Math.abs(0.5 - q.difficulty);
      score -= difficultyDiff * 10;

      if (score > highestScore) {
        highestScore = score;
        bestQuestion = q;
      }
    }

    return {
      question: bestQuestion,
      reason: "Evaluating your initial knowledge for this concept."
    };
  }
}

export const adaptiveAssessmentService = new AdaptiveAssessmentService();
