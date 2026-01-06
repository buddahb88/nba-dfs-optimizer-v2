import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        description: 'Health check endpoint',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              timestamp: { type: 'string' },
              version: { type: 'string' },
              database: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      let dbStatus = 'disconnected';

      try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
      } catch (error) {
        app.log.error({ err: error }, 'Database health check failed');
      }

      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        database: dbStatus,
      };
    }
  );

  app.get(
    '/ready',
    {
      schema: {
        tags: ['Health'],
        description: 'Readiness check for load balancers',
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
            },
          },
          503: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        await prisma.$queryRaw`SELECT 1`;
        return { ready: true };
      } catch (error) {
        reply.status(503);
        return {
          ready: false,
          error: 'Database connection failed',
        };
      }
    }
  );
};
