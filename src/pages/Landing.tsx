import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDownRight, ArrowRight, AudioLines, BookOpen, BrainCircuit, CirclePlay, FileText, Network, Sparkles, Target, WandSparkles } from 'lucide-react';

const features = [
  { number: '01', icon: BookOpen, title: 'Your material, understood', text: 'Turn lectures and course files into a searchable foundation for everything you learn.' },
  { number: '02', icon: BrainCircuit, title: 'Practice that responds', text: 'Questions adapt as you answer, so your next challenge meets you where you are.' },
  { number: '03', icon: Network, title: 'See how ideas connect', text: 'Explore prerequisites, related concepts, and the topics ready for your attention.' },
];

export const Landing: React.FC = () => <main className="landing-page">
  <nav className="landing-nav" aria-label="Main navigation">
    <Link to="/" className="landing-brand"><span className="landing-brand-mark"><Sparkles size={16} /></span>AdaptiveLearn<span>AI</span></Link>
    <div className="landing-nav-links"><a href="#how-it-works">How it works</a><a href="#tools">Learning tools</a><Link className="landing-nav-cta" to="/app">Open dashboard <ArrowRight size={15} /></Link></div>
  </nav>

  <section className="landing-hero">
    <div className="landing-hero-copy">
      <div className="landing-kicker"><span /> A learning space built around your course</div>
      <h1>Study smarter.<br />Make it <em>stick.</em></h1>
      <p className="landing-hero-description">Bring your course materials. Get a tutor that knows them, assessments that adapt, and a learning path that moves with you.</p>
      <div className="landing-hero-actions"><Link to="/app/courses" className="landing-primary-cta">Bring in your course <ArrowRight size={17} /></Link><Link to="/app" className="landing-secondary-cta">Explore dashboard <ArrowDownRight size={17} /></Link></div>
      <div className="landing-proofline"><span><Target size={15} /> Built around your materials</span><i /> <span><WandSparkles size={15} /> Personalized as you learn</span></div>
    </div>

    <div className="landing-visual" aria-label="Illustration of AdaptiveLearn's connected learning tools" role="img">
      <div className="landing-orbit landing-orbit-one" /><div className="landing-orbit landing-orbit-two" />
      <div className="landing-visual-caption"><span className="landing-live-dot" /> YOUR LEARNING, IN MOTION</div>
      <div className="landing-node landing-node-source"><div className="landing-node-icon source"><FileText size={18} /></div><div><strong>Course notes</strong><small>Material indexed</small></div><span className="landing-node-state">READY</span></div>
      <div className="landing-node landing-node-tutor"><div className="landing-node-icon tutor"><AudioLines size={18} /></div><div><strong>AI tutor</strong><small>Grounded in your sources</small></div><span className="landing-wave"><b /><b /><b /><b /><b /></span></div>
      <div className="landing-node landing-node-assessment"><div className="landing-node-icon assess"><BrainCircuit size={18} /></div><div><strong>Adaptive quiz</strong><small>Finding your next step</small></div><span className="landing-node-score">+12</span></div>
      <div className="landing-center-orb"><div className="landing-center-ring"><Sparkles size={29} /></div><span>LEARNER<br />MODEL</span></div>
      <div className="landing-connect landing-connect-a" /><div className="landing-connect landing-connect-b" /><div className="landing-connect landing-connect-c" />
      <span className="landing-orbit-star star-a">✳</span><span className="landing-orbit-star star-b">✳</span>
      <div className="landing-visual-foot"><span>UPLOAD</span><i /><span>UNDERSTAND</span><i /><span>GROW</span></div>
    </div>
    <a href="#how-it-works" className="landing-scroll-cue"><CirclePlay size={16} /> See how it works</a>
  </section>

  <section id="how-it-works" className="landing-manifesto">
    <div className="landing-manifesto-label">LESS GUESSWORK. MORE MOMENTUM.</div>
    <p>Your notes become a <span>tutor.</span><br />Your effort becomes <span>progress.</span></p>
    <div className="landing-manifesto-aside">One connected learning loop—from your first upload to the concepts you’ve truly mastered.</div>
  </section>

  <section id="tools" className="landing-features">
    <header className="landing-section-heading"><div><div className="landing-kicker"><span /> THE TOOLKIT</div><h2>Everything works<br />better <em>together.</em></h2></div><p>Each part learns from your course and your progress, so every next step feels relevant.</p></header>
    <div className="landing-feature-grid">{features.map(({ number, icon: Icon, title, text }) => <article className="landing-feature" key={number}><div className="landing-feature-top"><span>{number}</span><Icon size={19} /></div><h3>{title}</h3><p>{text}</p><div className="landing-feature-line" /></article>)}</div>
  </section>

  <section className="landing-final-cta"><div className="landing-final-ornament"><span /><span /><span /></div><div className="landing-kicker"><span /> YOUR NEXT SESSION STARTS HERE</div><h2>Make your course<br />work <em>for you.</em></h2><p>Start with the material you already have.</p><Link to="/app/courses" className="landing-primary-cta">Start learning <ArrowRight size={17} /></Link></section>

  <footer className="landing-footer"><Link to="/" className="landing-brand"><span className="landing-brand-mark"><Sparkles size={14} /></span>AdaptiveLearn<span>AI</span></Link><span>Learn from your material. Grow at your pace.</span><Link to="/app" className="landing-footer-link">Go to dashboard <ArrowRight size={14} /></Link></footer>
</main>;
