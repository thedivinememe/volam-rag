import { RankingResult } from '../types/core.js';

export interface NullnessHistory {
  concept: string;
  timestamp: string;
  nullness: number;
  confidence: number;
  evidence_count: number;
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
