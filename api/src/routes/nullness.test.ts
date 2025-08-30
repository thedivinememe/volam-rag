import { beforeEach, describe, expect, test } from 'vitest';

import Fastify from 'fastify';
import { nullnessRoutes } from './nullness.js';

describe('Nullness Routes', () => {
  let fastify: any;

  beforeEach(async () => {
    fastify = Fastify();
    await fastify.register(nullnessRoutes);
  });

  describe('POST /update_nullness', () => {
    test('should update nullness with support action', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'test-concept',
          action: 'support',
          evidence_strength: 0.8,
          k: 0.5,
          lambda: 0.9
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('concept', 'test-concept');
      expect(result.data).toHaveProperty('old_nullness');
      expect(result.data).toHaveProperty('new_nullness');
      expect(result.data).toHaveProperty('delta');
      expect(result.data).toHaveProperty('timestamp');
      
      // Support should decrease nullness (increase certainty)
      expect(result.data.new_nullness).toBeLessThan(result.data.old_nullness);
      expect(result.data.delta).toBeLessThan(0);
    });

    test('should update nullness with refute action', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'test-concept-2',
          action: 'refute',
          evidence_strength: 0.6,
          k: 0.4,
          lambda: 0.8
        }
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      
      // Refute should increase nullness (decrease certainty)
      expect(result.data.new_nullness).toBeGreaterThan(result.data.old_nullness);
      expect(result.data.delta).toBeGreaterThan(0);
    });

    test('should enforce nullness bounds [0, 1]', async () => {
      // Test lower bound
      const supportResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'bound-test-low',
          action: 'support',
          evidence_strength: 1.0,
          k: 2.0, // High k to force boundary
          lambda: 1.0
        }
      });

      expect(supportResponse.statusCode).toBe(200);
      const supportResult = JSON.parse(supportResponse.payload);
      expect(supportResult.data.new_nullness).toBeGreaterThanOrEqual(0);

      // Test upper bound
      const refuteResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'bound-test-high',
          action: 'refute',
          evidence_strength: 1.0,
          k: 2.0, // High k to force boundary
          lambda: 1.0
        }
      });

      expect(refuteResponse.statusCode).toBe(200);
      const refuteResult = JSON.parse(refuteResponse.payload);
      expect(refuteResult.data.new_nullness).toBeLessThanOrEqual(1);
    });

    test('should validate required parameters', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'test-concept',
          action: 'support'
          // Missing evidence_strength, k, lambda
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      // Fastify validation errors have different format
      expect(result.message || result.error).toBeDefined();
    });

    test('should validate action values', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'test-concept',
          action: 'invalid-action',
          evidence_strength: 0.5,
          k: 0.3,
          lambda: 0.9
        }
      });

      expect(response.statusCode).toBe(400);
      const result = JSON.parse(response.payload);
      // Fastify validation errors have different format
      expect(result.message || result.error).toBeDefined();
    });

    test('should validate numeric ranges', async () => {
      // Test negative evidence_strength
      const response1 = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'test-concept',
          action: 'support',
          evidence_strength: -0.5,
          k: 0.3,
          lambda: 0.9
        }
      });

      expect(response1.statusCode).toBe(400);

      // Test evidence_strength > 1
      const response2 = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'test-concept',
          action: 'support',
          evidence_strength: 1.5,
          k: 0.3,
          lambda: 0.9
        }
      });

      expect(response2.statusCode).toBe(400);
    });
  });

  describe('Monotonicity Tests', () => {
    test('stronger evidence should have greater impact', async () => {
      const concept = 'monotonicity-test-1';
      const baseParams = {
        concept,
        action: 'support' as const,
        k: 0.5,
        lambda: 1.0
      };

      // Weak evidence
      const weakResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, evidence_strength: 0.3 }
      });

      // Strong evidence
      const strongResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, evidence_strength: 0.8 }
      });

      expect(weakResponse.statusCode).toBe(200);
      expect(strongResponse.statusCode).toBe(200);

      const weakResult = JSON.parse(weakResponse.payload);
      const strongResult = JSON.parse(strongResponse.payload);

      // Stronger evidence should produce larger absolute delta
      expect(Math.abs(strongResult.data.delta)).toBeGreaterThan(Math.abs(weakResult.data.delta));
    });

    test('higher k parameter should amplify impact', async () => {
      const concept = 'monotonicity-test-2';
      const baseParams = {
        concept,
        action: 'support' as const,
        evidence_strength: 0.7,
        lambda: 1.0
      };

      // Low k
      const lowKResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, k: 0.2 }
      });

      // High k
      const highKResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, k: 0.8 }
      });

      expect(lowKResponse.statusCode).toBe(200);
      expect(highKResponse.statusCode).toBe(200);

      const lowKResult = JSON.parse(lowKResponse.payload);
      const highKResult = JSON.parse(highKResponse.payload);

      // Higher k should produce larger absolute delta
      expect(Math.abs(highKResult.data.delta)).toBeGreaterThan(Math.abs(lowKResult.data.delta));
    });

    test('lambda decay should reduce impact over time', async () => {
      const concept = 'monotonicity-test-3';
      const baseParams = {
        concept,
        action: 'support' as const,
        evidence_strength: 0.6,
        k: 0.5
      };

      // No decay (lambda = 1)
      const noDecayResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, lambda: 1.0 }
      });

      // With decay (lambda < 1)
      const decayResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, lambda: 0.5 }
      });

      expect(noDecayResponse.statusCode).toBe(200);
      expect(decayResponse.statusCode).toBe(200);

      const noDecayResult = JSON.parse(noDecayResponse.payload);
      const decayResult = JSON.parse(decayResponse.payload);

      // Decay should reduce absolute impact
      expect(Math.abs(noDecayResult.data.delta)).toBeGreaterThan(Math.abs(decayResult.data.delta));
    });

    test('opposite actions should have opposite effects', async () => {
      const concept = 'monotonicity-test-4';
      const baseParams = {
        concept,
        evidence_strength: 0.5,
        k: 0.4,
        lambda: 1.0
      };

      // Support action
      const supportResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, action: 'support' }
      });

      // Refute action
      const refuteResponse = await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: { ...baseParams, action: 'refute' }
      });

      expect(supportResponse.statusCode).toBe(200);
      expect(refuteResponse.statusCode).toBe(200);

      const supportResult = JSON.parse(supportResponse.payload);
      const refuteResult = JSON.parse(refuteResponse.payload);

      // Support should decrease nullness, refute should increase it
      expect(supportResult.data.delta).toBeLessThan(0);
      expect(refuteResult.data.delta).toBeGreaterThan(0);
      
      // Magnitudes should be equal for same parameters
      expect(Math.abs(supportResult.data.delta)).toBeCloseTo(Math.abs(refuteResult.data.delta), 5);
    });
  });

  describe('GET /nullness/history/:concept', () => {
    test('should return history for existing concept', async () => {
      const concept = 'history-test';
      
      // First create some history
      await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept,
          action: 'support',
          evidence_strength: 0.5,
          k: 0.3,
          lambda: 0.9
        }
      });

      await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept,
          action: 'refute',
          evidence_strength: 0.4,
          k: 0.3,
          lambda: 0.9
        }
      });

      // Get history
      const response = await fastify.inject({
        method: 'GET',
        url: `/nullness/history/${concept}`
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('concept', concept);
      expect(result.data).toHaveProperty('history');
      expect(Array.isArray(result.data.history)).toBe(true);
      expect(result.data.history.length).toBeGreaterThan(0);
      
      // Check history entry structure
      const entry = result.data.history[0];
      expect(entry).toHaveProperty('timestamp');
      expect(entry).toHaveProperty('nullness');
      expect(entry).toHaveProperty('delta');
      expect(entry).toHaveProperty('action');
      expect(entry).toHaveProperty('evidence_strength');
    });

    test('should return empty history for non-existent concept', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/nullness/history/non-existent-concept'
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(result.data.history).toEqual([]);
    });
  });

  describe('GET /nullness/concepts', () => {
    test('should return list of tracked concepts', async () => {
      // Create some concepts
      await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'concept-1',
          action: 'support',
          evidence_strength: 0.5,
          k: 0.3,
          lambda: 0.9
        }
      });

      await fastify.inject({
        method: 'POST',
        url: '/update_nullness',
        payload: {
          concept: 'concept-2',
          action: 'refute',
          evidence_strength: 0.4,
          k: 0.3,
          lambda: 0.9
        }
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/nullness/concepts'
      });

      expect(response.statusCode).toBe(200);
      const result = JSON.parse(response.payload);
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data.concepts)).toBe(true);
      expect(result.data.concepts.length).toBeGreaterThan(0);
      
      // Check concept entry structure
      const concept = result.data.concepts[0];
      expect(concept).toHaveProperty('concept');
      expect(concept).toHaveProperty('current_nullness');
      expect(concept).toHaveProperty('last_updated');
      expect(concept).toHaveProperty('update_count');
    });
  });
});
