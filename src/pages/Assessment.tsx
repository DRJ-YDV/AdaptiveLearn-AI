import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Brain, ArrowRight, CheckCircle, XCircle, Info, RefreshCcw, Activity } from 'lucide-react';
import type { Question, ID, Concept, Topic, LearnerModel } from '../types/domain';
import { adaptiveAssessmentService } from '../services/adaptiveAssessmentService';
import { learnerModelService } from '../services/learnerModelService';
import { gradeAssessmentResponse } from '../services/assessmentGrader';
import { courseRepository } from '../services/courseRepository';

const ACTIVE_ASSESSMENT_KEY = 'adaptivelearn:active-assessment';
const LATEST_ASSESSMENT_RESULT_KEY = 'adaptivelearn:latest-assessment-result';

type SavedAssessment = {
  isDiagnostic: boolean;
  phase: 'QUESTION' | 'FEEDBACK';
  questionCount: number;
  scopeId: string;
  questionSet: Question[];
  attemptedIds: ID[];
  currentQuestion: Question | null;
  adaptationReason: string;
  selectedOptionId: ID | null;
  answerValue: string;
  isCorrect: boolean;
  masteryChange: { before: number; after: number };
  timedMode: boolean;
  timeRemaining: number | null;
  deadlineAt: number | null;
  visitedQuestions: Question[];
  answers: Record<ID, { isCorrect: boolean; selectedOptionId?: ID }>;
  baselineModel: LearnerModel | null;
};

const readSavedAssessment = (): SavedAssessment | null => {
  try {
    const value = sessionStorage.getItem(ACTIVE_ASSESSMENT_KEY);
    if (!value) return null;
    const saved = JSON.parse(value) as SavedAssessment;
    return saved.phase && Array.isArray(saved.questionSet) && saved.currentQuestion ? saved : null;
  } catch {
    return null;
  }
};

const saveAssessmentResult = (questions: Question[], completedIds: Set<ID>, scopeId: string, isDiagnostic: boolean) => {
  const completedConceptIds = [...new Set(questions
    .filter(question => completedIds.has(question.id))
    .map(question => question.conceptId))];
  try {
    localStorage.setItem(LATEST_ASSESSMENT_RESULT_KEY, JSON.stringify({
      conceptIds: completedConceptIds,
      scopeId,
      isDiagnostic,
      completedAt: new Date().toISOString()
    }));
  } catch { /* Results can still render from the learner model if storage is unavailable. */ }
};

export const Assessment: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [restored] = useState<SavedAssessment | null>(readSavedAssessment);
  const isDiagnostic = restored?.isDiagnostic ?? (searchParams.get('diagnostic') === 'true');
  
  // Phase 1: Setup
  // Phase 2: Question
  // Phase 3: Feedback (Skipped in diagnostic to avoid contamination)
  const [phase, setPhase] = useState<'SETUP' | 'QUESTION' | 'FEEDBACK'>(restored?.phase ?? 'SETUP');
  
  // Setup config
  const [questionCount, setQuestionCount] = useState(restored?.questionCount ?? (isDiagnostic ? 10 : 5)); // Default longer for diagnostic
  const [topics, setTopics] = useState<Topic[]>([]);
  const [scopeId, setScopeId] = useState(restored?.scopeId ?? '');
  const [questionSet, setQuestionSet] = useState<Question[]>(restored?.questionSet ?? []);
  const [timedMode, setTimedMode] = useState(restored?.timedMode ?? false);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(restored?.deadlineAt ?? null);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(restored?.timeRemaining ?? null);
  const [visitedQuestions, setVisitedQuestions] = useState<Question[]>(restored?.visitedQuestions ?? []);
  const [answers, setAnswers] = useState<Record<ID, { isCorrect: boolean; selectedOptionId?: ID }>>(restored?.answers ?? {});
  const [baselineModel, setBaselineModel] = useState<LearnerModel | null>(restored?.baselineModel ?? null);
  const [answerValue, setAnswerValue] = useState(restored?.answerValue ?? '');
  const [startError, setStartError] = useState('');
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (deadlineAt === null) return;
    const syncRemaining = window.setTimeout(() => setTimeRemaining(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))), 0);
    return () => window.clearTimeout(syncRemaining);
  }, [deadlineAt]);

  useEffect(() => {
    courseRepository.getTopics('course_ml_101').then(loadedTopics => {
      setTopics(loadedTopics);
      const requestedTopic = searchParams.get('topic');
      if (!restored) setScopeId(requestedTopic && loadedTopics.some(topic => topic.id === requestedTopic) ? requestedTopic : '');
    }).catch(error => console.error('Failed to load assessment topics:', error));
  }, [searchParams, restored]);
  
  // Test State
  const [attemptedIds, setAttemptedIds] = useState<Set<ID>>(new Set(restored?.attemptedIds ?? []));
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(restored?.currentQuestion ?? null);
  const [adaptationReason, setAdaptationReason] = useState<string>(restored?.adaptationReason ?? '');
  
  // Interaction State
  const [selectedOptionId, setSelectedOptionId] = useState<ID | null>(restored?.selectedOptionId ?? null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  
  // Feedback State
  const [isCorrect, setIsCorrect] = useState(restored?.isCorrect ?? false);
  const [masteryChange, setMasteryChange] = useState(restored?.masteryChange ?? { before: 0, after: 0 });
  const [concept, setConcept] = useState<Concept | null>(null);
  const activeQuestionCount = questionSet.length || questionCount;

  useEffect(() => {
    if (!currentQuestion || phase === 'SETUP') return;
    const saved: SavedAssessment = {
      isDiagnostic, phase, questionCount, scopeId, questionSet, attemptedIds: [...attemptedIds], currentQuestion,
      adaptationReason, selectedOptionId, answerValue, isCorrect, masteryChange
      , timedMode, timeRemaining, deadlineAt, visitedQuestions, answers, baselineModel
    };
    try { sessionStorage.setItem(ACTIVE_ASSESSMENT_KEY, JSON.stringify(saved)); } catch { /* Keep the in-memory assessment usable if storage is unavailable. */ }
  }, [isDiagnostic, phase, questionCount, scopeId, questionSet, attemptedIds, currentQuestion, adaptationReason, selectedOptionId, answerValue, isCorrect, masteryChange, timedMode, timeRemaining, deadlineAt, visitedQuestions, answers, baselineModel]);

  useEffect(() => {
    if (phase === 'SETUP' || timeRemaining === null || timeRemaining <= 0) return;
    const timer = window.setTimeout(() => setTimeRemaining(deadlineAt === null ? null : Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))), 1000);
    return () => window.clearTimeout(timer);
  }, [phase, timeRemaining, deadlineAt]);

  useEffect(() => {
    if (timeRemaining !== 0 || phase === 'SETUP') return;
    if (isDiagnostic) learnerModelService.completeDiagnostic();
    saveAssessmentResult(questionSet, attemptedIds, scopeId, isDiagnostic);
    sessionStorage.removeItem(ACTIVE_ASSESSMENT_KEY);
    navigate(isDiagnostic ? '/app/assessment/results?diagnostic=true' : '/app/assessment/results');
  }, [timeRemaining, phase, isDiagnostic, questionSet, attemptedIds, scopeId, navigate]);

  useEffect(() => {
    if (!currentQuestion) return;
    courseRepository.getConceptsByCourse('course_ml_101').then(concepts => {
      setConcept(concepts.find(item => item.id === currentQuestion.conceptId) || null);
    }).catch(error => console.error('Failed to restore assessment concept:', error));
  }, [currentQuestion]);

  const quitAssessment = () => {
    sessionStorage.removeItem(ACTIVE_ASSESSMENT_KEY);
    setPhase('SETUP');
    setCurrentQuestion(null);
    setQuestionSet([]);
    setAttemptedIds(new Set());
    navigate('/app');
  };

  const formatTime = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const topicsBySource = topics.reduce<Record<string, { sourceId?: string; sourceTitle: string; topics: Topic[] }>>((groups, topic) => {
    const sourceTitle = topic.sourceTitle || 'Course topics';
    const groupKey = topic.sourceId || `title:${sourceTitle}`;
    const group = groups[groupKey] ?? { sourceId: topic.sourceId, sourceTitle, topics: [] };
    group.topics.push(topic);
    groups[groupKey] = group;
    return groups;
  }, {});

  const loadNextQuestion = async (updatedAttemptedIds: Set<ID>, questions = questionSet) => {
    if (updatedAttemptedIds.size >= questions.length) {
      if (isDiagnostic) {
        learnerModelService.completeDiagnostic();
        saveAssessmentResult(questions, updatedAttemptedIds, scopeId, isDiagnostic);
        sessionStorage.removeItem(ACTIVE_ASSESSMENT_KEY);
        navigate('/app/assessment/results?diagnostic=true');
      } else {
        saveAssessmentResult(questions, updatedAttemptedIds, scopeId, isDiagnostic);
        sessionStorage.removeItem(ACTIVE_ASSESSMENT_KEY);
        navigate('/app/assessment/results');
      }
      return;
    }

    const next = await adaptiveAssessmentService.getNextQuestion('user_1', 'course_ml_101', updatedAttemptedIds, isDiagnostic, scopeId === 'ALL' ? undefined : scopeId, questions);
    if (!next) {
      if (isDiagnostic) {
        learnerModelService.completeDiagnostic();
        saveAssessmentResult(questions, updatedAttemptedIds, scopeId, isDiagnostic);
        sessionStorage.removeItem(ACTIVE_ASSESSMENT_KEY);
        navigate('/app/assessment/results?diagnostic=true');
      } else {
        saveAssessmentResult(questions, updatedAttemptedIds, scopeId, isDiagnostic);
        sessionStorage.removeItem(ACTIVE_ASSESSMENT_KEY);
        navigate('/app/assessment/results');
      }
      return;
    }

    const concepts = await courseRepository.getConceptsByCourse('course_ml_101');
    setConcept(concepts.find(c => c.id === next.question.conceptId) || null);

    setCurrentQuestion(next.question);
    setVisitedQuestions(existing => existing.some(question => question.id === next.question.id) ? existing : [...existing, next.question]);
    setAdaptationReason(next.reason);
    setSelectedOptionId(null);
    setAnswerValue('');
    setPhase('QUESTION');
  };

  const handleStart = async () => {
    if (!scopeId) {
      setStartError('Choose a topic or All topics before starting the assessment.');
      return;
    }
    setIsStarting(true);
    setStartError('');
    try {
      const startingModel = JSON.parse(JSON.stringify(learnerModelService.getLearnerModel())) as LearnerModel;
      const questions = await adaptiveAssessmentService.generateQuestionSet('user_1', 'course_ml_101', questionCount, scopeId === 'ALL' ? undefined : scopeId);
      setQuestionSet(questions);
      setAttemptedIds(new Set());
      setAnswers({});
      setVisitedQuestions([]);
      setBaselineModel(startingModel);
      const limit = timedMode ? questions.reduce((total, question) => total + Math.round(45 + question.difficulty * 75), 0) : null;
      setTimeRemaining(limit);
      setDeadlineAt(limit === null ? null : Date.now() + limit * 1000);
      await loadNextQuestion(new Set(), questions);
    } catch (error) {
      setStartError(error instanceof Error ? error.message : 'Could not start this assessment.');
    } finally {
      setIsStarting(false);
    }
  };

  const handleSubmit = async () => {
    if (!currentQuestion) return;
    const selectedOpt = currentQuestion.options?.find(option => option.id === selectedOptionId);
    if (currentQuestion.type === 'MCQ' && !selectedOpt) return;
    if (currentQuestion.type !== 'MCQ' && !answerValue.trim()) return;
    
    setIsEvaluating(true);
    await new Promise(r => setTimeout(r, 600)); // Simulate processing

    const correct = gradeAssessmentResponse(currentQuestion, { selectedOptionId: selectedOpt?.id, answerText: answerValue });
    
    setIsCorrect(correct);

    const lmBefore = learnerModelService.getLearnerModel().masteryStates[currentQuestion.conceptId]?.masteryScore || 0.5;
    const revisedAnswers = { ...answers, [currentQuestion.id]: { isCorrect: correct, selectedOptionId: selectedOpt?.id } };
    setAnswers(revisedAnswers);
    if (baselineModel) {
      learnerModelService.getStore().saveLearnerModel(JSON.parse(JSON.stringify(baselineModel)) as LearnerModel);
      for (const question of visitedQuestions) {
        const response = revisedAnswers[question.id];
        if (!response) continue;
        const option = question.options?.find(candidate => candidate.id === response.selectedOptionId);
        learnerModelService.updateMastery(question.conceptId, question, response.isCorrect, option, isDiagnostic);
      }
      if (!visitedQuestions.some(question => question.id === currentQuestion.id)) {
        learnerModelService.updateMastery(currentQuestion.conceptId, currentQuestion, correct, selectedOpt, isDiagnostic);
      }
    } else {
      learnerModelService.updateMastery(currentQuestion.conceptId, currentQuestion, correct, selectedOpt, isDiagnostic);
    }
    const newState = learnerModelService.getLearnerModel().masteryStates[currentQuestion.conceptId];
    
    setMasteryChange({ before: lmBefore, after: newState.masteryScore });
    
    const newAttempted = new Set(attemptedIds).add(currentQuestion.id);
    setAttemptedIds(newAttempted);
    setIsEvaluating(false);

    if (isDiagnostic) {
      // In diagnostic mode, we skip immediate feedback to avoid contamination.
      // Move immediately to next question.
      loadNextQuestion(newAttempted);
    } else {
      setPhase('FEEDBACK');
    }
  };

  const handleSkip = () => {
    if (!currentQuestion || isEvaluating) return;
    const nextAttempted = new Set(attemptedIds).add(currentQuestion.id);
    setAttemptedIds(nextAttempted);
    void loadNextQuestion(nextAttempted);
  };

  const handlePreviousQuestion = () => {
    if (!currentQuestion || isEvaluating) return;
    const index = visitedQuestions.findIndex(question => question.id === currentQuestion.id);
    if (index <= 0) return;
    const previous = visitedQuestions[index - 1];
    setCurrentQuestion(previous);
    setSelectedOptionId(answers[previous.id]?.selectedOptionId ?? null);
    setAnswerValue('');
    setPhase('QUESTION');
  };

  const handleAdvance = () => {
    if (!currentQuestion) return;
    const index = visitedQuestions.findIndex(question => question.id === currentQuestion.id);
    const following = visitedQuestions[index + 1];
    if (following) {
      setCurrentQuestion(following);
      setSelectedOptionId(answers[following.id]?.selectedOptionId ?? null);
      setAnswerValue('');
      setPhase('QUESTION');
      return;
    }
    void loadNextQuestion(attemptedIds);
  };

  if (phase === 'SETUP') {
    return (
      <div className="assessment-setup-shell animate-fade-in" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="nba-card assessment-setup-card" style={{ width: '100%', maxWidth: '600px' }}>
          <div className="nba-header">
            {isDiagnostic ? <Activity size={16} /> : <Brain size={16} />} 
            {isDiagnostic ? 'Initial Knowledge Check' : 'Adaptive Assessment Engine'}
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: 'var(--space-2)' }}>
            {isDiagnostic ? 'Course Diagnostic' : 'Start Practice'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>
            {isDiagnostic 
              ? 'This diagnostic will estimate your current knowledge to personalize your learning path. Immediate feedback will be hidden to maintain accuracy.'
            : 'Choose all course materials, one complete PDF or lecture, or a topic. Questions will stay within your selection and adapt as you answer.'}
          </p>

          {startError && <p role="alert" style={{ marginBottom: 'var(--space-4)', color: 'var(--status-error)' }}>{startError}</p>}

          <div style={{ marginBottom: 'var(--space-6)' }}>
            <label htmlFor="assessment-scope" style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>What should this assessment cover?</label>
            <select id="assessment-scope" value={scopeId} onChange={event => setScopeId(event.target.value)} style={{ width: '100%', padding: '12px', marginBottom: 'var(--space-5)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}>
              <option value="" disabled>Choose an assessment scope…</option>
              <option value="ALL">All course materials</option>
              {Object.entries(topicsBySource).map(([groupKey, sourceGroup]) => (
                <optgroup key={groupKey} label={sourceGroup.sourceTitle}>
                  {sourceGroup.sourceId && <option value={`source:${sourceGroup.sourceId}`}>Entire source (PDF / lecture)</option>}
                  {sourceGroup.topics.map(topic => <option key={topic.id} value={topic.id}>{topic.name}</option>)}
                </optgroup>
              ))}
            </select>
            <label style={{ display: 'block', marginBottom: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Length</label>
            <div className="assessment-length-options" style={{ display: 'flex', gap: 'var(--space-3)' }}>
              {[3, 5, 10, 15].map(n => (
                <button 
                  key={n}
                  onClick={() => setQuestionCount(n)}
                  className={`assessment-length-option${questionCount === n ? ' selected' : ''}`}
                  style={{ 
                    padding: 'var(--space-2) var(--space-4)', 
                    border: `1px solid ${questionCount === n ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                    backgroundColor: questionCount === n ? 'rgba(79, 70, 229, 0.1)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                    color: questionCount === n ? 'var(--accent-primary)' : 'var(--text-primary)'
                  }}
                >
                  {n} Questions
                </button>
              ))}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: 'var(--space-5)', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={timedMode} onChange={event => setTimedMode(event.target.checked)} />
              Use a timer (harder questions get more time)
            </label>
            {timedMode && <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>The total time limit is calculated from this quiz’s question difficulty.</p>}
          </div>

          <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: isStarting || !scopeId ? 0.55 : 1 }} onClick={handleStart} disabled={isStarting || !scopeId}>
            {isStarting ? 'Building your assessment…' : (isDiagnostic ? 'Start Diagnostic' : 'Begin Assessment')}
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="assessment-question-shell animate-fade-in" style={{ display: 'flex', justifyContent: 'center', paddingTop: 'var(--space-8)' }}>
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Question {Math.max(1, visitedQuestions.findIndex(question => question.id === currentQuestion?.id) + 1)} of {activeQuestionCount}
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.85rem', color: isDiagnostic ? 'var(--status-info)' : 'var(--accent-secondary)' }}>
            <RefreshCcw size={14} />
            <span title={adaptationReason} style={{ cursor: 'help' }}>
              {isDiagnostic ? 'Evaluating concept knowledge' : 'Adapting to performance'}
            </span>
          </div>
          <button type="button" onClick={quitAssessment} style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>Quit assessment</button>
        </div>
        {timeRemaining !== null && <div role="timer" aria-label="Time remaining" style={{ alignSelf: 'flex-end', color: timeRemaining < 60 ? 'var(--status-error)' : 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>Time remaining: <strong>{formatTime(timeRemaining)}</strong></div>}

        {/* Question Card */}
        <div className="panel-card assessment-question-card" style={{ padding: 'var(--space-8)' }}>
          <div style={{ marginBottom: 'var(--space-6)' }}>
            <span style={{ 
              display: 'inline-block', 
              padding: '4px 8px', 
              backgroundColor: 'rgba(255,255,255,0.05)', 
              borderRadius: '4px', 
              fontSize: '0.8rem', 
              color: 'var(--text-tertiary)',
              marginBottom: 'var(--space-4)'
            }}>
              {concept?.name} • {currentQuestion.type.replace('_', ' ')} • Difficulty: {Math.round(currentQuestion.difficulty * 100)}%
            </span>
            <h2 style={{ fontSize: '1.4rem', lineHeight: 1.5 }}>{currentQuestion.prompt}</h2>
          </div>

          {currentQuestion.type === 'MCQ' && <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {currentQuestion.options?.map(opt => {
              const isSelected = selectedOptionId === opt.id;
              const showFeedback = phase === 'FEEDBACK';
              
              let bgColor = isSelected ? 'rgba(79, 70, 229, 0.1)' : 'var(--bg-base)';
              let borderColor = isSelected ? 'var(--accent-primary)' : 'var(--border-strong)';
              
              if (showFeedback) {
                if (opt.isCorrect) {
                  bgColor = 'rgba(16, 185, 129, 0.1)';
                  borderColor = 'var(--status-success)';
                } else if (isSelected && !opt.isCorrect) {
                  bgColor = 'rgba(239, 68, 68, 0.1)';
                  borderColor = 'var(--status-error)';
                } else {
                  bgColor = 'transparent';
                  borderColor = 'var(--border-subtle)';
                }
              }

              return (
                <button 
                  key={opt.id}
                  className={`assessment-answer-option${isSelected ? ' selected' : ''}${showFeedback ? ' feedback' : ''}`}
                  onClick={() => phase === 'QUESTION' && setSelectedOptionId(opt.id)}
                  disabled={phase === 'FEEDBACK'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                    padding: '16px',
                    backgroundColor: bgColor,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'left',
                    transition: 'all 0.2s',
                    cursor: phase === 'FEEDBACK' ? 'default' : 'pointer'
                  }}
                >
                  <div style={{ 
                    width: '20px', height: '20px', borderRadius: '50%', 
                    border: `2px solid ${borderColor}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    {isSelected && !showFeedback && <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)' }} />}
                    {showFeedback && opt.isCorrect && <CheckCircle size={16} color="var(--status-success)" />}
                    {showFeedback && isSelected && !opt.isCorrect && <XCircle size={16} color="var(--status-error)" />}
                  </div>
                  <span style={{ fontSize: '1.05rem', color: showFeedback && !opt.isCorrect && !isSelected ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                    {opt.text}
                  </span>
                </button>
              );
            })}
          </div>}

          {currentQuestion.type !== 'MCQ' && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              {currentQuestion.type === 'NUMERICAL' ? (
                <input type="number" step="any" value={answerValue} disabled={phase === 'FEEDBACK'} onChange={event => setAnswerValue(event.target.value)} placeholder="Enter a numeric answer" aria-label="Numeric answer" style={{ width: '100%', padding: '14px', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }} />
              ) : (
                <textarea rows={4} value={answerValue} disabled={phase === 'FEEDBACK'} onChange={event => setAnswerValue(event.target.value)} placeholder="Write your answer" aria-label="Short answer" style={{ width: '100%', padding: '14px', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', resize: 'vertical' }} />
              )}
            </div>
          )}

          {phase === 'QUESTION' && (
            <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <button type="button" onClick={handlePreviousQuestion} disabled={visitedQuestions.findIndex(question => question.id === currentQuestion.id) <= 0 || isEvaluating} style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '10px 16px' }}>Previous question</button>
                <button type="button" onClick={handleSkip} disabled={isEvaluating} style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '10px 16px' }}>Skip question</button>
              </div>
              <button 
                className="btn-primary" 
                onClick={handleSubmit}
                disabled={(currentQuestion.type === 'MCQ' ? !selectedOptionId : !answerValue.trim()) || isEvaluating}
                style={{ opacity: ((currentQuestion.type === 'MCQ' ? !selectedOptionId : !answerValue.trim()) || isEvaluating) ? 0.5 : 1 }}
              >
                {isEvaluating ? 'Evaluating...' : (answers[currentQuestion.id] ? 'Update Answer' : (isDiagnostic ? 'Next Question' : 'Submit Answer'))}
              </button>
            </div>
          )}

          {phase === 'FEEDBACK' && !isDiagnostic && (
            <div className="animate-fade-in" style={{ marginTop: 'var(--space-6)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-start' }}>
                <div style={{ marginTop: '4px' }}>
                  {isCorrect ? <CheckCircle size={24} color="var(--status-success)" /> : <XCircle size={24} color="var(--status-error)" />}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1.2rem', color: isCorrect ? 'var(--status-success)' : 'var(--status-error)', marginBottom: 'var(--space-2)' }}>
                    {isCorrect ? 'Correct' : 'Incorrect'}
                  </h3>
                  <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
                    {currentQuestion.explanation}
                  </p>
                  {currentQuestion.type !== 'MCQ' && <p style={{ marginBottom: 'var(--space-4)', color: 'var(--text-secondary)' }}><strong>Model answer:</strong> {currentQuestion.correctAnswer}</p>}
                  
                  <div style={{ display: 'flex', gap: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Mastery Change</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginTop: '4px', fontWeight: 600 }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{Math.round(masteryChange.before * 100)}%</span>
                        <ArrowRight size={14} color="var(--text-tertiary)" />
                        <span style={{ color: isCorrect ? 'var(--status-success)' : 'var(--status-error)' }}>
                          {Math.round(masteryChange.after * 100)}%
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Source Evidence</div>
                      <div style={{ marginTop: '4px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent-secondary)' }}>
                        <Info size={14} />
                        {currentQuestion.sourceReferences[0] ? (
                          <a href={`http://localhost:3001/api/sources/${encodeURIComponent(currentQuestion.sourceReferences[0].sourceId)}${currentQuestion.sourceReferences[0].sourceType === 'TEXTBOOK' ? `#page=${Number(currentQuestion.sourceReferences[0].location.match(/\d+/)?.[0] ?? 1)}` : ''}`} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-secondary)' }}>{currentQuestion.sourceReferences[0].label}</a>
                        ) : 'Source excerpt'}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
              
              <div style={{ marginTop: 'var(--space-6)', display: 'flex', justifyContent: 'space-between' }}>
                <button type="button" onClick={handlePreviousQuestion} disabled={visitedQuestions.findIndex(question => question.id === currentQuestion.id) <= 0} style={{ color: 'var(--text-secondary)', background: 'transparent', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', padding: '10px 16px' }}>Previous question</button>
                <button className="btn-primary" onClick={handleAdvance}>
                  {attemptedIds.size >= activeQuestionCount ? 'View Results' : 'Next Question'}
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
