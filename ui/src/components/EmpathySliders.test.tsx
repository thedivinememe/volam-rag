import '@testing-library/jest-dom';

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { EmpathySliders } from './EmpathySliders';

describe('EmpathySliders', () => {
  const defaultProfile = {
    general_public: 0.4,
    experts: 0.3,
    policymakers: 0.2,
    affected_communities: 0.1,
  };

  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all stakeholder sliders', () => {
    render(<EmpathySliders profile={defaultProfile} onChange={mockOnChange} />);
    
    expect(screen.getByText('Empathy Profile')).toBeInTheDocument();
    expect(screen.getByText('General Public')).toBeInTheDocument();
    expect(screen.getByText('Experts')).toBeInTheDocument();
    expect(screen.getByText('Policymakers')).toBeInTheDocument();
    expect(screen.getByText('Affected Communities')).toBeInTheDocument();
  });

  it('should display correct percentage values', () => {
    const customProfile = {
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    };
    
    render(<EmpathySliders profile={customProfile} onChange={mockOnChange} />);
    
    expect(screen.getByText('40%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('20%')).toBeInTheDocument();
    expect(screen.getByText('10%')).toBeInTheDocument();
  });

  it('should call onChange when slider value changes', () => {
    render(<EmpathySliders profile={defaultProfile} onChange={mockOnChange} />);
    
    const generalPublicSlider = screen.getByDisplayValue('40');
    fireEvent.change(generalPublicSlider, { target: { value: '50' } });
    
    // The component normalizes weights, so we need to check for normalized values
    expect(mockOnChange).toHaveBeenCalled();
    const calledWith = mockOnChange.mock.calls[0][0];
    const sum = Object.values(calledWith as Record<string, number>).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
  });

  it('should disable sliders when disabled prop is true', () => {
    render(<EmpathySliders profile={defaultProfile} onChange={mockOnChange} disabled={true} />);
    
    const sliders = screen.getAllByRole('slider');
    sliders.forEach(slider => {
      expect(slider).toBeDisabled();
    });
  });

  it('should enable sliders when disabled prop is false', () => {
    render(<EmpathySliders profile={defaultProfile} onChange={mockOnChange} disabled={false} />);
    
    const sliders = screen.getAllByRole('slider');
    sliders.forEach(slider => {
      expect(slider).not.toBeDisabled();
    });
  });

  it('should render reset button', () => {
    render(<EmpathySliders profile={defaultProfile} onChange={mockOnChange} />);
    
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  it('should call onChange with default weights when reset button is clicked', () => {
    const customProfile = {
      general_public: 0.8,
      experts: 0.1,
      policymakers: 0.05,
      affected_communities: 0.05,
    };
    
    render(<EmpathySliders profile={customProfile} onChange={mockOnChange} />);
    
    const resetButton = screen.getByText('Reset');
    fireEvent.click(resetButton);
    
    expect(mockOnChange).toHaveBeenCalledWith({
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    });
  });

  it('should display visual weight distribution', () => {
    const customProfile = {
      general_public: 0.5,
      experts: 0.3,
      policymakers: 0.15,
      affected_communities: 0.05,
    };
    
    render(<EmpathySliders profile={customProfile} onChange={mockOnChange} />);
    
    // Check that the visual bars are rendered (they don't have test IDs in current implementation)
    expect(screen.getByText('Weight Distribution:')).toBeInTheDocument();
  });

  it('should handle edge case with zero weights', () => {
    const zeroProfile = {
      general_public: 0,
      experts: 0,
      policymakers: 0,
      affected_communities: 0,
    };
    
    render(<EmpathySliders profile={zeroProfile} onChange={mockOnChange} />);
    
    expect(screen.getAllByText('0%')).toHaveLength(5); // 4 stakeholders + total
  });

  it('should format percentages correctly for small values', () => {
    const smallProfile = {
      general_public: 0.001,
      experts: 0.002,
      policymakers: 0.003,
      affected_communities: 0.994,
    };
    
    render(<EmpathySliders profile={smallProfile} onChange={mockOnChange} />);
    
    expect(screen.getAllByText('0%')).toHaveLength(3); // 3 small values round to 0%
    expect(screen.getByText('99%')).toBeInTheDocument(); // 99.4% rounds to 99%
  });
});
