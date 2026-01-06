// Backtest Routes - API for running and reviewing backtests

import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { z } from 'zod';
import { BacktestEngine } from '../services/index.js';

const backtestEngine = new BacktestEngine(prisma);

const runBacktestSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minGamesPlayed: z.number().optional(),
  salaryRange: z
    .object({
      min: z.number(),
      max: z.number(),
    })
    .optional(),
  positions: z.array(z.string()).optional(),
  save: z.boolean().optional().default(false),
});

export const backtestRoutes: FastifyPluginAsync = async (app) => {
  // Run a new backtest
  app.post(
    '/run',
    {
      schema: {
        tags: ['Backtest'],
        description: 'Run a new backtest over a date range',
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            minGamesPlayed: { type: 'integer' },
            salaryRange: {
              type: 'object',
              properties: {
                min: { type: 'number' },
                max: { type: 'number' },
              },
            },
            positions: { type: 'array', items: { type: 'string' } },
            save: { type: 'boolean', default: false },
          },
          required: ['startDate', 'endDate'],
        },
      },
    },
    async (request, reply) => {
      const body = runBacktestSchema.parse(request.body);

      const config = {
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        minGamesPlayed: body.minGamesPlayed,
        salaryRange: body.salaryRange,
        positions: body.positions,
      };

      try {
        if (body.save) {
          // Run and save to database
          const savedRun = await backtestEngine.runAndSaveBacktest(config);
          return {
            success: true,
            message: 'Backtest completed and saved',
            data: savedRun,
          };
        } else {
          // Run without saving
          const results = await backtestEngine.runBacktest(config);

          // Convert Maps to objects for JSON serialization
          const byPosition: Record<string, { mae: number; hitRate: number; count: number }> = {};
          for (const [key, value] of results.byPosition) {
            byPosition[key] = value;
          }

          const bySalaryRange: Record<string, { mae: number; hitRate: number; count: number }> = {};
          for (const [key, value] of results.bySalaryRange) {
            bySalaryRange[key] = value;
          }

          return {
            success: true,
            data: {
              summary: results.summary,
              byConfidence: results.byConfidence,
              byPosition,
              bySalaryRange,
              dailyResults: results.dailyResults,
              // Limit player results to avoid huge responses
              playerResults: results.playerResults.slice(0, 100),
              playerResultsCount: results.playerResults.length,
            },
          };
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Backtest failed';
        reply.status(500);
        return {
          success: false,
          error: message,
        };
      }
    }
  );

  // Get backtest history
  app.get(
    '/history',
    {
      schema: {
        tags: ['Backtest'],
        description: 'Get historical backtest runs',
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'integer', default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { limit = 20 } = request.query as { limit?: number };

      const history = await backtestEngine.getBacktestHistory(limit);

      return {
        success: true,
        data: history,
        meta: {
          count: history.length,
          limit,
        },
      };
    }
  );

  // Get specific backtest run
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Backtest'],
        description: 'Get a specific backtest run by ID',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const run = await backtestEngine.getBacktestRun(id);

      if (!run) {
        reply.notFound('Backtest run not found');
        return;
      }

      return {
        success: true,
        data: run,
      };
    }
  );

  // Delete backtest run
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Backtest'],
        description: 'Delete a backtest run',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        await backtestEngine.deleteBacktestRun(id);
        return {
          success: true,
          message: 'Backtest run deleted',
        };
      } catch (error) {
        reply.notFound('Backtest run not found');
        return;
      }
    }
  );

  // Get accuracy trend over date range
  app.post(
    '/trend',
    {
      schema: {
        tags: ['Backtest'],
        description: 'Get projection accuracy trend over a date range',
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          },
          required: ['startDate', 'endDate'],
        },
      },
    },
    async (request) => {
      const body = request.body as { startDate: string; endDate: string };

      const trend = await backtestEngine.getAccuracyTrend({
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
      });

      return {
        success: true,
        data: trend,
      };
    }
  );
};
