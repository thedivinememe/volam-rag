import React from 'react';

export type StanceType = 'support' | 'refute' | 'neutral';

interface StanceBadgeProps {
  stance: StanceType;
  className?: string;
}

const stanceConfig = {
  support: {
    label: 'Support',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    icon: '👍'
  },
  refute: {
    label: 'Refute',
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: '👎'
  },
  neutral: {
    label: 'Neutral',
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: '⚖️'
  }
};

export const StanceBadge: React.FC<StanceBadgeProps> = ({ stance, className = '' }) => {
  const config = stanceConfig[stance];
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${config.color} ${className}`}
      role="img"
      aria-label={`Stance: ${config.label}`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className="font-semibold">{config.label}</span>
    </span>
  );
};
