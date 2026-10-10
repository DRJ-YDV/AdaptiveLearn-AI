import React, { useState, useEffect } from 'react';
import { ArrowRight, BookOpen, Brain, Activity, PlayCircle, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { nextBestActionService, NextBestAction } from '../services/nextBestActionService';
import { learnerModelService } from '../services/learnerModelService';
import { courseRepository } from '../services/courseRepository';
import type { Concept, LearnerModel, Topic } from '../types/domain';

export const Overview: React.FC = () => {
  const navigate = useNavigate();
  const [showWhy, setShowWhy] = useState(false);
  const [nba, setNba] = useState<NextBestAction | null>(null);

  const [isDiagnosticComplete, setIsDiagnosticComplete] = useState(false);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [learner, setLearner] = useState<LearnerModel | null>(null);

  const loadNba = async () => {
    const [lm, courseTopics, courseConcepts] = await Promise.all([
      courseRepository.getLearnerModel('user_1', 'course_ml_101'),
      courseRepository.getTopics('course_ml_101'),
      courseRepository.getConceptsByCourse('course_ml_101')
    ]);
    setLearner(lm);
    setTopics(courseTopics);
    setConcepts(courseConcepts);
    setIsDiagnosticComplete(!!lm.isDiagnosticComplete);
    
    if (lm.isDiagnosticComplete) {
      const action = await nextBestActionService.getNextBestAction('user_1', 'course_ml_101');
      setNba(action);
    }
  };

  useEffect(() => {
    let active = true;
    Promise.all([
      courseRepository.getLearnerModel('user_1', 'course_ml_101'),
      courseRepository.getTopics('course_ml_101'),
      courseRepository.getConceptsByCourse('course_ml_101')
    ]).then(async ([lm, courseTopics, courseConcepts]) => {
      const action = lm.isDiagnosticComplete
        ? await nextBestActionService.getNextBestAction('user_1', 'course_ml_101')
        : null;
      if (!active) return;
      setLearner(lm);
      setTopics(courseTopics);
      setConcepts(courseConcepts);
      setIsDiagnosticComplete(!!lm.isDiagnosticComplete);
      setNba(action);
    }).catch(error => console.error('Failed to load learner overview:', error));
    return () => { active = false; };
  }, []);

  const handleReset = () => {
    learnerModelService.reset();
    loadNba();
  };

  const executeAction = () => {
    if (!nba) return;
    if (nba.action === 'ASK_TUTOR') navigate(`/app/tutor?concept=${nba.conceptId}`);
    else if (nba.action === 'REVIEW_PREREQUISITE') navigate(`/app/knowledge-map?concept=${nba.conceptId}`);
    else if (nba.action === 'PRACTICE_CONCEPT') navigate(`/app/assessment`);
    else navigate(`/app/courses`);
  };

  const topicMastery = topics.map(topic => {
    const scores = concepts.filter(concept => concept.topicId === topic.id)
      .map(concept => learner?.masteryStates[concept.id]?.masteryScore)
      .filter((score): score is number => score !== undefined);
    const average = scores.length ? Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100) : null;
    const level = average === null ? 'new' : average >= 75 ? 'strong' : average >= 50 ? 'growing' : 'focus';
    return { topic, average, level };
  });
  const assessedTopicCount = topicMastery.filter(item => item.average !== null).length;

  return (
    <div className="dashboard-grid overview-dashboard animate-fade-in">
      <div className="main-column">
        
        <header style={{ marginBottom: 'var(--space-6)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
              Learning overview
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
              {concepts.length ? `${topics.length} topics • ${concepts.length} course concepts` : 'Upload course material to begin personalized study'}
            </p>
          </div>
          <button className="btn-secondary" onClick={handleReset} style={{ fontSize: '0.85rem' }}>
            <RefreshCw size={14} /> Reset Learner Progress
          </button>
        </header>

        {/* Next Best Action Card or Diagnostic Entry */}
        <div className="nba-card">
          {!isDiagnosticComplete ? (
            <>
              <div className="nba-header">
                <Brain size={16} />
                Initial Knowledge Check
              </div>
              <h2 className="nba-title">
                Start Course Diagnostic
              </h2>
              <p className="nba-reason">
                Take a short diagnostic quiz to personalize your learning path. This will evaluate your current knowledge of prerequisites and core concepts. It won't affect your grade.
              </p>
              <div className="nba-actions">
                <button className="btn-primary" onClick={() => navigate('/app/assessment?diagnostic=true')}>
                  <PlayCircle size={18} />
                  Start Diagnostic
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="nba-header">
                <Brain size={16} />
                Your Next Best Action
              </div>
              {nba ? (
                <>
                  <h2 className="nba-title">
                    {nba.action === 'ASK_TUTOR' && 'Ask Tutor about '}
                    {nba.action === 'REVIEW_PREREQUISITE' && 'Review Prerequisite: '}
                    {nba.action === 'PRACTICE_CONCEPT' && 'Practice: '}
                    {nba.action === 'CONTINUE' && 'Continue Learning'}
                    {nba.conceptName && <span style={{ color: 'var(--accent-primary)' }}>{nba.conceptName}</span>}
                  </h2>
                  
                  <p className="nba-reason">
                    {nba.reasons[0]}
                  </p>
                  
                  <div className="nba-actions">
                    <button className="btn-primary" onClick={executeAction}>
                      <PlayCircle size={18} />
                      Start Action
                    </button>
                    <button className="btn-text" onClick={() => setShowWhy(!showWhy)}>
                      {showWhy ? 'Hide Evidence' : 'Why this?'}
                    </button>
                  </div>
                  
                  {showWhy && (
                    <div className="animate-fade-in" style={{ marginTop: 'var(--space-6)', padding: 'var(--space-4)', backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <h4 style={{ fontSize: '0.9rem', marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}>Evidence & Reasoning</h4>
                      <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                        {nba.reasons.map((reason, idx) => (
                          <li key={idx} style={{ display: 'flex', gap: 'var(--space-2)', fontSize: '0.85rem' }}>
                            <Activity size={14} style={{ color: 'var(--status-info)', marginTop: '2px' }} />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : (
                <div className="placeholder-content">Loading intelligent recommendation...</div>
              )}
            </>
          )}
        </div>

        {/* Recent Activity / Continue Learning */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Continue Learning</h3>
          
        <div style={{ display: 'flex', gap: 'var(--space-4)' }}>
            <div className="panel-card" onClick={() => navigate('/app/courses')} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-4)', cursor: 'pointer', transition: 'border-color 0.2s' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-md)', backgroundColor: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-secondary)' }}>
                <BookOpen size={24} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px' }}>COURSE MATERIALS</div>
                <div style={{ fontWeight: 500 }}>{concepts.length ? `${concepts.length} concepts across ${topics.length} topics` : 'Upload your first course material'}</div>
                <div className="progress-bar-container" style={{ marginTop: 'var(--space-3)' }}>
                  <div className="progress-bar-fill" style={{ width: `${concepts.length ? Math.round((Object.keys(learner?.masteryStates ?? {}).length / concepts.length) * 100) : 0}%` }}></div>
                </div>
              </div>
              <ArrowRight size={20} style={{ color: 'var(--text-tertiary)' }} />
            </div>
          </div>
        </div>
      </div>

      <div className="side-panel">
        <div className="panel-card mastery-overview-card animate-fade-in delay-1">
          <div className="mastery-panel-header">
            <div className="mastery-heading-icon"><Activity size={17} /></div>
            <div className="mastery-heading-copy"><h3>Current Mastery</h3><p>Progress by topic</p></div>
            <span className="mastery-count">{assessedTopicCount}<i> / {topics.length} assessed</i></span>
          </div>
          <div className="metric-list mastery-topic-list">
            {topicMastery.map(({ topic, average, level }) => (
              <div className={`mastery-topic mastery-${level}`} key={topic.id}>
                <div className="mastery-topic-top">
                  <span className="mastery-topic-name" title={topic.name}>{topic.name}</span>
                  <span className="mastery-topic-score">{average === null ? 'New' : `${average}%`}</span>
                </div>
                <div className="mastery-topic-track" aria-label={average === null ? `${topic.name}: not assessed yet` : `${topic.name}: ${average}% mastery`}>
                  <span style={{ width: `${average ?? 0}%` }} />
                </div>
              </div>
            ))}
            {topics.length === 0 && <p className="mastery-empty">Add course material to see mastery by topic.</p>}
          </div>
          <button className="btn-secondary" onClick={() => navigate('/app/knowledge-map')} style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-5)' }}>
            View Knowledge Map
          </button>
        </div>

        <div className="panel-card animate-fade-in delay-2">
          <div className="panel-title">Mastery Target</div>
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ fontSize: '2.5rem', fontWeight: 700, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {concepts.filter(concept => (learner?.masteryStates[concept.id]?.masteryScore ?? 0) >= 0.8).length} / {concepts.length}
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: 'var(--space-2)' }}>
              Concepts at strong mastery
            </div>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${concepts.length ? Math.round((concepts.filter(concept => (learner?.masteryStates[concept.id]?.masteryScore ?? 0) >= 0.8).length / concepts.length) * 100) : 0}%` }}></div>
          </div>
        </div>
      </div>
    </div>
  );
};
