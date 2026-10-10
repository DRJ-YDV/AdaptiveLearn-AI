import type { Concept, LearnerModel, Topic } from '../types/domain';

export interface StudyPlanSettings {
  examDate: string;
  minutesPerDay: number;
  studyDays: number[];
}

export interface StudyPlanSession {
  id: string;
  date: string;
  conceptId: string;
  conceptName: string;
  topicId: string;
  topicName: string;
  estimatedMinutes: number;
  reason: string;
  completed: boolean;
}

export interface StudyPlan {
  id: string;
  generatedAt: string;
  settings: StudyPlanSettings;
  sessions: StudyPlanSession[];
  unscheduledConceptNames: string[];
}

const DEFAULT_USER_ID = 'user_1';
const DEFAULT_COURSE_ID = 'course_ml_101';
const storageKey = `adaptivelearn:study-plan:${DEFAULT_USER_ID}:${DEFAULT_COURSE_ID}`;

const masteryFor = (concept: Concept, learner: LearnerModel): number =>
  learner.masteryStates[concept.id]?.masteryScore ?? 0.5;

const minutesFor = (mastery: number): number => mastery < 0.4 ? 25 : mastery < 0.7 ? 20 : 12;

const reasonFor = (mastery: number): string => mastery < 0.4
  ? 'Needs reinforcement'
  : mastery < 0.7 ? 'Build mastery' : 'Spaced review';

const localDateString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export class StudyPlanService {
  load(): StudyPlan | null {
    try {
      const value = localStorage.getItem(storageKey);
      if (!value) return null;
      const plan = JSON.parse(value) as StudyPlan;
      return Array.isArray(plan.sessions) && Array.isArray(plan.settings?.studyDays) ? plan : null;
    } catch {
      return null;
    }
  }

  save(plan: StudyPlan): void {
    try { localStorage.setItem(storageKey, JSON.stringify(plan)); } catch { /* Keep the generated plan available for this session. */ }
  }

  toggleSession(plan: StudyPlan, sessionId: string): StudyPlan {
    const updated = {
      ...plan,
      sessions: plan.sessions.map(session => session.id === sessionId ? { ...session, completed: !session.completed } : session)
    };
    this.save(updated);
    return updated;
  }

  build(settings: StudyPlanSettings, topics: Topic[], concepts: Concept[], learner: LearnerModel): StudyPlan {
    const topicById = new Map(topics.map(topic => [topic.id, topic]));
    const pending = new Map(concepts.map(concept => [concept.id, concept]));
    const ordered: Concept[] = [];

    // Keep prerequisites ahead of dependent concepts, then prioritize weaker mastery.
    while (pending.size > 0) {
      const ready = [...pending.values()].filter(concept =>
        !concept.prerequisites.some(prerequisite => pending.has(prerequisite.conceptId))
      );
      const candidates = ready.length > 0 ? ready : [...pending.values()];
      candidates.sort((a, b) => masteryFor(a, learner) - masteryFor(b, learner));
      const next = candidates[0];
      ordered.push(next);
      pending.delete(next.id);
    }

    const endDate = new Date(`${settings.examDate}T00:00:00`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const eligibleDates: string[] = [];
    for (const date = new Date(today); date <= endDate && eligibleDates.length < 180; date.setDate(date.getDate() + 1)) {
      if (settings.studyDays.includes(date.getDay())) eligibleDates.push(localDateString(date));
    }

    const sessions: StudyPlanSession[] = [];
    let dayIndex = 0;
    let minutesUsed = 0;
    const unscheduledConceptNames: string[] = [];
    for (const concept of ordered) {
      const mastery = masteryFor(concept, learner);
      const estimatedMinutes = minutesFor(mastery);
      if (dayIndex >= eligibleDates.length) {
        unscheduledConceptNames.push(concept.name);
        continue;
      }
      if (minutesUsed > 0 && minutesUsed + estimatedMinutes > settings.minutesPerDay) {
        dayIndex++;
        minutesUsed = 0;
      }
      if (dayIndex >= eligibleDates.length) {
        unscheduledConceptNames.push(concept.name);
        continue;
      }
      const topic = topicById.get(concept.topicId);
      sessions.push({
        id: `${concept.id}:${eligibleDates[dayIndex]}`,
        date: eligibleDates[dayIndex],
        conceptId: concept.id,
        conceptName: concept.name,
        topicId: concept.topicId,
        topicName: topic?.name ?? 'Course review',
        estimatedMinutes,
        reason: reasonFor(mastery),
        completed: false
      });
      minutesUsed += estimatedMinutes;
    }

    return {
      id: crypto.randomUUID(),
      generatedAt: new Date().toISOString(),
      settings: { ...settings, studyDays: [...settings.studyDays] },
      sessions,
      unscheduledConceptNames
    };
  }
}

export const studyPlanService = new StudyPlanService();
