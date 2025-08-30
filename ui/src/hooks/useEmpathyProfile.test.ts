import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useEmpathyProfile } from './useEmpathyProfile';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useEmpathyProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with default profile when localStorage is empty', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    expect(result.current.profile).toEqual({
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    });
  });

  it('should load profile from localStorage when available', () => {
    const savedProfile = {
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    };
    localStorageMock.getItem.mockReturnValue(JSON.stringify(savedProfile));
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    // Use toBeCloseTo for floating point comparisons
    expect(result.current.profile.general_public).toBeCloseTo(0.4, 5);
    expect(result.current.profile.experts).toBeCloseTo(0.3, 5);
    expect(result.current.profile.policymakers).toBeCloseTo(0.2, 5);
    expect(result.current.profile.affected_communities).toBeCloseTo(0.1, 5);
  });

  it('should handle invalid JSON in localStorage gracefully', () => {
    localStorageMock.getItem.mockReturnValue('invalid-json');
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    expect(result.current.profile).toEqual({
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    });
  });

  it('should update stakeholder weight and normalize', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    act(() => {
      result.current.updateStakeholder('general_public', 0.6);
    });
    
    // Should normalize to sum to 1.0
    const profile = result.current.profile;
    const sum = Object.values(profile).reduce((a: number, b: number) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    // After normalization, general_public should be 0.6 / 1.2 = 0.5
    expect(profile.general_public).toBeCloseTo(0.5, 5);
  });

  it('should reset profile to default values', () => {
    localStorageMock.getItem.mockReturnValue(JSON.stringify({
      general_public: 0.8,
      experts: 0.1,
      policymakers: 0.05,
      affected_communities: 0.05,
    }));
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    act(() => {
      result.current.resetProfile();
    });
    
    expect(result.current.profile).toEqual({
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    });
  });

  it('should set full profile and normalize', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    const newProfile = {
      general_public: 0.6,
      experts: 0.6,
      policymakers: 0.6,
      affected_communities: 0.6,
    };
    
    act(() => {
      result.current.setFullProfile(newProfile);
    });
    
    // Should normalize to sum to 1.0
    const profile = result.current.profile;
    const sum = Object.values(profile).reduce((a: number, b: number) => a + b, 0);
    expect(sum).toBeCloseTo(1.0, 5);
    // Each should be 0.25 after normalization
    expect(profile.general_public).toBeCloseTo(0.25, 5);
    expect(profile.experts).toBeCloseTo(0.25, 5);
    expect(profile.policymakers).toBeCloseTo(0.25, 5);
    expect(profile.affected_communities).toBeCloseTo(0.25, 5);
  });

  it('should save profile to localStorage on updates', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    act(() => {
      result.current.updateStakeholder('general_public', 0.5);
    });
    
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'volam-empathy-profile',
      expect.stringContaining('"general_public":')
    );
  });

  it('should handle edge case where all weights are zero', () => {
    localStorageMock.getItem.mockReturnValue(null);
    
    const { result } = renderHook(() => useEmpathyProfile());
    
    const zeroProfile = {
      general_public: 0,
      experts: 0,
      policymakers: 0,
      affected_communities: 0,
    };
    
    act(() => {
      result.current.setFullProfile(zeroProfile);
    });
    
    // Should reset to default when all weights are zero
    expect(result.current.profile).toEqual({
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    });
  });
});
