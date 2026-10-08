import { MasterySimulationEvaluation, AdaptationEvaluation } from '../types';
import { adaptiveAssessmentService } from '../../services/adaptiveAssessmentService';
import { learnerModelService, MemoryLearnerStateStore } from '../../services/learnerModelService';
import { demoQuestions } from '../../data/questionBank';

export class MasteryEvaluator {

  async runSimulation(): Promise<{ mastery: MasterySimulationEvaluation, adaptation: AdaptationEvaluation }> {
    // Inject Memory Store for deterministic isolation
    learnerModelService.setStore(new MemoryLearnerStateStore());
    const profileCount = 5;
    const sessionsPerProfile = 3;
    const questionsPerSession = 5;
    const conceptIds = [...new Set(demoQuestions.map(question => question.conceptId))];
    const gains: number[] = [];
    let totalQuestions = 0;
    let repeatedQuestions = 0;
    
    let misconceptionTargetedCount = 0;
    let totalMisconceptionOpportunities = 0;

    for (let profile = 0; profile < profileCount; profile++) {
      const userId = `simulated-learner-${profile + 1}`;
      learnerModelService.reset(userId, 'course_ml_101');
      const seenAcrossSessions = new Set<string>();
      const masteryAtStart = 0.5;

      for (let session = 0; session < sessionsPerProfile; session++) {
        const attempted = new Set<string>();
        for (let questionIndex = 0; questionIndex < questionsPerSession; questionIndex++) {
          const selection = await adaptiveAssessmentService.getNextQuestion(userId, 'course_ml_101', attempted);
          if (!selection) break;
          const question = selection.question;
          attempted.add(question.id);
          totalQuestions++;
          if (seenAcrossSessions.has(question.id)) repeatedQuestions++;
          seenAcrossSessions.add(question.id);

          const currentConceptState = learnerModelService.getLearnerModel(userId, 'course_ml_101').masteryStates[question.conceptId];
          if (currentConceptState && currentConceptState.activeMisconceptions.length > 0) {
            totalMisconceptionOpportunities++;
            const targets = question.options?.some(option => currentConceptState.activeMisconceptions.some(m => m.misconceptionId === option.misconceptionId));
            if (targets) misconceptionTargetedCount++;
          }

          // Deterministic profiles improve by session while retaining different initial skill levels.
          const seed = `${profile}:${session}:${question.id}`;
          let hash = 2166136261;
          for (const character of seed) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
          const outcome = (hash >>> 0) % 100;
          const accuracy = Math.min(0.9, 0.25 + profile * 0.12 + session * 0.18);
          const isCorrect = outcome < accuracy * 100;
          const selectedOption = isCorrect
            ? question.options?.find(option => option.isCorrect)
            : question.options?.find(option => !option.isCorrect && option.misconceptionId) ?? question.options?.find(option => !option.isCorrect);
          learnerModelService.updateMastery(question.conceptId, question, isCorrect, selectedOption, false, userId, 'course_ml_101');
        }
      }

      const finalModel = learnerModelService.getLearnerModel(userId, 'course_ml_101');
      const testedStates = conceptIds.map(id => finalModel.masteryStates[id]).filter(Boolean);
      const finalMastery = testedStates.length ? testedStates.reduce((sum, state) => sum + state.masteryScore, 0) / testedStates.length : masteryAtStart;
      gains.push(finalMastery - masteryAtStart);
    }
    const masteryGain = gains.length ? gains.reduce((sum, gain) => sum + gain, 0) / gains.length : 0;
    const repetitionRate = totalQuestions > 0 ? repeatedQuestions / totalQuestions : 0;
    const targeting = totalMisconceptionOpportunities > 0 ? misconceptionTargetedCount / totalMisconceptionOpportunities : 0;
    const formattedMasteryGain = `${masteryGain >= 0 ? '+' : ''}${Math.round(masteryGain * 100)} pp`;

    return {
      mastery: {
        metrics: [
          {
            name: 'Mastery Gain (Adaptive)',
            value: masteryGain,
            formattedValue: formattedMasteryGain,
            sampleSize: gains.length,
            description: `Mean mastery-score change across ${profileCount} simulated learners over ${sessionsPerProfile} assessment sessions each; initial concept mastery is set to 0.50.`
          }
        ]
      },
      adaptation: {
        metrics: [
          {
            name: 'Question Repetition Rate',
            value: repetitionRate,
            formattedValue: `${Math.round(repetitionRate * 100)}%`,
            sampleSize: totalQuestions,
            description: 'Share of presented questions that repeat a question already seen by the same simulated learner in an earlier session.'
          },
          {
            name: 'Misconception Targeting Rate',
            value: targeting,
            formattedValue: totalMisconceptionOpportunities > 0 ? `${Math.round(targeting * 100)}%` : 'N/A',
            sampleSize: totalMisconceptionOpportunities,
            description: 'How often the system successfully prioritized a question targeting a known active misconception.'
          }
        ]
      }
    };
  }
}
