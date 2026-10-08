export type ID = string;

export interface Source {
  id: ID;
  title: string;
  type: 'TEXTBOOK' | 'SLIDE' | 'VIDEO' | 'DOCUMENT';
  url?: string;
}

export interface SourceReference {
  id: ID;
  sourceId: ID;
  sourceType: Source['type'];
  location: string; // e.g., "Page 42", "Slide 15", "18:42"
  startTime?: number; // in seconds
  endTime?: number; // in seconds
  label: string; // Human readable
  excerpt?: string;
}

export interface Prerequisite {
  conceptId: ID;
  isHardRequirement: boolean;
}

export interface Concept {
  id: ID;
  topicId: ID;
  name: string;
  description: string;
  prerequisites: Prerequisite[];
  sourceReferences: SourceReference[];
}

export interface Topic {
  id: ID;
  courseId: ID;
  name: string;
  order: number;
  description?: string;
  sourceId?: ID;
  sourceTitle?: string;
}

export interface Course {
  id: ID;
  title: string;
  description: string;
  sources: Source[];
}

export type MasteryLevel = 'STRONG' | 'DEVELOPING' | 'WEAK' | 'NOT_STARTED';

export interface TrackedMisconception {
  misconceptionId: ID;
  conceptId: ID;
  occurrenceCount: number;
  firstDetected: string;
  lastDetected: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  resolved: boolean;
}

export interface PerformanceEvent {
  questionId: ID;
  conceptId: ID;
  difficulty: number;
  isCorrect: boolean;
  selectedOptionId?: ID;
  misconceptionId?: ID;
  masteryBefore: number;
  masteryAfter: number;
  timestamp: string;
  isDiagnostic?: boolean;
}

export interface MasteryState {
  conceptId: ID;
  masteryScore: number; // 0.0 to 1.0
  confidenceScore: number; // 0.0 to 1.0
  attempts: number;
  correct: number;
  incorrect: number;
  recentPerformance: boolean[]; // e.g. [true, false, true] (most recent last)
  consecutiveIncorrect: number;
  lastStudied?: string; // ISO Date String
  trend: 'UP' | 'DOWN' | 'STABLE';
  difficulty: number; // 0.0 to 1.0
  prerequisiteStatus: 'CLEARED' | 'BLOCKED' | 'PARTIAL' | 'WEAK' | 'UNKNOWN';
  activeMisconceptions: TrackedMisconception[];
}

export interface LearnerModel {
  userId: ID;
  courseId: ID;
  isDiagnosticComplete?: boolean;
  masteryStates: Record<ID, MasteryState>;
  history: PerformanceEvent[];
  conversationSignals?: ConversationLearningSignal[];
}

export interface ConversationLearningSignal {
  conceptId: ID;
  understood: boolean;
  timestamp: string;
}

export interface TutorResponse {
  id: ID;
  answer: string;
  conceptId?: ID;
  topicId?: ID;
  confidence: number;
  evidence: SourceReference[];
  grounded: boolean;
  unsupportedReason?: string;
  suggestedActions?: {
    type: 'PRACTICE' | 'VIEW_MAP' | 'REVIEW_PREREQ' | 'FOLLOW_UP';
    label: string;
    targetId?: ID;
  }[];
}

export interface TutorMessage {
  id: ID;
  role: 'USER' | 'TUTOR';
  content: string;
  timestamp: string;
  responseMetadata?: TutorResponse;
}

export interface Misconception {
  id: ID;
  conceptId: ID;
  description: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface QuestionOption {
  id: ID;
  text: string;
  isCorrect: boolean;
  misconceptionId?: ID; // if chosen, flags this misconception
}

export interface Question {
  id: ID;
  type: 'MCQ' | 'SHORT_ANSWER' | 'NUMERICAL';
  prompt: string;
  options?: QuestionOption[];
  correctAnswer?: string;
  answerKeywords?: string[];
  answerTolerance?: number;
  explanation: string;
  conceptId: ID;
  topicId: ID;
  difficulty: number; // 0.0 to 1.0
  sourceReferences: SourceReference[];
  tags: string[];
}

export interface QuestionAttempt {
  questionId: ID;
  isCorrect: boolean;
  selectedOptionId?: ID;
  timestamp: string;
  masteryChange: number; // e.g. +0.05 or -0.05
}

export interface AssessmentAttempt {
  id: ID;
  courseId: ID;
  userId: ID;
  scope: 'COURSE' | 'TOPIC' | 'CONCEPT';
  scopeId?: ID;
  startTime: string;
  endTime?: string;
  questionsAttempted: QuestionAttempt[];
  detectedMisconceptions: ID[];
}
