import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Download, FileText, Layers, RefreshCw, Sparkles } from 'lucide-react';
import { FormattedAnswer } from '../components/FormattedAnswer';
import { revisionMaterialsService, RevisionKit as RevisionKitData } from '../services/revisionMaterialsService';
import { DocumentChunk } from '../types/rag';

interface RevisionSource {
  sourceId: string;
  sourceTitle: string;
  chunks: DocumentChunk[];
}

const COURSE_ID = 'course_ml_101';

export const RevisionKit: React.FC = () => {
  const [sources, setSources] = useState<RevisionSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [kit, setKit] = useState<RevisionKitData>();
  const [loadingSources, setLoadingSources] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [activeCard, setActiveCard] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  const loadSources = useCallback(async () => {
    const response = await fetch(`http://localhost:3001/api/vector/chunks?courseId=${encodeURIComponent(COURSE_ID)}`);
    if (!response.ok) throw new Error('Could not load indexed course materials.');
    const data = await response.json() as { chunks?: DocumentChunk[] };
    const grouped = new Map<string, RevisionSource>();
    for (const chunk of data.chunks ?? []) {
      if (!chunk.metadata?.sourceId || !chunk.metadata.sourceTitle) continue;
      const source = grouped.get(chunk.metadata.sourceId) ?? { sourceId: chunk.metadata.sourceId, sourceTitle: chunk.metadata.sourceTitle, chunks: [] };
      source.chunks.push(chunk);
      grouped.set(source.sourceId, source);
    }
    return [...grouped.values()].sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
  }, []);

  useEffect(() => {
    let active = true;
    loadSources().then(availableSources => {
      if (!active) return;
      setSources(availableSources);
      setSelectedSourceId(current => current || availableSources[0]?.sourceId || '');
      setKit(availableSources[0] ? revisionMaterialsService.get(availableSources[0].sourceId) : undefined);
      setError('');
    }).catch(loadError => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load indexed course materials.');
    }).finally(() => {
      if (active) setLoadingSources(false);
    });
    return () => { active = false; };
  }, [loadSources]);

  const selectedSource = sources.find(source => source.sourceId === selectedSourceId);
  const card = kit?.flashcards[activeCard];

  const selectSource = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    setKit(sourceId ? revisionMaterialsService.get(sourceId) : undefined);
    setActiveCard(0);
    setShowAnswer(false);
    setError('');
  };

  const generateKit = async () => {
    if (!selectedSourceId) return;
    setGenerating(true);
    setError('');
    try {
      const generated = await revisionMaterialsService.generate(COURSE_ID, selectedSourceId);
      setKit(generated);
      setActiveCard(0);
      setShowAnswer(false);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : 'Could not generate revision materials.');
    } finally {
      setGenerating(false);
    }
  };

  const downloadKit = () => {
    if (!kit) return;
    const flashcards = kit.flashcards.map((item, index) => `### ${index + 1}. ${item.front}\n\n${item.back}\n\nSources: ${item.evidenceChunkIds.map(id => selectedSource?.chunks.find(chunk => chunk.id === id)?.metadata.location ?? id).join(', ')}`).join('\n\n');
    const content = `# Revision kit: ${kit.sourceTitle}\n\nGenerated ${new Date(kit.generatedAt).toLocaleString()}\n\n## Study notes\n\n${kit.summary}\n\n## Key points\n\n${kit.keyPoints.map(point => `- ${point}`).join('\n')}\n\n## Flashcards\n\n${flashcards}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${kit.sourceTitle.replace(/\.pdf$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLocaleLowerCase() || 'course'}-revision-kit.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const setCardIndex = (next: number) => {
    if (!kit?.flashcards.length) return;
    setActiveCard((next + kit.flashcards.length) % kit.flashcards.length);
    setShowAnswer(false);
  };

  return <main className="revision-kit-page animate-fade-in" style={{ width: '100%', maxWidth: '1000px', margin: '0 auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
    <header className="nba-card" style={{ padding: 'var(--space-7)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
      <div style={{ maxWidth: '650px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--accent-secondary)', fontSize: '0.82rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 'var(--space-2)' }}><Sparkles size={16} /> SOURCE-BASED STUDY TOOLS</div>
        <h1 style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>Revision Kit</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>Turn an indexed lecture or PDF into concise study notes and evidence-linked flashcards.</p>
      </div>
      <div style={{ width: '72px', height: '72px', borderRadius: '22px', display: 'grid', placeItems: 'center', color: 'var(--accent-secondary)', background: 'rgba(169, 211, 111, 0.12)', border: '1px solid rgba(169, 211, 111, 0.24)' }}><Layers size={32} /></div>
    </header>

    <section className="nba-card" style={{ padding: 'var(--space-6)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
        <label style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: '0.9rem' }} htmlFor="revision-source">Choose course material
          <select id="revision-source" value={selectedSourceId} onChange={event => selectSource(event.target.value)} disabled={loadingSources || sources.length === 0} style={{ padding: '12px 14px', color: 'var(--text-primary)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)' }}>
            {sources.length === 0 && <option value="">{loadingSources ? 'Loading materials…' : 'No indexed sources found'}</option>}
            {sources.map(source => <option key={source.sourceId} value={source.sourceId}>{source.sourceTitle}</option>)}
          </select>
        </label>
        <button type="button" className="btn-primary" onClick={() => void generateKit()} disabled={!selectedSourceId || generating || loadingSources} style={{ minHeight: '44px', justifyContent: 'center' }}>
          {generating ? <><RefreshCw size={16} /> Building kit…</> : <><Sparkles size={16} /> {kit?.sourceId === selectedSourceId ? 'Regenerate kit' : 'Generate revision kit'}</>}
        </button>
      </div>
      {selectedSource && <p style={{ color: 'var(--text-tertiary)', fontSize: '0.82rem', marginTop: 'var(--space-3)' }}><FileText size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Using {selectedSource.chunks.length} indexed content units from {selectedSource.sourceTitle}. Flashcards include their source locations.</p>}
      {!loadingSources && sources.length === 0 && !error && <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-3)' }}>Upload and index course material in My Courses to create a revision kit.</p>}
    </section>

    {error && <div role="alert" className="nba-card" style={{ padding: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)', color: 'var(--status-error)' }}><AlertTriangle size={18} />{error}</div>}

    {kit && kit.sourceId === selectedSourceId && <>
      <section className="nba-card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-4)' }}>
          <div><div style={{ color: 'var(--accent-secondary)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.07em' }}>STUDY NOTES</div><h2 style={{ fontSize: '1.35rem', marginTop: 5 }}>{kit.sourceTitle}</h2></div>
          <button type="button" className="btn-secondary" onClick={downloadKit}><Download size={16} /> Download notes</button>
        </div>
        <div style={{ lineHeight: 1.7, color: 'var(--text-primary)' }}><FormattedAnswer content={kit.summary} /></div>
        {kit.keyPoints.length > 0 && <div style={{ marginTop: 'var(--space-5)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: 'var(--space-3)' }}>Key points to remember</h3>
          <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>{kit.keyPoints.map((point, index) => <li key={`${index}-${point}`}>{point}</li>)}</ul>
        </div>}
      </section>

      <section className="nba-card" style={{ padding: 'var(--space-6)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}><div><div style={{ color: 'var(--accent-secondary)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: '0.07em' }}>ACTIVE RECALL</div><h2 style={{ fontSize: '1.3rem', marginTop: 5 }}>Flashcards</h2></div><span style={{ color: 'var(--text-secondary)' }}>{activeCard + 1} / {kit.flashcards.length}</span></div>
        {card && <button type="button" aria-pressed={showAnswer} onClick={() => setShowAnswer(value => !value)} style={{ width: '100%', minHeight: '200px', textAlign: 'left', padding: 'var(--space-6)', borderRadius: 'var(--radius-lg)', color: 'var(--text-primary)', background: 'var(--bg-base)', border: '1px solid var(--border-strong)', cursor: 'pointer' }}>
          <span style={{ display: 'block', color: 'var(--accent-secondary)', fontSize: '0.76rem', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>{showAnswer ? 'ANSWER' : 'QUESTION · CLICK TO REVEAL'}</span>
          <span style={{ display: 'block', fontSize: '1.25rem', lineHeight: 1.6 }}>{showAnswer ? card.back : card.front}</span>
          {showAnswer && <span style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 'var(--space-4)' }}>{card.evidenceChunkIds.map(id => <span key={id} style={{ padding: '4px 8px', color: 'var(--text-secondary)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-full)', fontSize: '0.76rem' }}>{selectedSource?.chunks.find(chunk => chunk.id === id)?.metadata.location ?? 'Source passage'}</span>)}</span>}
        </button>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-4)' }}><button type="button" className="btn-secondary" onClick={() => setCardIndex(activeCard - 1)} disabled={kit.flashcards.length < 2}><ArrowLeft size={16} /> Previous</button><button type="button" className="btn-secondary" onClick={() => setCardIndex(activeCard + 1)} disabled={kit.flashcards.length < 2}>Next <ArrowRight size={16} /></button></div>
      </section>
    </>}
  </main>;
};
