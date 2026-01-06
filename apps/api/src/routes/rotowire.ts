import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { RotoWireService, SITE_IDS } from '../services/dataIngestion/rotoWireService.js';

const rotoWireService = new RotoWireService(prisma);

export const rotowireRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /rotowire/status
   * Check if RotoWire is configured and accessible
   */
  app.get(
    '/rotowire/status',
    {
      schema: {
        tags: ['RotoWire'],
        description: 'Check RotoWire connection status',
        response: {
          200: {
            type: 'object',
            properties: {
              configured: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async () => {
      const hasCookies = rotoWireService.hasCookies();
      return {
        configured: hasCookies,
        message: hasCookies
          ? 'RotoWire cookies configured'
          : 'RotoWire cookies not configured. Set ROTOWIRE_COOKIES environment variable.',
      };
    }
  );

  /**
   * GET /rotowire/slates
   * Fetch available slates from RotoWire (without saving)
   */
  app.get(
    '/rotowire/slates',
    {
      schema: {
        tags: ['RotoWire'],
        description: 'Fetch available slates from RotoWire',
        querystring: {
          type: 'object',
          properties: {
            siteId: { type: 'number', default: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              slates: { type: 'array' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const { siteId } = request.query as { siteId?: number };
      const result = await rotoWireService.fetchSlates(siteId || SITE_IDS.DRAFTKINGS);

      return {
        success: result.success,
        slates: result.data || [],
        error: result.error,
      };
    }
  );

  /**
   * GET /rotowire/players/:slateId
   * Fetch players for a slate from RotoWire (without saving)
   */
  app.get(
    '/rotowire/players/:slateId',
    {
      schema: {
        tags: ['RotoWire'],
        description: 'Fetch players for a specific slate from RotoWire',
        params: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
          },
          required: ['slateId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              players: { type: 'array' },
              count: { type: 'number' },
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request) => {
      const { slateId } = request.params as { slateId: string };
      const result = await rotoWireService.fetchPlayers(parseInt(slateId));

      return {
        success: result.success,
        players: result.data || [],
        count: result.data?.length || 0,
        error: result.error,
      };
    }
  );

  /**
   * POST /rotowire/sync/slates
   * Sync slates from RotoWire to database
   */
  app.post(
    '/rotowire/sync/slates',
    {
      schema: {
        tags: ['RotoWire'],
        description: 'Sync available slates from RotoWire to database',
        querystring: {
          type: 'object',
          properties: {
            siteId: { type: 'number', default: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              counts: {
                type: 'object',
                properties: {
                  slates: { type: 'number' },
                },
              },
              errors: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request) => {
      const { siteId } = request.query as { siteId?: number };
      const result = await rotoWireService.syncSlates(siteId || SITE_IDS.DRAFTKINGS);
      return result;
    }
  );

  /**
   * POST /rotowire/sync/players/:slateId
   * Sync players for a specific slate from RotoWire to database
   */
  app.post(
    '/rotowire/sync/players/:slateId',
    {
      schema: {
        tags: ['RotoWire'],
        description: 'Sync players for a slate from RotoWire to database',
        params: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
          },
          required: ['slateId'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              counts: {
                type: 'object',
                properties: {
                  players: { type: 'number' },
                },
              },
              errors: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request) => {
      const { slateId } = request.params as { slateId: string };
      const result = await rotoWireService.syncPlayers(slateId);
      return result;
    }
  );

  /**
   * POST /rotowire/sync/full
   * Full sync: all slates and their players
   */
  app.post(
    '/rotowire/sync/full',
    {
      schema: {
        tags: ['RotoWire'],
        description: 'Full sync of all slates and players from RotoWire',
        querystring: {
          type: 'object',
          properties: {
            siteId: { type: 'number', default: 1 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
              counts: {
                type: 'object',
                properties: {
                  slates: { type: 'number' },
                  players: { type: 'number' },
                },
              },
              errors: { type: 'array', items: { type: 'string' } },
            },
          },
        },
      },
    },
    async (request) => {
      const { siteId } = request.query as { siteId?: number };
      const result = await rotoWireService.fullSync(siteId || SITE_IDS.DRAFTKINGS);
      return result;
    }
  );
};
