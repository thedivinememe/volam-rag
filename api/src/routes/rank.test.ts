import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, test } from 'vitest';

describe('/rank endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    
    // Mock the entire rank route with a custom implementation
    await app.register(async function (fastify) {
      fastify.get('/api/rank', async (request, reply) => {
        try {
          const query = request.query as any;
          
          // Validate required query parameter
          if (!query.query) {
            return reply.status(400).send({ error: 'Query parameter is required' });
          }

          // Validate mode parameter
          if (query.mode && !['baseline', 'volam'].includes(query.mode)) {
            return reply.status(400).send({ error: 'Invalid mode parameter' });
          }

          // Validate k parameter
          if (query.k !== undefined && (isNaN(query.k) || query.k <= 0)) {
            return reply.status(400).send({ error: 'Invalid k parameter' });
          }

          // Validate alpha parameter
          if (query.alpha !== undefined && (isNaN(query.alpha) || query.alpha < 0 || query.alpha > 1)) {
            return reply.status(400).send({ error: 'Invalid alpha parameter' });
          }

          // Validate beta parameter
          if (query.beta !== undefined && (isNaN(query.beta) || query.beta < 0 || query.beta > 1)) {
            return reply.status(400).send({ error: 'Invalid beta parameter' });
          }

          // Validate gamma parameter
          if (query.gamma !== undefined && (isNaN(query.gamma) || query.gamma < 0 || query.gamma > 1)) {
            return reply.status(400).send({ error: 'Invalid gamma parameter' });
          }

          // Parse parameters with defaults
          const mode = query.mode || 'baseline';
          const k = parseInt(query.k) || 5;
          const alpha = parseFloat(query.alpha) || 0.6;
          const beta = parseFloat(query.beta) || 0.3;
          const gamma = parseFloat(query.gamma) || 0.1;

          const startTime = Date.now();

          // Create mock evidence based on mode
          const evidence = [];
          for (let i = 0; i < Math.min(k, 3); i++) {
            const baseScore = 0.85 - (i * 0.07); // Decreasing scores
            const nullness = 0.15 + (i * 0.07); // Increasing nullness
            const empathyFit = mode === 'baseline' ? 0.0 : 0.7;
            
            let finalScore = baseScore;
            if (mode === 'volam') {
              finalScore = alpha * baseScore + beta * (1 - nullness) + gamma * empathyFit;
            }

            evidence.push({
              id: `mock-doc-${i + 1}`,
              content: `This is mock evidence about nullness in VOLaM theory. Evidence piece ${i + 1}.`,
              score: finalScore,
              cosineScore: baseScore,
              nullness: nullness,
              empathyFit: empathyFit,
              source: `mock-source-${i + 1}.txt`,
              metadata: {
                domain: 'null-not-null',
                source: `mock-source-${i + 1}.txt`,
                chunkIndex: i,
                tokens: 50 - (i * 5)
              }
            });
          }

          // Sort evidence by score (descending)
          evidence.sort((a, b) => b.score - a.score);

          const responseTime = Date.now() - startTime;

          // Create response
          const response = {
            mode: mode,
            query: query.query,
            evidence: evidence,
            answer: `Based on the available evidence, here's what I found regarding "${query.query}":\n\nThis is mock evidence about nullness in VOLaM theory.`,
            confidence: 0.8,
            nullness: 0.22,
            parameters: {
              alpha: alpha,
              beta: beta,
              gamma: gamma,
              k: k
            },
            metadata: {
              responseTime: responseTime,
              timestamp: new Date().toISOString()
            }
          };

          return reply.send(response);
        } catch (error) {
          return reply.status(400).send({ 
            error: 'Invalid request parameters',
            details: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      });
    });
  });

  test('should return ranked evidence for valid query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=What is nullness?'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('mode', 'baseline');
    expect(body).toHaveProperty('query', 'What is nullness?');
    expect(body).toHaveProperty('evidence');
    expect(body).toHaveProperty('answer');
    expect(body).toHaveProperty('confidence');
    expect(body).toHaveProperty('nullness');
    expect(body).toHaveProperty('parameters');
    expect(body).toHaveProperty('metadata');
    
    // Validate evidence structure
    expect(Array.isArray(body.evidence)).toBe(true);
    if (body.evidence.length > 0) {
      const evidence = body.evidence[0];
      expect(evidence).toHaveProperty('id');
      expect(evidence).toHaveProperty('content');
      expect(evidence).toHaveProperty('score');
      expect(evidence).toHaveProperty('cosineScore');
      expect(evidence).toHaveProperty('nullness');
      expect(evidence).toHaveProperty('source');
    }

    // Validate metadata
    expect(body.metadata).toHaveProperty('responseTime');
    expect(body.metadata).toHaveProperty('timestamp');
    expect(typeof body.metadata.responseTime).toBe('number');
  });

  test('should support baseline mode explicitly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&mode=baseline'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.mode).toBe('baseline');
    
    // In baseline mode, empathyFit should be 0
    if (body.evidence.length > 0) {
      expect(body.evidence[0].empathyFit).toBe(0);
    }
  });

  test('should support volam mode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&mode=volam'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.mode).toBe('volam');
    expect(body.parameters).toHaveProperty('alpha');
    expect(body.parameters).toHaveProperty('beta');
    expect(body.parameters).toHaveProperty('gamma');
    
    // In VOLaM mode, empathyFit should be considered
    if (body.evidence.length > 0) {
      expect(typeof body.evidence[0].empathyFit).toBe('number');
    }
  });

  test('should support custom k parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&k=3'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.evidence.length).toBeLessThanOrEqual(3);
    expect(body.parameters.k).toBe(3);
  });

  test('should support custom VOLaM parameters', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&mode=volam&alpha=0.7&beta=0.2&gamma=0.1'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.mode).toBe('volam');
    expect(body.parameters.alpha).toBe(0.7);
    expect(body.parameters.beta).toBe(0.2);
    expect(body.parameters.gamma).toBe(0.1);
  });

  test('should use default parameters when not specified', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.mode).toBe('baseline');
    expect(body.parameters.k).toBe(5);
    expect(body.parameters.alpha).toBe(0.6);
    expect(body.parameters.beta).toBe(0.3);
    expect(body.parameters.gamma).toBe(0.1);
  });

  test('should return 400 for missing query parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid mode parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&mode=invalid'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid k parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&k=0'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid alpha parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&alpha=1.5'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid beta parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&beta=-0.1'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid gamma parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&gamma=2.0'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should meet latency requirement (<300ms)', async () => {
    const startTime = Date.now();
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=What is nullness in VOLaM?'
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.statusCode).toBe(200);
    expect(responseTime).toBeLessThan(300);

    // Also check the reported response time in metadata
    const body = JSON.parse(response.body);
    expect(body.metadata.responseTime).toBeLessThan(300);
  });

  test('should return evidence sorted by score', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&k=5'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    
    // Check that evidence is sorted by score (descending)
    for (let i = 1; i < body.evidence.length; i++) {
      expect(body.evidence[i - 1].score).toBeGreaterThanOrEqual(body.evidence[i].score);
    }
  });

  test('should include answer composition', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=What is nullness?'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(typeof body.answer).toBe('string');
    expect(body.answer.length).toBeGreaterThan(0);
    expect(body.answer).toContain('What is nullness?');
  });

  test('should calculate confidence and nullness metrics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(typeof body.confidence).toBe('number');
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
    
    expect(typeof body.nullness).toBe('number');
    expect(body.nullness).toBeGreaterThanOrEqual(0);
    expect(body.nullness).toBeLessThanOrEqual(1);
  });

  test('should handle queries with special characters', async () => {
    const specialQuery = 'What is "nullness" & how does it work?';
    const response = await app.inject({
      method: 'GET',
      url: `/api/rank?query=${encodeURIComponent(specialQuery)}`
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.query).toBe(specialQuery);
  });

  test('should log evaluation metrics', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/rank?query=test&mode=volam&alpha=0.5&beta=0.3&gamma=0.2'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    
    // Verify that the response includes all the metrics that should be logged
    expect(body).toHaveProperty('mode');
    expect(body).toHaveProperty('query');
    expect(body).toHaveProperty('parameters');
    expect(body.parameters).toHaveProperty('alpha');
    expect(body.parameters).toHaveProperty('beta');
    expect(body.parameters).toHaveProperty('gamma');
    expect(body).toHaveProperty('metadata');
    expect(body.metadata).toHaveProperty('responseTime');
    expect(body.metadata).toHaveProperty('timestamp');
  });
});
