import { Question } from '../types/domain';

export function gradeAssessmentResponse(
  question: Question,
  response: { selectedOptionId?: string; answerText?: string }
): boolean {
  if (question.type === 'MCQ') {
    return !!question.options?.find(option => option.id === response.selectedOptionId)?.isCorrect;
  }
  const answerText = response.answerText ?? '';
  if (question.type === 'NUMERICAL') {
    const answer = Number(answerText);
    const expected = Number(question.correctAnswer);
    return Number.isFinite(answer) && Number.isFinite(expected)
      && Math.abs(answer - expected) <= (question.answerTolerance ?? 0.01);
  }
  const normalized = answerText.toLocaleLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const keywords = question.answerKeywords ?? question.correctAnswer?.toLocaleLowerCase().split(/\s+/).filter(word => word.length > 3) ?? [];
  const matched = keywords.filter(keyword => normalized.includes(keyword.toLocaleLowerCase())).length;
  return normalized === question.correctAnswer?.toLocaleLowerCase().trim()
    || (keywords.length >= 2 && matched >= Math.max(2, Math.ceil(keywords.length * 0.6)));
}

/** Labeled edge cases for deterministic grader behavior; not human response data. */
export const assessmentGradingProbes: Array<{ name: string; question: Question; response: { selectedOptionId?: string; answerText?: string }; expected: boolean }> = [
  { name: 'MCQ correct choice', question: { id: 'probe-mcq', type: 'MCQ', prompt: 'Pick the correct choice', options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }], correctAnswer: 'A' } as Question, response: { selectedOptionId: 'a' }, expected: true },
  { name: 'MCQ incorrect choice', question: { id: 'probe-mcq-wrong', type: 'MCQ', prompt: 'Pick the correct choice', options: [{ id: 'a', text: 'A', isCorrect: true }, { id: 'b', text: 'B', isCorrect: false }], correctAnswer: 'A' } as Question, response: { selectedOptionId: 'b' }, expected: false },
  { name: 'Short answer accepts required keywords', question: { id: 'probe-short', type: 'SHORT_ANSWER', prompt: 'Define', correctAnswer: 'A derivative measures sensitivity', answerKeywords: ['derivative', 'sensitivity', 'change'] } as Question, response: { answerText: 'A derivative shows sensitivity to change.' }, expected: true },
  { name: 'Short answer rejects insufficient keywords', question: { id: 'probe-short-wrong', type: 'SHORT_ANSWER', prompt: 'Define', correctAnswer: 'A derivative measures sensitivity', answerKeywords: ['derivative', 'sensitivity', 'change'] } as Question, response: { answerText: 'A derivative is always zero.' }, expected: false },
  { name: 'Numerical answer within tolerance', question: { id: 'probe-number', type: 'NUMERICAL', prompt: 'Calculate', correctAnswer: '2', answerTolerance: 0.02 } as Question, response: { answerText: '2.01' }, expected: true },
  { name: 'Numerical answer outside tolerance', question: { id: 'probe-number-wrong', type: 'NUMERICAL', prompt: 'Calculate', correctAnswer: '2', answerTolerance: 0.02 } as Question, response: { answerText: '2.1' }, expected: false }
];
