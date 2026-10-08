import { DocumentChunk, LLMResponse } from '../../types/rag';
import { ILLMProvider } from './llmProvider';

export class GeminiLLMProvider implements ILLMProvider {
  private apiUrl = 'http://localhost:3001/api/gemini/generate';

  async generateGroundedAnswer(question: string, chunks: DocumentChunk[], contextMetadata?: any): Promise<LLMResponse> {
    try {
      const response = await fetch(this.apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: question,
          chunks,
          contextMetadata
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to communicate with Gemini API');
      }

      const result = await response.json();
      
      // Map JSON to expected LLMResponse
      return {
        answer: result.answer,
        groundingResult: {
          isGrounded: result.grounded,
          unsupportedReason: result.unsupportedReason,
          usedChunks: result.grounded ? chunks : []
        }
      };
    } catch (error: any) {
      console.error('GeminiLLMProvider Error:', error);
      return {
        answer: 'I encountered a technical error while connecting to the AI service. Please check the server connection and API key configuration.',
        groundingResult: {
          isGrounded: false,
          unsupportedReason: error.message || 'Network error',
          usedChunks: []
        }
      };
    }
  }
}
