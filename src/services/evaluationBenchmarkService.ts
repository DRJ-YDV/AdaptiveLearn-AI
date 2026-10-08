import { CourseMaterialBenchmark, EvaluationCase } from '../evaluation/types';
import { DocumentChunk } from '../types/rag';

const STORAGE_PREFIX = 'adaptivelearn:pdf-benchmark:';

export class EvaluationBenchmarkService {
  async generate(sourceTitle: string, sourceId: string, chunks: DocumentChunk[]): Promise<CourseMaterialBenchmark> {
    const selected = this.sampleChunks(chunks);
    if (selected.length === 0) throw new Error('No indexed page content is available for this PDF.');
    const response = await fetch('http://localhost:3001/api/gemini/generate-evaluation-benchmark', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceTitle, sourceId, chunks: selected.map(chunk => ({
        id: chunk.id,
        location: chunk.metadata.location,
        text: chunk.text.slice(0, 2400)
      })) })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Could not generate a benchmark from this PDF.');
    const generationId = Date.now();
    const cases = (Array.isArray(payload.cases) ? payload.cases : []).flatMap((item: any, index: number): EvaluationCase[] => {
      if (typeof item.question !== 'string' || typeof item.referenceAnswer !== 'string' || !Array.isArray(item.relevantChunkIds)) return [];
      const validIds = (item.relevantChunkIds as unknown[]).filter((id: unknown): id is string => typeof id === 'string' && selected.some(chunk => chunk.id === id));
      if (!validIds.length) return [];
      return [{
        id: `${sourceId}-candidate-${generationId}-${index + 1}`,
        question: item.question.slice(0, 1000),
        type: 'SUPPORTED',
        expectedSourceIds: [sourceId],
        expectedChunkIds: [...new Set(validIds)],
        referenceAnswer: item.referenceAnswer.slice(0, 2000),
        reviewStatus: 'DRAFT'
      }];
    });
    if (cases.length < 3) throw new Error('The generator returned fewer than three verifiable questions. Try again after checking the PDF extraction.');
    const previous = this.get(sourceId);
    const keptCases = previous?.cases.filter(testCase => testCase.reviewStatus === 'APPROVED') ?? [];
    const benchmark: CourseMaterialBenchmark = { datasetName: sourceTitle, sourceTitle, sourceId, cases: [...keptCases, ...cases] };
    this.save(benchmark);
    return benchmark;
  }

  get(sourceId: string): CourseMaterialBenchmark | undefined {
    if (typeof localStorage === 'undefined') return undefined;
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${sourceId}`);
      if (!saved) return undefined;
      const parsed = JSON.parse(saved) as CourseMaterialBenchmark;
      if (parsed.sourceId !== sourceId || !Array.isArray(parsed.cases)) return undefined;
      return parsed;
    } catch { return undefined; }
  }

  save(benchmark: CourseMaterialBenchmark): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(`${STORAGE_PREFIX}${benchmark.sourceId}`, JSON.stringify(benchmark));
  }

  private sampleChunks(chunks: DocumentChunk[]): DocumentChunk[] {
    const pages = chunks.filter(chunk => /^Page\s+\d+/i.test(chunk.metadata.location));
    if (pages.length <= 40) return pages;
    return Array.from({ length: 40 }, (_, index) => pages[Math.floor(index * (pages.length - 1) / 39)]);
  }
}

export const evaluationBenchmarkService = new EvaluationBenchmarkService();
