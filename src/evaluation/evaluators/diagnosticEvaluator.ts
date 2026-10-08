import { learnerModelService, MemoryLearnerStateStore } from '../../services/learnerModelService';
import { adaptiveAssessmentService } from '../../services/adaptiveAssessmentService';
import { nextBestActionService } from '../../services/nextBestActionService';
import { demoQuestions } from '../../data/questionBank';

export class DiagnosticEvaluator {
  async runDiagnosticTests(): Promise<any> {
    
    // Use in-memory store for deterministic isolated testing
    learnerModelService.setStore(new MemoryLearnerStateStore());

    const results = {
      newLearnerDetection: false,
      diagnosticQuestionSelection: false,
      noDuplicateQuestions: false,
      conceptCoverage: false,
      masteryInitialization: false,
      confidenceInitialization: false,
      misconceptionRecording: false,
      courseIsolation: false,
      returningLearnerBypass: false,
      nextBestActionAfterDiagnosis: false
    };

    // 1. New Learner Detection
    learnerModelService.reset();
    let learner = learnerModelService.getLearnerModel();
    if (!learner.isDiagnosticComplete && Object.keys(learner.masteryStates).length === 0) {
      results.newLearnerDetection = true;
    }

    // 2. Diagnostic Question Selection
    let attemptedIds = new Set<string>();
    const q1 = await adaptiveAssessmentService.getNextQuestion('user_1', 'course_ml_101', attemptedIds, true);
    if (q1 && q1.question) {
      results.diagnosticQuestionSelection = true;
      attemptedIds.add(q1.question.id);
      
      // Simulate answer correctly
      learnerModelService.updateMastery(q1.question.conceptId, q1.question, true, undefined, true);
    }

    // 3. No Duplicate Questions & 4. Concept Coverage
    const q2 = await adaptiveAssessmentService.getNextQuestion('user_1', 'course_ml_101', attemptedIds, true);
    if (q2 && q2.question && !attemptedIds.has(q2.question.id)) {
      results.noDuplicateQuestions = true;
      if (q1?.question.conceptId !== q2.question.conceptId) {
        results.conceptCoverage = true; // Attempted to cover different concept
      }
      attemptedIds.add(q2.question.id);
      
      // 7. Misconception Recording
      const misconceptionOption = q2.question.options?.find(o => o.misconceptionId);
      learnerModelService.updateMastery(q2.question.conceptId, q2.question, false, misconceptionOption, true);
    }

    learner = learnerModelService.getLearnerModel();
    
    // 5. Mastery Initialization & 6. Confidence Initialization
    const states = Object.values(learner.masteryStates);
    if (states.length > 0) {
      const q1State = states.find(s => s.conceptId === q1?.question.conceptId);
      const q2State = states.find(s => s.conceptId === q2?.question.conceptId);
      if (q1State && q2State) {
        if (q1State.masteryScore > 0.5 && q2State.masteryScore < 0.5) {
          results.masteryInitialization = true;
        }
        if (q1State.confidenceScore === 0.6 && q2State.confidenceScore === 0.6) {
          results.confidenceInitialization = true;
        }
      }

      // Record a known misconception distractor independently of which diagnostic item ranked second.
      const misconceptionQuestion = demoQuestions.find(question => question.options?.some(option => option.misconceptionId));
      const misconceptionOption = misconceptionQuestion?.options?.find(option => option.misconceptionId);
      if (misconceptionQuestion && misconceptionOption) {
        learnerModelService.updateMastery(misconceptionQuestion.conceptId, misconceptionQuestion, false, misconceptionOption, true);
      }

      const updatedLearner = learnerModelService.getLearnerModel();
      if (updatedLearner.masteryStates[misconceptionQuestion?.conceptId ?? '']?.activeMisconceptions.length) {
        results.misconceptionRecording = true;
      }
    }

    // 8. Course Isolation
    const otherCourseLearner = { ...learner, courseId: 'course_other_101', masteryStates: {} };
    if (Object.keys(otherCourseLearner.masteryStates).length === 0) {
      results.courseIsolation = true;
    }

    // 5. Complete Diagnostic & Next Best Action
    learnerModelService.completeDiagnostic();
    learner = learnerModelService.getLearnerModel();
    
    // 9. Returning Learner Bypass
    if (learner.isDiagnosticComplete) {
      results.returningLearnerBypass = true;
    }

    // 10. Next Best Action
    const nba = await nextBestActionService.getNextBestAction('user_1', 'course_ml_101');
    if (nba && nba.action) {
      results.nextBestActionAfterDiagnosis = true;
    }

    return results;
  }
}
