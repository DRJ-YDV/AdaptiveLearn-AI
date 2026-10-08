import { ID } from './domain';

export type ContentLocationType = 'page' | 'slide' | 'timestamp' | 'section';

export interface ContentLocation {
  type: ContentLocationType;
  page?: number;
  slide?: number;
  timestamp?: string; // e.g., "00:12:43"
  startTime?: number; // in seconds
  endTime?: number; // in seconds
  section?: string;
}

export interface ContentUnit {
  id: ID;
  courseId?: ID;
  documentId: ID;
  sourceTitle: string;
  sourceType: 'TEXTBOOK' | 'SLIDE' | 'VIDEO' | 'DOCUMENT';
  text: string;
  concepts?: string[];
  prerequisiteRelations?: Array<{ concept: string; prerequisite: string }>;
  topicName?: string;
  location: ContentLocation;
  topicId?: ID;
  conceptId?: ID;
}

export type IngestionStatus = 'PENDING' | 'EXTRACTING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';

export interface IngestionResult {
  status: IngestionStatus;
  documentId: ID;
  sourceTitle: string;
  contentUnits: ContentUnit[];
  error?: string;
  benchmarkCaseCount?: number;
  benchmarkError?: string;
}

export interface IngestionJob {
  id: ID;
  status: IngestionStatus;
  files: File[];
  progress: number; // 0 to 100
  results: IngestionResult[];
  detail?: string;
}
