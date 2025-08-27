import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { NullnessService } from '../services/nullness.js';
import { RankingService } from '../services/ranking.js';
import { z } from 'zod';

const rankQuerySchema = z.object({
  mode: z.enum(['baseline', 'volam']).default('baseline'),
  query: z.string(),
  k: z.number().int().positive().default(5),
  alpha: z.number().min(0).max(1).default(0.6),
  beta: z.number().min(0).max(1).default(0.3),
  gamma: z.number().min(0).max(1).default(0.1)
});

interface RankQuery {
  mode?: 'baseline' | 'volam';
  query: string;
  k?: number;
  alpha?: number;
  beta?: number;
  gamma?: number;
}

export async function rankRoutes(fastify: FastifyInstance) {
  const rankingService = new RankingService();
  const nullnessService = new NullnessService();

  fastify.get('/rank', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          mode: { type: 'string', enum: ['baseline', 'volam'] },
          query: { type: 'string' },
          k: { type: 'number', minimum: 1 },
          alpha: { type: 'number', minimum: 0, maximum: 1 },
          beta: { type: 'number', minimum: 0, maximum: 1 },
          gamma: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['query']
      }
    }
  }, async (request: FastifyRequest<{ Querystring: RankQuery }>, reply: FastifyReply) => {
    try {
      const params = rankQuerySchema.parse(request.query);
      
      const startTime = Date.now();
      
      let results;
      if (params.mode === 'volam') {
        results = await rankingService.rankWithVOLaM(
          params.query,
          params.k,
          params.alpha,
          params.beta,
          params.gamma
        );
      } else {
        results = await rankingService.rankBaseline(params.query, params.k);
      }

      // Update nullness tracking
      await nullnessService.updateNullness(params.query, results);

      const responseTime = Date.now() - startTime;

      // Log evaluation metrics
      fastify.log.info({
        mode: params.mode,
        query: params.query,
        alpha: params.alpha,
        beta: params.beta,
        gamma: params.gamma,
        topKScores: results.evidence.slice(0, 3).map(e => e.score),
        responseTime,
        timestamp: new Date().toISOString()
      });

      return {
        mode: params.mode,
        query: params.query,
        evidence: results.evidence,
        answer: results.answer,
        confidence: results.confidence,
        nullness: results.nullness,
        parameters: {
          alpha: params.alpha,
          beta: params.beta,
          gamma: params.gamma,
          k: params.k
        },
        metadata: {
          responseTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(400).send({ 
        error: 'Invalid request parameters',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
