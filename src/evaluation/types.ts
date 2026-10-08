export interface MetricResult {
  name: string;
  value: number; // 0 to 1 percentage, or raw score
  formattedValue: string; // e.g. "94%"
  sampleSize: number;
  description: string;
}

export interface EvaluationCase {
  id: string;
  question: string;
  type: 'SUPPORTED' | 'UNSUPPORTED' | 'PREREQUISITE' | 'MULTI_CONCEPT';
  expectedConceptId?: string;
  expectedSourceIds?: string[];
  expectedChunkIds?: string[];
  referenceAnswer?: string;
  reviewStatus?: 'DRAFT' | 'APPROVED';
}

export interface CourseMaterialBenchmark {
  datasetName: string;
  sourceTitle: string;
  sourceId: string;
  cases: EvaluationCase[];
}

export interface RAGEvaluation {
  metrics: MetricResult[];
}

export interface RetrievalEvaluation {
  metrics: MetricResult[];
}

export interface AssessmentEvaluation {
  metrics: MetricResult[];
}

export interface AdaptationEvaluation {
  metrics: MetricResult[];
}

export interface MasterySimulationEvaluation {
  metrics: MetricResult[];
}

export interface EvaluationReport {
  timestamp: string;
  rag: RAGEvaluation;
  retrieval: RetrievalEvaluation;
  assessment: AssessmentEvaluation;
  adaptation: AdaptationEvaluation;
  mastery: MasterySimulationEvaluation;
  diagnostic?: Record<string, boolean>;
  persistence?: Record<string, boolean>;
  reliability?: Record<string, boolean>;
  endToEnd?: any;
  courseMaterial?: CourseMaterialEvaluation;
}

export interface ExtractionPageLabel {
  unitId: string;
  expectedConcepts: string[] | null;
  expectedPrerequisites?: Array<{ concept: string; prerequisite: string }> | null;
  expectedTextPresent: boolean | null;
  expectedVisualDescriptionPresent?: boolean | null;
  visualDescriptionAccurate: boolean | null;
}

export interface ExtractionReviewDataset {
  datasetName: string;
  sourceTitle: string;
  sourceId: string;
  reviewStatus: 'HUMAN_REVIEWED';
  reviewedBy: string;
  pages: ExtractionPageLabel[];
}

export interface CourseMaterialEvaluation {
  datasetName: string;
  reviewStatus: string;
  corpusChunkCount: number;
  retrieval: RetrievalEvaluation;
  rag: RAGEvaluation;
  extraction: MetricResult[];
  ragasDataset: Array<{ question: string; reference: string; response: string; retrieved_contexts: string[] }>;
  caseCount: number;
}
