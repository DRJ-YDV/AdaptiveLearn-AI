import { ID } from './domain';

export interface ChunkMetadata {
  courseId?: ID;
  sourceId: ID;
  sourceTitle: string;
  sourceType: 'TEXTBOOK' | 'SLIDE' | 'VIDEO' | 'DOCUMENT';
  location: string;
  topicId?: ID;
  conceptId?: ID;
  startTime?: number;
  endTime?: number;
  topicName?: string;
  concepts?: string[];
  prerequisiteRelations?: Array<{ concept: string; prerequisite: string }>;
}

export interface DocumentChunk {
  id: ID;
  text: string;
  metadata: ChunkMetadata;
}

export interface RetrievalResult {
  chunk: DocumentChunk;
  score: number; // 0.0 to 1.0 similarity
}

export interface RetrievalQuery {
  text: string;
  topK: number;
  minSimilarity: number;
  courseId?: ID;
  sourceIds?: ID[];
}

export interface RetrievalResponse {
  query: string;
  results: RetrievalResult[];
  status: 'SUCCESS' | 'NO_RELEVANT_CONTEXT';
}

export interface GroundingResult {
  isGrounded: boolean;
  unsupportedReason?: string;
  usedChunks: DocumentChunk[];
}

export interface LLMResponse {
  answer: string;
  groundingResult: GroundingResult;
  suggestedConceptId?: ID;
}
