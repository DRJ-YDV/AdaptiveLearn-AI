import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarDays, Check, Clock3, GraduationCap, RefreshCw, Sparkles } from 'lucide-react';
import { courseRepository } from '../services/courseRepository';
import { learnerModelService } from '../services/learnerModelService';
import { studyPlanService, type StudyPlan, type StudyPlanSettings } from '../services/studyPlanService';
import type { Concept, Topic } from '../types/domain';

const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const todayString = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const defaultExamDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const readableDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

export const StudyPlanPage: React.FC = () => {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [plan, setPlan] = useState<StudyPlan | null>(() => studyPlanService.load());
  const [settings, setSettings] = useState<StudyPlanSettings>(() => plan?.settings ?? { examDate: defaultExamDate(), minutesPerDay: 45, studyDays: [1, 2, 3, 4, 5] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([courseRepository.getTopics('course_ml_101'), courseRepository.getConceptsByCourse('course_ml_101')])
      .then(([loadedTopics, loadedConcepts]) => {
        if (!active) return;
        setTopics(loadedTopics);
        setConcepts(loadedConcepts);
      })
      .catch(() => { if (active) setError('Could not load course concepts to build your plan.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const groupedSessions = useMemo(() => {
    const groups = new Map<string, NonNullable<StudyPlan>['sessions']>();
    plan?.sessions.forEach(session => groups.set(session.date, [...(groups.get(session.date) ?? []), session]));
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [plan]);
  const completedCount = plan?.sessions.filter(session => session.completed).length ?? 0;
  const progress = plan?.sessions.length ? Math.round(completedCount / plan.sessions.length * 100) : 0;

  const buildPlan = () => {
    if (settings.studyDays.length === 0) { setError('Choose at least one study day.'); return; }
    if (settings.examDate < todayString()) { setError('Choose today or a future date for your exam.'); return; }
    if (!Number.isFinite(settings.minutesPerDay) || settings.minutesPerDay < 30 || settings.minutesPerDay > 480) { setError('Daily study time must be between 30 and 480 minutes.'); return; }
    setError('');
    const nextPlan = studyPlanService.build(settings, topics, concepts, learnerModelService.getLearnerModel('user_1', 'course_ml_101'));
    studyPlanService.save(nextPlan);
    setPlan(nextPlan);
  };

  const toggleDay = (day: number) => setSettings(current => ({ ...current, studyDays: current.studyDays.includes(day) ? current.studyDays.filter(item => item !== day) : [...current.studyDays, day].sort() }));

  return <main className="study-plan-page animate-fade-in">
    <header className="study-plan-heading">
      <div>
        <div className="study-plan-eyebrow"><span className="study-plan-eyebrow-mark"><CalendarDays size={15} /></span> YOUR LEARNING ROUTINE</div>
        <h1>Study plan<span>.</span></h1>
        <p>Turn your course into a clear, achievable path to your exam.</p>
      </div>
      {plan && <button className="study-plan-reset" type="button" onClick={() => setPlan(null)}><RefreshCw size={15} /> Edit plan</button>}
    </header>

    {!plan && <section className="study-plan-builder" aria-labelledby="plan-builder-heading">
      <div className="study-plan-builder-form">
        <div className="study-plan-section-label">PERSONALIZE YOUR PLAN</div>
        <h2 id="plan-builder-heading">When is your exam?</h2>
        <p className="study-plan-muted">We’ll distribute your course concepts across the time you have and prioritize topics that need more practice.</p>
        <div className="study-plan-fields">
          <label className="study-plan-field"><span>Exam date</span><input type="date" min={todayString()} value={settings.examDate} onChange={event => setSettings(current => ({ ...current, examDate: event.target.value }))} /></label>
          <label className="study-plan-field"><span>Time available each study day</span><div className="study-plan-minutes"><input type="number" min={30} max={480} step={15} value={settings.minutesPerDay} onChange={event => setSettings(current => ({ ...current, minutesPerDay: Number(event.target.value) }))} /><span>minutes</span></div></label>
        </div>
        <fieldset className="study-plan-days"><legend>Which days work for you?</legend><div>{dayLabels.map((label, day) => <button key={label} type="button" aria-pressed={settings.studyDays.includes(day)} onClick={() => toggleDay(day)} className={settings.studyDays.includes(day) ? 'selected' : ''}>{label}</button>)}</div></fieldset>
        {error && <p className="study-plan-error" role="alert">{error}</p>}
        <button className="study-plan-submit" type="button" disabled={loading || concepts.length === 0} onClick={buildPlan}>{loading ? 'Loading your course…' : 'Create my study plan'}<ArrowRight size={17} /></button>
        {!loading && concepts.length === 0 && <p className="study-plan-inline-note">Add course material first to build a plan from your topics.</p>}
      </div>
      <aside className="study-plan-preview">
        <div className="study-plan-preview-icon"><Sparkles size={20} /></div>
        <div className="study-plan-section-label">BUILT AROUND YOU</div>
        <h3>Small sessions. Steady progress.</h3>
        <ul><li><Check size={15} /> More time for topics you find difficult</li><li><Check size={15} /> Prerequisites scheduled before advanced ideas</li><li><Check size={15} /> Flexible days that fit your week</li></ul>
        <div className="study-plan-course"><BookOpen size={16} /><span>Using your indexed course material</span></div>
      </aside>
    </section>}

    {plan && <>
      <section className="study-plan-overview" aria-label="Plan overview">
        <div className="study-plan-overview-main"><div className="study-plan-section-label">YOUR REVISION ROADMAP</div><h2>Ready for <span>{readableDate(plan.settings.examDate)}</span></h2><div className="study-plan-progress-meta"><span>{completedCount} of {plan.sessions.length} sessions complete</span><strong>{progress}%</strong></div><div className="study-plan-progress-track"><span style={{ width: `${progress}%` }} /></div></div>
        <div className="study-plan-stat"><Clock3 size={17} /><strong>{plan.settings.minutesPerDay}<small>min</small></strong><span>per study day</span></div>
        <div className="study-plan-stat"><CalendarDays size={17} /><strong>{groupedSessions.length}</strong><span>study days planned</span></div>
      </section>
      {plan.unscheduledConceptNames.length > 0 && <div role="status" className="study-plan-warning">Your current schedule leaves {plan.unscheduledConceptNames.length} concept{plan.unscheduledConceptNames.length === 1 ? '' : 's'} out. Add more study time or days to fit everything in.</div>}
      {groupedSessions.length === 0 ? <section className="study-plan-empty"><CalendarDays size={22} /><h2>No sessions scheduled</h2><p>Choose some study days and update your plan to create your revision schedule.</p></section> : <section className="study-plan-agenda" aria-label="Scheduled study sessions">
        <div className="study-plan-agenda-heading"><div><div className="study-plan-section-label">YOUR SCHEDULE</div><h2>One step at a time</h2></div><span>{groupedSessions.length} days · {plan.sessions.length} sessions</span></div>
        <div className="study-plan-timeline">{groupedSessions.map(([date, sessions]) => <section className="study-plan-day" key={date}>
          <div className="study-plan-date"><span className="study-plan-date-dot" /><strong>{readableDate(date)}</strong><span>{sessions.reduce((total, session) => total + session.estimatedMinutes, 0)} min</span></div>
          <div className="study-plan-session-list">{sessions.map(session => <article className={`study-plan-session${session.completed ? ' is-complete' : ''}`} key={session.id}>
            <button className="study-plan-check" type="button" aria-label={session.completed ? `Mark ${session.conceptName} incomplete` : `Mark ${session.conceptName} complete`} onClick={() => setPlan(studyPlanService.toggleSession(plan, session.id))}><Check size={15} /></button>
            <div className="study-plan-session-copy"><h3>{session.conceptName}</h3><p>{session.topicName} <span>·</span> {session.reason}</p></div>
            <span className="study-plan-session-time"><Clock3 size={14} />{session.estimatedMinutes} min</span>
            <div className="study-plan-session-actions"><button type="button" onClick={() => navigate(`/app/tutor?concept=${encodeURIComponent(session.conceptId)}`)}><GraduationCap size={15} /> Study</button><button type="button" onClick={() => navigate(`/app/assessment?topic=${encodeURIComponent(session.topicId)}`)}>Practice<ArrowRight size={14} /></button></div>
          </article>)}</div>
        </section>)}</div>
      </section>}
    </>}
  </main>;
};
