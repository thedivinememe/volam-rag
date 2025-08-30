import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { NullnessService } from '../services/nullness.js';
import { z } from 'zod';

const updateNullnessSchema = z.object({
  concept: z.string().min(1).max(100),
  action: z.enum(['support', 'refute']),
  evidence_strength: z.number().min(0).max(1),
  k: z.number().min(0).max(2).default(0.1), // Allow higher k for testing bounds
  lambda: z.number().min(0).max(1).default(0.9)
});

const historyQuerySchema = z.object({
  concept: z.string().min(1).max(100),
  limit: z.number().int().positive().max(1000).default(100),
  timeWindow: z.number().int().positive().default(24)
});

interface UpdateNullnessBody {
  concept: string;
  action: 'support' | 'refute';
  evidence_strength: number;
  k?: number;
  lambda?: number;
}

interface HistoryQuery {
  concept: string;
  limit?: number;
  timeWindow?: number;
}

export async function nullnessRoutes(fastify: FastifyInstance) {
  const nullnessService = new NullnessService();

  // Update nullness endpoint
  fastify.post('/update_nullness', {
    schema: {
      body: {
        type: 'object',
        properties: {
          concept: { type: 'string', minLength: 1, maxLength: 100 },
          action: { type: 'string', enum: ['support', 'refute'] },
          evidence_strength: { type: 'number', minimum: 0, maximum: 1 },
          k: { type: 'number', minimum: 0, maximum: 2 },
          lambda: { type: 'number', minimum: 0, maximum: 1 }
        },
        required: ['concept', 'action', 'evidence_strength']
      }
    }
  }, async (request: FastifyRequest<{ Body: UpdateNullnessBody }>, reply: FastifyReply) => {
    try {
      const params = updateNullnessSchema.parse(request.body);
      
      const startTime = Date.now();
      
      const result = await nullnessService.updateNullnessExplicit(
        params.concept,
        params.action,
        params.evidence_strength,
        params.k,
        params.lambda
      );

      const responseTime = Date.now() - startTime;

      // Log update for evaluation
      fastify.log.info({
        action: 'nullness_update',
        concept: params.concept,
        action_type: params.action,
        evidence_strength: params.evidence_strength,
        k: params.k,
        lambda: params.lambda,
        old_nullness: result.oldNullness,
        new_nullness: result.newNullness,
        delta_nullness: result.deltaNullness,
        responseTime,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        data: {
          concept: params.concept,
          action: params.action,
          old_nullness: result.oldNullness,
          new_nullness: result.newNullness,
          delta: result.deltaNullness,
          timestamp: new Date().toISOString(),
          evidence_strength: params.evidence_strength,
          k: params.k,
          lambda: params.lambda
        },
        metadata: {
          responseTime
        }
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(400).send({ 
        success: false,
        error: 'Invalid request parameters',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Get nullness history for sparkline visualization
  fastify.get('/nullness/history/:concept', {
    schema: {
      params: {
        type: 'object',
        properties: {
          concept: { type: 'string', minLength: 1, maxLength: 100 }
        },
        required: ['concept']
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 1000 },
          timeWindow: { type: 'number', minimum: 1 }
        }
      }
    }
  }, async (request: FastifyRequest<{ 
    Params: { concept: string }, 
    Querystring: HistoryQuery 
  }>, reply: FastifyReply) => {
    try {
      const concept = request.params.concept;
      const query = historyQuerySchema.parse({
        concept: concept,
        limit: request.query.limit,
        timeWindow: request.query.timeWindow
      });
      
      const startTime = Date.now();
      
      const history = await nullnessService.getNullnessHistory(concept);
      const deltaNullness = await nullnessService.calculateDeltaNullness(concept, query.timeWindow);
      
      // Filter and limit history for sparkline
      const now = new Date();
      const windowStart = new Date(now.getTime() - query.timeWindow * 60 * 60 * 1000);
      
      const filteredHistory = history
        .filter(entry => new Date(entry.timestamp) >= windowStart)
        .slice(-query.limit)
        .map(entry => ({
          timestamp: entry.timestamp,
          nullness: entry.nullness,
          confidence: entry.confidence
        }));

      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          concept,
          history: filteredHistory.map(entry => ({
            timestamp: entry.timestamp,
            nullness: entry.nullness,
            delta: 0, // Will be calculated from previous entry
            action: 'unknown', // Historical data may not have action
            evidence_strength: 0 // Historical data may not have evidence_strength
          })),
          deltaNullness,
          currentNullness: history.length > 0 ? history[history.length - 1].nullness : null
        },
        metadata: {
          totalEntries: history.length,
          filteredEntries: filteredHistory.length,
          timeWindow: query.timeWindow,
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

  // Get all concepts with nullness tracking
  fastify.get('/nullness/concepts', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const startTime = Date.now();
      
      const concepts = await nullnessService.getAllConceptsWithMetadata();
      
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        data: {
          concepts: concepts.map(concept => ({
            concept: concept.concept,
            current_nullness: concept.currentNullness,
            last_updated: concept.lastUpdated,
            update_count: concept.updateCount
          }))
        },
        metadata: {
          responseTime,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      fastify.log.error(error);
      reply.status(500).send({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
