import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Target, TrendingUp, AlertTriangle, ArrowRight, Map, Bot, Activity } from 'lucide-react';
import { courseRepository } from '../services/courseRepository';
import { Concept, LearnerModel } from '../types/domain';

const LATEST_ASSESSMENT_RESULT_KEY = 'adaptivelearn:latest-assessment-result';

const readLatestConceptIds = (): Set<string> | null => {
  try {
    const stored = localStorage.getItem(LATEST_ASSESSMENT_RESULT_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as { conceptIds?: unknown };
    return Array.isArray(parsed.conceptIds) ? new Set(parsed.conceptIds.filter((id): id is string => typeof id === 'string')) : null;
  } catch {
    return null;
  }
};

export const AssessmentResults: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isDiagnostic = searchParams.get('diagnostic') === 'true';
  const [learnerModel, setLearnerModel] = useState<LearnerModel | null>(null);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [latestConceptIds] = useState<Set<string> | null>(readLatestConceptIds);

  useEffect(() => {
    const loadData = async () => {
      const lm = await courseRepository.getLearnerModel('user_1', 'course_ml_101');
      const cons = await courseRepository.getConceptsByCourse('course_ml_101');
      setLearnerModel(lm);
      setConcepts(latestConceptIds ? cons.filter(concept => latestConceptIds.has(concept.id)) : cons);
    };
    loadData();
  }, [latestConceptIds]);

  const { weakestConcept, strongestConcept, developingConcepts } = useMemo(() => {
    if (!learnerModel || concepts.length === 0) return { weakestConcept: null, strongestConcept: null, developingConcepts: [] };
    
    let weakest: { c: Concept, m: number } | null = null;
    let strongest: { c: Concept, m: number } | null = null;
    const developing: { c: Concept, m: number }[] = [];

    for (const c of concepts) {
      const state = learnerModel.masteryStates[c.id];
      if (!state) continue; // Skip unassessed concepts in diagnostic
      const mastery = state.masteryScore;
      
      if (!weakest || mastery < weakest.m) weakest = { c, m: mastery };
      if (!strongest || mastery > strongest.m) strongest = { c, m: mastery };
      
      if (mastery >= 0.4 && mastery < 0.7) {
        developing.push({ c, m: mastery });
      }
    }

    return { weakestConcept: weakest, strongestConcept: strongest, developingConcepts: developing };
  }, [learnerModel, concepts]);

  if (!learnerModel || concepts.length === 0) return null;

  return (
    <div className="results-dashboard animate-fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          {isDiagnostic ? (
            <Activity size={48} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-4)' }} />
          ) : (
            <Target size={48} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-4)' }} />
          )}
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            {isDiagnostic ? 'Initial Learning Profile' : 'Assessment Complete'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            {isDiagnostic 
              ? 'Your learner model has been initialized based on your diagnostic results.'
              : 'Your learner model has been updated based on your performance.'}
          </p>
        </div>

        <div className="nba-card" style={{ padding: 'var(--space-8)' }}>
          <div className="nba-header">
            <TrendingUp size={16} /> {isDiagnostic ? 'Your Knowledge Baseline' : 'Your Learning Signal'}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
            
            {weakestConcept && (
              <div style={{ padding: 'var(--space-5)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-lg)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--status-error)', marginBottom: 'var(--space-3)' }}>
                  <AlertTriangle size={18} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    {isDiagnostic ? 'Needs Attention' : 'Weakest Concept'}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-2)' }}>{weakestConcept.c.name}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                  Mastery: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(weakestConcept.m * 100)}%</strong>
                </div>
                {learnerModel.masteryStates[weakestConcept.c.id]?.trend === 'DOWN' && !isDiagnostic && (
                  <div style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--status-error)' }}>
                    Accuracy is declining. Focus needed here.
                  </div>
                )}
                
                <div style={{ marginTop: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  <button 
                    onClick={() => navigate(`/app/tutor?concept=${weakestConcept.c.id}`)}
                    className="btn-secondary" 
                    style={{ fontSize: '0.85rem', justifyContent: 'center' }}
                  >
                    <Bot size={14} /> Ask Tutor to explain
                  </button>
                  <button 
                    onClick={() => navigate(`/app/knowledge-map?concept=${weakestConcept.c.id}`)}
                    className="btn-text" 
                    style={{ fontSize: '0.85rem', justifyContent: 'center' }}
                  >
                    <Map size={14} /> Explore Prerequisites
                  </button>
                </div>
              </div>
            )}

            {strongestConcept && (
              <div style={{ padding: 'var(--space-5)', backgroundColor: 'rgba(16, 185, 129, 0.05)', border: '1px solid var(--status-success)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--status-success)', marginBottom: 'var(--space-3)' }}>
                  <Target size={18} />
                  <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase' }}>
                    {isDiagnostic ? 'Strong Foundation' : 'Strongest Concept'}
                  </span>
                </div>
                <h3 style={{ fontSize: '1.3rem', marginBottom: 'var(--space-2)' }}>{strongestConcept.c.name}</h3>
                <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', flex: 1 }}>
                  Mastery: <strong style={{ color: 'var(--text-primary)' }}>{Math.round(strongestConcept.m * 100)}%</strong>
                </div>
                {learnerModel.masteryStates[strongestConcept.c.id]?.trend === 'UP' && !isDiagnostic && (
                  <div style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--status-success)' }}>
                    Solid understanding. Ready to advance.
                  </div>
                )}
              </div>
            )}
            
          </div>
          
          {isDiagnostic && developingConcepts.length > 0 && (
            <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-secondary)', marginBottom: 'var(--space-3)' }}>
                <Activity size={18} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem', textTransform: 'uppercase' }}>Developing Concepts</span>
              </div>
              <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', margin: 0, padding: 0, listStyle: 'none' }}>
                {developingConcepts.map((dc, i) => (
                  <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-2) 0', borderBottom: i < developingConcepts.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <span style={{ fontWeight: 500 }}>{dc.c.name}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>{Math.round(dc.m * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detected Misconceptions */}
          {(() => {
            const allMisconceptions = Object.values(learnerModel.masteryStates)
              .filter(ms => !latestConceptIds || latestConceptIds.has(ms.conceptId))
              .flatMap(ms => ms.activeMisconceptions);
            if (allMisconceptions.length > 0) {
              return (
                <div style={{ marginTop: 'var(--space-6)', padding: 'var(--space-5)', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)' }}>
                  <h4 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-4)', color: 'var(--status-error)' }}>
                    Detected Misconceptions
                  </h4>
                  <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                    {allMisconceptions.map((m, idx) => {
                      const concept = concepts.find(c => c.id === m.conceptId);
                      return (
                        <li key={idx} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start' }}>
                          <AlertTriangle size={16} color="var(--status-error)" style={{ marginTop: '2px' }} />
                          <div>
                            <span style={{ fontWeight: 600 }}>{concept?.name || 'Concept'}</span>
                            <span style={{ color: 'var(--text-secondary)', marginLeft: '8px' }}>Detected {m.occurrenceCount} time(s)</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            }
            return null;
          })()}

          <div style={{ marginTop: 'var(--space-8)', paddingTop: 'var(--space-6)', borderTop: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-4)' }}>Recommended Next Action</h3>
            <div style={{ padding: 'var(--space-4)', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              {weakestConcept ? (
                <div>
                  <p style={{ fontSize: '1.05rem', marginBottom: 'var(--space-2)' }}>
                    Review <strong>{weakestConcept.c.name}</strong> before attempting more advanced topics.
                  </p>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                    Your recent performance indicates this foundational concept needs reinforcement. The AI Tutor can provide targeted examples from your course materials.
                  </p>
                </div>
              ) : (
                <p>You're doing great! Proceed to the next module.</p>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-4)' }}>
          <button className="btn-primary" onClick={() => navigate('/app')}>
            Return to Dashboard
            <ArrowRight size={18} />
          </button>
        </div>

      </div>
    </div>
  );
};
