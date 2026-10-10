import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Library, 
  Network, 
  Bot, 
  BrainCircuit, 
  TrendingUp, 
  Activity,
  Search,
  Bell,
  Settings,
  UserRound,
  X,
  BookOpen,
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  Sparkles
} from 'lucide-react';
import { courseRepository } from '../services/courseRepository';
import { learnerModelService } from '../services/learnerModelService';
import type { Concept } from '../types/domain';

const navItems = [
  { path: '/', label: 'Product Home', icon: Sparkles },
  { path: '/app', label: 'Overview', icon: LayoutDashboard },
  { path: '/app/courses', label: 'My Courses', icon: Library },
  { path: '/app/knowledge-map', label: 'Knowledge Map', icon: Network },
  { path: '/app/tutor', label: 'AI Tutor', icon: Bot },
  { path: '/app/assessment', label: 'Adaptive Assessment', icon: BrainCircuit },
  { path: '/app/progress', label: 'Learning Progress', icon: Activity },
  { path: '/app/study-plan', label: 'Study Plan', icon: CalendarDays },
  { path: '/app/evaluation', label: 'Evaluation & Benchmarks', icon: TrendingUp },
];

export const Layout: React.FC = () => {
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [reducedMotion, setReducedMotion] = useState(() => localStorage.getItem('adaptivelearn-reduced-motion') === 'true');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('adaptivelearn-notifications') !== 'false');
  const learner = learnerModelService.getLearnerModel('user_1', 'course_ml_101');
  const learningAlerts = Object.values(learner.masteryStates).flatMap(state => {
    const concept = concepts.find(item => item.id === state.conceptId);
    const unresolved = state.activeMisconceptions.filter(item => !item.resolved).length;
    if (unresolved) return [{ id: state.conceptId, title: `Review ${concept?.name ?? 'a course concept'}`, detail: `${unresolved} misconception${unresolved === 1 ? '' : 's'} to revisit`, conceptId: state.conceptId }];
    if (state.masteryScore < 0.4) return [{ id: state.conceptId, title: `${concept?.name ?? 'A course concept'} needs practice`, detail: `Current mastery: ${Math.round(state.masteryScore * 100)}%`, conceptId: state.conceptId }];
    return [];
  });
  const searchResults = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    const routes = navItems.filter(item => item.label.toLocaleLowerCase().includes(normalized)).map(item => ({ label: item.label, detail: 'App section', to: item.path }));
    const matches = concepts.filter(concept => concept.name.toLocaleLowerCase().includes(normalized)).slice(0, 8).map(concept => ({ label: concept.name, detail: 'Course concept', to: `/app/knowledge-map?concept=${encodeURIComponent(concept.id)}` }));
    return [...routes, ...matches].slice(0, 10);
  }, [concepts, query]);

  useEffect(() => {
    courseRepository.getConceptsByCourse('course_ml_101').then(setConcepts).catch(() => setConcepts([]));
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);
    localStorage.setItem('adaptivelearn-reduced-motion', String(reducedMotion));
  }, [reducedMotion]);

  useEffect(() => {
    localStorage.setItem('adaptivelearn-notifications', String(notificationsEnabled));
  }, [notificationsEnabled]);

  const openSearch = () => { setSearchOpen(true); setNotificationsOpen(false); setSettingsOpen(false); };

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-text">AdaptiveLearn AI</div>
        </div>
        <nav className="nav-links">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink 
                key={item.path}
                to={item.path} 
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                end={item.path === '/app' || item.path === '/'}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button type="button" className="user-profile profile-link" onClick={() => navigate('/app/progress')} aria-label="Open learner profile and progress">
            <div className="avatar">AL</div>
            <div>
              <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>Learner Profile</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Personalized learning</div>
            </div>
          </button>
        </div>
      </aside>
      
      <main className="main-content">
        <header className="topbar">
          <div className="page-title">
            {/* Can be made dynamic based on route */}
          </div>
          <div className="topbar-actions" aria-label="Quick actions">
            <button type="button" className="icon-button" onClick={openSearch} aria-label="Search courses and concepts" title="Search courses and concepts"><Search size={18} /></button>
            <div className="quick-action-wrap">
              <button type="button" className="icon-button" onClick={() => { setNotificationsOpen(value => !value); setSettingsOpen(false); }} aria-label="Learning notifications" title="Learning notifications">
                <Bell size={18} />{notificationsEnabled && learningAlerts.length > 0 && <span className="notification-dot" />}
              </button>
              {notificationsOpen && <div className="quick-popover" role="dialog" aria-label="Learning notifications">
                <div className="popover-heading"><strong>Learning reminders</strong><button className="icon-button small-icon-button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications"><X size={16} /></button></div>
                {!notificationsEnabled ? <p className="popover-empty">Learning reminders are turned off. Enable them in Settings.</p>
                  : learningAlerts.length === 0 ? <p className="popover-empty">You’re all caught up. Practice results will surface topics that need another look.</p>
                    : learningAlerts.slice(0, 5).map(alert => <button key={alert.id} className="notification-item" onClick={() => { setNotificationsOpen(false); navigate(`/app/knowledge-map?concept=${encodeURIComponent(alert.conceptId)}`); }}><AlertTriangle size={16} /><span><strong>{alert.title}</strong><small>{alert.detail}</small></span><ArrowRight size={14} /></button>)}
              </div>}
            </div>
            <button type="button" className="icon-button" onClick={() => { setSettingsOpen(true); setNotificationsOpen(false); }} aria-label="Settings" title="Settings"><Settings size={18} /></button>
            <button type="button" className="icon-button profile-icon-button" onClick={() => navigate('/app/progress')} aria-label="Open learner profile" title="Learner profile"><UserRound size={18} /></button>
          </div>
        </header>
        
        <div className="page-container">
          <Outlet />
        </div>
      </main>

      {searchOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
        <section className="quick-dialog" role="dialog" aria-modal="true" aria-label="Search AdaptiveLearn">
          <div className="search-input-wrap"><Search size={19} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') setSearchOpen(false); }} placeholder="Search pages and course concepts..." aria-label="Search pages and course concepts" /><button className="icon-button small-icon-button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={17} /></button></div>
          <div className="search-results" aria-live="polite">
            {!query.trim() ? <p className="popover-empty"><BookOpen size={16} /> Search app sections and concepts from your course materials.</p>
              : searchResults.length === 0 ? <p className="popover-empty">No matching pages or concepts found.</p>
                : searchResults.map(result => <button key={`${result.to}-${result.label}`} className="search-result" onClick={() => { setSearchOpen(false); setQuery(''); navigate(result.to); }}><span><strong>{result.label}</strong><small>{result.detail}</small></span><ArrowRight size={16} /></button>)}
          </div>
        </section>
      </div>}

      {settingsOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSettingsOpen(false); }}>
        <section className="quick-dialog settings-dialog" role="dialog" aria-modal="true" aria-label="Settings">
          <div className="popover-heading"><div><h2>Settings</h2><p>Preferences for this browser on this device.</p></div><button className="icon-button small-icon-button" onClick={() => setSettingsOpen(false)} aria-label="Close settings"><X size={17} /></button></div>
          <label className="setting-row"><span><strong>Learning reminders</strong><small>Show practice reminders from your saved mastery results.</small></span><input type="checkbox" checked={notificationsEnabled} onChange={event => setNotificationsEnabled(event.target.checked)} /></label>
          <label className="setting-row"><span><strong>Reduce motion</strong><small>Limit interface animations.</small></span><input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} /></label>
          <p className="settings-note">Your learner profile and preferences are stored locally in this browser. There is no sign-in or cross-device profile yet.</p>
        </section>
      </div>}
    </div>
  );
};
