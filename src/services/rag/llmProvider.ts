import { DocumentChunk, LLMResponse } from '../../types/rag';

export interface ILLMProvider {
  generateGroundedAnswer(question: string, chunks: DocumentChunk[], contextMetadata?: any): Promise<LLMResponse>;
}

export class MockLLMProvider implements ILLMProvider {
  private mockResponse?: LLMResponse;

  setMockResponse(response: LLMResponse): void {
    this.mockResponse = response;
  }

  async generateGroundedAnswer(question: string, chunks: DocumentChunk[], contextMetadata?: any): Promise<LLMResponse> {
    if (this.mockResponse) return this.mockResponse;
    // Simulate network delay
    await new Promise(r => setTimeout(r, 600));

    if (chunks.length === 0) {
      return {
        answer: 'That information isn\'t covered in the uploaded course material. I can only answer using the verified course content.',
        groundingResult: {
          isGrounded: false,
          unsupportedReason: 'No relevant course chunks were found for this query.',
          usedChunks: []
        }
      };
    }

    const stopWords = new Set(['what', 'which', 'where', 'when', 'does', 'this', 'that', 'with', 'from', 'about', 'explain', 'describe', 'tell', 'the', 'and', 'for', 'are', 'is', 'how', 'who', 'can', 'you']);
    const keyTerms = question.toLocaleLowerCase().match(/[a-z0-9]+/g)?.filter(term => term.length > 2 && !stopWords.has(term)) ?? [];
    const evidenceText = chunks.map(chunk => chunk.text.toLocaleLowerCase()).join(' ');
    const overlap = keyTerms.filter(term => evidenceText.includes(term)).length;
    if (keyTerms.length > 0 && overlap / keyTerms.length < 0.75) {
      return {
        answer: "I couldn't find enough evidence in the uploaded course material to answer that question.",
        groundingResult: {
          isGrounded: false,
          unsupportedReason: 'The retrieved passages do not support the key details in the question.',
          usedChunks: []
        }
      };
    }

    // In a real LLM, we would construct a prompt with the chunks and the question.
    // Here we will deterministically compose an answer based on the highest ranked chunk.
    
    const primaryChunk = chunks[0];
    
    let answer = `${primaryChunk.text}`;
    
    // Adaptive addition based on learner model if passed in contextMetadata
    if (contextMetadata?.activeMisconceptions && contextMetadata.activeMisconceptions.length > 0) {
       answer = `I noticed you might have some trouble with a specific part of this. To clarify: ${answer}`;
    } else if (contextMetadata?.masteryScore !== undefined && contextMetadata.masteryScore < 0.5) {
      answer = `Let's break this down since we've been working on it. Based on the material: ${answer}`;
    } else {
      answer = `According to your course material: ${answer}`;
    }

    return {
      answer,
      suggestedConceptId: primaryChunk.metadata.conceptId,
      groundingResult: {
        isGrounded: true,
        usedChunks: chunks
      }
    };
  }
}
