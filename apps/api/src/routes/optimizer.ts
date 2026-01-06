import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';
import { z } from 'zod';
import { OptimizerEngine, ProjectionEngine, BacktestEngine } from '../services/index.js';
import { PlayerRepository } from '../repositories/index.js';

// PlayerRepository for future use
const _playerRepo = new PlayerRepository(prisma);
const projectionEngine = new ProjectionEngine(prisma);
const backtestEngine = new BacktestEngine(prisma);

const optimizeSchema = z.object({
  slateId: z.string(),
  mode: z.enum(['CASH', 'GPP']).default('CASH'),
  numLineups: z.number().min(1).max(150).default(1),
  lockedPlayers: z.array(z.string()).optional(),
  excludedPlayers: z.array(z.string()).optional(),
  maxExposure: z.number().min(0).max(100).default(100),
  minExposure: z.number().min(0).max(100).default(0),
  enableStacking: z.boolean().default(false),
  minStack: z.number().min(2).max(4).optional(),
  maxStack: z.number().min(2).max(4).optional(),
  diversityFactor: z.number().min(0).max(0.5).default(0.15),
});

const backtestSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  salaryMin: z.number().optional(),
  salaryMax: z.number().optional(),
});

export const optimizerRoutes: FastifyPluginAsync = async (app) => {
  // Optimize lineups
  app.post(
    '/optimize',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Generate optimized lineups',
        body: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
            mode: { type: 'string', enum: ['CASH', 'GPP'] },
            numLineups: { type: 'integer', minimum: 1, maximum: 150 },
            lockedPlayers: { type: 'array', items: { type: 'string' } },
            excludedPlayers: { type: 'array', items: { type: 'string' } },
            maxExposure: { type: 'number', minimum: 0, maximum: 100 },
            enableStacking: { type: 'boolean' },
          },
          required: ['slateId'],
        },
      },
    },
    async (request, reply) => {
      const body = optimizeSchema.parse(request.body);

      // Get players for the slate
      const players = await prisma.player.findMany({
        where: {
          slateId: body.slateId,
          id: body.excludedPlayers
            ? { notIn: body.excludedPlayers }
            : undefined,
        },
      });

      if (players.length < 8) {
        reply.badRequest('Not enough players to build a lineup');
        return;
      }

      // Map players to optimizer format with enhanced projections
      type SlatePlayer = typeof players[number];
      const playerInputs = players.map((p: SlatePlayer) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        opponent: p.opponent,
        positions: p.positions, // Already a string from Prisma
        salary: p.salary,
        projectedPoints: p.projectedPoints,
        ownership: p.ownership,
        floor: p.floor,
        ceiling: p.ceiling,
        value: p.value,
        boomProbability: p.boomProbability,
        leverageScore: p.leverageScore,
      }));

      // Run optimizer
      const engine = new OptimizerEngine({
        salaryCap: 50000,
        rosterSize: 8,
        mode: body.mode,
        numLineups: body.numLineups,
        maxExposure: body.maxExposure,
        minExposure: body.minExposure,
        stacking: {
          enabled: body.enableStacking,
          minStack: body.minStack || 2,
          maxStack: body.maxStack || 4,
          correlationBonus: 1.5,
          preferHighTotal: true,
        },
        lockedPlayers: body.lockedPlayers || [],
        excludedPlayers: body.excludedPlayers || [],
        diversityFactor: body.diversityFactor,
      });

      const lineups = engine.optimize(playerInputs);

      // Calculate exposure stats
      const exposureMap = new Map<string, number>();
      for (const lineup of lineups) {
        for (const lp of lineup.players) {
          const current = exposureMap.get(lp.player.id) || 0;
          exposureMap.set(lp.player.id, current + 1);
        }
      }

      type PlayerInput = typeof playerInputs[number];
      const exposureStats = Array.from(exposureMap.entries())
        .map(([playerId, count]) => ({
          playerId,
          playerName: playerInputs.find((p: PlayerInput) => p.id === playerId)?.name || 'Unknown',
          count,
          percentage: Math.round((count / lineups.length) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);

      return {
        success: true,
        data: {
          lineups,
          exposureStats,
          meta: {
            count: lineups.length,
            mode: body.mode,
            slateId: body.slateId,
            stackingEnabled: body.enableStacking,
          },
        },
      };
    }
  );

  // Get saved lineups
  app.get(
    '/lineups/:slateId',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Get saved lineups for a slate',
        params: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
          },
          required: ['slateId'],
        },
      },
    },
    async (request, reply) => {
      const { slateId } = request.params as { slateId: string };

      const lineups = await prisma.lineup.findMany({
        where: { slateId },
        include: {
          players: {
            include: {
              player: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return {
        success: true,
        data: lineups,
      };
    }
  );

  // Save lineup
  app.post(
    '/lineups',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Save a lineup',
        body: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
            name: { type: 'string' },
            mode: { type: 'string', enum: ['CASH', 'GPP'] },
            players: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  playerId: { type: 'string' },
                  slot: { type: 'string' },
                },
              },
            },
          },
          required: ['slateId', 'name', 'players'],
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        slateId: string;
        name: string;
        mode?: string;
        players: Array<{ playerId: string; slot: string }>;
      };

      // Calculate total salary and projected points
      const playerIds = body.players.map((p: { playerId: string; slot: string }) => p.playerId);
      const players = await prisma.player.findMany({
        where: { id: { in: playerIds } },
      });

      type SavedPlayer = typeof players[number];
      const totalSalary = players.reduce((sum: number, p: SavedPlayer) => sum + p.salary, 0);
      const projectedPoints = players.reduce(
        (sum: number, p: SavedPlayer) => sum + (p.projectedPoints || 0),
        0
      );

      const lineup = await prisma.lineup.create({
        data: {
          slateId: body.slateId,
          name: body.name,
          totalSalary,
          projectedPoints,
          mode: (body.mode as 'CASH' | 'GPP') || 'CASH',
          isOptimized: true,
          players: {
            create: body.players.map((p) => ({
              playerId: p.playerId,
              slot: p.slot,
            })),
          },
        },
        include: {
          players: {
            include: {
              player: true,
            },
          },
        },
      });

      reply.status(201);
      return {
        success: true,
        data: lineup,
      };
    }
  );

  // Delete lineup
  app.delete(
    '/lineups/:lineupId',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Delete a lineup',
        params: {
          type: 'object',
          properties: {
            lineupId: { type: 'string' },
          },
          required: ['lineupId'],
        },
      },
    },
    async (request, reply) => {
      const { lineupId } = request.params as { lineupId: string };

      await prisma.lineup.delete({
        where: { id: lineupId },
      });

      return {
        success: true,
        message: 'Lineup deleted',
      };
    }
  );

  // Calculate projections for a slate
  app.post(
    '/projections/:slateId',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Calculate enhanced projections for all players in a slate',
        params: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
          },
          required: ['slateId'],
        },
      },
    },
    async (request, reply) => {
      const { slateId } = request.params as { slateId: string };

      // Get players for the slate
      const players = await prisma.player.findMany({
        where: { slateId },
      });

      if (players.length === 0) {
        reply.notFound('No players found for slate');
        return;
      }

      // Map to projection input format
      type ProjPlayer = typeof players[number];
      const playerInputs = players.map((p: ProjPlayer) => ({
        id: p.id,
        name: p.name,
        team: p.team,
        opponent: p.opponent,
        positions: p.positions,
        salary: p.salary,
        projectedPoints: p.projectedPoints,
        ownership: p.ownership,
        vegasImplied: p.vegasImplied,
        vegasSpread: p.vegasSpread,
        vegasTotal: p.vegasTotal,
        isHome: false, // Would need game info
      }));

      // Calculate projections
      const projections = await projectionEngine.calculateProjections(playerInputs);

      // Update players with new projections
      for (const proj of projections) {
        await prisma.player.update({
          where: { id: proj.playerId },
          data: {
            projectedPoints: proj.projectedPoints,
            floor: proj.floor,
            ceiling: proj.ceiling,
            value: proj.value,
            confidence: proj.confidence,
            boomProbability: proj.boomProbability,
            bustProbability: proj.bustProbability,
            leverageScore: proj.leverageScore,
          },
        });
      }

      return {
        success: true,
        data: {
          projections,
          meta: {
            count: projections.length,
            slateId,
          },
        },
      };
    }
  );

  // Get projection details for a player
  app.get(
    '/projections/:slateId/:playerId',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Get detailed projection breakdown for a player',
        params: {
          type: 'object',
          properties: {
            slateId: { type: 'string' },
            playerId: { type: 'string' },
          },
          required: ['slateId', 'playerId'],
        },
      },
    },
    async (request, reply) => {
      const { slateId, playerId } = request.params as {
        slateId: string;
        playerId: string;
      };

      const player = await prisma.player.findFirst({
        where: { id: playerId, slateId },
      });

      if (!player) {
        reply.notFound('Player not found');
        return;
      }

      // Calculate projection with full details
      const playerInput = {
        id: player.id,
        name: player.name,
        team: player.team,
        opponent: player.opponent,
        positions: player.positions,
        salary: player.salary,
        projectedPoints: player.projectedPoints,
        ownership: player.ownership,
        vegasImplied: player.vegasImplied,
        vegasSpread: player.vegasSpread,
        vegasTotal: player.vegasTotal,
        isHome: false,
      };

      const [projection] = await projectionEngine.calculateProjections([playerInput]);

      return {
        success: true,
        data: {
          player: {
            id: player.id,
            name: player.name,
            team: player.team,
            opponent: player.opponent,
            salary: player.salary,
          },
          projection,
        },
      };
    }
  );

  // Run backtest
  app.post(
    '/backtest',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Run projection backtest over date range',
        body: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time' },
            salaryMin: { type: 'number' },
            salaryMax: { type: 'number' },
          },
          required: ['startDate', 'endDate'],
        },
      },
    },
    async (request, reply) => {
      const body = backtestSchema.parse(request.body);

      const results = await backtestEngine.runBacktest({
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        salaryRange:
          body.salaryMin && body.salaryMax
            ? { min: body.salaryMin, max: body.salaryMax }
            : undefined,
      });

      return {
        success: true,
        data: {
          summary: results.summary,
          byConfidence: results.byConfidence,
          bySalaryRange: Object.fromEntries(results.bySalaryRange),
          dailyResults: results.dailyResults.slice(0, 30), // Limit for response size
        },
      };
    }
  );

  // Get backtest accuracy trend
  app.get(
    '/backtest/trend',
    {
      schema: {
        tags: ['Optimizer'],
        description: 'Get projection accuracy trend over time',
        querystring: {
          type: 'object',
          properties: {
            startDate: { type: 'string', format: 'date' },
            endDate: { type: 'string', format: 'date' },
          },
        },
      },
    },
    async (request, reply) => {
      const { startDate, endDate } = request.query as {
        startDate?: string;
        endDate?: string;
      };

      const end = endDate ? new Date(endDate) : new Date();
      const start = startDate
        ? new Date(startDate)
        : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days

      const trend = await backtestEngine.getAccuracyTrend({
        startDate: start,
        endDate: end,
      });

      return {
        success: true,
        data: trend,
      };
    }
  );
};
