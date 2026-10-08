import { CourseMaterialBenchmark, EvaluationReport, ExtractionReviewDataset } from './types';
import { RAGEvaluator } from './evaluators/ragEvaluator';
import { AssessmentEvaluator } from './evaluators/assessmentEvaluator';
import { MasteryEvaluator } from './evaluators/masteryEvaluator';
import { DiagnosticEvaluator } from './evaluators/diagnosticEvaluator';
import { PersistenceEvaluator } from './evaluators/persistenceEvaluator';
import { ReliabilityEvaluator } from './evaluators/reliabilityEvaluator';
import { EndToEndEvaluator } from './evaluators/endToEndEvaluator';
import { learnerModelService, MemoryLearnerStateStore } from '../services/learnerModelService';

export class EvaluationRunner {
  async runAll(extractionReview?: ExtractionReviewDataset, courseBenchmark?: CourseMaterialBenchmark): Promise<EvaluationReport & { diagnostic?: any, persistence?: any, reliability?: any, endToEnd?: any }> {
    const originalLearnerStore = learnerModelService.getStore();
    learnerModelService.setStore(new MemoryLearnerStateStore());
    try {
    const ragEval = new RAGEvaluator();
    const assessEval = new AssessmentEvaluator();
    const masteryEval = new MasteryEvaluator();
    const diagEval = new DiagnosticEvaluator();
    const persEval = new PersistenceEvaluator();
    const relEval = new ReliabilityEvaluator();
    const e2eEval = new EndToEndEvaluator();

    const retrievalResults = await ragEval.runRetrievalEvaluation();
    const ragResults = await ragEval.runRAGEvaluation();
    const courseMaterial = await ragEval.runCourseMaterialEvaluation(courseBenchmark, extractionReview);
    
    const assessmentResults = await assessEval.runEvaluation();
    const simResults = await masteryEval.runSimulation();
    const diagnosticResults = await diagEval.runDiagnosticTests();
    const persistenceResults = await persEval.runPersistenceTests();
    const reliabilityResults = await relEval.runReliabilityTests();
    const endToEndResults = await e2eEval.runEndToEndTests();

    return {
      timestamp: new Date().toISOString(),
      rag: ragResults,
      retrieval: retrievalResults,
      assessment: assessmentResults,
      adaptation: simResults.adaptation,
      mastery: simResults.mastery,
      diagnostic: diagnosticResults,
      persistence: persistenceResults,
      reliability: reliabilityResults,
      endToEnd: endToEndResults,
      courseMaterial
    };
    } finally {
      learnerModelService.setStore(originalLearnerStore);
    }
  }
}

export const evaluationRunner = new EvaluationRunner();
