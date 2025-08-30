import { AnswerService, Citation } from '../services/answer.js';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { RankingService } from '../services/ranking.js';
import { z } from 'zod';

const answerQuerySchema = z.object({
  query: z.string().min(1, 'Query cannot be empty'),
  k: z.number().int().positive().max(10).default(3),
  mode: z.enum(['baseline', 'volam']).default('baseline')
});

interface AnswerQuery {
  query: string;
  k?: number;
  mode?: 'baseline' | 'volam';
}

interface AnswerResponse {
  query: string;
  answer: string;
  citations: Citation[];
  confidence: number;
  mode: string;
  metadata: {
    responseTime: number;
    timestamp: string;
    citationCount: number;
  };
}

export async function answerRoutes(fastify: FastifyInstance) {
  const rankingService = new RankingService();
  const answerService = new AnswerService();

  fastify.get('/answer', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          query: { type: 'string', minLength: 1 },
          k: { type: 'number', minimum: 1, maximum: 10 },
          mode: { type: 'string', enum: ['baseline', 'volam'] }
        },
        required: ['query']
      },
      response: {
        200: {
          type: 'object',
          properties: {
            query: { type: 'string' },
            answer: { type: 'string' },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  content: { type: 'string' },
                  source: { type: 'string' },
                  score: { type: 'number' },
                  index: { type: 'number' },
                  quotedText: { type: 'string' }
                }
              }
            },
            confidence: { type: 'number' },
            mode: { type: 'string' },
            metadata: {
              type: 'object',
              properties: {
                responseTime: { type: 'number' },
                timestamp: { type: 'string' },
                citationCount: { type: 'number' }
              }
            }
          }
        }
      }
    }
  }, async (request: FastifyRequest<{ Querystring: AnswerQuery }>, reply: FastifyReply) => {
    try {
      const params = answerQuerySchema.parse(request.query);
      const startTime = Date.now();

      // Get ranked evidence using the existing ranking service
      let rankingResult;
      if (params.mode === 'volam') {
        rankingResult = await rankingService.rankWithVOLaM(params.query, params.k);
      } else {
        rankingResult = await rankingService.rankBaseline(params.query, params.k);
      }

      // Use AnswerService to compose answer with rationale and citations
      const answerComposition = await answerService.composeAnswer({
        query: params.query,
        evidence: rankingResult.evidence,
        mode: params.mode,
        rankingResult
      });

      const responseTime = Date.now() - startTime;

      // Log for performance monitoring
      fastify.log.info({
        endpoint: '/answer',
        mode: params.mode,
        query: params.query,
        k: params.k,
        responseTime,
        citationCount: answerComposition.citations.length,
        confidence: answerComposition.confidence,
        timestamp: new Date().toISOString()
      });

      const response: AnswerResponse = {
        query: params.query,
        answer: answerComposition.answer,
        citations: answerComposition.citations,
        confidence: answerComposition.confidence,
        mode: params.mode,
        metadata: {
          responseTime,
          timestamp: new Date().toISOString(),
          citationCount: answerComposition.citations.length
        }
      };

      return response;
    } catch (error) {
      fastify.log.error(error);
      reply.status(400).send({
        error: 'Invalid request parameters',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
