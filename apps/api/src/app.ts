import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { healthRoutes } from './routes/health.js';
import { slateRoutes } from './routes/slates.js';
import { playerRoutes } from './routes/players.js';
import { optimizerRoutes } from './routes/optimizer.js';
import { historicalRoutes } from './routes/historical.js';
import { chatRoutes } from './routes/chat.js';
import { rotowireRoutes } from './routes/rotowire.js';

export async function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts);

  // Plugins
  await app.register(cors, {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  });

  await app.register(sensible);

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  // Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'NBA DFS Optimizer API',
        description: 'API for NBA DFS research and lineup optimization',
        version: '2.0.0',
      },
      servers: [
        {
          url: process.env.API_URL || 'http://localhost:3001',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Slates', description: 'Slate management' },
        { name: 'Players', description: 'Player data and projections' },
        { name: 'Optimizer', description: 'Lineup optimization' },
        { name: 'Historical', description: 'Historical data and analytics' },
        { name: 'Chat', description: 'AI chat interface' },
        { name: 'RotoWire', description: 'RotoWire data sync' },
      ],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
  });

  // Routes
  await app.register(healthRoutes, { prefix: '/api' });
  await app.register(slateRoutes, { prefix: '/api/slates' });
  await app.register(playerRoutes, { prefix: '/api/players' });
  await app.register(optimizerRoutes, { prefix: '/api/optimizer' });
  await app.register(historicalRoutes, { prefix: '/api/historical' });
  await app.register(chatRoutes, { prefix: '/api/chat' });
  await app.register(rotowireRoutes, { prefix: '/api' });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    app.log.error(error);

    const statusCode = error.statusCode || 500;
    const message =
      statusCode === 500 ? 'Internal Server Error' : error.message;

    reply.status(statusCode).send({
      success: false,
      error: message,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    });
  });

  return app;
}
