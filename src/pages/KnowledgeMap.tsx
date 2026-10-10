import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, RefreshCw, Book, Video, MonitorPlay, Bot } from 'lucide-react';
import { courseRepository } from '../services/courseRepository';
import { Concept, Topic, LearnerModel, ID } from '../types/domain';

export const KnowledgeMap: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [topics, setTopics] = useState<Topic[]>([]);
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [learnerModel, setLearnerModel] = useState<LearnerModel | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopicId, setSelectedTopicId] = useState<ID | 'ALL'>('ALL');
  const [selectedConceptId, setSelectedConceptId] = useState<ID | null>(searchParams.get('concept'));

  useEffect(() => {
    const loadData = async () => {
      const courseId = 'course_ml_101';
      const [t, c, lm] = await Promise.all([
        courseRepository.getTopics(courseId),
        courseRepository.getConceptsByCourse(courseId),
        courseRepository.getLearnerModel('user_1', courseId)
      ]);
      setTopics(t);
      setConcepts(c);
      setLearnerModel(lm);
      const requestedConceptId = searchParams.get('concept');
      setSelectedConceptId(requestedConceptId && c.some(concept => concept.id === requestedConceptId) ? requestedConceptId : null);
    };
    loadData();
  }, [searchParams]);

  const getMasteryLevel = (score: number) => {
    if (score >= 0.8) return 'STRONG';
    if (score >= 0.5) return 'DEVELOPING';
    if (score > 0.0) return 'WEAK';
    return 'UNASSESSED';
  };

  const getMasteryColor = (score: number) => {
    if (score >= 0.8) return 'var(--status-success)';
    if (score >= 0.5) return 'var(--status-warning)';
    if (score > 0) return 'var(--status-error)';
    return 'var(--text-tertiary)';
  };

  // Compute related concepts for highlighting
  const { prerequisites, dependents } = useMemo(() => {
    if (!selectedConceptId) return { prerequisites: new Set<ID>(), dependents: new Set<ID>() };
    
    const selected = concepts.find(c => c.id === selectedConceptId);
    if (!selected) return { prerequisites: new Set<ID>(), dependents: new Set<ID>() };

    const pre = new Set(selected.prerequisites.map(p => p.conceptId));
    
    const dep = new Set<ID>();
    concepts.forEach(c => {
      if (c.prerequisites.some(p => p.conceptId === selectedConceptId)) {
        dep.add(c.id);
      }
    });
    
    return { prerequisites: pre, dependents: dep };
  }, [selectedConceptId, concepts]);

  const filteredConcepts = useMemo(() => {
    return concepts.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesTopic = selectedTopicId === 'ALL' || c.topicId === selectedTopicId;
      return matchesSearch && matchesTopic;
    });
  }, [concepts, searchQuery, selectedTopicId]);

  const selectedConcept = concepts.find(c => c.id === selectedConceptId);
  const selectedConceptMastery = selectedConcept && learnerModel?.masteryStates[selectedConcept.id];

  const handleReset = () => {
    setSearchQuery('');
    setSelectedTopicId('ALL');
    setSelectedConceptId(null);
  };

  const getIconForSourceType = (type: string) => {
    switch (type) {
      case 'TEXTBOOK': return <Book size={14} />;
      case 'VIDEO': return <Video size={14} />;
      case 'SLIDE': return <MonitorPlay size={14} />;
      default: return <Book size={14} />;
    }
  };

  return (
    <div className="knowledge-map-container animate-fade-in" style={{ display: 'flex', height: '100%', gap: 'var(--space-6)' }}>
      {/* Main Map Area */}
      <div className="map-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        
        {/* Toolbar */}
        <div className="map-toolbar" style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'center', backgroundColor: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              placeholder="Search concepts..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
            />
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <Filter size={16} color="var(--text-tertiary)" />
            <select 
              value={selectedTopicId}
              onChange={e => setSelectedTopicId(e.target.value)}
              style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}
            >
              <option value="ALL">All Topics</option>
              {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <button className="btn-secondary" onClick={handleReset} title="Reset Map">
            <RefreshCw size={16} />
          </button>
        </div>

        {/* Map Graph Visualization */}
        <div className="map-graph" style={{ flex: 1, backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 'var(--space-6)', overflowY: 'auto' }}>
          {topics.length === 0 ? (
            <div className="placeholder-content" style={{ minHeight: '220px' }}>
              <Book size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
              <p>Upload course materials to build your knowledge map.</p>
            </div>
          ) : topics.filter(t => selectedTopicId === 'ALL' || t.id === selectedTopicId).map(topic => (
            <div className="map-topic-group" key={topic.id} style={{ marginBottom: 'var(--space-8)' }}>
              <h3 className="map-topic-heading" style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-2)' }}>
                {topic.name}
              </h3>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
                {filteredConcepts.filter(c => c.topicId === topic.id).map(concept => {
                  const mastery = learnerModel?.masteryStates[concept.id]?.masteryScore || 0;
                  const isSelected = selectedConceptId === concept.id;
                  const isPrereq = prerequisites.has(concept.id);
                  const isDependent = dependents.has(concept.id);
                  
                  // Dim if a concept is selected and this one is neither selected, prereq, nor dependent
                  const isDimmed = selectedConceptId && !isSelected && !isPrereq && !isDependent;

                  return (
                    <div 
                      key={concept.id}
                      role="button"
                      tabIndex={0}
                      aria-pressed={isSelected}
                      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedConceptId(isSelected ? null : concept.id); } }}
                      className={`knowledge-concept-card${isSelected ? ' selected' : ''}${isPrereq ? ' prerequisite' : ''}${isDependent ? ' dependent' : ''}${isDimmed ? ' dimmed' : ''}`}
                      onClick={() => setSelectedConceptId(isSelected ? null : concept.id)}
                      style={{
                        padding: 'var(--space-3) var(--space-4)',
                        backgroundColor: isSelected ? 'var(--bg-surface-highlight)' : 'var(--bg-base)',
                        border: `1px solid ${isSelected ? 'var(--accent-primary)' : (isPrereq ? 'var(--status-warning)' : isDependent ? 'var(--status-info)' : 'var(--border-strong)')}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer',
                        opacity: isDimmed ? 0.3 : 1,
                        transition: 'all 0.2s',
                        boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                        minWidth: '200px'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{concept.name}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: getMasteryColor(mastery) }} />
                        {getMasteryLevel(mastery)} ({Math.round(mastery * 100)}%)
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side Detail Panel */}
      <div className="map-detail-panel" style={{ width: '340px', backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedConcept ? (
          <div className="animate-fade-in" style={{ padding: 'var(--space-5)', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                CONCEPT
              </div>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>{selectedConcept.name}</h2>
              <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.5 }}>
                {selectedConcept.description}
              </p>
            </div>

            {selectedConceptMastery && (
              <div style={{ backgroundColor: 'var(--bg-base)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Mastery</span>
                  <span style={{ fontWeight: 700, color: getMasteryColor(selectedConceptMastery.masteryScore) }}>
                    {Math.round(selectedConceptMastery.masteryScore * 100)}%
                  </span>
                </div>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${selectedConceptMastery.masteryScore * 100}%`, background: getMasteryColor(selectedConceptMastery.masteryScore) }} />
                </div>
              </div>
            )}

            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Prerequisites</h4>
              {selectedConcept.prerequisites.length > 0 ? (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {selectedConcept.prerequisites.map(p => {
                    const preC = concepts.find(c => c.id === p.conceptId);
                    return preC ? (
                      <li key={p.conceptId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--status-warning)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                        {preC.name}
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No prerequisites.</div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Depends on this</h4>
              {dependents.size > 0 ? (
                <ul style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {Array.from(dependents).map(id => {
                    const depC = concepts.find(c => c.id === id);
                    return depC ? (
                      <li key={id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontSize: '0.9rem', color: 'var(--status-info)' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                        {depC.name}
                      </li>
                    ) : null;
                  })}
                </ul>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No dependents.</div>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>Evidence</h4>
              {selectedConcept.sourceReferences.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  {selectedConcept.sourceReferences.map(ref => (
                    <div key={ref.id} style={{ backgroundColor: 'var(--bg-base)', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', fontWeight: 500, fontSize: '0.85rem' }}>
                        {getIconForSourceType(ref.sourceType)}
                        {ref.label}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Location: {ref.location}
                      </div>
                      {ref.excerpt && (
                        <div style={{ marginTop: 'var(--space-2)', padding: 'var(--space-2)', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-tertiary)' }}>
                          "{ref.excerpt}"
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>No source evidence.</div>
              )}
            </div>

            <button 
              className="btn-primary" 
              onClick={() => navigate(`/app/tutor?concept=${selectedConcept.id}`)}
              style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-4)' }}
            >
              <Bot size={18} />
              Ask Tutor about this concept
            </button>

          </div>
        ) : (
          <div className="placeholder-content">
            <Book size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
            <p>Select a concept to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};
