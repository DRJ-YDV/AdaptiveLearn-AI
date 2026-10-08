import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Book, Video, MonitorPlay, Send, Brain, AlertTriangle, ArrowRight, Lightbulb, Map } from 'lucide-react';
import { tutorService } from '../services/tutorService';
import { courseRepository } from '../services/courseRepository';
import { learnerModelService } from '../services/learnerModelService';
import { TutorMessage, SourceReference, Concept, Topic } from '../types/domain';

export const Tutor: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const conceptIdParam = searchParams.get('concept');

  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [conversationRatings, setConversationRatings] = useState<Record<string, boolean>>({});
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [serviceStatus, setServiceStatus] = useState<'checking' | 'ready' | 'needs-key' | 'offline'>('checking');

  // Context State
  const [currentConcept, setCurrentConcept] = useState<Concept | null>(null);
  const [currentTopic, setCurrentTopic] = useState<Topic | null>(null);
  
  // Right Panel Evidence State
  const [selectedEvidence, setSelectedEvidence] = useState<SourceReference | null>(null);
  const [evidenceConcept, setEvidenceConcept] = useState<Concept | null>(null);
  const [sourceAvailable, setSourceAvailable] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('http://localhost:3001/api/health')
      .then(async response => {
        const health = await response.json();
        setServiceStatus(response.ok && health.ok ? (health.geminiConfigured ? 'ready' : 'needs-key') : 'offline');
      })
      .catch(() => setServiceStatus('offline'));
  }, []);

  useEffect(() => {
    // Initial load - if conceptIdParam exists, fetch it to set context
    const loadContext = async () => {
      if (conceptIdParam) {
        const concepts = await courseRepository.getConceptsByCourse('course_ml_101');
        const c = concepts.find(con => con.id === conceptIdParam);
        if (c) {
          setCurrentConcept(c);
          const topics = await courseRepository.getTopics('course_ml_101');
          setCurrentTopic(topics.find(t => t.id === c.topicId) || null);
          
        }
      }
    };
    loadContext();
  }, [conceptIdParam]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim()) return;
    
    const userMessage: TutorMessage = {
      id: crypto.randomUUID(),
      role: 'USER',
      content: inputValue.trim(),
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setError('');

    try {
      const response = await tutorService.ask(userMessage.content, {
        courseId: 'course_ml_101',
        userId: 'user_1',
        conceptId: currentConcept?.id
      });

      const tutorMessage: TutorMessage = {
        id: crypto.randomUUID(),
        role: 'TUTOR',
        content: response.answer,
        timestamp: new Date().toISOString(),
        responseMetadata: response
      };

      setMessages(prev => [...prev, tutorMessage]);

      // Update context if the tutor grounded the answer to a new concept
      if (response.conceptId && response.conceptId !== currentConcept?.id) {
        const concepts = await courseRepository.getConceptsByCourse('course_ml_101');
        const c = concepts.find(con => con.id === response.conceptId);
        if (c) {
          setCurrentConcept(c);
          const topics = await courseRepository.getTopics('course_ml_101');
          setCurrentTopic(topics.find(t => t.id === c.topicId) || null);
        }
      }
    } catch (err) {
      console.error('Tutor request failed:', err);
      setError('Something went wrong while retrieving course evidence.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewEvidence = async (evidence: SourceReference, conceptId?: string) => {
    setSelectedEvidence(evidence);
    setSourceAvailable(false);
    try {
      const availability = await fetch(`http://localhost:3001/api/sources/${encodeURIComponent(evidence.sourceId)}`, { method: 'HEAD' });
      setSourceAvailable(availability.ok);
    } catch {
      setSourceAvailable(false);
    }
    if (conceptId) {
      const concepts = await courseRepository.getConceptsByCourse('course_ml_101');
      setEvidenceConcept(concepts.find(c => c.id === conceptId) || null);
    }
  };

  const handleConversationRating = (messageId: string, conceptId: string | undefined, understood: boolean) => {
    if (!conceptId || conversationRatings[messageId] !== undefined) return;
    learnerModelService.recordConversationSignal(conceptId, understood, 'user_1', 'course_ml_101');
    setConversationRatings(current => ({ ...current, [messageId]: understood }));
  };

  const getIconForSourceType = (type: string) => {
    switch (type) {
      case 'TEXTBOOK': return <Book size={14} />;
      case 'VIDEO': return <Video size={14} />;
      case 'SLIDE': return <MonitorPlay size={14} />;
      default: return <Book size={14} />;
    }
  };

  const handleAction = (action: any) => {
    if (action.type === 'VIEW_MAP') {
      navigate('/knowledge-map');
    } else if (action.type === 'REVIEW_PREREQ' && action.targetId) {
      navigate(`/knowledge-map?concept=${action.targetId}`);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', gap: 'var(--space-6)' }} className="animate-fade-in">
      {/* LEFT: Context */}
      <div style={{ width: '280px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        <div className="panel-card">
          <div className="panel-title" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
            Course Context
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Brain size={20} color="var(--accent-primary)" />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>Course materials</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Answers grounded in indexed sources</div>
            </div>
          </div>
        </div>

        {currentTopic && (
          <div className="panel-card animate-fade-in">
            <div className="panel-title" style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>
              Current Focus
            </div>
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>{currentTopic.name}</div>
            {currentConcept && (
              <div style={{ padding: 'var(--space-2)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem', color: 'var(--accent-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'currentColor' }} />
                {currentConcept.name}
              </div>
            )}
          </div>
        )}
      </div>

      {/* CENTER: Chat Interface */}
      <div style={{ flex: 1, backgroundColor: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Source-Grounded Tutor</h2>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: serviceStatus === 'ready' ? 'var(--status-success)' : serviceStatus === 'checking' ? 'var(--status-warning)' : 'var(--status-error)' }} />
            {serviceStatus === 'ready' ? 'AI service ready' : serviceStatus === 'checking' ? 'Checking AI service…' : serviceStatus === 'needs-key' ? 'Gemini key required' : 'AI service unavailable'}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
          {messages.length === 0 && (
            <div style={{ margin: 'auto', maxWidth: '440px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Brain size={28} color="var(--accent-primary)" style={{ marginBottom: 'var(--space-3)' }} />
              <h3 style={{ color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                {currentConcept ? `Ask about ${currentConcept.name}` : 'Ask about your course materials'}
              </h3>
              <p style={{ lineHeight: 1.6 }}>The tutor will answer from indexed course sources and show the passages it used.</p>
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'USER' ? 'flex-end' : 'flex-start' }}>
              <div style={{ 
                maxWidth: '85%', 
                padding: 'var(--space-4)', 
                borderRadius: 'var(--radius-lg)', 
                backgroundColor: msg.role === 'USER' ? 'var(--accent-primary)' : 'var(--bg-base)',
                border: msg.role === 'TUTOR' ? '1px solid var(--border-subtle)' : 'none',
                color: msg.role === 'USER' ? 'white' : 'var(--text-primary)'
              }}>
                <p style={{ lineHeight: 1.6, fontSize: '0.95rem' }}>{msg.content}</p>

                {/* Evidence & Meta rendering for Tutor responses */}
                {msg.responseMetadata && (
                  <div style={{ marginTop: 'var(--space-4)', paddingTop: 'var(--space-4)', borderTop: `1px solid ${msg.role === 'USER' ? 'rgba(255,255,255,0.2)' : 'var(--border-subtle)'}` }}>
                    
                    {!msg.responseMetadata.grounded ? (
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2)', color: 'var(--status-warning)', fontSize: '0.85rem' }}>
                        <AlertTriangle size={16} style={{ marginTop: '2px' }} />
                        <div>
                          <strong>Not covered in your course material.</strong>
                          <div style={{ marginTop: '4px', color: 'var(--text-secondary)' }}>
                            {msg.responseMetadata.unsupportedReason}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          Source Evidence
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                          {msg.responseMetadata.evidence.map(ev => (
                            <button 
                              key={ev.id} 
                              onClick={() => handleViewEvidence(ev, msg.responseMetadata!.conceptId)}
                              style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'var(--bg-surface-elevated)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', fontSize: '0.8rem', transition: 'all 0.2s', color: 'var(--text-primary)' }}
                            >
                              {getIconForSourceType(ev.sourceType)}
                              {ev.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {msg.responseMetadata.grounded && msg.responseMetadata.conceptId && (
                      <div style={{ marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
                        <span style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem' }}>
                          {conversationRatings[msg.id] === undefined ? 'Did this explanation help you understand?' : 'Learning signal saved.'}
                        </span>
                        {conversationRatings[msg.id] === undefined && (
                          <>
                            <button type="button" onClick={() => handleConversationRating(msg.id, msg.responseMetadata?.conceptId, true)} className="btn-text" style={{ fontSize: '0.8rem' }}>I understand</button>
                            <button type="button" onClick={() => handleConversationRating(msg.id, msg.responseMetadata?.conceptId, false)} className="btn-text" style={{ fontSize: '0.8rem' }}>I need more help</button>
                          </>
                        )}
                      </div>
                    )}

                    {msg.responseMetadata.suggestedActions && msg.responseMetadata.suggestedActions.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
                        {msg.responseMetadata.suggestedActions.map((action, idx) => (
                          <button 
                            key={idx}
                            onClick={() => handleAction(action)}
                            style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2) var(--space-3)', backgroundColor: 'transparent', border: '1px solid var(--accent-secondary)', color: 'var(--accent-secondary)', borderRadius: 'var(--radius-full)', fontSize: '0.8rem', transition: 'all 0.2s' }}
                          >
                            {action.type === 'VIEW_MAP' ? <Map size={14} /> : <Lightbulb size={14} />}
                            {action.label}
                            <ArrowRight size={14} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', maxWidth: '50%', color: 'var(--text-secondary)' }}>
              <Brain size={18} className="animate-pulse" style={{ animation: 'pulse 1.5s infinite' }} />
              <span style={{ fontSize: '0.9rem' }}>Searching your course...</span>
            </div>
          )}
          
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-4)', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--status-error)', borderRadius: 'var(--radius-lg)', color: 'var(--status-error)' }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: '0.9rem' }}>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-base)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <input 
              type="text" 
              placeholder="Ask a question about the course..." 
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={isLoading}
              style={{ flex: 1, padding: '12px 16px', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)', color: 'var(--text-primary)', outline: 'none' }}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="btn-primary"
              style={{ padding: '0 var(--space-5)' }}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: Evidence Panel */}
      <div style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
        {selectedEvidence ? (
          <div className="panel-card animate-fade-in" style={{ flex: 1, overflowY: 'auto' }}>
            <div className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              {getIconForSourceType(selectedEvidence.sourceType)}
              Evidence Detail
            </div>
            
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px', textTransform: 'uppercase' }}>Source</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{selectedEvidence.label}</div>
            </div>

            <div style={{ marginTop: 'var(--space-4)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px', textTransform: 'uppercase' }}>Location</div>
              <div style={{ fontWeight: 500, color: 'var(--accent-secondary)' }}>{selectedEvidence.location}</div>
            </div>

            {evidenceConcept && (
              <div style={{ marginTop: 'var(--space-4)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '2px', textTransform: 'uppercase' }}>Related Concept</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', padding: 'var(--space-2)', backgroundColor: 'var(--bg-base)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', fontSize: '0.9rem' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: 'var(--status-info)' }} />
                  {evidenceConcept.name}
                </div>
              </div>
            )}

            {selectedEvidence.excerpt && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>Excerpt</div>
                <div style={{ padding: 'var(--space-4)', backgroundColor: 'rgba(255,255,255,0.03)', borderLeft: '3px solid var(--accent-primary)', fontSize: '0.9rem', fontStyle: 'italic', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  "{selectedEvidence.excerpt}"
                </div>
              </div>
            )}
            
            {selectedEvidence.sourceType === 'VIDEO' && selectedEvidence.startTime !== undefined && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)', textTransform: 'uppercase' }}>Source video</div>
                {sourceAvailable ? (
                  <video ref={videoRef} controls preload="metadata" src={`http://localhost:3001/api/sources/${encodeURIComponent(selectedEvidence.sourceId)}`} style={{ width: '100%', backgroundColor: '#000', borderRadius: 'var(--radius-md)' }} />
                ) : (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>The original video is not stored for this older citation. The excerpt and timestamp above remain available.</p>
                )}
                <button 
                  className="btn-secondary" 
                  style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-2)' }}
                  disabled={!sourceAvailable}
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = selectedEvidence.startTime!;
                      void videoRef.current.play();
                    }
                  }}
                >
                  Jump to {selectedEvidence.location}
                </button>
              </div>
            )}

            {selectedEvidence.sourceType !== 'VIDEO' && sourceAvailable && (
              <a
                className="btn-secondary"
                href={`http://localhost:3001/api/sources/${encodeURIComponent(selectedEvidence.sourceId)}${selectedEvidence.sourceType === 'TEXTBOOK' ? `#page=${Number(selectedEvidence.location.match(/\d+/)?.[0] ?? 1)}` : ''}`}
                target="_blank"
                rel="noreferrer"
                style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-6)' }}
              >Open Full Source</a>
            )}
            {selectedEvidence.sourceType !== 'VIDEO' && !sourceAvailable && (
              <p style={{ marginTop: 'var(--space-6)', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>The original file is not stored for this older citation. Its exact page or slide excerpt is shown above.</p>
            )}
          </div>
        ) : (
          <div className="placeholder-content" style={{ height: '100%', border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-lg)' }}>
            <Book size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--space-2)' }} />
            <p style={{ fontSize: '0.9rem' }}>Click an evidence citation in the chat to view source details here.</p>
          </div>
        )}
      </div>
    </div>
  );
};
