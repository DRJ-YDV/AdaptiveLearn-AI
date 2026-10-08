import { Concept, ID } from '../types/domain';
import { courseRepository } from './courseRepository';
import { learnerModelService, LearnerModelService } from './learnerModelService';

export type NextBestActionType = 'REVIEW_CONCEPT' | 'REVIEW_PREREQUISITE' | 'PRACTICE_CONCEPT' | 'ASK_TUTOR' | 'CONTINUE';

export interface NextBestAction {
  action: NextBestActionType;
  conceptId?: ID;
  conceptName?: string;
  reasons: string[];
}

export class NextBestActionService {
  constructor(private learners: LearnerModelService = learnerModelService) {}

  async getNextBestAction(userId: ID, courseId: ID): Promise<NextBestAction> {
    const learnerModel = this.learners.getLearnerModel(userId, courseId);
    const concepts = await courseRepository.getConceptsByCourse(courseId);
    
    // Find concept with highest active misconceptions
    let maxMisconceptionConcept: Concept | null = null;
    let maxMisconceptions = 0;

    // Find weakest overall concept
    let weakestConcept: Concept | null = null;
    let minMastery = 1.0;

    for (const concept of concepts) {
      const state = learnerModel.masteryStates[concept.id];
      if (!state) continue;

      if (state.masteryScore < minMastery) {
        minMastery = state.masteryScore;
        weakestConcept = concept;
      }

      const severeMisconceptions = state.activeMisconceptions.filter(m => m.severity === 'HIGH' || m.severity === 'MEDIUM');
      if (severeMisconceptions.length > maxMisconceptions) {
        maxMisconceptions = severeMisconceptions.length;
        maxMisconceptionConcept = concept;
      }
    }

    // 1. Prioritize addressing active misconceptions
    if (maxMisconceptionConcept && maxMisconceptions > 0) {
      const state = learnerModel.masteryStates[maxMisconceptionConcept.id];
      return {
        action: 'ASK_TUTOR',
        conceptId: maxMisconceptionConcept.id,
        conceptName: maxMisconceptionConcept.name,
        reasons: [
          `You have ${maxMisconceptions} unresolved misconception(s) detected.`,
          `Recent performance trend is ${state.trend}.`,
          `The AI Tutor can provide targeted clarification.`
        ]
      };
    }

    // 2. Check for weak prerequisites
    if (weakestConcept && minMastery < 0.5) {
      const state = learnerModel.masteryStates[weakestConcept.id];
      
      // Check if any prerequisites are also weak
      if (weakestConcept.prerequisites.length > 0) {
        for (const prereq of weakestConcept.prerequisites) {
          const prereqState = learnerModel.masteryStates[prereq.conceptId];
          if (prereqState && prereqState.masteryScore < 0.6) {
            const prereqConcept = concepts.find(c => c.id === prereq.conceptId);
            return {
              action: 'REVIEW_PREREQUISITE',
              conceptId: prereq.conceptId,
              conceptName: prereqConcept?.name,
              reasons: [
                `Mastery of ${weakestConcept.name} is low (${Math.round(minMastery * 100)}%).`,
                `Prerequisite ${prereqConcept?.name} is also below recommended threshold (${Math.round(prereqState.masteryScore * 100)}%).`,
                `Strengthening this foundation is required before advancing.`
              ]
            };
          }
        }
      }

      // 3. Direct concept practice if no weak prereqs
      return {
        action: 'PRACTICE_CONCEPT',
        conceptId: weakestConcept.id,
        conceptName: weakestConcept.name,
        reasons: [
          `Mastery is currently ${Math.round(minMastery * 100)}%.`,
          state.consecutiveIncorrect > 0 ? `${state.consecutiveIncorrect} recent incorrect answer(s).` : 'Needs reinforcement.',
          `Direct practice will help raise your score.`
        ]
      };
    }

    // 4. Default state
    return {
      action: 'CONTINUE',
      reasons: [
        'No major weaknesses detected.',
        'Your learning trajectory is stable.',
        'You are ready to advance to the next module.'
      ]
    };
  }
}

export const nextBestActionService = new NextBestActionService();
