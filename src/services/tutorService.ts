import { ID, TutorResponse } from '../types/domain';
import { DevFallbackEmbeddingProvider } from './rag/embeddingProvider';
import { GeminiEmbeddingProvider } from './rag/geminiEmbeddingProvider';
import { InMemoryVectorStore } from './rag/vectorStore';
import { PersistentVectorStore } from './rag/persistentVectorStore';
import { Retriever } from './rag/retriever';
import { MockLLMProvider } from './rag/llmProvider';
import { GeminiLLMProvider } from './rag/geminiLLMProvider';
import { RAGTutorService } from './ragTutorService';

export interface TutorContext {
  courseId: ID;
  userId: ID;
  conceptId?: ID;
  focus?: string;
  sourceIds?: ID[];
}

export interface ITutorService {
  ask(question: string, context: TutorContext): Promise<TutorResponse>;
}

// --------------------------------------------------
// RAG PIPELINE INITIALIZATION
// --------------------------------------------------

const useGemini = import.meta.env.VITE_LLM_PROVIDER === 'gemini';
const useRealEmbeddings = import.meta.env.VITE_EMBEDDING_PROVIDER === 'gemini';
const usePersistentDb = import.meta.env.VITE_VECTOR_STORE === 'persistent';

export const embeddingProvider = useRealEmbeddings 
  ? new GeminiEmbeddingProvider() 
  : new DevFallbackEmbeddingProvider();

export const vectorStore = usePersistentDb 
  ? new PersistentVectorStore(embeddingProvider)
  : new InMemoryVectorStore(embeddingProvider);

export const retriever = new Retriever(embeddingProvider, vectorStore);
const llmProvider = useGemini ? new GeminiLLMProvider() : new MockLLMProvider();

// --------------------------------------------------
// EXPORT SERVICE
// --------------------------------------------------

export const tutorService = new RAGTutorService(retriever, llmProvider);
