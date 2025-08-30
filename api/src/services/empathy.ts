import { join } from 'path';
import { readFileSync } from 'fs';

export interface EmpathyProfile {
  name: string;
  stakeholders: Record<string, number>;
}

export interface EmpathyProfiles {
  [key: string]: EmpathyProfile;
}

export interface ContentTags {
  stakeholders?: string[];
  topics?: string[];
  domain?: string;
}

export class EmpathyService {
  private profiles: EmpathyProfiles = {};

  constructor() {
    this.loadProfiles();
  }

  /**
   * Load empathy profiles from configuration file
   */
  private loadProfiles(): void {
    try {
      // Try relative path from api directory first, then absolute path
      let profilesPath = join(process.cwd(), '../data/profiles/empathy-profiles.json');
      try {
        const profilesData = readFileSync(profilesPath, 'utf-8');
        this.profiles = JSON.parse(profilesData);
        return;
      } catch {
        // Fallback to root-relative path
        profilesPath = join(process.cwd(), 'data/profiles/empathy-profiles.json');
        const profilesData = readFileSync(profilesPath, 'utf-8');
        this.profiles = JSON.parse(profilesData);
        return;
      }
    } catch (error) {
      console.warn('Failed to load empathy profiles, using defaults:', error);
      this.profiles = {
        default: {
          name: 'Default Profile',
          stakeholders: {
            general_public: 0.4,
            experts: 0.3,
            policymakers: 0.2,
            affected_communities: 0.1
          }
        },
        climate_focused: {
          name: 'Climate-Focused Profile',
          stakeholders: {
            affected_communities: 0.4,
            environmental_scientists: 0.3,
            policymakers: 0.2,
            general_public: 0.1
          }
        }
      };
    }
  }

  /**
   * Calculate empathy fit score based on content tags and selected profile
   */
  calculateEmpathyFit(
    contentTags: ContentTags,
    profileName: string = 'default'
  ): number {
    const profile = this.profiles[profileName] || this.profiles.default;
    
    if (!contentTags.stakeholders || contentTags.stakeholders.length === 0) {
      // If no stakeholder tags, return neutral empathy fit
      return 0.5;
    }

    let totalFit = 0;
    let matchedStakeholders = 0;

    // Calculate weighted empathy fit based on stakeholder overlap
    for (const stakeholder of contentTags.stakeholders) {
      const normalizedStakeholder = stakeholder.toLowerCase().replace(/\s+/g, '_');
      
      if (profile.stakeholders[normalizedStakeholder]) {
        totalFit += profile.stakeholders[normalizedStakeholder];
        matchedStakeholders++;
      }
    }

    if (matchedStakeholders === 0) {
      // No matching stakeholders, return low empathy fit
      return 0.2;
    }

    // Normalize by number of matched stakeholders and apply scaling
    const avgFit = totalFit / matchedStakeholders;
    
    // Scale to [0, 1] range with some boost for multiple stakeholder matches
    const stakeholderBonus = Math.min(matchedStakeholders * 0.1, 0.3);
    return Math.min(avgFit + stakeholderBonus, 1.0);
  }

  /**
   * Extract content tags from evidence metadata and content
   */
  extractContentTags(content: string, metadata: any): ContentTags {
    const tags: ContentTags = {
      stakeholders: [],
      topics: [],
      domain: metadata?.domain || 'general'
    };

    // Extract stakeholders from metadata if available
    if (metadata?.stakeholders) {
      tags.stakeholders = Array.isArray(metadata.stakeholders) 
        ? metadata.stakeholders 
        : [metadata.stakeholders];
    }

    // Extract stakeholders from content using keyword matching
    const stakeholderKeywords = {
      'general_public': ['public', 'citizens', 'people', 'community', 'society'],
      'experts': ['expert', 'scientist', 'researcher', 'specialist', 'professional'],
      'policymakers': ['policy', 'government', 'regulation', 'law', 'official'],
      'affected_communities': ['affected', 'vulnerable', 'marginalized', 'impacted', 'disadvantaged'],
      'environmental_scientists': ['environmental', 'climate', 'ecology', 'conservation'],
      'healthcare_workers': ['healthcare', 'medical', 'doctor', 'nurse', 'patient']
    };

    const contentLower = content.toLowerCase();
    
    for (const [stakeholder, keywords] of Object.entries(stakeholderKeywords)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        if (!tags.stakeholders!.includes(stakeholder)) {
          tags.stakeholders!.push(stakeholder);
        }
      }
    }

    // Extract topics from content
    const topicKeywords = {
      'climate': ['climate', 'global warming', 'carbon', 'emissions'],
      'technology': ['technology', 'digital', 'AI', 'software', 'computer'],
      'health': ['health', 'medical', 'disease', 'treatment', 'wellness'],
      'education': ['education', 'learning', 'school', 'university', 'teaching']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        tags.topics!.push(topic);
      }
    }

    return tags;
  }

  /**
   * Get available empathy profiles
   */
  getAvailableProfiles(): string[] {
    return Object.keys(this.profiles);
  }

  /**
   * Get specific empathy profile
   */
  getProfile(profileName: string): EmpathyProfile | null {
    return this.profiles[profileName] || null;
  }
}
