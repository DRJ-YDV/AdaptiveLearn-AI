import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Filter, RefreshCw, Book, Video, MonitorPlay, Bot, ZoomIn, ZoomOut, Maximize2, Minimize2, ChevronRight } from 'lucide-react';
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
  const [mapZoom, setMapZoom] = useState(1);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState('');
  const [detailWidth, setDetailWidth] = useState(() => {
    const savedWidth = Number(localStorage.getItem('adaptivelearn:knowledge-map-detail-width'));
    return Number.isFinite(savedWidth) && savedWidth >= 300 && savedWidth <= 620 ? savedWidth : 380;
  });
  const resizeStartRef = React.useRef<{ x: number; width: number } | null>(null);
  const mapElementRef = React.useRef<HTMLDivElement>(null);

  const updateDetailWidth = (width: number) => {
    const nextWidth = Math.max(300, Math.min(620, width));
    setDetailWidth(nextWidth);
    localStorage.setItem('adaptivelearn:knowledge-map-detail-width', String(nextWidth));
  };

  const startDetailResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    resizeStartRef.current = { x: event.clientX, width: detailWidth };
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
  };

  const moveDetailResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = resizeStartRef.current;
    if (start) updateDetailWidth(start.width + start.x - event.clientX);
  };

  const stopDetailResize = () => { resizeStartRef.current = null; };

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

  useEffect(() => {
    const syncFullscreen = () => setIsMapFullscreen(document.fullscreenElement === mapElementRef.current);
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);

  const toggleMapFullscreen = async () => {
    setFullscreenError('');
    try {
      if (document.fullscreenElement === mapElementRef.current) await document.exitFullscreen();
      else await mapElementRef.current?.requestFullscreen();
    } catch {
      setFullscreenError('Fullscreen is unavailable in this browser. Try the browser’s full-screen shortcut instead.');
    }
  };

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

  const graph = useMemo(() => {
    const positions = new Map<ID, { x: number; y: number }>();
    const visibleTopics = topics
      .filter(topic => selectedTopicId === 'ALL' || topic.id === selectedTopicId)
      .map(topic => ({ topic, concepts: filteredConcepts.filter(concept => concept.topicId === topic.id) }))
      .filter(group => group.concepts.length > 0);
    const conceptCardHeight = 84;
    const conceptRowStep = 76;
    const documents = new Map<string, { title: string; topics: typeof visibleTopics }>();
    visibleTopics.forEach(group => {
      const key = group.topic.sourceId ?? 'course-materials';
      const document = documents.get(key) ?? { title: group.topic.sourceTitle ?? 'Course materials', topics: [] };
      document.topics.push(group);
      documents.set(key, document);
    });
    let cursorY = 52;
    const documentNodes: Array<{ id: string; title: string; y: number; centerY: number }> = [];
    const topicNodes: Array<{ topic: Topic; documentId: string; y: number; centerY: number; concepts: Concept[] }> = [];
    for (const [documentId, document] of documents) {
      const documentStartY = cursorY;
      const topicLayouts = document.topics.map(group => ({
        ...group,
        height: Math.max(148, conceptCardHeight + (group.concepts.length - 1) * conceptRowStep + 44)
      }));
      const documentHeight = topicLayouts.reduce((total, group) => total + group.height + 20, 0) - 20;
      topicLayouts.forEach(({ topic, concepts: topicConcepts, height: topicHeight }) => {
        const topicY = cursorY + topicHeight / 2 - 39;
        const cardStackHeight = conceptCardHeight + Math.max(0, topicConcepts.length - 1) * conceptRowStep;
        const firstCardY = cursorY + (topicHeight - cardStackHeight) / 2;
        topicConcepts.forEach((concept, index) => positions.set(concept.id, { x: 590, y: firstCardY + index * conceptRowStep }));
        topicNodes.push({ topic, documentId, y: topicY, centerY: topicY + 39, concepts: topicConcepts });
        cursorY += topicHeight + 20;
      });
      cursorY -= 20;
      const documentY = documentStartY + documentHeight / 2 - 39;
      documentNodes.push({ id: documentId, title: document.title, y: documentY, centerY: documentY + 39 });
      cursorY += 36;
    }
    const height = Math.max(460, cursorY + 24);
    const documentEdges = topicNodes.map(node => ({ documentId: node.documentId, startY: documentNodes.find(document => document.id === node.documentId)?.centerY ?? height / 2, endY: node.centerY }));
    const conceptEdges = topicNodes.flatMap(node => node.concepts.map(concept => ({
      topicId: node.topic.id,
      conceptId: concept.id,
      startY: node.centerY,
      endY: (positions.get(concept.id)?.y ?? 0) + 42
    })));
    const visibleIds = new Set(filteredConcepts.map(concept => concept.id));
    const prerequisiteEdges = selectedConceptId ? filteredConcepts.flatMap(concept => concept.prerequisites
      .filter(prerequisite => visibleIds.has(prerequisite.conceptId) && (concept.id === selectedConceptId || prerequisite.conceptId === selectedConceptId))
      .map(prerequisite => ({ from: prerequisite.conceptId, to: concept.id }))) : [];
    return { positions, documentNodes, topicNodes, documentEdges, conceptEdges, prerequisiteEdges, width: 860, height };
  }, [filteredConcepts, topics, selectedTopicId, selectedConceptId]);

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
    <div ref={mapElementRef} className={`knowledge-map-container animate-fade-in${isMapFullscreen ? ' map-graph-fullscreen' : ''}`} style={{ display: 'flex', height: '100%', gap: '8px', '--map-detail-width': `${detailWidth}px` } as React.CSSProperties}>
      {/* Main Map Area */}
      <div className="map-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        
        {/* Toolbar */}
        <div className="map-toolbar" style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center', backgroundColor: 'var(--bg-surface)', padding: 'var(--space-3)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)' }}>
          <div className="map-search-control" style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-tertiary)' }} />
            <input 
              type="text" 
              placeholder="Search concepts..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ width: '100%', padding: '8px 12px 8px 36px', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)' }}
            />
          </div>
          
          <div className="map-topic-filter" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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

          <button className="btn-secondary map-reset-button" onClick={handleReset} title="Reset map" aria-label="Reset map">
            <RefreshCw size={16} />
          </button>
          <div className="map-zoom-controls" role="group" aria-label="Map view controls">
            <button type="button" onClick={() => setMapZoom(value => Math.min(1.5, Number((value + 0.1).toFixed(1))))} aria-label="Zoom in" title="Zoom in"><ZoomIn size={16} /></button>
            <span>{Math.round(mapZoom * 100)}%</span>
            <button type="button" onClick={() => setMapZoom(value => Math.max(0.6, Number((value - 0.1).toFixed(1))))} aria-label="Zoom out" title="Zoom out"><ZoomOut size={16} /></button>
            <button type="button" onClick={() => setMapZoom(1)} aria-label="Reset zoom" title="Reset zoom"><Maximize2 size={15} /></button>
          </div>
          <button type="button" className="map-fullscreen-button" onClick={toggleMapFullscreen} aria-label={isMapFullscreen ? 'Exit full size map' : 'Expand map to full window'} title={isMapFullscreen ? 'Exit full size' : 'Expand to full window'}>
            {isMapFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            <span>{isMapFullscreen ? 'Exit full size' : 'Full size'}</span>
          </button>
          {isMapFullscreen && <span className="map-fullscreen-exit-hint">Press Esc to exit</span>}
        </div>

        {/* Map Graph Visualization */}
        <div className="map-graph" style={{ flex: 1, backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', padding: 'var(--space-4)', overflow: 'auto' }}>
          {fullscreenError && <div className="map-fullscreen-error" role="status">{fullscreenError}</div>}
          {topics.length === 0 ? (
            <div className="placeholder-content" style={{ minHeight: '220px' }}>
              <Book size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
              <p>Upload course materials to build your knowledge map.</p>
            </div>
          ) : filteredConcepts.length === 0 ? (
            <div className="map-empty-state"><Search size={22} /><strong>No concepts match</strong><span>Try another search or choose a different topic.</span></div>
          ) : (
            <>
              <div className="map-graph-legend"><strong className="map-reading-guide">Follow the map <span>PDF</span><b>→</b><span>Topic</span><b>→</b><span>Concept</span></strong><span><i className="mastery-strong" /> Strong</span><span><i className="mastery-developing" /> Developing</span><span><i className="mastery-weak" /> Needs practice</span><span className="map-legend-link"><b /> Prerequisite link appears when selected</span></div>
              <div className="map-graph-scroll" style={{ width: graph.width * mapZoom, height: graph.height * mapZoom }}>
                <div className="map-graph-canvas" style={{ width: graph.width, height: graph.height, transform: `scale(${mapZoom})` }}>
                  <svg className="map-graph-edges" width={graph.width} height={graph.height} aria-hidden="true">
                    {graph.documentEdges.map(edge => <path key={`document-${edge.documentId}-${edge.endY}`} className="map-tree-edge map-course-edge" d={`M 222 ${edge.startY} C 260 ${edge.startY}, 260 ${edge.endY}, 300 ${edge.endY}`} />)}
                    {graph.conceptEdges.map(edge => {
                      const conceptPosition = graph.positions.get(edge.conceptId)!;
                      const selectedBranch = !selectedConceptId || selectedTopicId === edge.topicId || edge.conceptId === selectedConceptId || prerequisites.has(edge.conceptId) || dependents.has(edge.conceptId);
                      return <path key={`topic-${edge.conceptId}`} className={`map-tree-edge map-topic-edge${selectedBranch ? ' branch-active' : ''}`} d={`M 488 ${edge.startY} C 540 ${edge.startY}, 540 ${edge.endY}, ${conceptPosition.x} ${edge.endY}`} />;
                    })}
                    {graph.prerequisiteEdges.map(edge => {
                      const from = graph.positions.get(edge.from)!;
                      const to = graph.positions.get(edge.to)!;
                      return <path key={`prereq-${edge.from}-${edge.to}`} className="map-prerequisite-edge" d={`M 780 ${from.y + 42} C 845 ${from.y + 42}, 845 ${to.y + 42}, 780 ${to.y + 42}`} />;
                    })}
                  </svg>
                  {graph.documentNodes.map(document => <div key={document.id} className="map-source-node" style={{ left: 32, top: document.y }} title={document.title}><span>UPLOADED PDF</span><strong>{document.title}</strong><small>{graph.topicNodes.filter(node => node.documentId === document.id).length} topics</small></div>)}
                  {graph.topicNodes.map(({ topic, y, concepts: topicConcepts }) => <button type="button" key={`topic-${topic.id}`} className={`map-topic-node${selectedTopicId === topic.id ? ' topic-selected' : ''}`} style={{ left: 300, top: y }} onClick={() => { setSelectedTopicId(selectedTopicId === topic.id ? 'ALL' : topic.id); setSelectedConceptId(null); }} title={`Show only ${topic.name} concepts`} aria-label={`Show only ${topic.name}, ${topicConcepts.length} concepts`}>
                    <span>TOPIC · CLICK TO FOCUS</span><strong>{topic.name}</strong><small>{topicConcepts.length} concept{topicConcepts.length === 1 ? '' : 's'}<ChevronRight size={13} /></small>
                  </button>)}
                  {filteredConcepts.map(concept => {
                  const mastery = learnerModel?.masteryStates[concept.id]?.masteryScore || 0;
                  const isSelected = selectedConceptId === concept.id;
                  const isPrereq = prerequisites.has(concept.id);
                  const isDependent = dependents.has(concept.id);
                  const isDimmed = !!selectedConceptId && !isSelected && !isPrereq && !isDependent;
                  const position = graph.positions.get(concept.id)!;

                  return (
                    <button
                      key={concept.id}
                      aria-pressed={isSelected}
                      className={`knowledge-concept-card${isSelected ? ' selected' : ''}${isPrereq ? ' prerequisite' : ''}${isDependent ? ' dependent' : ''}${isDimmed ? ' dimmed' : ''}`}
                      onClick={() => setSelectedConceptId(isSelected ? null : concept.id)}
                      style={{ left: position.x, top: position.y }}
                    >
                      <strong>{concept.name}</strong>
                      <span className="map-node-mastery"><i style={{ backgroundColor: getMasteryColor(mastery) }} />{getMasteryLevel(mastery)} <b>{Math.round(mastery * 100)}%</b></span>
                    </button>
                  );
                  })}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Resizable divider: drag left to give the concept details more room. */}
      <div
        className="map-detail-resizer"
        role="separator"
        aria-label="Resize concept details panel"
        aria-orientation="vertical"
        aria-valuemin={300}
        aria-valuemax={620}
        aria-valuenow={detailWidth}
        tabIndex={0}
        title="Drag left to widen concept details; use arrow keys to resize"
        onPointerDown={startDetailResize}
        onPointerMove={moveDetailResize}
        onPointerUp={stopDetailResize}
        onPointerCancel={stopDetailResize}
        onKeyDown={event => {
          if (event.key === 'ArrowLeft') { event.preventDefault(); updateDetailWidth(detailWidth + 24); }
          if (event.key === 'ArrowRight') { event.preventDefault(); updateDetailWidth(detailWidth - 24); }
        }}
      />

      {/* Side Detail Panel */}
      <div className="map-detail-panel" style={{ width: detailWidth, flex: `0 0 ${detailWidth}px`, backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selectedConcept ? (
          <div className="map-detail-content animate-fade-in" style={{ overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="map-concept-intro">
              <div className="map-concept-kicker"><span /> CONCEPT OVERVIEW</div>
              <h2>{selectedConcept.name}</h2>
              <p>
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

            <div className="map-detail-section">
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

            <div className="map-detail-section">
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

            <div className="map-detail-section">
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
