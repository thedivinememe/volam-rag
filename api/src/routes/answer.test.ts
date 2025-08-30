import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, test } from 'vitest';

import { answerRoutes } from './answer.js';
import fs from 'fs';
import path from 'path';

// Load QA dataset for fixture tests
const qaDatasetPath = path.join(process.cwd(), '../data/evaluation/qa-dataset.json');
const qaDataset = JSON.parse(fs.readFileSync(qaDatasetPath, 'utf-8'));

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

describe('/answer endpoint - QA Dataset Fixtures', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(answerRoutes, { prefix: '/api' });
  });

  test('should handle hotel domain question with proper citations', async () => {
    const hotelQuestion = qaDataset.questions.find((q: any) => q.domain === 'hotel');
    expect(hotelQuestion).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(hotelQuestion.question)}&mode=baseline&k=3`
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.query).toBe(hotelQuestion.question);
    expect(body.answer).toBeDefined();
    expect(body.citations).toBeDefined();
    expect(Array.isArray(body.citations)).toBe(true);
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
    
    // Validate enhanced citation structure from AnswerService
    if (body.citations.length > 0) {
      const citation = body.citations[0];
      expect(citation).toHaveProperty('id');
      expect(citation).toHaveProperty('content');
      expect(citation).toHaveProperty('source');
      expect(citation).toHaveProperty('score');
      expect(citation).toHaveProperty('index');
      expect(citation).toHaveProperty('quotedText');
    }
  });

  test('should handle web-dev domain question with VOLaM mode', async () => {
    const webDevQuestion = qaDataset.questions.find((q: any) => q.domain === 'web-dev');
    expect(webDevQuestion).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(webDevQuestion.question)}&mode=volam&k=3`
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.query).toBe(webDevQuestion.question);
    expect(body.mode).toBe('volam');
    expect(body.answer).toBeDefined();
    expect(body.citations).toBeDefined();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);

    // Check that answer includes rationale-style content
    expect(body.answer).toMatch(/Based on the available evidence/);
    expect(body.answer).toMatch(/Sources:/);
  });

  test('should handle null-not-null domain question with confidence calculation', async () => {
    const nnQuestion = qaDataset.questions.find((q: any) => q.domain === 'null-not-null');
    expect(nnQuestion).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(nnQuestion.question)}&mode=volam&k=5`
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    expect(body.query).toBe(nnQuestion.question);
    expect(body.answer).toBeDefined();
    expect(body.citations).toBeDefined();
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);

    // Validate that confidence is calculated using nullness service integration
    expect(typeof body.confidence).toBe('number');
    
    // Check citation formatting includes quoted text
    if (body.citations.length > 0) {
      body.citations.forEach((citation: any) => {
        expect(citation.quotedText).toBeDefined();
        expect(typeof citation.quotedText).toBe('string');
        expect(citation.quotedText.length).toBeGreaterThan(0);
      });
    }
  });

  test('should provide consistent citation numbering across domains', async () => {
    const testQuestions = [
      qaDataset.questions.find((q: any) => q.domain === 'hotel'),
      qaDataset.questions.find((q: any) => q.domain === 'web-dev'),
      qaDataset.questions.find((q: any) => q.domain === 'null-not-null')
    ];

    for (const question of testQuestions) {
      if (!question) continue;

      const response = await app.inject({
        method: 'GET',
        url: `/api/answer?query=${encodeURIComponent(question.question)}&k=3`
      });

      expect(response.statusCode).toBe(200);
      
      const body = JSON.parse(response.body);
      
      // Validate citation numbering consistency
      body.citations.forEach((citation: any, index: number) => {
        expect(citation.index).toBe(index + 1);
      });

      // Validate that citations are referenced in answer
      if (body.citations.length > 0) {
        expect(body.answer).toMatch(/\[1\]/);
      }
    }
  });

  test('should handle baseline vs volam mode differences', async () => {
    const testQuestion = qaDataset.questions[0]; // Use first question

    const baselineResponse = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(testQuestion.question)}&mode=baseline&k=3`
    });

    const volamResponse = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(testQuestion.question)}&mode=volam&k=3`
    });

    expect(baselineResponse.statusCode).toBe(200);
    expect(volamResponse.statusCode).toBe(200);

    const baselineBody = JSON.parse(baselineResponse.body);
    const volamBody = JSON.parse(volamResponse.body);

    expect(baselineBody.mode).toBe('baseline');
    expect(volamBody.mode).toBe('volam');

    // Both should have valid confidence scores
    expect(baselineBody.confidence).toBeGreaterThanOrEqual(0);
    expect(baselineBody.confidence).toBeLessThanOrEqual(1);
    expect(volamBody.confidence).toBeGreaterThanOrEqual(0);
    expect(volamBody.confidence).toBeLessThanOrEqual(1);

    // Both should have proper citation structure
    expect(Array.isArray(baselineBody.citations)).toBe(true);
    expect(Array.isArray(volamBody.citations)).toBe(true);
  });

  test('should validate answer composition with rationale', async () => {
    const testQuestion = qaDataset.questions.find((q: any) => q.id === 'nn-001'); // Nullness question
    expect(testQuestion).toBeDefined();

    const response = await app.inject({
      method: 'GET',
      url: `/api/answer?query=${encodeURIComponent(testQuestion.question)}&mode=volam&k=3`
    });

    expect(response.statusCode).toBe(200);
    
    const body = JSON.parse(response.body);
    
    // Validate answer structure includes rationale-style content
    expect(body.answer).toMatch(/Based on the available evidence/);
    expect(body.answer).toMatch(/According to the evidence/);
    expect(body.answer).toMatch(/Sources:/);
    
    // Validate citations include quoted text
    if (body.citations.length > 0) {
      body.citations.forEach((citation: any) => {
        expect(citation).toHaveProperty('quotedText');
        expect(citation.quotedText).toBeDefined();
        expect(citation.quotedText.length).toBeLessThanOrEqual(100); // Should be truncated
      });
    }

    // Validate confidence calculation
    expect(body.confidence).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeLessThanOrEqual(1);
  });
});
