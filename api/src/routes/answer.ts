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

interface Citation {
  id: string;
  content: string;
  source: string;
  score: number;
  index: number;
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
                  index: { type: 'number' }
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

      // Extract citations from evidence
      const citations: Citation[] = rankingResult.evidence.map((evidence, index) => ({
        id: evidence.id,
        content: evidence.content,
        source: evidence.source,
        score: evidence.score,
        index: index + 1
      }));

      // Compose answer with proper citations
      const answer = composeAnswerWithCitations(rankingResult.evidence, params.query);

      const responseTime = Date.now() - startTime;

      // Log for performance monitoring
      fastify.log.info({
        endpoint: '/answer',
        mode: params.mode,
        query: params.query,
        k: params.k,
        responseTime,
        citationCount: citations.length,
        timestamp: new Date().toISOString()
      });

      const response: AnswerResponse = {
        query: params.query,
        answer,
        citations,
        confidence: rankingResult.confidence,
        mode: params.mode,
        metadata: {
          responseTime,
          timestamp: new Date().toISOString(),
          citationCount: citations.length
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

/**
 * Compose answer with numbered citations
 */
function composeAnswerWithCitations(evidence: any[], query: string): string {
  if (evidence.length === 0) {
    return `I don't have sufficient evidence to answer the query: "${query}". Please try rephrasing your question or providing more context.`;
  }

  // Create the main answer content
  const mainContent = evidence
    .map((e, index) => `[${index + 1}] ${e.content}`)
    .join('\n\n');

  // Create a synthesized response
  const synthesis = `Based on the available evidence, here's what I found regarding "${query}":

${mainContent}

Sources:
${evidence.map((e, index) => `[${index + 1}] ${e.source}`).join('\n')}`;

  return synthesis;
}
