import React from 'react';
import { Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

interface BrandLogoProps {
  className?: string;
  ariaLabel?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ className = 'landing-brand', ariaLabel = 'AdaptiveLearn AI home' }) => (
  <Link to="/" className={className} aria-label={ariaLabel}>
    <span className="landing-brand-mark"><Sparkles size={16} /></span>
    AdaptiveLearn<span>AI</span>
  </Link>
);
