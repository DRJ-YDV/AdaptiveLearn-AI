import { RetrievalQuery, RetrievalResponse } from '../../types/rag';
import { IEmbeddingProvider } from './embeddingProvider';
import { IVectorStore } from './vectorStore';

export class Retriever {
  constructor(
    private embeddingProvider: IEmbeddingProvider,
    private vectorStore: IVectorStore
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievalResponse> {
    const queryVector = await this.embeddingProvider.embedText(query.text);
    const filter = query.courseId ? { courseId: query.courseId, sourceIds: query.sourceIds } : undefined;
    const results = await this.vectorStore.search(queryVector, query.topK, filter);
    
    // Filter by minSimilarity threshold
    const filteredResults = results.filter(r => r.score >= query.minSimilarity);
    
    return {
      query: query.text,
      results: filteredResults,
      status: filteredResults.length > 0 ? 'SUCCESS' : 'NO_RELEVANT_CONTEXT'
    };
  }
}
