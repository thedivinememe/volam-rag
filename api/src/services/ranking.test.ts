import { describe, expect, it } from 'vitest';

import { RankingService } from './ranking.js';

describe('RankingService', () => {
  const rankingService = new RankingService();

  it('should create instance', () => {
    expect(rankingService).toBeDefined();
  });

  it('should rank evidence with baseline mode', async () => {
    const query = 'test query about climate change';
    const k = 2;

    const result = await rankingService.rankBaseline(query, k);
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('evidence');
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('nullness');
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(result.evidence.length).toBeLessThanOrEqual(k);
  });

  it('should rank evidence with VOLaM mode', async () => {
    const query = 'test query about artificial intelligence';
    const k = 2;
    const alpha = 0.6;
    const beta = 0.3;
    const gamma = 0.1;

    const result = await rankingService.rankWithVOLaM(query, k, alpha, beta, gamma);
    
    expect(result).toBeDefined();
    expect(result).toHaveProperty('evidence');
    expect(result).toHaveProperty('answer');
    expect(result).toHaveProperty('confidence');
    expect(result).toHaveProperty('nullness');
    expect(Array.isArray(result.evidence)).toBe(true);
    expect(result.evidence.length).toBeLessThanOrEqual(k);
    
    // Check that evidence has VOLaM-specific properties
    if (result.evidence.length > 0) {
      expect(result.evidence[0]).toHaveProperty('empathyFit');
      expect(result.evidence[0]).toHaveProperty('cosineScore');
      expect(result.evidence[0]).toHaveProperty('nullness');
    }
  });
});
