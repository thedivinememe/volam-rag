import { RankingResult } from '../types/core.js';

export interface NullnessHistory {
  concept: string;
  timestamp: string;
  nullness: number;
  confidence: number;
  evidence_count: number;
}

export interface NullnessUpdateResult {
  oldNullness: number;
  newNullness: number;
  deltaNullness: number;
  concept: string;
  timestamp: string;
}

export interface NullnessConfig {
  k: number; // Evidence weight factor
  lambda: number; // Time decay factor
  defaultNullness: number;
  updateThreshold: number;
  historyRetention: number;
}

export class NullnessService {
  private history: Map<string, NullnessHistory[]> = new Map();

  constructor() {
    // TODO: Initialize with persistent storage (SQLite)
  }

  /**
   * Update nullness tracking for a concept based on ranking results
   */
  async updateNullness(query: string, results: RankingResult): Promise<void> {
    const concept = this.extractConcept(query);
    
    const entry: NullnessHistory = {
      concept,
      timestamp: new Date().toISOString(),
      nullness: results.nullness,
      confidence: results.confidence,
      evidence_count: results.evidence.length
    };

    if (!this.history.has(concept)) {
      this.history.set(concept, []);
    }

    this.history.get(concept)!.push(entry);

    // TODO: Persist to database
    // await this.persistToDatabase(entry);
  }

  /**
   * Get nullness history for a concept
   */
  async getNullnessHistory(concept: string): Promise<NullnessHistory[]> {
    return this.history.get(concept) || [];
  }

  /**
   * Calculate ΔNullness (change in nullness over time)
   */
  async calculateDeltaNullness(concept: string, timeWindow: number = 24): Promise<number> {
    const history = await this.getNullnessHistory(concept);
    
    if (history.length < 2) {
      return 0; // No change if insufficient data
    }

    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow * 60 * 60 * 1000);
    
    const recentEntries = history.filter(entry => 
      new Date(entry.timestamp) >= windowStart
    );

    if (recentEntries.length < 2) {
      return 0;
    }

    const latest = recentEntries[recentEntries.length - 1];
    const earliest = recentEntries[0];
    
    return latest.nullness - earliest.nullness;
  }

  /**
   * Get all concepts with nullness tracking
   */
  async getAllConcepts(): Promise<string[]> {
    return Array.from(this.history.keys());
  }

  /**
   * Get all concepts with their current nullness and metadata
   */
  async getAllConceptsWithMetadata(): Promise<Array<{
    concept: string;
    currentNullness: number;
    lastUpdated: string;
    updateCount: number;
  }>> {
    const concepts = Array.from(this.history.keys());
    const result = [];

    for (const concept of concepts) {
      const history = await this.getNullnessHistory(concept);
      if (history.length > 0) {
        const latest = history[history.length - 1];
        result.push({
          concept,
          currentNullness: latest.nullness,
          lastUpdated: latest.timestamp,
          updateCount: history.length
        });
      }
    }

    return result;
  }

  /**
   * Extract concept from query (simplified implementation)
   */
  private extractConcept(query: string): string {
    // TODO: Implement more sophisticated concept extraction
    // For now, use first few words as concept identifier
    return query.toLowerCase()
      .split(' ')
      .slice(0, 3)
      .join('_')
      .replace(/[^a-z0-9_]/g, '');
  }

  /**
   * Explicit nullness update with support/refute logic
   * Update rule: nullness_new = nullness_old ± k * evidence_strength * λ^time_decay
   */
  async updateNullnessExplicit(
    concept: string,
    action: 'support' | 'refute',
    evidenceStrength: number,
    k: number = 0.1,
    lambda: number = 0.9
  ): Promise<NullnessUpdateResult> {
    const history = await this.getNullnessHistory(concept);
    
    // Get current nullness or use default
    const currentNullness = history.length > 0 
      ? history[history.length - 1].nullness 
      : 0.5; // Default nullness

    // Calculate time decay factor (simplified - using 1.0 for now)
    const timeDelta = 1.0; // TODO: Calculate actual time since last update
    const decayFactor = Math.pow(lambda, timeDelta);

    // Calculate nullness change based on action
    const evidenceImpact = k * evidenceStrength * decayFactor;
    let newNullness: number;

    if (action === 'support') {
      // Supporting evidence decreases nullness (increases certainty)
      newNullness = currentNullness - evidenceImpact;
    } else {
      // Refuting evidence increases nullness (decreases certainty)
      newNullness = currentNullness + evidenceImpact;
    }

    // Enforce monotonicity and bounds [0, 1]
    newNullness = Math.max(0, Math.min(1, newNullness));

    const timestamp = new Date().toISOString();
    const deltaNullness = newNullness - currentNullness;

    // Create history entry
    const entry: NullnessHistory = {
      concept,
      timestamp,
      nullness: newNullness,
      confidence: 1 - newNullness, // Confidence is inverse of nullness
      evidence_count: 1 // Single evidence update
    };

    // Update history
    if (!this.history.has(concept)) {
      this.history.set(concept, []);
    }
    this.history.get(concept)!.push(entry);

    // TODO: Persist to database
    // await this.persistToDatabase(entry);

    return {
      oldNullness: currentNullness,
      newNullness,
      deltaNullness,
      concept,
      timestamp
    };
  }

  /**
   * Get current nullness for a concept
   */
  async getCurrentNullness(concept: string): Promise<number> {
    const history = await this.getNullnessHistory(concept);
    return history.length > 0 ? history[history.length - 1].nullness : 0.5;
  }

  /**
   * Get nullness statistics for reporting
   */
  async getNullnessStats(): Promise<{
    totalConcepts: number;
    avgNullness: number;
    conceptsWithDecreasingNullness: number;
    conceptsWithIncreasingNullness: number;
  }> {
    const concepts = await this.getAllConcepts();
    let totalNullness = 0;
    let conceptsWithDecreasingNullness = 0;
    let conceptsWithIncreasingNullness = 0;

    for (const concept of concepts) {
      const history = await this.getNullnessHistory(concept);
      if (history.length > 0) {
        const latestNullness = history[history.length - 1].nullness;
        totalNullness += latestNullness;

        const deltaNullness = await this.calculateDeltaNullness(concept);
        if (deltaNullness < 0) {
          conceptsWithDecreasingNullness++;
        } else if (deltaNullness > 0) {
          conceptsWithIncreasingNullness++;
        }
      }
    }

    return {
      totalConcepts: concepts.length,
      avgNullness: concepts.length > 0 ? totalNullness / concepts.length : 0,
      conceptsWithDecreasingNullness,
      conceptsWithIncreasingNullness
    };
  }
}
