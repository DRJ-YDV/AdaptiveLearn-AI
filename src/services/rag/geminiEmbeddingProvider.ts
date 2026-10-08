import { IEmbeddingProvider, Vector } from './embeddingProvider';

export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  private apiUrl = 'http://localhost:3001/api/embeddings/generate';

  async embedText(text: string): Promise<Vector> {
    const vectors = await this.embedDocuments([text]);
    if (vectors.length > 0) return vectors[0];
    throw new Error('Failed to generate embedding');
  }

  async embedDocuments(texts: string[]): Promise<Vector[]> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to fetch embeddings');
      }

      const result = await response.json();
      if (!Array.isArray(result.embeddings) || result.embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, received ${result.embeddings?.length ?? 0}`);
      }
      return result.embeddings;
    } catch (e: any) {
      console.error('GeminiEmbeddingProvider Error:', e);
      throw e;
    }
  }
}
