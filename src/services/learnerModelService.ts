import { LearnerModel, MasteryState, ID, Question, QuestionOption, PerformanceEvent } from '../types/domain';

export interface ILearnerStateStore {
  getLearnerModel(userId: ID, courseId: ID): LearnerModel;
  saveLearnerModel(model: LearnerModel): void;
  reset(userId: ID, courseId: ID): void;
}

export class MemoryLearnerStateStore implements ILearnerStateStore {
  private states: Record<string, LearnerModel> = {};

  private getKey(userId: ID, courseId: ID) {
    return `${userId}_${courseId}`;
  }

  getLearnerModel(userId: ID, courseId: ID): LearnerModel {
    const key = this.getKey(userId, courseId);
    if (!this.states[key]) {
      this.reset(userId, courseId);
    }
    return this.states[key];
  }

  saveLearnerModel(model: LearnerModel): void {
    const key = this.getKey(model.userId, model.courseId);
    this.states[key] = JSON.parse(JSON.stringify(model)); // deep clone to prevent accidental references
  }

  reset(userId: ID, courseId: ID): void {
    const key = this.getKey(userId, courseId);
    const initial: LearnerModel = {
      userId,
      courseId,
      isDiagnosticComplete: false,
      masteryStates: {},
      history: []
    };
    this.states[key] = initial;
  }
}

export class PersistentLearnerStateStore implements ILearnerStateStore {
  private getStorageKey(userId: ID, courseId: ID): string {
    return `adaptivelearn:learner:${userId}:${courseId}`;
  }

  getLearnerModel(userId: ID, courseId: ID): LearnerModel {
    try {
      const key = this.getStorageKey(userId, courseId);
      const data = localStorage.getItem(key);
      if (data) {
        const parsed = JSON.parse(data);
        // Simple version check could go here if schema changes
        if (parsed.version === 1 && parsed.learnerModel) {
          return parsed.learnerModel as LearnerModel;
        }
      }
    } catch (e) {
      console.warn('Failed to deserialize learner model from localStorage, initializing fresh state.', e);
    }
    
    // Fallback or initialization
    const initial: LearnerModel = {
      userId,
      courseId,
      isDiagnosticComplete: false,
      masteryStates: {},
      history: []
    };
    return initial;
  }

  saveLearnerModel(model: LearnerModel): void {
    try {
      const key = this.getStorageKey(model.userId, model.courseId);
      const payload = {
        version: 1,
        courseId: model.courseId,
        learnerModel: model
      };
      localStorage.setItem(key, JSON.stringify(payload));
      
      // Trigger a custom event for cross-tab or same-session synchronization
      window.dispatchEvent(new CustomEvent('adaptivelearn:learner:updated', {
        detail: { userId: model.userId, courseId: model.courseId }
      }));
    } catch (e) {
      console.warn('Failed to persist learner model to localStorage.', e);
    }
  }

  reset(userId: ID, courseId: ID): void {
    try {
      const key = this.getStorageKey(userId, courseId);
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('Failed to reset learner model in localStorage.', e);
    }
  }
}

export class LearnerModelService {
  private store: ILearnerStateStore;

  constructor(store?: ILearnerStateStore) {
    this.store = store || new PersistentLearnerStateStore(); // Use persistent by default in prod
  }

  // Provide a way to inject a different store (e.g. MemoryLearnerStateStore for tests)
  setStore(store: ILearnerStateStore) {
    this.store = store;
  }

  getStore(): ILearnerStateStore {
    return this.store;
  }

  getLearnerModel(userId: ID = 'user_1', courseId: ID = 'course_ml_101'): LearnerModel {
    return this.store.getLearnerModel(userId, courseId);
  }

  reset(userId: ID = 'user_1', courseId: ID = 'course_ml_101'): void {
    this.store.reset(userId, courseId);
  }

  updateMastery(conceptId: ID, question: Question, isCorrect: boolean, selectedOption?: QuestionOption, isDiagnostic: boolean = false, userId: ID = 'user_1', courseId: ID = 'course_ml_101'): MasteryState {
    const model = this.getLearnerModel(userId, courseId);
    const isFirstAttempt = !model.masteryStates[conceptId];
    
    const state = model.masteryStates[conceptId] || {
      conceptId,
      masteryScore: 0.5,
      confidenceScore: 0.2, // Start low for new concepts
      attempts: 0,
      correct: 0,
      incorrect: 0,
      recentPerformance: [],
      consecutiveIncorrect: 0,
      trend: 'STABLE',
      difficulty: 0.5,
      prerequisiteStatus: 'CLEARED',
      activeMisconceptions: []
    };

    const previousMastery = state.masteryScore;
    
    if (isDiagnostic && isFirstAttempt) {
      // Diagnostic initialization logic
      if (isCorrect) {
        state.masteryScore = 0.6 + (question.difficulty * 0.3); // 0.6 to 0.9 depending on difficulty
        state.confidenceScore = 0.6; // We have one piece of strong diagnostic evidence
      } else {
        state.masteryScore = 0.4 - ((1 - question.difficulty) * 0.3); // 0.1 to 0.4 depending on difficulty
        state.confidenceScore = 0.6;
      }
      state.correct = isCorrect ? 1 : 0;
      state.incorrect = isCorrect ? 0 : 1;
      state.consecutiveIncorrect = isCorrect ? 0 : 1;
    } else {
      // Normal practice update logic
      let delta = 0;
      if (isCorrect) {
        delta = 0.05 + (question.difficulty * 0.1);
        state.correct += 1;
        state.consecutiveIncorrect = 0;
      } else {
        delta = -0.05 - ((1 - question.difficulty) * 0.1);
        state.incorrect += 1;
        state.consecutiveIncorrect += 1;
      }
      state.masteryScore = Math.max(0, Math.min(1, state.masteryScore + delta));
      
      // Update confidence based on consistency
      if (isCorrect) {
        state.confidenceScore = Math.min(1, state.confidenceScore + 0.1);
      } else {
        state.confidenceScore = Math.max(0, state.confidenceScore - 0.15);
      }
    }

    state.attempts += 1;
    
    // Update recent performance array (keep last 5)
    state.recentPerformance.push(isCorrect);
    if (state.recentPerformance.length > 5) {
      state.recentPerformance.shift();
    }

    // Update trend based on recent performance
    const recentCorrect = state.recentPerformance.filter(b => b).length;
    if (recentCorrect >= 3) {
      state.trend = 'UP';
    } else if (state.consecutiveIncorrect >= 2) {
      state.trend = 'DOWN';
    } else {
      state.trend = 'STABLE';
    }

    // Handle misconceptions
    if (selectedOption?.misconceptionId) {
      const miscId = selectedOption.misconceptionId;
      let tracked = state.activeMisconceptions.find(m => m.misconceptionId === miscId);
      if (!tracked) {
        tracked = {
          misconceptionId: miscId,
          conceptId,
          occurrenceCount: 0,
          firstDetected: new Date().toISOString(),
          lastDetected: new Date().toISOString(),
          severity: 'LOW',
          resolved: false
        };
        state.activeMisconceptions.push(tracked);
      }
      
      tracked.occurrenceCount += 1;
      tracked.lastDetected = new Date().toISOString();
      tracked.resolved = false;
      
      // Determine severity deterministically
      if (tracked.occurrenceCount >= 3) tracked.severity = 'HIGH';
      else if (tracked.occurrenceCount === 2) tracked.severity = 'MEDIUM';
    }

    state.lastStudied = new Date().toISOString();
    model.masteryStates[conceptId] = state;
    
    // Record Performance Event
    const event: PerformanceEvent = {
      questionId: question.id,
      conceptId,
      difficulty: question.difficulty,
      isCorrect,
      selectedOptionId: selectedOption?.id,
      misconceptionId: selectedOption?.misconceptionId,
      masteryBefore: previousMastery,
      masteryAfter: state.masteryScore,
      timestamp: new Date().toISOString(),
      isDiagnostic
    };
    model.history.push(event);

    this.store.saveLearnerModel(model);
    return state;
  }

  recordConversationSignal(conceptId: ID, understood: boolean, userId: ID = 'user_1', courseId: ID = 'course_ml_101'): void {
    const model = this.getLearnerModel(userId, courseId);
    const state = model.masteryStates[conceptId] ?? {
      conceptId, masteryScore: 0.5, confidenceScore: 0.2, attempts: 0, correct: 0, incorrect: 0,
      recentPerformance: [], consecutiveIncorrect: 0, trend: 'STABLE' as const, difficulty: 0.5,
      prerequisiteStatus: 'UNKNOWN' as const, activeMisconceptions: []
    };
    // A self-report is weaker evidence than a scored answer, so its mastery adjustment is deliberately small.
    state.masteryScore = Math.max(0, Math.min(1, state.masteryScore + (understood ? 0.015 : -0.015)));
    state.confidenceScore = Math.max(0, Math.min(1, state.confidenceScore + (understood ? 0.05 : -0.05)));
    state.lastStudied = new Date().toISOString();
    model.masteryStates[conceptId] = state;
    model.conversationSignals ??= [];
    model.conversationSignals.push({ conceptId, understood, timestamp: new Date().toISOString() });
    if (model.conversationSignals.length > 200) model.conversationSignals.splice(0, model.conversationSignals.length - 200);
    this.store.saveLearnerModel(model);
  }

  completeDiagnostic(userId: ID = 'user_1', courseId: ID = 'course_ml_101'): void {
    const model = this.getLearnerModel(userId, courseId);
    model.isDiagnosticComplete = true;
    this.store.saveLearnerModel(model);
  }
}

export const learnerModelService = new LearnerModelService();
