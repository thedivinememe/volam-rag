import React from 'react';

export type MetricType = 'similarity' | 'certainty' | 'empathy';

interface MetricChipProps {
  type: MetricType;
  value: number;
  className?: string;
}

const metricConfig = {
  similarity: {
    label: 'Sim',
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: '🔍'
  },
  certainty: {
    label: 'Cert',
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: '✓'
  },
  empathy: {
    label: 'Emp',
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    icon: '💜'
  }
};

export const MetricChip: React.FC<MetricChipProps> = ({ type, value, className = '' }) => {
  const config = metricConfig[type];
  const percentage = Math.round(value * 100);
  
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full border ${config.color} ${className}`}
      role="img"
      aria-label={`${config.label}: ${percentage}%`}
    >
      <span aria-hidden="true">{config.icon}</span>
      <span className="font-semibold">{percentage}%</span>
    </span>
  );
};
