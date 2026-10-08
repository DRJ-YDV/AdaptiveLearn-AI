export type Vector = number[];

export interface IEmbeddingProvider {
  embedText(text: string): Promise<Vector>;
  embedDocuments(texts: string[]): Promise<Vector[]>;
}

/**
 * Deterministic Development Fallback Embedding Provider.
 * This is NOT a production embedding model. It uses a naive bag-of-words
 * term frequency approach for local deterministic testing of the RAG pipeline.
 */
export class DevFallbackEmbeddingProvider implements IEmbeddingProvider {
  // A small fixed vocabulary based on our demo course for pseudo-embeddings
  private vocab = [
    'gradient', 'descent', 'loss', 'optimization', 'minimum', 'learning', 'rate',
    'entropy', 'information', 'gain', 'split', 'decision', 'tree', 'impurity',
    'derivative', 'partial', 'change', 'rate', 'calculus', 'constant',
    'backpropagation', 'chain', 'rule', 'neural', 'network', 'layer', 'output', 'input'
  ];

  async embedText(text: string): Promise<Vector> {
    const lower = text.toLowerCase();
    const vec = new Array(this.vocab.length).fill(0);
    
    // Simple term frequency count
    for (let i = 0; i < this.vocab.length; i++) {
      const term = this.vocab[i];
      const count = (lower.match(new RegExp(term, 'g')) || []).length;
      vec[i] = count;
    }
    
    // Normalize vector (L2 norm)
    const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return vec.map(v => v / magnitude);
    }
    return vec;
  }

  async embedDocuments(texts: string[]): Promise<Vector[]> {
    return Promise.all(texts.map(t => this.embedText(t)));
  }
}
