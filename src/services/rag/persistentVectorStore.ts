import { DocumentChunk } from '../../types/rag';
import { Vector, IEmbeddingProvider } from './embeddingProvider';
import { IVectorStore } from './vectorStore';

export class PersistentVectorStore implements IVectorStore {
  private apiUrl = 'http://localhost:3001/api/vector';

  constructor(private embeddingProvider: IEmbeddingProvider) {}

  async add(chunks: DocumentChunk[]): Promise<void> {
    if (chunks.length === 0) return;

    const containsResponse = await fetch(`${this.apiUrl}/contains`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: chunks.map(chunk => chunk.id) })
    });
    if (!containsResponse.ok) throw new Error('Failed to check the persistent index before adding chunks.');
    const existingIds = new Set<string>((await containsResponse.json()).ids);
    const newChunks = chunks.filter(chunk => !existingIds.has(chunk.id));
    if (newChunks.length === 0) return;

    // Generate embeddings on the frontend using our provider (which proxies to backend)
    const embeddings = await this.embeddingProvider.embedDocuments(newChunks.map(c => c.text));
    if (embeddings.length !== newChunks.length || embeddings.some(vector => !Array.isArray(vector) || vector.length === 0)) {
      throw new Error(`Expected ${newChunks.length} valid embeddings, received ${embeddings.filter(Boolean).length}.`);
    }
    
    // Combine chunks with their embeddings
    const payload = newChunks.map((chunk, idx) => ({
      chunk,
      embedding: embeddings[idx]
    }));

    const res = await fetch(`${this.apiUrl}/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: payload })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add vectors to persistent store');
    }
  }

  async search(queryVector: Vector, topK: number, filter?: { courseId?: string; sourceIds?: string[] }): Promise<{ chunk: DocumentChunk; score: number; }[]> {
    const res = await fetch(`${this.apiUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryVector, topK, filter })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to query persistent vector store');
    }

    const data = await res.json();
    return data.results; // Array of { chunk, score }
  }

  async clear(): Promise<void> {
    const res = await fetch(`${this.apiUrl}/clear`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!res.ok) {
      throw new Error('Failed to clear persistent vector store');
    }
  }

  async removeSource(courseId: string, sourceTitle: string, keepSourceId: string): Promise<void> {
    const res = await fetch(`${this.apiUrl}/remove-source`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, sourceTitle, keepSourceId })
    });
    if (!res.ok) throw new Error('Failed to replace previous indexed content.');
  }
}
