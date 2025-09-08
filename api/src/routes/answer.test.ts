import Fastify, { FastifyInstance } from 'fastify';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { answerRoutes } from './answer.js';
import fs from 'fs';
import path from 'path';

// Mock all services before importing anything else
vi.mock('../services/ranking.js', () => ({
  RankingService: vi.fn().mockImplementation(() => ({
    initialize: vi.fn().mockResolvedValue(undefined),
    rankBaseline: vi.fn().mockResolvedValue({
      evidence: [
        {
          id: 'mock-doc-1',
          content: 'This is mock evidence about nullness in VOLaM theory.',
          score: 0.85,
          cosineScore: 0.85,
          nullness: 0.15,
          empathyFit: 0.7,
          source: 'mock-source-1.txt',
          metadata: {
            domain: 'null-not-null',
            source: 'mock-source-1.txt',
            chunkIndex: 0,
            tokens: 50
          }
        },
        {
          id: 'mock-doc-2',
          content: 'Additional mock evidence explaining theoretical foundations.',
          score: 0.78,
          cosineScore: 0.78,
          nullness: 0.22,
          empathyFit: 0.7,
          source: 'mock-source-2.txt',
          metadata: {
            domain: 'null-not-null',
            source: 'mock-source-2.txt',
            chunkIndex: 1,
            tokens: 45
          }
        },
        {
          id: 'mock-doc-3',
          content: 'Third piece of mock evidence for comprehensive answers.',
          score: 0.72,
          cosineScore: 0.72,
          nullness: 0.28,
          empathyFit: 0.7,
          source: 'mock-source-3.txt',
          metadata: {
            domain: 'null-not-null',
            source: 'mock-source-3.txt',
            chunkIndex: 2,
            tokens: 40
          }
        }
      ],
      answer: 'Mock answer based on evidence',
      confidence: 0.8,
      nullness: 0.22,
      mode: 'baseline'
    }),
    rankWithVOLaM: vi.fn().mockResolvedValue({
      evidence: [
        {
          id: 'mock-doc-1',
          content: 'This is mock evidence about nullness in VOLaM theory.',
          score: 0.87,
          cosineScore: 0.85,
          nullness: 0.15,
          empathyFit: 0.7,
          source: 'mock-source-1.txt',
          metadata: {
            domain: 'null-not-null',
            source: 'mock-source-1.txt',
            chunkIndex: 0,
            tokens: 50
          }
        },
        {
          id: 'mock-doc-2',
          content: 'Additional mock evidence explaining theoretical foundations.',
          score: 0.80,
          cosineScore: 0.78,
          nullness: 0.22,
          empathyFit: 0.7,
          source: 'mock-source-2.txt',
          metadata: {
            domain: 'null-not-null',
            source: 'mock-source-2.txt',
            chunkIndex: 1,
            tokens: 45
          }
        },
        {
          id: 'mock-doc-3',
          content: 'Third piece of mock evidence for comprehensive answers.',
          score: 0.74,
          cosineScore: 0.72,
          nullness: 0.28,
          empathyFit: 0.7,
          source: 'mock-source-3.txt',
          metadata: {
            domain: 'null-not-null',
            source: 'mock-source-3.txt',
            chunkIndex: 2,
            tokens: 40
          }
        }
      ],
      answer: 'Mock VOLaM answer based on evidence',
      confidence: 0.82,
      nullness: 0.22,
      mode: 'volam',
      parameters: { alpha: 0.6, beta: 0.3, gamma: 0.1 }
    })
  }))
}));

vi.mock('../services/answer.js', () => ({
  AnswerService: vi.fn().mockImplementation(() => ({
    composeAnswer: vi.fn().mockResolvedValue({
      answer: 'Based on the available evidence, here\'s what I found regarding your query:\n\nAccording to the evidence, "This is mock evidence about nullness in VOLaM theory." [1]\n\nAccording to the evidence, "Additional mock evidence explaining theoretical foundations." [2]\n\nAccording to the evidence, "Third piece of mock evidence for comprehensive answers." [3]\n\n**Sources:**\n[1] mock-source-1.txt (Score: 0.850)\n[2] mock-source-2.txt (Score: 0.780)\n[3] mock-source-3.txt (Score: 0.720)',
      citations: [
        {
          id: 'mock-doc-1',
          content: 'This is mock evidence about nullness in VOLaM theory.',
          source: 'mock-source-1.txt',
          score: 0.85,
          index: 1,
          quotedText: 'This is mock evidence about nullness in VOLaM theory.'
        },
        {
          id: 'mock-doc-2',
          content: 'Additional mock evidence explaining theoretical foundations.',
          source: 'mock-source-2.txt',
          score: 0.78,
          index: 2,
          quotedText: 'Additional mock evidence explaining theoretical foundations.'
        },
        {
          id: 'mock-doc-3',
          content: 'Third piece of mock evidence for comprehensive answers.',
          source: 'mock-source-3.txt',
          score: 0.72,
          index: 3,
          quotedText: 'Third piece of mock evidence for comprehensive answers.'
        }
      ],
      confidence: 0.8,
      rationale: 'This answer is based on 3 pieces of evidence retrieved using baseline ranking mode.',
      metadata: {
        evidenceCount: 3,
        avgScore: 0.783,
        avgNullness: 0.217,
        synthesisMethod: 'template-based'
      }
    })
  }))
}));






// Load QA dataset for fixture tests
// Handle both local development (api/) and CI (root) working directories
const qaDatasetPath = fs.existsSync(path.join(process.cwd(), '../data/evaluation/qa-dataset.json'))
  ? path.join(process.cwd(), '../data/evaluation/qa-dataset.json')
  : path.join(process.cwd(), 'data/evaluation/qa-dataset.json');
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
