import React, { useEffect, useState } from 'react';
import { PlayCircle, Download, Activity, RefreshCw, ArrowRight, Upload, Sparkles, CheckCircle2 } from 'lucide-react';
import { evaluationRunner } from '../evaluation/evaluationRunner';
import { CourseMaterialBenchmark, EvaluationCase, EvaluationReport, ExtractionReviewDataset, MetricResult } from '../evaluation/types';
import { evaluationBenchmarkService } from '../services/evaluationBenchmarkService';
import { DocumentChunk } from '../types/rag';

interface PdfSource {
  sourceId: string;
  sourceTitle: string;
  chunks: DocumentChunk[];
}

const safeFilename = (value: string) => value.toLocaleLowerCase().replace(/\.pdf$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'course-pdf';

export const Evaluation: React.FC = () => {
  const [report, setReport] = useState<EvaluationReport | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState('');
  const [extractionReview, setExtractionReview] = useState<ExtractionReviewDataset | undefined>();
  const [reviewFileName, setReviewFileName] = useState('');
  const [pdfSources, setPdfSources] = useState<PdfSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [benchmark, setBenchmark] = useState<CourseMaterialBenchmark | undefined>();
  const [generatingBenchmark, setGeneratingBenchmark] = useState(false);
  const [unsupportedQuestion, setUnsupportedQuestion] = useState('');

  useEffect(() => {
    fetch('http://localhost:3001/api/vector/chunks?courseId=course_ml_101')
      .then(async response => {
        if (!response.ok) throw new Error('Could not load indexed course files.');
        return response.json() as Promise<{ chunks?: DocumentChunk[] }>;
      })
      .then(data => {
        const groups = new Map<string, PdfSource>();
        for (const chunk of data.chunks ?? []) {
          if (!chunk.metadata?.sourceTitle?.toLocaleLowerCase().endsWith('.pdf')) continue;
          const sourceId = chunk.metadata.sourceId;
          const existing = groups.get(sourceId) ?? { sourceId, sourceTitle: chunk.metadata.sourceTitle, chunks: [] };
          existing.chunks.push(chunk);
          groups.set(sourceId, existing);
        }
        const sources = [...groups.values()].sort((a, b) => a.sourceTitle.localeCompare(b.sourceTitle));
        setPdfSources(sources);
        const firstSource = sources[0];
        setSelectedSourceId(firstSource?.sourceId ?? '');
        setBenchmark(firstSource ? evaluationBenchmarkService.get(firstSource.sourceId) : undefined);
      })
      .catch(error => setError(error instanceof Error ? error.message : 'Could not load indexed PDF files.'));
  }, []);

  const selectedSource = pdfSources.find(source => source.sourceId === selectedSourceId);

  const handleSourceChange = (sourceId: string) => {
    setSelectedSourceId(sourceId);
    const source = pdfSources.find(item => item.sourceId === sourceId);
    setBenchmark(source ? evaluationBenchmarkService.get(source.sourceId) : undefined);
    setExtractionReview(undefined);
    setReviewFileName('');
    setReport(null);
  };

  const runBenchmark = async () => {
    setRunning(true);
    setError('');
    try {
      const approvedCases = benchmark?.cases.filter(testCase => testCase.reviewStatus === 'APPROVED') ?? [];
      const approvedBenchmark = selectedSource && approvedCases.length > 0 ? { ...benchmark, cases: approvedCases } as CourseMaterialBenchmark : undefined;
      const results = await evaluationRunner.runAll(extractionReview, approvedBenchmark);
      setReport(results);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : 'The evaluation could not be completed.');
    } finally {
      setRunning(false);
    }
  };

  const generatePdfBenchmark = async () => {
    if (!selectedSource) return;
    setGeneratingBenchmark(true);
    setError('');
    try {
      const generated = await evaluationBenchmarkService.generate(selectedSource.sourceTitle, selectedSource.sourceId, selectedSource.chunks);
      setBenchmark(generated);
      setReport(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate a benchmark from this PDF.');
    } finally {
      setGeneratingBenchmark(false);
    }
  };

  const updateBenchmarkCase = (id: string, patch: Partial<EvaluationCase>) => {
    if (!benchmark) return;
    const updated = { ...benchmark, cases: benchmark.cases.map(testCase => testCase.id === id ? { ...testCase, ...patch } : testCase) };
    setBenchmark(updated);
    evaluationBenchmarkService.save(updated);
    setReport(null);
  };

  const addUnsupportedQuestion = () => {
    if (!benchmark || !unsupportedQuestion.trim()) return;
    const item: EvaluationCase = { id: `${benchmark.sourceId}-unsupported-${Date.now()}`, question: unsupportedQuestion.trim(), type: 'UNSUPPORTED', reviewStatus: 'DRAFT' };
    const updated = { ...benchmark, cases: [...benchmark.cases, item] };
    setBenchmark(updated);
    evaluationBenchmarkService.save(updated);
    setUnsupportedQuestion('');
    setReport(null);
  };

  const downloadExtractionTemplate = async () => {
    if (!selectedSource) return;
    const template = {
      datasetName: selectedSource.sourceTitle,
      sourceTitle: selectedSource.sourceTitle,
      sourceId: selectedSource.sourceId,
      reviewStatus: 'NEEDS_HUMAN_REVIEW',
      reviewedBy: '',
      instructions: 'Compare each extracted page with the PDF. Fill in expected concepts, prerequisite relations, text presence, visual description presence, and whether any extracted visual description is accurate. After review, set reviewStatus to HUMAN_REVIEWED and add a reviewer label.',
      pages: selectedSource.chunks.map(chunk => ({
        unitId: chunk.id,
        location: chunk.metadata.location,
        expectedConcepts: null as string[] | null,
        expectedPrerequisites: null as Array<{ concept: string; prerequisite: string }> | null,
        expectedTextPresent: null as boolean | null,
        expectedVisualDescriptionPresent: null as boolean | null,
        visualDescriptionAccurate: null as boolean | null,
        notes: ''
      }))
    };
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename(selectedSource.sourceTitle)}-extraction-review-template.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadRagasDataset = () => {
    if (!report?.courseMaterial) return;
    const blob = new Blob([JSON.stringify(report.courseMaterial.ragasDataset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${safeFilename(report.courseMaterial.datasetName)}-ragas-dataset.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const importExtractionReview = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as ExtractionReviewDataset;
      if (!selectedSource || parsed.reviewStatus !== 'HUMAN_REVIEWED' || !parsed.reviewedBy?.trim() || parsed.datasetName !== selectedSource.sourceTitle || parsed.sourceTitle !== selectedSource.sourceTitle || parsed.sourceId !== selectedSource.sourceId || !Array.isArray(parsed.pages)) {
        throw new Error('Set reviewStatus to HUMAN_REVIEWED, add reviewedBy, and use the currently selected PDF review template.');
      }
      setExtractionReview(parsed);
      setReviewFileName(file.name);
      setError('');
    } catch (e) {
      setExtractionReview(undefined);
      setReviewFileName('');
      setError(e instanceof Error ? e.message : 'Could not read the extraction review file.');
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const a = document.createElement('a');
    a.href = dataStr;
    a.download = `adaptivelearn-eval-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const renderMetric = (metric: MetricResult) => (
    <div key={metric.name} style={{
      backgroundColor: 'var(--bg-base)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 'var(--radius-md)',
      padding: 'var(--space-4)'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2)' }}>
        <h4 style={{ fontSize: '1rem', fontWeight: 600 }}>{metric.name}</h4>
        <div style={{ 
          backgroundColor: 'rgba(139, 92, 246, 0.1)', 
          color: 'var(--accent-secondary)', 
          padding: '2px 8px', 
          borderRadius: '12px', 
          fontSize: '0.75rem',
          fontWeight: 600
        }}>
          n={metric.sampleSize}
        </div>
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
        {metric.formattedValue}
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {metric.description}
      </p>
    </div>
  );

  return (
    <div className="animate-fade-in" style={{ padding: 'var(--space-6)', maxWidth: '1000px', margin: '0 auto' }}>
      <header style={{ marginBottom: 'var(--space-8)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', color: 'var(--accent-primary)', marginBottom: 'var(--space-2)' }}>
            <Activity size={24} />
            <span style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.85rem' }}>RAG and Personalization Evaluation</span>
          </div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>
            System Evaluation & Benchmarks
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem', maxWidth: '600px' }}>
            Run the benchmark on a labeled course set. Retrieval uses gold passage labels, answer quality is scored by a Gemini judge when configured, and personalization runs across simulated learner profiles. Judge scores are model estimates and should be paired with human review.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
          {report && (
            <button className="btn-secondary" onClick={downloadReport}>
              <Download size={18} /> Export JSON
            </button>
          )}
          <button className="btn-primary" onClick={runBenchmark} disabled={running}>
            {running ? <RefreshCw size={18} className="animate-spin" /> : <PlayCircle size={18} />}
            {running ? 'Running...' : report ? 'Run Evaluation Again' : 'Run Evaluation'}
          </button>
        </div>
      </header>

      <section className="nba-card" style={{ padding: 'var(--space-5)', marginBottom: 'var(--space-6)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
          <Sparkles size={20} color="var(--accent-primary)" />
          <h2 style={{ fontSize: '1.2rem', fontWeight: 650 }}>PDF benchmark builder</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Uploading a PDF drafts questions automatically. Select any indexed PDF here, review the generated questions and evidence pages, then approve the cases you want to score.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <select value={selectedSourceId} onChange={event => handleSourceChange(event.target.value)} disabled={!pdfSources.length} aria-label="Select indexed PDF">
            {!pdfSources.length && <option value="">No indexed PDFs found</option>}
            {pdfSources.map(source => <option key={source.sourceId} value={source.sourceId}>{source.sourceTitle} · {source.sourceId.slice(0, 8)} ({source.chunks.length} pages)</option>)}
          </select>
          <button className="btn-secondary" onClick={() => void generatePdfBenchmark()} disabled={!selectedSource || generatingBenchmark}>
            {generatingBenchmark ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
            {generatingBenchmark ? 'Generating draft…' : benchmark ? 'Generate new draft' : 'Generate benchmark'}
          </button>
          <span style={{ color: 'var(--text-tertiary)', fontSize: '0.9rem' }}>
            {benchmark ? `${benchmark.cases.filter(item => item.reviewStatus === 'APPROVED').length} approved · ${benchmark.cases.filter(item => item.reviewStatus !== 'APPROVED').length} to review` : 'No benchmark generated yet'}
          </span>
          {selectedSource && <button className="btn-secondary" onClick={() => void downloadExtractionTemplate()}><Download size={18} /> Extraction review template</button>}
          {selectedSource && <label className="btn-secondary" style={{ cursor: 'pointer' }}>
            <Upload size={18} /> Import human labels
            <input type="file" accept="application/json,.json" onChange={event => void importExtractionReview(event.target.files?.[0])} style={{ display: 'none' }} />
          </label>}
          {reviewFileName && <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Loaded: {reviewFileName}</span>}
        </div>

        {benchmark && selectedSource && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {benchmark.cases.map((item, index) => (
              <article key={item.id} style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-3)', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <strong>Question {index + 1} · {item.type === 'UNSUPPORTED' ? 'Unsupported-query check' : 'Answerable'}</strong>
                  <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', cursor: 'pointer' }}>
                    <input type="checkbox" checked={item.reviewStatus === 'APPROVED'} onChange={event => updateBenchmarkCase(item.id, { reviewStatus: event.target.checked ? 'APPROVED' : 'DRAFT' })} />
                    <span>{item.reviewStatus === 'APPROVED' ? 'Approved for evaluation' : 'Needs review'}</span>
                    {item.reviewStatus === 'APPROVED' && <CheckCircle2 size={17} color="var(--status-success)" />}
                  </label>
                </div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>Question</label>
                <textarea value={item.question} onChange={event => updateBenchmarkCase(item.id, { question: event.target.value })} rows={2} style={{ width: '100%', marginBottom: 'var(--space-2)' }} />
                {item.type !== 'UNSUPPORTED' && <>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>Draft reference answer</label>
                  <textarea value={item.referenceAnswer ?? ''} onChange={event => updateBenchmarkCase(item.id, { referenceAnswer: event.target.value })} rows={2} style={{ width: '100%', marginBottom: 'var(--space-2)' }} />
                  <div style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                    Evidence: {(item.expectedChunkIds ?? []).map(id => selectedSource.chunks.find(chunk => chunk.id === id)?.metadata.location ?? id).join(', ') || 'No page selected'}
                  </div>
                </>}
              </article>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
              <input value={unsupportedQuestion} onChange={event => setUnsupportedQuestion(event.target.value)} placeholder="Add a question this PDF cannot answer" style={{ flex: '1 1 320px' }} />
              <button className="btn-secondary" onClick={addUnsupportedQuestion} disabled={!unsupportedQuestion.trim()}>Add unsupported check</button>
            </div>
          </div>
        )}
        {!selectedSource && <p style={{ color: 'var(--text-tertiary)' }}>Upload and index a PDF first. Gemini must be configured to draft its benchmark automatically.</p>}
      </section>

      {!report && !running && (
        <div className="nba-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <Activity size={48} color="var(--text-tertiary)" style={{ margin: '0 auto var(--space-4)' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>No evaluation data available</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Click "Run Evaluation" to execute the deterministic benchmarking suite across all subsystems.</p>
        </div>
      )}

      {error && !running && (
        <div role="alert" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-md)', color: 'var(--status-error)' }}>
          {error}
        </div>
      )}

      {running && (
        <div className="nba-card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
          <RefreshCw size={48} className="animate-spin" color="var(--accent-primary)" style={{ margin: '0 auto var(--space-4)' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Executing Benchmarks...</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Running retrieval evaluations, generating RAG responses, and simulating learner mastery trajectories.</p>
        </div>
      )}

      {report && !running && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

          {report.courseMaterial && (
            <section>
              <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                Real Course Material: {report.courseMaterial.datasetName}
              </h3>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
                {report.courseMaterial.reviewStatus} · {report.courseMaterial.caseCount} approved cases · {report.courseMaterial.corpusChunkCount} indexed page chunks. Review the generated questions and evidence before treating scores as validated results.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                {report.courseMaterial.retrieval.metrics.map(renderMetric)}
                {report.courseMaterial.rag.metrics.map(renderMetric)}
                {report.courseMaterial.extraction.map(renderMetric)}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)' }}>
                {report.courseMaterial.ragasDataset.length > 0 && <button className="btn-secondary" onClick={downloadRagasDataset}><Download size={18} /> Export RAGAS dataset</button>}
              </div>
              <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: 'var(--space-3)' }}>
                Review each page against the original PDF. The imported labels are used only for extraction scoring; generated labels are never counted as ground truth.
              </p>
            </section>
          )}
          
          <section>
            <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              1. Retrieval Quality
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {report.retrieval.metrics.map(renderMetric)}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              2. RAG & Grounding
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {report.rag.metrics.map(renderMetric)}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              3. Assessment Quality
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {report.assessment.metrics.map(renderMetric)}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              4. Adaptive Behavior & Personalization
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {report.adaptation.metrics.map(renderMetric)}
            </div>
          </section>

          <section>
            <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
              5. Mastery Simulation
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
              {report.mastery.metrics.map(renderMetric)}
            </div>
          </section>

          {report.diagnostic && (
            <section>
              <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                6. Diagnostic & Learner Initialization
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                {Object.entries(report.diagnostic).map(([key, passed]) => (
                  <div key={key} style={{
                    backgroundColor: 'var(--bg-base)',
                    border: `1px solid ${passed ? 'var(--status-success)' : 'var(--status-error)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      {passed ? (
                        <span style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.85rem' }}>PASS</span>
                      ) : (
                        <span style={{ color: 'var(--status-error)', fontWeight: 600, fontSize: '0.85rem' }}>FAIL</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.persistence && (
            <section>
              <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                7. Persistent State & Session Continuity
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                {Object.entries(report.persistence).map(([key, passed]) => (
                  <div key={key} style={{
                    backgroundColor: 'var(--bg-base)',
                    border: `1px solid ${passed ? 'var(--status-success)' : 'var(--status-error)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      {passed ? (
                        <span style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.85rem' }}>PASS</span>
                      ) : (
                        <span style={{ color: 'var(--status-error)', fontWeight: 600, fontSize: '0.85rem' }}>FAIL</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.reliability && (
            <section>
              <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                8. Reliability & Grounding
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-4)' }}>
                {Object.entries(report.reliability).map(([key, passed]) => (
                  <div key={key} style={{
                    backgroundColor: 'var(--bg-base)',
                    border: `1px solid ${passed ? 'var(--status-success)' : 'var(--status-error)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: 'var(--space-4)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--space-2)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, textTransform: 'capitalize' }}>
                        {key.replace(/([A-Z])/g, ' $1').trim()}
                      </h4>
                      {passed ? (
                        <span style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.85rem' }}>PASS</span>
                      ) : (
                        <span style={{ color: 'var(--status-error)', fontWeight: 600, fontSize: '0.85rem' }}>FAIL</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {report.endToEnd && (
            <section>
              <h3 style={{ fontSize: '1.3rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                9. End-to-End Pipeline
              </h3>
              
              <div className="nba-card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-tertiary)' }}>
                  <span>UPLOAD</span> <ArrowRight size={14} /> 
                  <span>EXTRACT</span> <ArrowRight size={14} /> 
                  <span>CHUNK</span> <ArrowRight size={14} /> 
                  <span>EMBED</span> <ArrowRight size={14} /> 
                  <span>INDEX</span> <ArrowRight size={14} /> 
                  <span>RETRIEVE</span> <ArrowRight size={14} /> 
                  <span>GROUND</span> <ArrowRight size={14} /> 
                  <span>ASSESS</span> <ArrowRight size={14} /> 
                  <span>UPDATE LEARNER</span> <ArrowRight size={14} /> 
                  <span>PERSONALIZE</span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Total Pipeline Tests</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{report.endToEnd.total}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Passed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--status-success)' }}>{report.endToEnd.passed}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>Failed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600, color: report.endToEnd.failed > 0 ? 'var(--status-error)' : 'var(--text-primary)' }}>{report.endToEnd.failed}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 'var(--space-2)' }}>
                {Object.entries(report.endToEnd.tests).map(([key, result]: [string, any]) => (
                  <div key={key} style={{
                    backgroundColor: 'var(--bg-base)',
                    borderLeft: `4px solid ${result.status === 'PASS' ? 'var(--status-success)' : 'var(--status-error)'}`,
                    borderRadius: 'var(--radius-sm)',
                    padding: 'var(--space-3)',
                    display: 'flex',
                    flexDirection: 'column',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '0.95rem', fontWeight: 600, fontFamily: 'monospace' }}>
                        {key}
                      </h4>
                      {result.status === 'PASS' ? (
                        <span style={{ color: 'var(--status-success)', fontWeight: 600, fontSize: '0.85rem' }}>PASS</span>
                      ) : (
                        <span style={{ color: 'var(--status-error)', fontWeight: 600, fontSize: '0.85rem' }}>FAIL</span>
                      )}
                    </div>
                    {result.status === 'FAIL' && result.message && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--status-error)', marginTop: 'var(--space-2)' }}>
                        {result.message}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      )}
    </div>
  );
};
