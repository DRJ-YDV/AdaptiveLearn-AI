import React, { useState } from 'react';
import { UploadCloud, CheckCircle, XCircle, FileText, Settings, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { CourseIndexingService } from '../services/ingestion/courseIndexingService';
import { vectorStore } from '../services/tutorService';
import { IngestionJob } from '../types/ingestion';

export const CourseIngestion: React.FC = () => {
  const navigate = useNavigate();
  const [dragActive, setDragActive] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [job, setJob] = useState<IngestionJob | null>(null);

  const indexingService = new CourseIndexingService(vectorStore);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles(prev => [...prev, ...droppedFiles]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFiles = Array.from(e.target.files);
      setFiles(prev => [...prev, ...selectedFiles]);
    }
  };

  const startIngestion = async () => {
    if (files.length === 0) return;
    
    // In a real app this would come from a dropdown or router param
    const courseId = 'course_ml_101';
    
    await indexingService.indexFiles(courseId, files, (updatedJob) => {
      setJob({...updatedJob});
    });
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Compute stats
  const totalUnits = job?.results.reduce((sum, r) => sum + (r.contentUnits?.length || 0), 0) || 0;
  const successfulFiles = job?.results.filter(r => r.status === 'COMPLETED' || r.status === 'PARTIAL').length || 0;
  const failedFiles = job?.results.filter(r => r.status === 'FAILED').length || 0;

  return (
    <div className="course-dashboard animate-fade-in" style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-6)' }}>
      <div style={{ width: '100%', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
          <Settings size={48} color="var(--accent-primary)" style={{ margin: '0 auto var(--space-4)' }} />
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Course Ingestion Pipeline</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
            Upload PDFs, PPTX, videos, or text files to automatically generate a vector knowledge base.
          </p>
        </div>

        {/* Upload Zone */}
        {!job && (
          <div className="nba-card" style={{ padding: 'var(--space-8)' }}>
            <div 
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              style={{
                border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'var(--border-strong)'}`,
                borderRadius: 'var(--radius-lg)',
                padding: 'var(--space-8)',
                textAlign: 'center',
                backgroundColor: dragActive ? 'rgba(79, 70, 229, 0.05)' : 'var(--bg-base)',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onClick={() => document.getElementById('file-upload')?.click()}
            >
              <UploadCloud size={48} color="var(--text-tertiary)" style={{ margin: '0 auto var(--space-4)' }} />
              <h3 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Drag and drop files here</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                Supports .pdf, .pptx, .txt, .md, .mp4, .mov, .webm
              </p>
              <input 
                id="file-upload" 
                type="file" 
                multiple 
                onChange={handleFileInput} 
                style={{ display: 'none' }}
                accept=".pdf,.pptx,.txt,.md,.mp4,.mov,.webm"
              />
            </div>

            {files.length > 0 && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <h4 style={{ marginBottom: 'var(--space-3)' }}>Selected Files ({files.length})</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-6)' }}>
                  {files.map((f, idx) => (
                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: 'var(--bg-base)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                        <FileText size={18} color="var(--accent-secondary)" />
                        <span style={{ fontSize: '0.95rem' }}>{f.name}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{(f.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); removeFile(idx); }} style={{ color: 'var(--text-tertiary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <XCircle size={18} />
                      </button>
                    </div>
                  ))}
                </div>
                <button className="btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={startIngestion}>
                  Start Processing {files.length} File{files.length !== 1 ? 's' : ''}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Progress View */}
        {job && (
          <div className="nba-card" style={{ padding: 'var(--space-8)' }}>
            <h3 style={{ fontSize: '1.4rem', marginBottom: 'var(--space-2)' }}>Ingestion Status: {job.status}</h3>
            {job.detail && <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-6)' }}>{job.detail}</p>}
            
            <div style={{ 
              width: '100%', 
              height: '8px', 
              backgroundColor: 'var(--border-subtle)', 
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: 'var(--space-6)'
            }}>
              <div style={{ 
                height: '100%', 
                width: `${job.progress}%`, 
                backgroundColor: job.status === 'FAILED' ? 'var(--status-error)' : 'var(--accent-primary)',
                transition: 'width 0.3s ease'
              }} />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-8)' }}>
              {job.results.map((r, idx) => (
                <div key={idx} style={{ 
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                  padding: '16px', 
                  backgroundColor: r.status === 'FAILED' ? 'rgba(239, 68, 68, 0.05)' : r.status === 'PARTIAL' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                  border: `1px solid ${r.status === 'FAILED' ? 'var(--status-error)' : r.status === 'PARTIAL' ? 'var(--status-warning)' : 'var(--status-success)'}`,
                  borderRadius: 'var(--radius-md)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                    {r.status === 'FAILED' ? <XCircle size={18} color="var(--status-error)" /> : <CheckCircle size={18} color={r.status === 'PARTIAL' ? 'var(--status-warning)' : 'var(--status-success)'} />}
                    <div>
                      <div style={{ fontWeight: 600 }}>{r.sourceTitle}</div>
                      {r.error && <div style={{ fontSize: '0.85rem', color: r.status === 'FAILED' ? 'var(--status-error)' : 'var(--status-warning)', marginTop: '4px' }}>{r.error}</div>}
                      {r.contentUnits.length > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Extracted {r.contentUnits.length} content units</div>}
                      {r.benchmarkCaseCount !== undefined && <div style={{ fontSize: '0.85rem', color: 'var(--status-success)', marginTop: '4px' }}>{r.benchmarkCaseCount} draft benchmark questions generated. Review them on the Evaluation page.</div>}
                      {r.benchmarkError && <div style={{ fontSize: '0.85rem', color: 'var(--status-warning)', marginTop: '4px' }}>Benchmark draft not generated: {r.benchmarkError} You can retry from the Evaluation page.</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {(job.status === 'COMPLETED' || job.status === 'PARTIAL' || job.status === 'FAILED') && (
              <div className="animate-fade-in">
                <div style={{ padding: 'var(--space-6)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)' }}>
                  <h4 style={{ marginBottom: 'var(--space-4)', fontSize: '1.1rem' }}>Knowledge Base Summary</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Files Processed</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{successfulFiles} <span style={{ fontSize: '1rem', color: 'var(--status-error)', fontWeight: 400 }}>{failedFiles > 0 ? `(${failedFiles} failed)` : ''}</span></div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Content Units / Chunks</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 600 }}>{totalUnits}</div>
                    </div>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setJob(null); setFiles([]); }}>
                    Process More Files
                  </button>
                  <button className="btn-primary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => navigate('/app/tutor')}>
                    Test in AI Tutor
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
};
