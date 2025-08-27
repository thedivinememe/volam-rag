import Fastify from 'fastify';
import cors from '@fastify/cors';
import { rankRoutes } from './routes/rank.js';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(cors, {
  origin: true
});

await fastify.register(swagger, {
  swagger: {
    info: {
      title: 'VOLaM-RAG API',
      description: 'Evidence ranking with nullness tracking and empathy profiling',
      version: '1.0.0'
    },
    host: 'localhost:8000',
    schemes: ['http'],
    consumes: ['application/json'],
    produces: ['application/json']
  }
});

await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: {
    docExpansion: 'full',
    deepLinking: false
  }
});

// Register routes
await fastify.register(rankRoutes, { prefix: '/api' });

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: 8000, host: '0.0.0.0' });
    console.log('VOLaM-RAG API server listening on port 8000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
