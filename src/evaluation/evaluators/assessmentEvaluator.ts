import { AssessmentEvaluation } from '../types';
import { demoQuestions } from '../../data/questionBank';
import { assessmentGradingProbes, gradeAssessmentResponse } from '../../services/assessmentGrader';

export class AssessmentEvaluator {
  
  async runEvaluation(): Promise<AssessmentEvaluation> {
    let validCount = 0;
    let validAnswerKeys = 0;
    let duplicatePairs = 0;
    let comparisonPairs = 0;
    const totalQuestions = demoQuestions.length;

    for (let index = 0; index < demoQuestions.length; index++) {
      const question = demoQuestions[index];
      const options = question.options ?? [];
      const correctOptions = options.filter(option => option.isCorrect);
      const uniqueOptions = new Set(options.map(option => option.text.trim().toLocaleLowerCase()));
      const validMcqKey = question.type !== 'MCQ' || (options.length === 4 && uniqueOptions.size === 4 && correctOptions.length === 1 && correctOptions[0].text === question.correctAnswer);
      const validWrittenKey = question.type === 'MCQ' || (typeof question.correctAnswer === 'string' && question.correctAnswer.trim().length > 0
        && (question.type !== 'SHORT_ANSWER' || (question.answerKeywords?.length ?? 0) >= 2)
        && (question.type !== 'NUMERICAL' || Number.isFinite(Number(question.correctAnswer))));
      const hasCitation = question.sourceReferences.length > 0 && question.sourceReferences.every(reference => !!reference.sourceId && !!reference.location);
      if (question.conceptId && question.topicId && question.difficulty >= 0 && question.difficulty <= 1 && validMcqKey && validWrittenKey && hasCitation) validCount++;
      if (validMcqKey && validWrittenKey) validAnswerKeys++;

      const promptTokens = new Set(question.prompt.toLocaleLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3) ?? []);
      for (let priorIndex = 0; priorIndex < index; priorIndex++) {
        comparisonPairs++;
        const priorTokens = new Set(demoQuestions[priorIndex].prompt.toLocaleLowerCase().match(/[a-z0-9]+/g)?.filter(word => word.length > 3) ?? []);
        const intersection = [...promptTokens].filter(word => priorTokens.has(word)).length;
        const similarity = promptTokens.size + priorTokens.size ? intersection / (promptTokens.size + priorTokens.size - intersection) : 0;
        if (similarity >= 0.82) duplicatePairs++;
      }
    }

    const validityRate = totalQuestions > 0 ? validCount / totalQuestions : 0;
    const answerKeyRate = totalQuestions > 0 ? validAnswerKeys / totalQuestions : 0;
    const duplicateRate = comparisonPairs > 0 ? duplicatePairs / comparisonPairs : 0;
    const gradingMatches = assessmentGradingProbes.filter(probe => gradeAssessmentResponse(probe.question, probe.response) === probe.expected).length;
    const gradingProbeAccuracy = assessmentGradingProbes.length ? gradingMatches / assessmentGradingProbes.length : 0;
    
    return {
      metrics: [
        {
          name: 'Question Validity Rate',
          value: validityRate,
          formattedValue: `${Math.round(validityRate * 100)}%`,
          sampleSize: totalQuestions,
          description: 'Percentage of questions in the bank that possess all required structural and domain metadata.'
        },
        {
          name: 'Answer-Key Integrity', value: answerKeyRate, formattedValue: `${Math.round(answerKeyRate * 100)}%`, sampleSize: totalQuestions,
          description: 'Checks MCQ count, option uniqueness, single correct option, answer-key consistency, and required written-answer keys.'
        },
        {
          name: 'Near-Duplicate Prompt Pair Rate', value: duplicateRate, formattedValue: `${Math.round(duplicateRate * 100)}%`, sampleSize: comparisonPairs,
          description: 'Share of question pairs with token Jaccard similarity at least 0.82; a deterministic novelty warning, not semantic verification.'
        },
        {
          name: 'Grader Labeled Probe Accuracy', value: gradingProbeAccuracy, formattedValue: `${Math.round(gradingProbeAccuracy * 100)}%`, sampleSize: assessmentGradingProbes.length,
          description: 'Regression probes for known correct/incorrect MCQ, short-answer, and numerical responses. These are not human-graded learner responses.'
        }
      ]
    };
  }
}
