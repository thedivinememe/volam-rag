import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { MetricChip } from './MetricChip';

describe('MetricChip', () => {
  it('should render similarity chip with correct percentage', () => {
    render(<MetricChip type="similarity" value={0.85} />);
    
    expect(screen.getByLabelText('Sim: 85%')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText('🔍')).toBeInTheDocument();
  });

  it('should render certainty chip with correct styling', () => {
    render(<MetricChip type="certainty" value={0.72} />);
    
    const chip = screen.getByLabelText('Cert: 72%');
    expect(chip).toHaveClass('bg-green-100', 'text-green-800', 'border-green-200');
    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should render empathy chip with correct value', () => {
    render(<MetricChip type="empathy" value={0.91} />);
    
    expect(screen.getByLabelText('Emp: 91%')).toBeInTheDocument();
    expect(screen.getByText('💜')).toBeInTheDocument();
  });

  it('should round percentage values correctly', () => {
    render(<MetricChip type="similarity" value={0.876} />);
    expect(screen.getByText('88%')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<MetricChip type="similarity" value={0.5} className="custom-class" />);
    
    const chip = screen.getByLabelText('Sim: 50%');
    expect(chip).toHaveClass('custom-class');
  });

  it('should handle zero and one values', () => {
    const { rerender } = render(<MetricChip type="similarity" value={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    
    rerender(<MetricChip type="similarity" value={1} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
