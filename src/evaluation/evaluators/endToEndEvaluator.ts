import { Retriever } from '../../services/rag/retriever';
import { InMemoryVectorStore } from '../../services/rag/vectorStore';
import { MockLLMProvider } from '../../services/rag/llmProvider';
import { RAGTutorService } from '../../services/ragTutorService';
import { LearnerModelService, MemoryLearnerStateStore } from '../../services/learnerModelService';
import { AdaptiveAssessmentService } from '../../services/adaptiveAssessmentService';
import { NextBestActionService } from '../../services/nextBestActionService';
import { IEmbeddingProvider } from '../../services/rag/embeddingProvider';
import { DocumentChunk } from '../../types/rag';
import { Question } from '../../types/domain';

class DeterministicEmbeddingProvider implements IEmbeddingProvider {
  async embedText(_text: string): Promise<number[]> {
    return [0.5, 0.5, 0.5];
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return texts.map(() => [0.5, 0.5, 0.5]);
  }
}

export class EndToEndEvaluator {
  async runEndToEndTests(): Promise<{
    tests: Record<string, { status: 'PASS' | 'FAIL'; message?: string }>;
    passed: number;
    failed: number;
    total: number;
  }> {
    const report = {
      tests: {} as Record<string, { status: 'PASS' | 'FAIL'; message?: string }>,
      passed: 0,
      failed: 0,
      total: 0
    };

    const run = async (name: string, action: () => Promise<void>) => {
      report.total++;
      try {
        await action();
        report.tests[name] = { status: 'PASS' };
        report.passed++;
      } catch (error) {
        report.tests[name] = { status: 'FAIL', message: error instanceof Error ? error.message : String(error) };
        report.failed++;
      }
    };

    const embeddings = new DeterministicEmbeddingProvider();
    const vectors = new InMemoryVectorStore(embeddings);
    const llm = new MockLLMProvider();
    const tutor = new RAGTutorService(new Retriever(embeddings, vectors), llm);
    const learners = new LearnerModelService(new MemoryLearnerStateStore());
    const assessments = new AdaptiveAssessmentService(learners);
    const nextAction = new NextBestActionService(learners);
    const courseId = 'course_e2e';
    const userId = 'learner_e2e';
    const conceptId = 'concept_e2e';

    const chunks: DocumentChunk[] = [
      { id: 'e2e-pdf', text: 'Gradient descent updates parameters to reduce loss.', metadata: { courseId, sourceId: 'pdf-e2e', sourceType: 'TEXTBOOK', sourceTitle: 'Course PDF', location: 'Page 4', conceptId } },
      { id: 'e2e-slide', text: 'A slide explains gradient descent.', metadata: { courseId, sourceId: 'slide-e2e', sourceType: 'SLIDE', sourceTitle: 'Course slides', location: 'Slide 8', conceptId } },
      { id: 'e2e-video', text: 'A lecture explains gradient descent.', metadata: { courseId, sourceId: 'video-e2e', sourceType: 'VIDEO', sourceTitle: 'Course video', location: '07:00', startTime: 420, endTime: 510, conceptId } },
      { id: 'e2e-other-course', text: 'Quantum entanglement.', metadata: { courseId: 'course_other', sourceId: 'other', sourceType: 'DOCUMENT', sourceTitle: 'Other course', location: 'Page 1' } }
    ];
    await vectors.add(chunks);

    await run('Course-scoped retrieval', async () => {
      const result = await tutor.ask('Explain gradient descent.', { userId, courseId, conceptId });
      if (!result.evidence.some(source => source.sourceId === 'pdf-e2e')) throw new Error('Expected a matching PDF citation.');
      if (result.evidence.some(source => source.sourceId === 'other')) throw new Error('A different course leaked into retrieval.');
    });

    await run('Empty course returns unsupported answer', async () => {
      const result = await tutor.ask('Explain this.', { userId, courseId: 'empty-course' });
      if (result.grounded || result.evidence.length) throw new Error('Empty course should not return grounded evidence.');
    });

    await run('PDF, slide, and video citation locations', async () => {
      llm.setMockResponse({
        answer: 'Grounded test response.',
        groundingResult: { isGrounded: true, usedChunks: chunks.slice(0, 3) }
      });
      const result = await tutor.ask('Explain gradient descent.', { userId, courseId, conceptId });
      const pdf = result.evidence.find(source => source.sourceId === 'pdf-e2e');
      const slide = result.evidence.find(source => source.sourceId === 'slide-e2e');
      const video = result.evidence.find(source => source.sourceId === 'video-e2e');
      if (pdf?.location !== 'Page 4' || slide?.location !== 'Slide 8' || video?.startTime !== 420 || video.endTime !== 510) {
        throw new Error('A source location was not preserved.');
      }
    });

    await run('Assessment updates learner mastery', async () => {
      const question: Question = {
        id: 'question-e2e', type: 'MCQ', prompt: 'What direction reduces the loss?',
        options: [{ id: 'correct', text: 'Negative gradient', isCorrect: true }, { id: 'wrong', text: 'Positive gradient', isCorrect: false }],
        correctAnswer: 'Negative gradient', explanation: 'The source says gradient descent moves along the negative gradient.',
        conceptId, topicId: 'topic-e2e', difficulty: 0.5,
        sourceReferences: [{ id: 'evidence-e2e', sourceId: 'pdf-e2e', sourceType: 'TEXTBOOK', location: 'Page 4', label: 'Course PDF - Page 4', excerpt: chunks[0].text }],
        tags: ['e2e']
      };
      const selection = await assessments.getNextQuestion(userId, courseId, new Set(), true, undefined, [question]);
      if (!selection) throw new Error('No assessment question was available.');
      learners.updateMastery(selection.question.conceptId, selection.question, false, undefined, true, userId, courseId);
      const state = learners.getLearnerModel(userId, courseId).masteryStates[selection.question.conceptId];
      if (!state || state.attempts !== 1) throw new Error('The learner state was not updated.');
    });

    await run('Next action recommends an available step', async () => {
      const action = await nextAction.getNextBestAction(userId, courseId);
      if (!action.action) throw new Error('No next action was returned.');
    });

    return report;
  }
}
