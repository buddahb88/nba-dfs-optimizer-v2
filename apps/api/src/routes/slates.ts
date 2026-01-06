import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { z } from 'zod';
import { SlateRepository } from '../repositories/index.js';
import { DataIngestionService } from '../services/index.js';

const slateRepo = new SlateRepository(prisma);
const ingestionService = new DataIngestionService(prisma);

const createSlateSchema = z.object({
  externalId: z.string(),
  name: z.string(),
  startTime: z.string().datetime().optional(),
});

export const slateRoutes: FastifyPluginAsync = async (app) => {
  // Get all slates with counts
  app.get(
    '/',
    {
      schema: {
        tags: ['Slates'],
        description: 'Get all slates with player and lineup counts',
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PENDING', 'ACTIVE', 'LOCKED', 'COMPLETED'] },
            contestType: { type: 'string', enum: ['Classic', 'Showdown', 'Tiers'] },
            limit: { type: 'integer', default: 20 },
            offset: { type: 'integer', default: 0 },
          },
        },
      },
    },
    async (request, reply) => {
      const { status, contestType, limit, offset } = request.query as {
        status?: string;
        contestType?: string;
        limit?: number;
        offset?: number;
      };

      let slates;
      if (contestType) {
        slates = await slateRepo.findByContestType(contestType);
      } else {
        slates = await slateRepo.findAllWithCounts({
          status,
          limit: limit || 20,
          offset: offset || 0,
        });
      }

      return {
        success: true,
        data: slates,
        meta: {
          count: slates.length,
          limit: limit || 20,
          offset: offset || 0,
        },
      };
    }
  );

  // Get slates grouped by contest type
  app.get(
    '/by-type',
    {
      schema: {
        tags: ['Slates'],
        description: 'Get available slates grouped by contest type for lineup building',
      },
    },
    async () => {
      const [classic, showdown, tiers] = await Promise.all([
        slateRepo.findByContestType('Classic'),
        slateRepo.findByContestType('Showdown'),
        slateRepo.findByContestType('Tiers'),
      ]);

      return {
        success: true,
        data: {
          Classic: classic,
          Showdown: showdown,
          Tiers: tiers,
        },
        rosterRules: {
          Classic: {
            slots: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
            salaryCap: 50000,
            description: '8 players, $50K salary cap',
          },
          Showdown: {
            slots: ['CPT', 'FLEX', 'FLEX', 'FLEX', 'FLEX', 'FLEX'],
            salaryCap: 50000,
            description: '1 Captain (1.5x pts/salary) + 5 FLEX, single game',
          },
          Tiers: {
            slots: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6'],
            salaryCap: null,
            description: 'Pick 1 player from each tier, no salary cap',
          },
        },
      };
    }
  );

  // Get slate by ID with stats
  app.get(
    '/:id',
    {
      schema: {
        tags: ['Slates'],
        description: 'Get slate by ID with statistics',
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

      const [slate, stats] = await Promise.all([
        slateRepo.findById(id),
        slateRepo.getSlateStats(id),
      ]);

      if (!slate) {
        reply.notFound('Slate not found');
        return;
      }

      return {
        success: true,
        data: {
          ...slate,
          stats,
        },
      };
    }
  );

  // Get slate with all players
  app.get(
    '/:id/players',
    {
      schema: {
        tags: ['Slates'],
        description: 'Get slate with all players',
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

      const slate = await slateRepo.findWithPlayers(id);

      if (!slate) {
        reply.notFound('Slate not found');
        return;
      }

      return {
        success: true,
        data: slate,
      };
    }
  );

  // Create new slate
  app.post(
    '/',
    {
      schema: {
        tags: ['Slates'],
        description: 'Create a new slate',
        body: {
          type: 'object',
          properties: {
            externalId: { type: 'string' },
            name: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
          },
          required: ['externalId', 'name'],
        },
      },
    },
    async (request, reply) => {
      const body = createSlateSchema.parse(request.body);

      const slate = await slateRepo.create({
        externalId: body.externalId,
        name: body.name,
        startTime: body.startTime ? new Date(body.startTime) : null,
      });

      reply.status(201);
      return {
        success: true,
        data: slate,
      };
    }
  );

  // Delete slate
  app.delete(
    '/:id',
    {
      schema: {
        tags: ['Slates'],
        description: 'Delete a slate and all related data',
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

      const exists = await slateRepo.exists(id);
      if (!exists) {
        reply.notFound('Slate not found');
        return;
      }

      await slateRepo.deleteWithRelations(id);

      return {
        success: true,
        message: 'Slate deleted',
      };
    }
  );

  // Sync slate data
  app.post(
    '/:id/sync',
    {
      schema: {
        tags: ['Slates'],
        description: 'Sync slate data from external sources',
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

      const result = await ingestionService.syncSlate(id);

      if (!result.success) {
        reply.status(400);
      }

      return {
        success: result.success,
        message: result.message,
        data: {
          slateId: id,
          counts: result.counts,
        },
        errors: result.errors,
      };
    }
  );

  // Import CSV data
  app.post(
    '/import',
    {
      schema: {
        tags: ['Slates'],
        description: 'Import slate data from CSV',
        body: {
          type: 'object',
          properties: {
            csvContent: { type: 'string' },
            slateName: { type: 'string' },
            externalId: { type: 'string' },
            startTime: { type: 'string', format: 'date-time' },
          },
          required: ['csvContent', 'slateName', 'externalId'],
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        csvContent: string;
        slateName: string;
        externalId: string;
        startTime?: string;
      };

      const result = await ingestionService.importRotoWireCSV(
        body.csvContent,
        body.slateName,
        body.externalId,
        body.startTime ? new Date(body.startTime) : undefined
      );

      if (!result.success) {
        reply.status(400);
      }

      return result;
    }
  );

  // Get active slates
  app.get(
    '/active',
    {
      schema: {
        tags: ['Slates'],
        description: 'Get all active (not locked) slates',
      },
    },
    async (request, reply) => {
      const slates = await slateRepo.getActiveSlates();

      return {
        success: true,
        data: slates,
      };
    }
  );

  // Get upcoming slates
  app.get(
    '/upcoming',
    {
      schema: {
        tags: ['Slates'],
        description: 'Get slates starting within specified hours',
        querystring: {
          type: 'object',
          properties: {
            hours: { type: 'integer', default: 24 },
          },
        },
      },
    },
    async (request, reply) => {
      const { hours } = request.query as { hours?: number };

      const slates = await slateRepo.getUpcomingSlates(hours || 24);

      return {
        success: true,
        data: slates,
      };
    }
  );
};
