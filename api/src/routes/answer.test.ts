import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, test } from 'vitest';

import { answerRoutes } from './answer.js';

describe('/answer endpoint', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(answerRoutes, { prefix: '/api' });
  });

  test('should return answer with citations for valid query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=What is nullness?'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('query', 'What is nullness?');
    expect(body).toHaveProperty('answer');
    expect(body).toHaveProperty('citations');
    expect(body).toHaveProperty('confidence');
    expect(body).toHaveProperty('mode', 'baseline');
    expect(body).toHaveProperty('metadata');
    
    // Validate citations structure
    expect(Array.isArray(body.citations)).toBe(true);
    if (body.citations.length > 0) {
      const citation = body.citations[0];
      expect(citation).toHaveProperty('id');
      expect(citation).toHaveProperty('content');
      expect(citation).toHaveProperty('source');
      expect(citation).toHaveProperty('score');
      expect(citation).toHaveProperty('index');
    }

    // Validate metadata
    expect(body.metadata).toHaveProperty('responseTime');
    expect(body.metadata).toHaveProperty('timestamp');
    expect(body.metadata).toHaveProperty('citationCount');
    expect(typeof body.metadata.responseTime).toBe('number');
  });

  test('should support different modes (baseline and volam)', async () => {
    const baselineResponse = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&mode=baseline'
    });

    const volamResponse = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&mode=volam'
    });

    expect(baselineResponse.statusCode).toBe(200);
    expect(volamResponse.statusCode).toBe(200);

    const baselineBody = JSON.parse(baselineResponse.body);
    const volamBody = JSON.parse(volamResponse.body);

    expect(baselineBody.mode).toBe('baseline');
    expect(volamBody.mode).toBe('volam');
  });

  test('should support custom k parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&k=5'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.citations.length).toBeLessThanOrEqual(5);
  });

  test('should return 400 for missing query parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for empty query', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query='
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid k parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&k=0'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for k parameter exceeding maximum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&k=15'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should return 400 for invalid mode parameter', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&mode=invalid'
    });

    expect(response.statusCode).toBe(400);
    
    const body = JSON.parse(response.body);
    expect(body).toHaveProperty('error');
  });

  test('should meet latency requirement (<300ms)', async () => {
    const startTime = Date.now();
    
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=What is nullness in VOLaM?'
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;

    expect(response.statusCode).toBe(200);
    expect(responseTime).toBeLessThan(300);

    // Also check the reported response time in metadata
    const body = JSON.parse(response.body);
    expect(body.metadata.responseTime).toBeLessThan(300);
  });

  test('should format citations correctly', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/answer?query=test&k=3'
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    
    // Check that answer contains citation markers
    expect(body.answer).toMatch(/\[1\]/);
    
    // Check that citations are numbered correctly
    body.citations.forEach((citation: any, index: number) => {
      expect(citation.index).toBe(index + 1);
    });

    // Check that answer contains source references
    expect(body.answer).toMatch(/Sources:/);
  });

  test('should handle queries with special characters', async () => {
    const specialQuery = 'What is "nullness" & how does it work?';
    const response = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(specialQuery)}`
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.query).toBe(specialQuery);
  });
});
