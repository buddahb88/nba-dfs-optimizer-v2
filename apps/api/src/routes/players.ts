import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { parsePositions } from '@nba-dfs/utils';

export const playerRoutes: FastifyPluginAsync = async (app) => {
  // Get players for a slate
  app.get(
    '/:slateId',
    {
      schema: {
        tags: ['Players'],
        description: 'Get all players for a slate with projections',
        params: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
          },
          required: ['slateId'],
        },
        querystring: {
          type: 'object',
          properties: {
            minProjection: { type: 'number' },
            maxSalary: { type: 'number' },
            minSalary: { type: 'number' },
            positions: { type: 'string' },
            teams: { type: 'string' },
            search: { type: 'string' },
            sortBy: { type: 'string', default: 'projectedPoints' },
            sortOrder: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          },
        },
      },
    },
    async (request, reply) => {
      const { slateId } = request.params as { slateId: string };
      const query = request.query as {
        minProjection?: number;
        maxSalary?: number;
        minSalary?: number;
        positions?: string;
        teams?: string;
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
      };

      const players = await prisma.player.findMany({
        where: {
          slateId,
          ...(query.minProjection && {
            projectedPoints: { gte: query.minProjection },
          }),
          ...(query.maxSalary && { salary: { lte: query.maxSalary } }),
          ...(query.minSalary && { salary: { gte: query.minSalary } }),
          ...(query.teams && {
            team: { in: query.teams.split(',') },
          }),
          ...(query.search && {
            name: { contains: query.search },
          }),
        },
        orderBy: {
          [query.sortBy || 'projectedPoints']: query.sortOrder || 'desc',
        },
      });

      // Filter by positions if specified
      type SlatePlayer = typeof players[number];
      let filteredPlayers = players;
      if (query.positions) {
        const requestedPositions = query.positions.split(',');
        filteredPlayers = players.filter((p: SlatePlayer) => {
          const playerPositions = parsePositions(p.positions);
          return playerPositions.some((pos: string) =>
            requestedPositions.includes(pos)
          );
        });
      }

      // Transform to include parsed positions
      const transformedPlayers = filteredPlayers.map((player: SlatePlayer) => ({
        ...player,
        positions: parsePositions(player.positions),
      }));

      return {
        success: true,
        data: transformedPlayers,
        meta: {
          total: transformedPlayers.length,
        },
      };
    }
  );

  // Get single player details
  app.get(
    '/detail/:playerId',
    {
      schema: {
        tags: ['Players'],
        description: 'Get detailed player information',
        params: {
          type: 'object',
          properties: {
            playerId: { type: 'string' },
          },
          required: ['playerId'],
        },
      },
    },
    async (request, reply) => {
      const { playerId } = request.params as { playerId: string };

      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: {
          slate: true,
        },
      });

      if (!player) {
        reply.notFound('Player not found');
        return;
      }

      // Get historical stats for this player
      const historicalGames = await prisma.historicalGame.findMany({
        where: {
          playerName: {
            equals: player.name,
          },
        },
        orderBy: { gameDate: 'desc' },
        take: 20,
      });

      return {
        success: true,
        data: {
          ...player,
          positions: parsePositions(player.positions),
          historicalGames,
        },
      };
    }
  );

  // Update player (lock/exclude)
  app.patch(
    '/:playerId',
    {
      schema: {
        tags: ['Players'],
        description: 'Update player properties',
        params: {
          type: 'object',
          properties: {
            playerId: { type: 'string' },
          },
          required: ['playerId'],
        },
        body: {
          type: 'object',
          properties: {
            projectedPoints: { type: 'number' },
            ownership: { type: 'number' },
          },
        },
      },
    },
    async (request, reply) => {
      const { playerId } = request.params as { playerId: string };
      const body = request.body as {
        projectedPoints?: number;
        ownership?: number;
      };

      const player = await prisma.player.update({
        where: { id: playerId },
        data: body,
      });

      return {
        success: true,
        data: player,
      };
    }
  );
};
