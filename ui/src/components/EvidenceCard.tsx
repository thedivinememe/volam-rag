import React, { useState } from 'react';
import { StanceBadge, StanceType } from './StanceBadge';

import { MetricChip } from './MetricChip';

interface Evidence {
  id: string;
  content: string;
  score: number;
  cosineScore: number;
  nullness: number;
  empathyFit: number;
  source: string;
  metadata: Record<string, unknown>;
  stance?: StanceType; // Optional for now, will be added to core types
}

interface EvidenceCardProps {
  evidence: Evidence;
  index: number;
  mode: 'baseline' | 'volam';
  onCardClick?: (evidence: Evidence) => void;
  isUpdating?: boolean;
  className?: string;
}

// Simple stance detection based on content keywords
const detectStance = (content: string): StanceType => {
  const supportWords = ['support', 'agree', 'confirm', 'validate', 'prove', 'demonstrate', 'show', 'evidence suggests'];
  const refuteWords = ['refute', 'disagree', 'contradict', 'disprove', 'challenge', 'oppose', 'however', 'but'];
  
  const lowerContent = content.toLowerCase();
  
  const supportCount = supportWords.filter(word => lowerContent.includes(word)).length;
  const refuteCount = refuteWords.filter(word => lowerContent.includes(word)).length;
  
  if (supportCount > refuteCount) return 'support';
  if (refuteCount > supportCount) return 'refute';
  return 'neutral';
};

export const EvidenceCard: React.FC<EvidenceCardProps> = ({
  evidence,
  index,
  mode,
  onCardClick,
  isUpdating = false,
  className = ''
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const stance = evidence.stance || detectStance(evidence.content);
  const formatScore = (score: number) => score.toFixed(3);
  
  const handleClick = () => {
    if (onCardClick && !isUpdating) {
      onCardClick(evidence);
    }
  };
  
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if ((event.key === 'Enter' || event.key === ' ') && onCardClick && !isUpdating) {
      event.preventDefault();
      onCardClick(evidence);
    }
  };

  return (
    <div
      className={`
        border border-gray-200 rounded-lg p-4 transition-all duration-200
        ${onCardClick ? 'cursor-pointer hover:shadow-md hover:border-gray-300' : ''}
        ${isHovered ? 'ring-2 ring-blue-200' : ''}
        ${isUpdating ? 'opacity-60 cursor-wait' : ''}
        ${className}
      `}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      tabIndex={onCardClick ? 0 : -1}
      role={onCardClick ? 'button' : 'article'}
      aria-label={onCardClick ? `Evidence card ${index + 1}: Click to update concept nullness` : `Evidence card ${index + 1}`}
      aria-busy={isUpdating}
    >
      {/* Header with rank, source, and stance */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2">
          <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
            #{index + 1}
          </span>
          <span className="text-sm text-gray-600 truncate max-w-xs" title={evidence.source}>
            {evidence.source}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <StanceBadge stance={stance} />
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">
              {formatScore(evidence.score)}
            </div>
            <div className="text-xs text-gray-500">
              {mode === 'volam' ? 'VOLaM Score' : 'Cosine Score'}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <p className="text-gray-700 mb-3 leading-relaxed">
        {evidence.content}
      </p>

      {/* Metric chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        <MetricChip type="similarity" value={evidence.cosineScore} />
        <MetricChip type="certainty" value={1 - evidence.nullness} />
        {mode === 'volam' && (
          <MetricChip type="empathy" value={evidence.empathyFit} />
        )}
      </div>

      {/* Metadata (collapsed by default) */}
      {Object.keys(evidence.metadata).length > 0 && (
        <details className="mt-3">
          <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-200 rounded">
            View metadata
          </summary>
          <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
            <pre className="whitespace-pre-wrap text-gray-600">
              {JSON.stringify(evidence.metadata, null, 2)}
            </pre>
          </div>
        </details>
      )}

      {/* Loading indicator */}
      {isUpdating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            Updating nullness...
          </div>
        </div>
      )}
    </div>
  );
};
