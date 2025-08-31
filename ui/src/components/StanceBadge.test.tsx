import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { StanceBadge } from './StanceBadge';

describe('StanceBadge', () => {
  it('should render support stance with correct styling', () => {
    render(<StanceBadge stance="support" />);
    
    const badge = screen.getByLabelText('Stance: Support');
    expect(badge).toHaveClass('bg-emerald-100', 'text-emerald-800', 'border-emerald-200');
    expect(screen.getByText('Support')).toBeInTheDocument();
    expect(screen.getByText('👍')).toBeInTheDocument();
  });

  it('should render refute stance with correct styling', () => {
    render(<StanceBadge stance="refute" />);
    
    const badge = screen.getByLabelText('Stance: Refute');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800', 'border-red-200');
    expect(screen.getByText('Refute')).toBeInTheDocument();
    expect(screen.getByText('👎')).toBeInTheDocument();
  });

  it('should render neutral stance with correct styling', () => {
    render(<StanceBadge stance="neutral" />);
    
    const badge = screen.getByLabelText('Stance: Neutral');
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800', 'border-gray-200');
    expect(screen.getByText('Neutral')).toBeInTheDocument();
    expect(screen.getByText('⚖️')).toBeInTheDocument();
  });

  it('should apply custom className', () => {
    render(<StanceBadge stance="support" className="custom-class" />);
    
    const badge = screen.getByLabelText('Stance: Support');
    expect(badge).toHaveClass('custom-class');
  });

  it('should have proper accessibility attributes', () => {
    render(<StanceBadge stance="support" />);
    
    const badge = screen.getByRole('img');
    expect(badge).toHaveAttribute('aria-label', 'Stance: Support');
  });
});
