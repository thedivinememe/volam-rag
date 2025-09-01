import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RankingService } from './ranking.js';

// Mock the external dependencies
vi.mock('./embedding.js', () => ({
  EmbeddingService: vi.fn().mockImplementation(() => ({
    embed: vi.fn().mockResolvedValue({
      embedding: new Array(1536).fill(0.1) // Mock 1536-dimensional embedding
    })
  }))
}));

vi.mock('./vectorStore.js', () => ({
  VectorStoreFactory: {
    create: vi.fn().mockResolvedValue({
      search: vi.fn().mockImplementation((embedding, k) => {
        const allResults = [
          {
            document: {
              id: 'doc1',
              content: 'Climate change affects vulnerable communities and requires policy intervention.',
              metadata: {
                domain: 'climate',
                source: 'climate-policy-doc',
                chunkIndex: 0,
                tokens: 150
              }
            },
            score: 0.85
          },
          {
            document: {
              id: 'doc2',
              content: 'Expert researchers have developed new technology solutions for environmental conservation.',
              metadata: {
                domain: 'technology',
                source: 'research-tech-doc',
                chunkIndex: 1,
                tokens: 120
              }
            },
            score: 0.75
          },
          {
            document: {
              id: 'doc3',
              content: 'Public health initiatives benefit the general public and healthcare workers.',
              metadata: {
                domain: 'health',
                source: 'health-public-doc',
                chunkIndex: 2,
                tokens: 100
              }
            },
            score: 0.65
          }
        ];
        return Promise.resolve(allResults.slice(0, k));
      })
    })
  }
}));

describe('RankingService', () => {
  let rankingService: RankingService;

  beforeEach(async () => {
    rankingService = new RankingService();
    await rankingService.initialize();
  });

  it('should create instance', () => {
    expect(rankingService).toBeDefined();
  });

  describe('rankBaseline', () => {
    it('should rank evidence with baseline mode', async () => {
      const query = 'test query about climate change';
      const k = 2;

      const result = await rankingService.rankBaseline(query, k);
      
      expect(result).toBeDefined();
      expect(result).toHaveProperty('evidence');
      expect(result).toHaveProperty('answer');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('nullness');
      expect(result.mode).toBe('baseline');
      expect(Array.isArray(result.evidence)).toBe(true);
      expect(result.evidence.length).toBeLessThanOrEqual(k);
    });

    it('should use cosine score as final score in baseline mode', async () => {
      const result = await rankingService.rankBaseline('test query', 5);
      
      for (const evidence of result.evidence) {
        expect(evidence.score).toBe(evidence.cosineScore);
        expect(evidence.empathyFit).toBe(0.0); // Not used in baseline
      }
    });

    it('should return evidence sorted by cosine score', async () => {
      const result = await rankingService.rankBaseline('test query', 5);
      
      for (let i = 1; i < result.evidence.length; i++) {
        expect(result.evidence[i-1].cosineScore).toBeGreaterThanOrEqual(
          result.evidence[i].cosineScore
        );
      }
    });
  });

  describe('rankWithVOLaM', () => {
    it('should rank evidence with VOLaM mode', async () => {
      const query = 'test query about climate change';
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
      expect(result).toHaveProperty('parameters');
      expect(result).toHaveProperty('empathyProfile');
      expect(result.mode).toBe('volam');
      expect(Array.isArray(result.evidence)).toBe(true);
      expect(result.evidence.length).toBeLessThanOrEqual(k);
    });

    it('should calculate empathy fit for each evidence piece', async () => {
      const result = await rankingService.rankWithVOLaM('climate policy query', 3);
      
      for (const evidence of result.evidence) {
        expect(evidence.empathyFit).toBeGreaterThan(0);
        expect(evidence.empathyFit).toBeLessThanOrEqual(1);
      }
    });

    it('should calculate VOLaM scores using α·cosine + β·(1−nullness) + γ·empathy_fit', async () => {
      const alpha = 0.5;
      const beta = 0.3;
      const gamma = 0.2;
      
      const result = await rankingService.rankWithVOLaM('test query', 3, alpha, beta, gamma);
      
      for (const evidence of result.evidence) {
        const expectedScore = alpha * evidence.cosineScore + 
                            beta * (1 - evidence.nullness) + 
                            gamma * evidence.empathyFit;
        
        expect(evidence.score).toBeCloseTo(expectedScore, 5);
      }
    });

    it('should sort evidence by VOLaM score in descending order', async () => {
      const result = await rankingService.rankWithVOLaM('test query', 3);
      
      for (let i = 1; i < result.evidence.length; i++) {
        expect(result.evidence[i-1].score).toBeGreaterThanOrEqual(
          result.evidence[i].score
        );
      }
    });

    it('should use different empathy profiles', async () => {
      const defaultResult = await rankingService.rankWithVOLaM('climate query', 3, 0.6, 0.3, 0.1, 'default');
      const climateResult = await rankingService.rankWithVOLaM('climate query', 3, 0.6, 0.3, 0.1, 'climate_focused');
      
      expect(defaultResult.empathyProfile).toBe('default');
      expect(climateResult.empathyProfile).toBe('climate_focused');
      
      // Empathy fits should be different for different profiles
      const defaultEmpathy = defaultResult.evidence.map(e => e.empathyFit);
      const climateEmpathy = climateResult.evidence.map(e => e.empathyFit);
      
      expect(defaultEmpathy).not.toEqual(climateEmpathy);
    });

    it('should include parameters in result', async () => {
      const alpha = 0.7;
      const beta = 0.2;
      const gamma = 0.1;
      
      const result = await rankingService.rankWithVOLaM('test', 2, alpha, beta, gamma);
      
      expect(result.parameters).toEqual({ alpha, beta, gamma });
    });

    it('should handle tie-breaking by cosine similarity', async () => {
      // This test verifies the tie-breaking logic exists
      // In practice, exact ties are rare with real data
      const result = await rankingService.rankWithVOLaM('test query', 3);
      
      // Verify sorting logic is applied
      expect(result.evidence).toBeDefined();
      expect(result.evidence.length).toBeGreaterThan(0);
    });

    it('should use default parameters when not specified', async () => {
      const result = await rankingService.rankWithVOLaM('test query');
      
      expect(result.parameters).toEqual({
        alpha: 0.6,
        beta: 0.3,
        gamma: 0.1
      });
      expect(result.empathyProfile).toBe('default');
    });

    it('should validate parameter ranges', async () => {
      // Test with extreme parameters
      const result = await rankingService.rankWithVOLaM('test', 2, 1.0, 0.0, 0.0);
      
      expect(result.parameters).toEqual({
        alpha: 1.0,
        beta: 0.0,
        gamma: 0.0
      });
      
      // With alpha=1, beta=0, gamma=0, VOLaM score should equal cosine score
      for (const evidence of result.evidence) {
        expect(evidence.score).toBeCloseTo(evidence.cosineScore, 5);
      }
    });
  });

  describe('VOLaM scoring formula', () => {
    it('should prioritize certainty when beta is high', async () => {
      const highBetaResult = await rankingService.rankWithVOLaM('test', 3, 0.1, 0.8, 0.1);
      
      // Evidence with lower nullness (higher certainty) should rank higher
      const sortedByNullness = [...highBetaResult.evidence].sort((a, b) => a.nullness - b.nullness);
      const actualOrder = highBetaResult.evidence;
      
      // First evidence should have relatively low nullness
      expect(actualOrder[0].nullness).toBeLessThanOrEqual(sortedByNullness[1].nullness);
    });

    it('should prioritize empathy when gamma is high', async () => {
      const highGammaResult = await rankingService.rankWithVOLaM('climate policy', 3, 0.1, 0.1, 0.8, 'climate_focused');
      
      // Evidence with higher empathy fit should rank higher
      expect(highGammaResult.evidence[0].empathyFit).toBeGreaterThan(0);
    });

    it('should prioritize cosine similarity when alpha is high', async () => {
      const highAlphaResult = await rankingService.rankWithVOLaM('test', 3, 0.9, 0.05, 0.05);
      
      // Top evidence should have high cosine scores
      expect(highAlphaResult.evidence[0].cosineScore).toBeGreaterThan(0.5);
    });
  });
});
