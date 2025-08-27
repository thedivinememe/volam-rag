/**
 * Core type definitions for VOLaM-RAG system
 * 
 * This module defines the fundamental types used throughout the VOLaM-RAG system:
 * - Evidence: Individual pieces of information with ranking scores
 * - Concept: Abstract concepts tracked for nullness over time
 * - EmpathyProfile: Stakeholder weighting configurations
 */

/**
 * Represents a single piece of evidence in the knowledge base
 * 
 * Evidence is the fundamental unit of information in VOLaM-RAG. Each piece
 * contains content, various scoring metrics, and metadata for tracking.
 */
export interface Evidence {
  /** Unique identifier for this evidence piece */
  id: string;
  
  /** The actual textual content of the evidence */
  content: string;
  
  /** 
   * Final computed score for this evidence piece
   * In baseline mode: equals cosineScore
   * In VOLaM mode: α·cosine + β·(1−nullness) + γ·empathy_fit
   */
  score: number;
  
  /** 
   * Cosine similarity score between evidence and query
   * Range: [0, 1] where 1 is perfect similarity
   */
  cosineScore: number;
  
  /** 
   * Nullness score representing uncertainty about this evidence
   * Range: [0, 1] where:
   * - 0 = complete certainty (high confidence)
   * - 1 = complete uncertainty (no confidence)
   * - 0.5 = neutral/unknown confidence level
   */
  nullness: number;
  
  /** 
   * Empathy fit score based on stakeholder alignment
   * Range: [0, 1] where 1 means perfect alignment with stakeholder priorities
   * Calculated using weighted stakeholder preferences from EmpathyProfile
   */
  empathyFit: number;
  
  /** Source document or location where this evidence originated */
  source: string;
  
  /** Additional metadata for tracking and debugging */
  metadata: Record<string, any>;
}

/**
 * Represents an abstract concept tracked for nullness evolution
 * 
 * Concepts are high-level ideas or topics that have associated uncertainty
 * that changes over time as more evidence is gathered.
 */
export interface Concept {
  /** Unique identifier for this concept */
  id: string;
  
  /** Human-readable name or description of the concept */
  name: string;
  
  /** 
   * Current nullness level for this concept
   * Range: [0, 1] where 0 = certain, 1 = completely uncertain
   */
  currentNullness: number;
  
  /** 
   * Historical nullness values with timestamps
   * Tracks how uncertainty has evolved over time
   */
  nullnessHistory: NullnessHistoryEntry[];
  
  /** 
   * Related evidence pieces that inform this concept
   * Used to update nullness based on new evidence
   */
  relatedEvidence: string[]; // Evidence IDs
  
  /** When this concept was first created */
  createdAt: string; // ISO timestamp
  
  /** When this concept was last updated */
  updatedAt: string; // ISO timestamp
  
  /** Additional concept metadata */
  metadata: Record<string, any>;
}

/**
 * Single entry in a concept's nullness history
 */
export interface NullnessHistoryEntry {
  /** When this nullness value was recorded */
  timestamp: string; // ISO timestamp
  
  /** The nullness value at this time */
  nullness: number;
  
  /** What triggered this nullness update */
  trigger: 'evidence_added' | 'manual_update' | 'system_recalculation';
  
  /** Optional context about the update */
  context?: string;
}

/**
 * Configuration for stakeholder empathy weighting
 * 
 * EmpathyProfiles define how much weight to give different stakeholder
 * perspectives when calculating empathy fit scores for evidence.
 */
export interface EmpathyProfile {
  /** Unique identifier for this profile */
  id: string;
  
  /** Human-readable name for this empathy profile */
  name: string;
  
  /** 
   * Description of when/why to use this profile
   * e.g., "Use for climate change queries to prioritize affected communities"
   */
  description?: string;
  
  /** 
   * Stakeholder weights mapping
   * Keys are stakeholder identifiers, values are weights [0, 1]
   * All weights should sum to 1.0
   */
  stakeholders: StakeholderWeights;
  
  /** When this profile was created */
  createdAt: string; // ISO timestamp
  
  /** When this profile was last modified */
  updatedAt: string; // ISO timestamp
  
  /** Whether this profile is currently active/available */
  isActive: boolean;
  
  /** Additional profile metadata */
  metadata: Record<string, any>;
}

/**
 * Mapping of stakeholder identifiers to their weights
 * 
 * Weights represent how much to prioritize each stakeholder's perspective
 * when calculating empathy fit. All weights should sum to 1.0.
 */
export interface StakeholderWeights {
  [stakeholderId: string]: number;
}

/**
 * Parameters for VOLaM scoring algorithm
 * 
 * These control the relative importance of different factors in evidence ranking:
 * VOLaM_score = α·cosine + β·(1−nullness) + γ·empathy_fit
 */
export interface VOLaMParameters {
  /** Weight for cosine similarity component [0, 1] */
  alpha: number;
  
  /** Weight for certainty (1-nullness) component [0, 1] */
  beta: number;
  
  /** Weight for empathy fit component [0, 1] */
  gamma: number;
}

/**
 * Result of a ranking operation
 * 
 * Contains ranked evidence along with metadata about the ranking process
 */
export interface RankingResult {
  /** Ranked evidence pieces in descending order of score */
  evidence: Evidence[];
  
  /** Composed answer based on top evidence */
  answer: string;
  
  /** Confidence in the overall result [0, 1] */
  confidence: number;
  
  /** Average nullness across returned evidence */
  nullness: number;
  
  /** Parameters used for this ranking (if VOLaM mode) */
  parameters?: VOLaMParameters;
  
  /** Ranking mode used ('baseline' or 'volam') */
  mode: 'baseline' | 'volam';
  
  /** Empathy profile used (if any) */
  empathyProfile?: string; // Profile ID
}

/**
 * Type guard to check if an object is a valid Evidence
 */
export function isEvidence(obj: any): obj is Evidence {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.content === 'string' &&
    typeof obj.score === 'number' &&
    typeof obj.cosineScore === 'number' &&
    typeof obj.nullness === 'number' &&
    typeof obj.empathyFit === 'number' &&
    typeof obj.source === 'string' &&
    typeof obj.metadata === 'object'
  );
}

/**
 * Type guard to check if an object is a valid Concept
 */
export function isConcept(obj: any): obj is Concept {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.currentNullness === 'number' &&
    Array.isArray(obj.nullnessHistory) &&
    Array.isArray(obj.relatedEvidence) &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string'
  );
}

/**
 * Type guard to check if an object is a valid EmpathyProfile
 */
export function isEmpathyProfile(obj: any): obj is EmpathyProfile {
  return (
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.stakeholders === 'object' &&
    typeof obj.createdAt === 'string' &&
    typeof obj.updatedAt === 'string' &&
    typeof obj.isActive === 'boolean'
  );
}
