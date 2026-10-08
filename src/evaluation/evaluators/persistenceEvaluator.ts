import { PersistentLearnerStateStore } from '../../services/learnerModelService';

export class PersistenceEvaluator {
  
  async runPersistenceTests(): Promise<any> {
    const results = {
      stateSerialization: false,
      stateDeserialization: false,
      stateRestoration: false,
      courseIsolation: false,
      diagnosticCompletionPersistence: false,
      masteryPersistence: false,
      misconceptionPersistence: false,
      performanceEventPersistence: false,
      attemptedQuestionPersistence: false,
      resetBehavior: false,
      corruptedStateRecovery: false,
      missingStateInitialization: false
    };

    const store = new PersistentLearnerStateStore();
    
    const userId = `test_user_${crypto.randomUUID()}`;
    const courseA = 'course_A';
    const courseB = 'course_B';

    // 12. Missing-state initialization
    let modelA = store.getLearnerModel(userId, courseA);
    if (modelA && Object.keys(modelA.masteryStates).length === 0 && !modelA.isDiagnosticComplete) {
      results.missingStateInitialization = true;
    }

    // Mutate state for testing
    modelA.isDiagnosticComplete = true;
    modelA.masteryStates['concept_1'] = {
      conceptId: 'concept_1',
      masteryScore: 0.85,
      confidenceScore: 0.9,
      attempts: 5,
      correct: 4,
      incorrect: 1,
      recentPerformance: [true, true, true],
      consecutiveIncorrect: 0,
      trend: 'UP',
      difficulty: 0.6,
      prerequisiteStatus: 'CLEARED',
      activeMisconceptions: [{
        misconceptionId: 'misc_1',
        conceptId: 'concept_1',
        occurrenceCount: 2,
        firstDetected: new Date().toISOString(),
        lastDetected: new Date().toISOString(),
        severity: 'MEDIUM',
        resolved: false
      }]
    };
    modelA.history.push({
      questionId: 'q_1',
      conceptId: 'concept_1',
      difficulty: 0.5,
      isCorrect: true,
      masteryBefore: 0.5,
      masteryAfter: 0.85,
      timestamp: new Date().toISOString()
    });

    // 1. State serialization
    store.saveLearnerModel(modelA);
    const rawData = localStorage.getItem(`adaptivelearn:learner:${userId}:${courseA}`);
    if (rawData && rawData.includes('concept_1') && rawData.includes('version')) {
      results.stateSerialization = true;
    }

    // 2. State deserialization & 3. State restoration
    const restoredA = store.getLearnerModel(userId, courseA);
    if (restoredA && restoredA.masteryStates['concept_1']) {
      results.stateDeserialization = true;
      results.stateRestoration = true;
      
      // 5. Diagnostic completion persistence
      if (restoredA.isDiagnosticComplete) results.diagnosticCompletionPersistence = true;
      
      // 6. Mastery persistence
      if (restoredA.masteryStates['concept_1'].masteryScore === 0.85) results.masteryPersistence = true;
      
      // 7. Misconception persistence
      if (restoredA.masteryStates['concept_1'].activeMisconceptions[0].misconceptionId === 'misc_1') {
        results.misconceptionPersistence = true;
      }
      
      // 8. Performance event persistence & 9. Attempted-question persistence
      if (restoredA.history.length === 1 && restoredA.history[0].questionId === 'q_1') {
        results.performanceEventPersistence = true;
        results.attemptedQuestionPersistence = true;
      }
    }

    // 4. Course isolation
    const modelB = store.getLearnerModel(userId, courseB);
    if (Object.keys(modelB.masteryStates).length === 0) {
      results.courseIsolation = true;
    }

    // 10. Reset behavior
    store.reset(userId, courseA);
    const resetA = store.getLearnerModel(userId, courseA);
    if (Object.keys(resetA.masteryStates).length === 0 && !resetA.isDiagnosticComplete) {
      results.resetBehavior = true;
    }

    // 11. Corrupted-state recovery
    localStorage.setItem(`adaptivelearn:learner:${userId}:${courseB}`, '{ corrupted_json: true, "version'); // Invalid JSON
    const recoveredB = store.getLearnerModel(userId, courseB);
    if (recoveredB && Object.keys(recoveredB.masteryStates).length === 0) {
      results.corruptedStateRecovery = true;
    }

    // Remove only this evaluator's temporary state; preserve the learner's saved progress.
    localStorage.removeItem(`adaptivelearn:learner:${userId}:${courseA}`);
    localStorage.removeItem(`adaptivelearn:learner:${userId}:${courseB}`);

    return results;
  }
}
