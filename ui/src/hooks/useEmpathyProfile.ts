import { useEffect, useState } from 'react';

export interface EmpathyProfile {
  [stakeholder: string]: number;
}

const DEFAULT_PROFILE: EmpathyProfile = {
  general_public: 0.4,
  experts: 0.3,
  policymakers: 0.2,
  affected_communities: 0.1,
};

const STORAGE_KEY = 'volam-empathy-profile';

/**
 * Custom hook for managing empathy profile state with localStorage persistence
 */
export const useEmpathyProfile = () => {
  const [profile, setProfile] = useState<EmpathyProfile>(DEFAULT_PROFILE);

  // Load profile from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedProfile = JSON.parse(stored);
        if (isValidProfile(parsedProfile)) {
          setProfile(normalizeProfile(parsedProfile));
        }
      }
    } catch (error) {
      console.warn('Failed to load empathy profile from localStorage:', error);
    }
  }, []);

  // Save profile to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch (error) {
      console.warn('Failed to save empathy profile to localStorage:', error);
    }
  }, [profile]);

  /**
   * Update a specific stakeholder weight
   */
  const updateStakeholder = (stakeholder: string, weight: number) => {
    setProfile(prev => {
      const updated = { ...prev, [stakeholder]: weight };
      return normalizeProfile(updated);
    });
  };

  /**
   * Reset profile to default values
   */
  const resetProfile = () => {
    setProfile(DEFAULT_PROFILE);
  };

  /**
   * Set entire profile (will be normalized)
   */
  const setFullProfile = (newProfile: EmpathyProfile) => {
    setProfile(normalizeProfile(newProfile));
  };

  return {
    profile,
    updateStakeholder,
    resetProfile,
    setFullProfile,
  };
};

/**
 * Normalize profile weights to sum to 1.0
 */
function normalizeProfile(profile: EmpathyProfile): EmpathyProfile {
  const total = Object.values(profile).reduce((sum, weight) => sum + weight, 0);
  
  if (total === 0) {
    return DEFAULT_PROFILE;
  }

  const normalized: EmpathyProfile = {};
  for (const [stakeholder, weight] of Object.entries(profile)) {
    normalized[stakeholder] = weight / total;
  }

  return normalized;
}

/**
 * Validate that profile has required structure
 */
function isValidProfile(profile: unknown): profile is EmpathyProfile {
  if (!profile || typeof profile !== 'object') {
    return false;
  }

  // Check that all values are numbers
  for (const value of Object.values(profile)) {
    if (typeof value !== 'number' || isNaN(value) || value < 0) {
      return false;
    }
  }

  return true;
}
