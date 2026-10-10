import { ITutorService, TutorContext } from './tutorService';
import { TutorResponse, SourceReference } from '../types/domain';
import { Retriever } from './rag/retriever';
import { ILLMProvider } from './rag/llmProvider';
import { courseRepository } from './courseRepository';

export class RAGTutorService implements ITutorService {
  constructor(
    private retriever: Retriever,
    private llmProvider: ILLMProvider
  ) {}

  async ask(question: string, context: TutorContext): Promise<TutorResponse> {
    // 1. Retrieve relevant chunks
    const retrievalResponse = await this.retriever.retrieve({
      text: context.focus ? `${question}\nCurrent learning focus: ${context.focus}` : question,
      courseId: context.courseId,
      sourceIds: context.sourceIds,
      topK: 3,
      minSimilarity: 0.15 // Threshold for deciding if we have ANY relevant info
    });
    
    // 1.5 Short-circuit if no relevant evidence is found
    if (retrievalResponse.results.length === 0) {
      return {
        id: crypto.randomUUID(),
        answer: "I couldn't find any relevant information in the course material to answer your question.",
        conceptId: context.conceptId,
        confidence: 0.0,
        evidence: [],
        grounded: false,
        unsupportedReason: "No relevant course material found."
      };
    }

    // 2. Fetch Learner Context if available
    let contextMetadata: any = {};
    if (context.userId && context.courseId) {
      const lm = await courseRepository.getLearnerModel(context.userId, context.courseId);
      // Try to figure out if there is a primary concept from the chunks
      if (retrievalResponse.results.length > 0) {
        const topConceptId = retrievalResponse.results[0].chunk.metadata.conceptId;
        if (topConceptId) {
          const state = lm.masteryStates[topConceptId];
          if (state) {
            contextMetadata.masteryScore = state.masteryScore;
            contextMetadata.activeMisconceptions = state.activeMisconceptions;
            contextMetadata.trend = state.trend;
          }
        }
      }
    }

    // 3. Generate Grounded Answer via LLM
    const chunks = retrievalResponse.results.map(r => r.chunk);
    
    let llmResponse;
    try {
      llmResponse = await this.llmProvider.generateGroundedAnswer(question, chunks, { ...contextMetadata, focus: context.focus });
      
      // Defend against malformed LLM responses
      if (!llmResponse || typeof llmResponse.groundingResult?.isGrounded !== 'boolean') {
        throw new Error('Malformed LLM response structure');
      }
    } catch (e) {
      console.error('LLM Failure:', e);
      return {
        id: crypto.randomUUID(),
        answer: "I'm having trouble processing the answer right now due to a service interruption. Please try again later.",
        conceptId: context.conceptId,
        confidence: 0.0,
        evidence: [],
        grounded: false,
        unsupportedReason: "LLM Service Failure"
      };
    }

    // 4. Source Reference Mapping (Strictly from retrieved metadata)
    const evidence: SourceReference[] = llmResponse.groundingResult.usedChunks.map(chunk => ({
      id: crypto.randomUUID(),
      sourceId: chunk.metadata.sourceId,
      sourceType: chunk.metadata.sourceType,
      location: chunk.metadata.location,
      startTime: chunk.metadata.startTime,
      endTime: chunk.metadata.endTime,
      label: chunk.metadata.sourceTitle + ' - ' + chunk.metadata.location,
      excerpt: chunk.text
    }));

    // Deduplicate evidence references
    const uniqueEvidence = Array.from(new Map(evidence.map(item => [item.label, item])).values());

    const conceptId = llmResponse.suggestedConceptId
      || context.conceptId
      || chunks.find(chunk => chunk.metadata.conceptId)?.metadata.conceptId;
    let topicId = undefined;
    if (conceptId) {
       const concepts = await courseRepository.getConceptsByCourse(context.courseId);
       topicId = concepts.find(c => c.id === conceptId)?.topicId;
    }

    const actions: TutorResponse['suggestedActions'] = [
      { type: 'VIEW_MAP', label: 'Open Knowledge Map', targetId: conceptId }
    ];

    return {
      id: crypto.randomUUID(),
      answer: llmResponse.answer,
      conceptId,
      topicId,
      confidence: llmResponse.groundingResult.isGrounded ? 0.95 : 0.0,
      evidence: uniqueEvidence,
      grounded: llmResponse.groundingResult.isGrounded,
      unsupportedReason: llmResponse.groundingResult.unsupportedReason,
      suggestedActions: actions
    };
  }
}
