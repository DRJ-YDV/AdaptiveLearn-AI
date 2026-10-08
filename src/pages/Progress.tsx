import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, BookOpen, TrendingUp } from 'lucide-react';
import { courseRepository } from '../services/courseRepository';
import type { Concept, LearnerModel } from '../types/domain';

export const Progress: React.FC = () => {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [learner, setLearner] = useState<LearnerModel | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([
      courseRepository.getConceptsByCourse('course_ml_101'),
      courseRepository.getLearnerModel('user_1', 'course_ml_101')
    ]).then(([loadedConcepts, model]) => {
      if (!active) return;
      setConcepts(loadedConcepts);
      setLearner(model);
    }).catch(error => console.error('Failed to load learner progress:', error));
    return () => { active = false; };
  }, []);

  const masteryStates = Object.values(learner?.masteryStates ?? {});
  const averageMastery = masteryStates.length
    ? Math.round(masteryStates.reduce((sum, state) => sum + state.masteryScore, 0) / masteryStates.length * 100)
    : 0;
  const activeMisconceptions = masteryStates.flatMap(state => state.activeMisconceptions.filter(item => !item.resolved));

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1100px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <header>
        <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>Learning Progress</h1>
        <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)' }}>Your assessment history, mastery, and topics that need another look.</p>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 'var(--space-4)' }}>
        <div className="panel-card"><div className="panel-title"><Activity size={16} /> Questions answered</div><strong style={{ fontSize: '2rem' }}>{learner?.history.length ?? 0}</strong></div>
        <div className="panel-card"><div className="panel-title"><TrendingUp size={16} /> Average mastery</div><strong style={{ fontSize: '2rem' }}>{masteryStates.length ? `${averageMastery}%` : '—'}</strong></div>
        <div className="panel-card"><div className="panel-title"><AlertTriangle size={16} /> Active misconceptions</div><strong style={{ fontSize: '2rem' }}>{activeMisconceptions.length}</strong></div>
        <div className="panel-card"><div className="panel-title"><BookOpen size={16} /> Concepts assessed</div><strong style={{ fontSize: '2rem' }}>{masteryStates.length} / {concepts.length}</strong></div>
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Mastery by concept</h2>
        {concepts.length === 0 ? <p style={{ color: 'var(--text-secondary)' }}>Upload course material to begin building your progress profile.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {concepts.map(concept => {
              const state = learner?.masteryStates[concept.id];
              const score = state?.masteryScore ?? 0;
              return (
                <div key={concept.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) minmax(120px, 2fr) 90px', gap: 'var(--space-4)', alignItems: 'center' }}>
                  <span>{concept.name}</span>
                  <div className="progress-bar-container"><div className="progress-bar-fill" style={{ width: `${Math.round(score * 100)}%` }} /></div>
                  <span style={{ color: 'var(--text-secondary)', textAlign: 'right' }}>{state ? `${Math.round(score * 100)}%` : 'Not assessed'}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="panel-card">
        <h2 className="panel-title">Recent answers</h2>
        {!learner?.history.length ? <p style={{ color: 'var(--text-secondary)' }}>Your answers will appear here after an assessment.</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {[...learner.history].reverse().slice(0, 10).map((event, index) => {
              const concept = concepts.find(item => item.id === event.conceptId);
              return <div key={`${event.questionId}-${event.timestamp}-${index}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)', paddingBottom: 'var(--space-2)', borderBottom: '1px solid var(--border-subtle)' }}>
                <span>{concept?.name ?? 'Course concept'}</span>
                <span style={{ color: event.isCorrect ? 'var(--status-success)' : 'var(--status-error)' }}>{event.isCorrect ? 'Correct' : 'Needs review'}</span>
              </div>;
            })}
          </div>
        )}
      </section>
    </div>
  );
};
