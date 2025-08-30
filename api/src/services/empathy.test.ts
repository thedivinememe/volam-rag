import { beforeEach, describe, expect, it } from 'vitest';

import { EmpathyService } from './empathy.js';

describe('EmpathyService', () => {
  let empathyService: EmpathyService;

  beforeEach(() => {
    empathyService = new EmpathyService();
  });

  describe('calculateEmpathyFit', () => {
    it('should return neutral empathy fit for empty stakeholders', () => {
      const contentTags = { stakeholders: [], topics: [], domain: 'general' };
      const empathyFit = empathyService.calculateEmpathyFit(contentTags, 'default');
      
      expect(empathyFit).toBe(0.5);
    });

    it('should return low empathy fit for unmatched stakeholders', () => {
      const contentTags = { 
        stakeholders: ['unknown_stakeholder'], 
        topics: [], 
        domain: 'general' 
      };
      const empathyFit = empathyService.calculateEmpathyFit(contentTags, 'default');
      
      expect(empathyFit).toBe(0.2);
    });

    it('should calculate empathy fit for matched stakeholders with default profile', () => {
      const contentTags = { 
        stakeholders: ['general_public', 'experts'], 
        topics: [], 
        domain: 'general' 
      };
      const empathyFit = empathyService.calculateEmpathyFit(contentTags, 'default');
      
      // Default profile: general_public: 0.4, experts: 0.3
      // Average: (0.4 + 0.3) / 2 = 0.35
      // With stakeholder bonus: 0.35 + 0.2 = 0.55
      expect(empathyFit).toBe(0.55);
    });

    it('should calculate empathy fit for climate-focused profile', () => {
      const contentTags = { 
        stakeholders: ['affected_communities', 'environmental_scientists'], 
        topics: [], 
        domain: 'climate' 
      };
      const empathyFit = empathyService.calculateEmpathyFit(contentTags, 'climate_focused');
      
      // Climate profile: affected_communities: 0.4, environmental_scientists: 0.3
      // Average: (0.4 + 0.3) / 2 = 0.35
      // With stakeholder bonus: 0.35 + 0.2 = 0.55
      expect(empathyFit).toBe(0.55);
    });

    it('should cap empathy fit at 1.0', () => {
      const contentTags = { 
        stakeholders: ['affected_communities', 'environmental_scientists', 'policymakers', 'general_public'], 
        topics: [], 
        domain: 'climate' 
      };
      const empathyFit = empathyService.calculateEmpathyFit(contentTags, 'climate_focused');
      
      expect(empathyFit).toBeLessThanOrEqual(1.0);
    });

    it('should fallback to default profile for unknown profile', () => {
      const contentTags = { 
        stakeholders: ['general_public'], 
        topics: [], 
        domain: 'general' 
      };
      const empathyFit = empathyService.calculateEmpathyFit(contentTags, 'unknown_profile');
      
      // Should use default profile: general_public: 0.4
      // With stakeholder bonus: 0.4 + 0.1 = 0.5
      expect(empathyFit).toBe(0.5);
    });
  });

  describe('extractContentTags', () => {
    it('should extract stakeholders from metadata', () => {
      const content = 'Some content';
      const metadata = { 
        stakeholders: ['experts', 'policymakers'],
        domain: 'technology'
      };
      
      const tags = empathyService.extractContentTags(content, metadata);
      
      expect(tags.stakeholders).toEqual(['experts', 'policymakers']);
      expect(tags.domain).toBe('technology');
    });

    it('should extract stakeholders from content keywords', () => {
      const content = 'Expert researchers and scientists work with government officials to help vulnerable communities.';
      const metadata = {};
      
      const tags = empathyService.extractContentTags(content, metadata);
      
      expect(tags.stakeholders).toContain('experts');
      expect(tags.stakeholders).toContain('policymakers');
      expect(tags.stakeholders).toContain('affected_communities');
    });

    it('should extract topics from content', () => {
      const content = 'Climate change and global warming require new technology solutions for health and medical treatment.';
      const metadata = {};
      
      const tags = empathyService.extractContentTags(content, metadata);
      
      expect(tags.topics).toContain('climate');
      expect(tags.topics).toContain('technology');
      expect(tags.topics).toContain('health');
    });

    it('should handle single stakeholder in metadata', () => {
      const content = 'Some content';
      const metadata = { 
        stakeholders: 'experts',
        domain: 'science'
      };
      
      const tags = empathyService.extractContentTags(content, metadata);
      
      expect(tags.stakeholders).toEqual(['experts']);
    });

    it('should avoid duplicate stakeholders', () => {
      const content = 'Expert scientists and researchers work on scientific research.';
      const metadata = { stakeholders: ['experts'] };
      
      const tags = empathyService.extractContentTags(content, metadata);
      
      // Should not have duplicate 'experts'
      const expertCount = tags.stakeholders!.filter(s => s === 'experts').length;
      expect(expertCount).toBe(1);
    });

    it('should set default domain when not provided', () => {
      const content = 'Some content';
      const metadata = {};
      
      const tags = empathyService.extractContentTags(content, metadata);
      
      expect(tags.domain).toBe('general');
    });
  });

  describe('getAvailableProfiles', () => {
    it('should return list of available profile names', () => {
      const profiles = empathyService.getAvailableProfiles();
      
      expect(profiles).toContain('default');
      expect(profiles).toContain('climate_focused');
      expect(profiles.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('getProfile', () => {
    it('should return profile for valid name', () => {
      const profile = empathyService.getProfile('default');
      
      expect(profile).toBeDefined();
      expect(profile!.name).toBe('Default Profile');
      expect(profile!.stakeholders).toHaveProperty('general_public');
    });

    it('should return null for invalid profile name', () => {
      const profile = empathyService.getProfile('nonexistent');
      
      expect(profile).toBeNull();
    });
  });
});
