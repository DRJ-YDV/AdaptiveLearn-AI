import { DocumentChunk } from '../../types/rag';
import { IEmbeddingProvider, Vector } from './embeddingProvider';

export interface IVectorStore {
  add(chunks: DocumentChunk[]): Promise<void>;
  search(queryVector: Vector, topK: number, filter?: { courseId?: string; sourceIds?: string[] }): Promise<{ chunk: DocumentChunk; score: number }[]>;
  clear(): Promise<void>;
  removeSource?(courseId: string, sourceTitle: string, keepSourceId: string): Promise<void>;
}

export class InMemoryVectorStore implements IVectorStore {
  private chunks: DocumentChunk[] = [];
  private vectors: Vector[] = [];

  constructor(private embeddingProvider: IEmbeddingProvider) {}

  async add(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;
    
    const embeddings = await this.embeddingProvider.embedDocuments(chunks.map(c => c.text));
    if (embeddings.length !== chunks.length) {
      throw new Error(`Expected ${chunks.length} embeddings, received ${embeddings.length}.`);
    }
    chunks.forEach((chunk, index) => {
      const existingIndex = this.chunks.findIndex(existing => existing.id === chunk.id);
      if (existingIndex === -1) {
        this.chunks.push(chunk);
        this.vectors.push(embeddings[index]);
      } else {
        this.chunks[existingIndex] = chunk;
        this.vectors[existingIndex] = embeddings[index];
      }
    });
  }

  async search(queryVector: Vector, topK: number, filter?: { courseId?: string; sourceIds?: string[] }): Promise<{ chunk: DocumentChunk; score: number }[]> {
    if (this.chunks.length === 0) return [];

    const results = this.vectors.map((vec, idx) => {
      const score = this.cosineSimilarity(queryVector, vec);
      return { chunk: this.chunks[idx], score };
    }).filter(res => {
      if (!filter) return true;
      const chunkCourseId = res.chunk.metadata.courseId;
      if (filter.courseId && chunkCourseId !== filter.courseId) return false;
      return !filter.sourceIds?.length || filter.sourceIds.includes(res.chunk.metadata.sourceId);
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  async clear(): Promise<void> {
    this.chunks = [];
    this.vectors = [];
  }

  async removeSource(courseId: string, sourceTitle: string, keepSourceId: string): Promise<void> {
    const keep: Array<{ chunk: DocumentChunk; vector: Vector }> = [];
    this.chunks.forEach((chunk, index) => {
      const matches = chunk.metadata.courseId === courseId
        && chunk.metadata.sourceTitle === sourceTitle
        && chunk.metadata.sourceId !== keepSourceId;
      if (!matches) keep.push({ chunk, vector: this.vectors[index] });
    });
    this.chunks = keep.map(item => item.chunk);
    this.vectors = keep.map(item => item.vector);
  }

  private cosineSimilarity(vecA: Vector, vecB: Vector): number {
    if (vecA.length === 0 || vecA.length !== vecB.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
