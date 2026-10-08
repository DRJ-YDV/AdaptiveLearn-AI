import { ragBenchmarkDataset } from '../datasets/ragBenchmark';
import { CourseMaterialBenchmark, CourseMaterialEvaluation, ExtractionReviewDataset, MetricResult, RAGEvaluation, RetrievalEvaluation } from '../types';
import { demoDocumentChunks } from '../../data/demoChunks';
import { RAGTutorService } from '../../services/ragTutorService';
import { InMemoryVectorStore } from '../../services/rag/vectorStore';
import { Retriever } from '../../services/rag/retriever';
import { MockLLMProvider } from '../../services/rag/llmProvider';
import { GeminiLLMProvider } from '../../services/rag/geminiLLMProvider';
import { IEmbeddingProvider } from '../../services/rag/embeddingProvider';
import { DocumentChunk } from '../../types/rag';

class DeterministicEmbeddingProvider implements IEmbeddingProvider {
  private embed(text: string): number[] {
    const vector = Array(128).fill(0) as number[];
    for (const token of text.toLocaleLowerCase().match(/[a-z0-9]+/g) ?? []) {
      let hash = 2166136261;
      for (const char of token) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
      vector[(hash >>> 0) % vector.length] += 1;
    }
    return vector;
  }

  async embedText(text: string): Promise<number[]> {
    return this.embed(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(text => this.embed(text));
  }
}

export class RAGEvaluator {
  private async createTutor(chunks: DocumentChunk[] = demoDocumentChunks) {
    const embeddings = new DeterministicEmbeddingProvider();
    const vectorStore = new InMemoryVectorStore(embeddings);
    const retriever = new Retriever(embeddings, vectorStore);
    await vectorStore.add(chunks.map(chunk => ({
      ...chunk,
      metadata: { ...chunk.metadata, courseId: 'course_ml_101' }
    })));
    const llm = import.meta.env.VITE_LLM_PROVIDER === 'gemini' ? new GeminiLLMProvider() : new MockLLMProvider();
    return { retriever, tutor: new RAGTutorService(retriever, llm) };
  }

  async runCourseMaterialEvaluation(benchmark?: CourseMaterialBenchmark, extractionReview?: ExtractionReviewDataset): Promise<CourseMaterialEvaluation> {
    let chunkData: { chunks?: DocumentChunk[] } = {};
    try {
      const response = await fetch('http://localhost:3001/api/vector/chunks?courseId=course_ml_101');
      if (response.ok) chunkData = await response.json() as { chunks?: DocumentChunk[] };
    } catch { /* Show N/A for this corpus when the local backend is unavailable. */ }
    const courseChunks = benchmark ? (chunkData.chunks ?? []).filter(chunk => chunk.metadata?.sourceId === benchmark.sourceId) : [];
    const cases = benchmark?.cases ?? [];
    const datasetName = benchmark?.datasetName ?? 'No PDF benchmark selected';
    if (!benchmark || cases.length === 0) {
      const pending = (name: string, description: string): MetricResult => ({ name, value: 0, formattedValue: 'Pending', sampleSize: 0, description });
      return {
        datasetName, reviewStatus: 'Select a PDF with a reviewed benchmark on the Evaluation page.', corpusChunkCount: courseChunks.length, caseCount: 0,
        retrieval: { metrics: [pending('Retrieval benchmark', 'Generate and review source-grounded questions before measuring retrieval.')] },
        rag: { metrics: [pending('RAG answer benchmark', 'Generate and review source-grounded questions before measuring answers.')] },
        extraction: [pending('Extraction review', 'Download and complete the page-level extraction review template for the selected PDF.')],
        ragasDataset: []
      };
    }
    if (!courseChunks.length) {
      const unavailable = (name: string): MetricResult => ({ name, value: 0, formattedValue: 'N/A', sampleSize: 0, description: `No indexed passages were found for ${benchmark.sourceTitle}. Re-upload this PDF and regenerate its benchmark.` });
      return {
        datasetName, reviewStatus: 'The PDF benchmark exists, but this source is no longer indexed.', corpusChunkCount: 0, caseCount: cases.length,
        retrieval: { metrics: [unavailable('Retrieval benchmark')] },
        rag: { metrics: [unavailable('RAG answer benchmark')] },
        extraction: [unavailable('Extraction review')], ragasDataset: []
      };
    }
    const corpus = courseChunks;
    const { retriever, tutor } = await this.createTutor(corpus);
    const retrievalCases = cases.filter(testCase => testCase.type !== 'UNSUPPORTED' && (testCase.expectedChunkIds?.length ?? 0) > 0);
    let hitCount = 0;
    let precisionSum = 0;
    let recallSum = 0;
    let apSum = 0;
    for (const testCase of retrievalCases) {
      const relevantIds = testCase.expectedChunkIds ?? [];
      const result = await retriever.retrieve({ text: testCase.question, courseId: 'course_ml_101', topK: 3, minSimilarity: 0.15 });
      const ids = result.results.map(item => item.chunk.id);
      const relevant = ids.map(id => relevantIds.includes(id));
      const hits = relevant.filter(Boolean).length;
      if (hits > 0) hitCount++;
      precisionSum += hits / 3;
      recallSum += hits / relevantIds.length;
      let found = 0;
      let averagePrecision = 0;
      relevant.forEach((isRelevant, rank) => {
        if (isRelevant) averagePrecision += (++found) / (rank + 1);
      });
      apSum += averagePrecision / relevantIds.length;
    }
    const n = retrievalCases.length;
    const metric = (name: string, value: number, sampleSize: number, description: string): MetricResult => ({ name, value, formattedValue: sampleSize ? `${Math.round(value * 100)}%` : 'N/A', sampleSize, description });
    const retrieval: RetrievalEvaluation = { metrics: [
      metric('Hit Rate@3', n ? hitCount / n : 0, n, 'Share of supported questions with at least one gold passage in the top three.'),
      metric('Context Precision@3', n ? precisionSum / n : 0, n, 'Relevant retrieved passages divided by three result slots, using exact labeled page IDs.'),
      metric('Context Recall@3', n ? recallSum / n : 0, n, 'Gold pages found divided by all gold pages per question.'),
      metric('Mean Average Precision@3', n ? apSum / n : 0, n, 'Rank-sensitive score using exact gold page IDs.')
    ] };

    let supported = 0;
    let cited = 0;
    let rejected = 0;
    let unsupported = 0;
    const judgeCases: Array<{ id: string; question: string; answer: string; referenceAnswer: string; contexts: string[] }> = [];
    const ragasDataset: CourseMaterialEvaluation['ragasDataset'] = [];
    let lexicalFaithfulness = 0;
    let lexicalRelevancy = 0;
    for (const testCase of cases) {
      const answer = await tutor.ask(testCase.question, { userId: 'evaluation', courseId: 'course_ml_101' });
      if (testCase.type === 'UNSUPPORTED') {
        unsupported++;
        if (!answer.grounded && answer.unsupportedReason) rejected++;
        continue;
      }
      supported++;
      if (answer.grounded && answer.evidence.some(evidence => testCase.expectedSourceIds?.includes(evidence.sourceId))) cited++;
      const contexts = answer.evidence.map(evidence => evidence.excerpt ?? '').filter(Boolean);
      const answerTokens = answer.answer.toLocaleLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
      const allEvidence = contexts.join(' ').toLocaleLowerCase();
      lexicalFaithfulness += answerTokens.length ? answerTokens.filter(token => allEvidence.includes(token)).length / answerTokens.length : 0;
      const questionTokens = testCase.question.toLocaleLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
      lexicalRelevancy += questionTokens.length ? questionTokens.filter(token => answer.answer.toLocaleLowerCase().includes(token)).length / questionTokens.length : 0;
      judgeCases.push({ id: testCase.id, question: testCase.question, answer: answer.answer, referenceAnswer: testCase.referenceAnswer ?? '', contexts });
      if (testCase.referenceAnswer) ragasDataset.push({ question: testCase.question, reference: testCase.referenceAnswer, response: answer.answer, retrieved_contexts: contexts });
    }
    let judgeFaith = 0;
    let judgeRelevant = 0;
    let judgeN = 0;
    try {
      const judged = await fetch('http://localhost:3001/api/gemini/evaluate-rag', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cases: judgeCases }) });
      if (judged.ok) for (const row of ((await judged.json()).evaluations ?? [])) {
        if (!Number.isFinite(row.faithfulness) || !Number.isFinite(row.answerRelevancy)) continue;
        judgeFaith += row.faithfulness; judgeRelevant += row.answerRelevancy; judgeN++;
      }
    } catch { /* The report will show N/A if the optional judge is not configured. */ }
    const rag: RAGEvaluation = { metrics: [
      metric('Unsupported Query Rejection Rate', unsupported ? rejected / unsupported : 0, unsupported, 'Share of out-of-scope questions correctly refused.'),
      metric('Citation Accuracy', supported ? cited / supported : 0, supported, 'Share of answerable questions citing the expected source document.'),
      metric('Faithfulness (lexical proxy)', supported ? lexicalFaithfulness / supported : 0, supported, 'Deterministic lexical overlap proxy; interpret alongside reviewed examples.'),
      metric('Answer Relevancy (lexical proxy)', supported ? lexicalRelevancy / supported : 0, supported, 'Deterministic keyword overlap proxy; interpret alongside reviewed examples.'),
      { name: 'Faithfulness (LLM judge)', value: judgeN ? judgeFaith / judgeN : 0, formattedValue: judgeN ? `${Math.round(judgeFaith / judgeN * 100)}%` : 'N/A', sampleSize: judgeN, description: 'Gemini judge estimate against retrieved excerpts; compare with human review.' },
      { name: 'Answer Relevancy (LLM judge)', value: judgeN ? judgeRelevant / judgeN : 0, formattedValue: judgeN ? `${Math.round(judgeRelevant / judgeN * 100)}%` : 'N/A', sampleSize: judgeN, description: 'Gemini judge estimate against the question and reference answer; compare with human review.' }
    ] };
    const extraction = this.evaluateExtractionReview(extractionReview, courseChunks, benchmark);
    return { datasetName, reviewStatus: `Approved benchmark cases: ${cases.length} · Extraction labels: ${extractionReview ? 'human review supplied' : 'pending'}`, corpusChunkCount: courseChunks.length, caseCount: cases.length, retrieval, rag, extraction, ragasDataset };
  }

  private evaluateExtractionReview(review: ExtractionReviewDataset | undefined, chunks: DocumentChunk[], benchmark: CourseMaterialBenchmark): MetricResult[] {
    if (!review || review.reviewStatus !== 'HUMAN_REVIEWED' || review.datasetName !== benchmark.datasetName || review.sourceTitle !== benchmark.sourceTitle || review.sourceId !== benchmark.sourceId) {
      return [{ name: 'Extraction review status', value: 0, formattedValue: 'Pending human labels', sampleSize: 0, description: 'Download the page review template, compare every page with the original PDF, and import it after completing the expected fields.' }];
    }
    const byId = new Map(chunks.map(chunk => [chunk.id, chunk]));
    if (!review.pages.some(page => byId.has(page.unitId))) {
      return [{ name: 'Extraction review status', value: 0, formattedValue: 'Stale labels', sampleSize: 0, description: 'The review file does not match current indexed page IDs. Download a fresh template and review the current ingestion.' }];
    }
    let conceptTp = 0, conceptFp = 0, conceptFn = 0, prereqTp = 0, prereqFp = 0, prereqFn = 0, textChecked = 0, textCorrect = 0, visualChecked = 0, visualCorrect = 0, visualQualityChecked = 0, visualQualityCorrect = 0;
    for (const page of review.pages) {
      const chunk = byId.get(page.unitId);
      if (!chunk) continue;
      if (page.expectedConcepts) {
        const expected = new Set(page.expectedConcepts.map(value => value.toLocaleLowerCase().trim()));
        const actual = new Set((chunk.metadata.concepts ?? []).map(value => value.toLocaleLowerCase().trim()));
        for (const value of actual) {
          if (expected.has(value)) conceptTp++;
          else conceptFp++;
        }
        for (const value of expected) if (!actual.has(value)) conceptFn++;
      }
      if (page.expectedPrerequisites) {
        const key = (edge: { concept: string; prerequisite: string }) => `${edge.concept.toLocaleLowerCase().trim()}\u0000${edge.prerequisite.toLocaleLowerCase().trim()}`;
        const expected = new Set(page.expectedPrerequisites.map(key));
        const actual = new Set((chunk.metadata.prerequisiteRelations ?? []).map(key));
        for (const edge of actual) {
          if (expected.has(edge)) prereqTp++;
          else prereqFp++;
        }
        for (const edge of expected) if (!actual.has(edge)) prereqFn++;
      }
      if (page.expectedTextPresent !== null) { textChecked++; if ((chunk.text.trim().length > 0) === page.expectedTextPresent) textCorrect++; }
      if (page.expectedVisualDescriptionPresent != null) { visualChecked++; if (chunk.text.includes('[Visual Content]') === page.expectedVisualDescriptionPresent) visualCorrect++; }
      if (page.visualDescriptionAccurate != null) { visualQualityChecked++; if (page.visualDescriptionAccurate) visualQualityCorrect++; }
    }
    const precision = conceptTp + conceptFp ? conceptTp / (conceptTp + conceptFp) : 0;
    const recall = conceptTp + conceptFn ? conceptTp / (conceptTp + conceptFn) : 0;
    const f1 = precision + recall ? 2 * precision * recall / (precision + recall) : 0;
    const prereqPrecision = prereqTp + prereqFp ? prereqTp / (prereqTp + prereqFp) : 0;
    const prereqRecall = prereqTp + prereqFn ? prereqTp / (prereqTp + prereqFn) : 0;
    const prereqF1 = prereqPrecision + prereqRecall ? 2 * prereqPrecision * prereqRecall / (prereqPrecision + prereqRecall) : 0;
    return [
      { name: 'Concept extraction precision', value: precision, formattedValue: conceptTp + conceptFp ? `${Math.round(precision * 100)}%` : 'N/A', sampleSize: conceptTp + conceptFp + conceptFn, description: 'Exact normalized concept-name precision against independently reviewed page labels.' },
      { name: 'Concept extraction recall', value: recall, formattedValue: conceptTp + conceptFn ? `${Math.round(recall * 100)}%` : 'N/A', sampleSize: conceptTp + conceptFp + conceptFn, description: 'Exact normalized concept-name recall against independently reviewed page labels.' },
      { name: 'Concept extraction F1', value: f1, formattedValue: conceptTp + conceptFp + conceptFn ? `${Math.round(f1 * 100)}%` : 'N/A', sampleSize: conceptTp + conceptFp + conceptFn, description: 'Harmonic mean of exact concept precision and recall.' },
      { name: 'Prerequisite relation precision', value: prereqPrecision, formattedValue: prereqTp + prereqFp ? `${Math.round(prereqPrecision * 100)}%` : 'N/A', sampleSize: prereqTp + prereqFp + prereqFn, description: 'Exact relation precision against independently reviewed prerequisite edges.' },
      { name: 'Prerequisite relation recall', value: prereqRecall, formattedValue: prereqTp + prereqFn ? `${Math.round(prereqRecall * 100)}%` : 'N/A', sampleSize: prereqTp + prereqFp + prereqFn, description: 'Exact relation recall against independently reviewed prerequisite edges.' },
      { name: 'Prerequisite relation F1', value: prereqF1, formattedValue: prereqTp + prereqFp + prereqFn ? `${Math.round(prereqF1 * 100)}%` : 'N/A', sampleSize: prereqTp + prereqFp + prereqFn, description: 'Harmonic mean of exact prerequisite precision and recall.' },
      { name: 'Page text presence accuracy', value: textChecked ? textCorrect / textChecked : 0, formattedValue: textChecked ? `${Math.round(textCorrect / textChecked * 100)}%` : 'N/A', sampleSize: textChecked, description: 'Accuracy for manually labeled whether a page contains extractable text.' },
      { name: 'Visual description coverage accuracy', value: visualChecked ? visualCorrect / visualChecked : 0, formattedValue: visualChecked ? `${Math.round(visualCorrect / visualChecked * 100)}%` : 'N/A', sampleSize: visualChecked, description: 'Agreement between manually labeled pages that should contain a visual description and extracted visual-description markers.' },
      { name: 'Visual description human approval rate', value: visualQualityChecked ? visualQualityCorrect / visualQualityChecked : 0, formattedValue: visualQualityChecked ? `${Math.round(visualQualityCorrect / visualQualityChecked * 100)}%` : 'N/A', sampleSize: visualQualityChecked, description: 'Share of manually reviewed visual descriptions judged accurate; report only after inspecting the original figures.' }
    ];
  }

  async runRetrievalEvaluation(): Promise<RetrievalEvaluation> {
    const { retriever } = await this.createTutor();
    let hitRateCount = 0;
    let totalSupported = 0;
    let precisionAtFiveSum = 0;
    let recallAtFiveSum = 0;
    let averagePrecisionSum = 0;

    for (const testCase of ragBenchmarkDataset) {
      if (testCase.type === 'UNSUPPORTED') continue;
      totalSupported++;
      const results = await retriever.retrieve({
        text: testCase.question,
        courseId: 'course_ml_101',
        topK: 3,
        minSimilarity: 0.15
      });

      const relevantIds = testCase.expectedChunkIds ?? [];
      if (!relevantIds.length) continue;
      const relevantAtRanks = results.results.map(result => relevantIds.includes(result.chunk.id));
      const hits = relevantAtRanks.filter(Boolean).length;
      if (hits > 0) hitRateCount++;
      precisionAtFiveSum += hits / 3;
      recallAtFiveSum += hits / relevantIds.length;
      let seenRelevant = 0;
      let precisionAtRelevantRanks = 0;
      relevantAtRanks.forEach((relevant, rank) => {
        if (relevant) {
          seenRelevant++;
          precisionAtRelevantRanks += seenRelevant / (rank + 1);
        }
      });
      averagePrecisionSum += precisionAtRelevantRanks / relevantIds.length;
    }

    const hitRate = totalSupported ? hitRateCount / totalSupported : 0;
    const recall = totalSupported ? recallAtFiveSum / totalSupported : 0;
    const precision = totalSupported ? precisionAtFiveSum / totalSupported : 0;
    const meanAveragePrecision = totalSupported ? averagePrecisionSum / totalSupported : 0;
    return {
      metrics: [
        { name: 'Hit Rate@3', value: hitRate, formattedValue: `${Math.round(hitRate * 100)}%`, sampleSize: totalSupported, description: 'Percentage of supported benchmark questions where at least one expected passage was retrieved in the top three.' },
        { name: 'Context Precision@3', value: precision, formattedValue: `${Math.round(precision * 100)}%`, sampleSize: totalSupported, description: 'Relevant retrieved passages divided by three result slots; relevance is labeled by exact gold chunk id.' },
        { name: 'Context Recall@3', value: recall, formattedValue: `${Math.round(recall * 100)}%`, sampleSize: totalSupported, description: 'Relevant gold passages retrieved divided by all gold-relevant passages for each question, averaged over supported cases.' },
        { name: 'Mean Average Precision@3', value: meanAveragePrecision, formattedValue: `${Math.round(meanAveragePrecision * 100)}%`, sampleSize: totalSupported, description: 'Rank-sensitive retrieval score computed from exact gold chunk relevance labels.' }
      ]
    };
  }

  async runRAGEvaluation(): Promise<RAGEvaluation> {
    const { tutor } = await this.createTutor();
    let unsupportedCorrectlyRejected = 0;
    let totalUnsupported = 0;
    let totalSupported = 0;
    let validCitations = 0;
    let faithfulness = 0;
    let answerRelevancy = 0;
    const judgeCases: Array<{ id: string; question: string; answer: string; referenceAnswer: string; contexts: string[] }> = [];
    const stopWords = new Set(['what', 'which', 'where', 'when', 'does', 'this', 'that', 'with', 'from', 'about', 'explain', 'describe', 'tell', 'the', 'and', 'for', 'are', 'is', 'how', 'who', 'can', 'you', 'use', 'used']);

    for (const testCase of ragBenchmarkDataset) {
      const response = await tutor.ask(testCase.question, { userId: 'evaluation', courseId: 'course_ml_101' });
      if (testCase.type === 'UNSUPPORTED') {
        totalUnsupported++;
        if (!response.grounded && response.unsupportedReason) unsupportedCorrectlyRejected++;
        continue;
      }

      totalSupported++;
      if (response.grounded && testCase.expectedSourceIds && response.evidence.some(evidence => testCase.expectedSourceIds?.includes(evidence.sourceId))) {
        validCitations++;
      }
      const answerTerms = response.answer.toLocaleLowerCase().match(/[a-z0-9]+/g)?.filter(term => term.length > 3 && !stopWords.has(term)) ?? [];
      const evidenceText = response.evidence.map(evidence => evidence.excerpt ?? '').join(' ').toLocaleLowerCase();
      faithfulness += answerTerms.length ? answerTerms.filter(term => evidenceText.includes(term)).length / answerTerms.length : 0;
      const questionTerms = testCase.question.toLocaleLowerCase().match(/[a-z0-9]+/g)?.filter(term => term.length > 3 && !stopWords.has(term)) ?? [];
      answerRelevancy += questionTerms.length ? questionTerms.filter(term => response.answer.toLocaleLowerCase().includes(term)).length / questionTerms.length : 0;
      judgeCases.push({ id: testCase.id, question: testCase.question, answer: response.answer, referenceAnswer: testCase.referenceAnswer ?? '', contexts: response.evidence.map(evidence => evidence.excerpt ?? '').filter(Boolean).slice(0, 5) });
    }

    let judgeFaithfulness = 0;
    let judgeAnswerRelevancy = 0;
    let judgeSampleSize = 0;
    try {
      const judgeResponse = await fetch('http://localhost:3001/api/gemini/evaluate-rag', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cases: judgeCases })
      });
      if (judgeResponse.ok) {
        const result = await judgeResponse.json();
        for (const row of result.evaluations ?? []) {
          if (!Number.isFinite(row.faithfulness) || !Number.isFinite(row.answerRelevancy)) continue;
          judgeFaithfulness += row.faithfulness;
          judgeAnswerRelevancy += row.answerRelevancy;
          judgeSampleSize++;
        }
      }
    } catch { /* The deterministic suite stays usable without the optional Gemini judge. */ }

    const rejectionRate = totalUnsupported ? unsupportedCorrectlyRejected / totalUnsupported : 0;
    const citationAccuracy = totalSupported ? validCitations / totalSupported : 0;
    return {
      metrics: [
        { name: 'Unsupported Query Rejection Rate', value: rejectionRate, formattedValue: `${Math.round(rejectionRate * 100)}%`, sampleSize: totalUnsupported, description: 'Share of unsupported benchmark queries correctly rejected.' },
        { name: 'Citation Accuracy (Deterministic)', value: citationAccuracy, formattedValue: `${Math.round(citationAccuracy * 100)}%`, sampleSize: totalSupported, description: 'Share of supported queries that cite an expected source.' },
        { name: 'Faithfulness (lexical proxy)', value: totalSupported ? faithfulness / totalSupported : 0, formattedValue: `${Math.round((totalSupported ? faithfulness / totalSupported : 0) * 100)}%`, sampleSize: totalSupported, description: 'Share of answer content terms present in cited excerpts. Deterministic lexical proxy; it does not replace human or RAGAS evaluation.' },
        { name: 'Answer Relevancy (lexical proxy)', value: totalSupported ? answerRelevancy / totalSupported : 0, formattedValue: `${Math.round((totalSupported ? answerRelevancy / totalSupported : 0) * 100)}%`, sampleSize: totalSupported, description: 'Share of question keywords present in the answer. Deterministic lexical proxy; it does not replace human or RAGAS evaluation.' }
        ,{ name: 'Faithfulness (LLM judge)', value: judgeSampleSize ? judgeFaithfulness / judgeSampleSize : 0, formattedValue: judgeSampleSize ? `${Math.round((judgeFaithfulness / judgeSampleSize) * 100)}%` : 'N/A', sampleSize: judgeSampleSize, description: 'Gemini judge rates whether answer claims are supported by retrieved excerpts. N/A means the Gemini evaluation endpoint was unavailable.' }
        ,{ name: 'Answer Relevancy (LLM judge)', value: judgeSampleSize ? judgeAnswerRelevancy / judgeSampleSize : 0, formattedValue: judgeSampleSize ? `${Math.round((judgeAnswerRelevancy / judgeSampleSize) * 100)}%` : 'N/A', sampleSize: judgeSampleSize, description: 'Gemini judge rates how directly each answer addresses its question, using the benchmark reference answer.' }
      ]
    };
  }
}
