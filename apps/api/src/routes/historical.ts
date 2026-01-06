import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '@nba-dfs/database';

export const historicalRoutes: FastifyPluginAsync = async (app) => {
  // Get player historical games
  app.get(
    '/player/:playerName',
    {
      schema: {
        tags: ['Historical'],
        description: 'Get historical games for a player',
        params: {
          type: 'object',
          properties: {
            playerName: { type: 'string' },
          },
          required: ['playerName'],
        },
        querystring: {
          type: 'object',
          properties: {
            season: { type: 'string' },
            limit: { type: 'integer', default: 30 },
            opponent: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { playerName } = request.params as { playerName: string };
      const { season, limit, opponent } = request.query as {
        season?: string;
        limit?: number;
        opponent?: string;
      };

      const games = await prisma.historicalGame.findMany({
        where: {
          playerName: {
            contains: playerName,
          },
          ...(season && { season }),
          ...(opponent && { opponent }),
        },
        orderBy: { gameDate: 'desc' },
        take: limit || 30,
      });

      // Calculate averages
      const avgDkPts =
        games.reduce((sum, g) => sum + g.dkFantasyPoints, 0) / games.length || 0;
      const avgMinutes =
        games.reduce((sum, g) => sum + (g.minutes || 0), 0) / games.length || 0;

      return {
        success: true,
        data: {
          games,
          stats: {
            gamesPlayed: games.length,
            avgDkPts: Math.round(avgDkPts * 10) / 10,
            avgMinutes: Math.round(avgMinutes * 10) / 10,
          },
        },
      };
    }
  );

  // Get team defense stats
  app.get(
    '/defense',
    {
      schema: {
        tags: ['Historical'],
        description: 'Get team defense statistics',
      },
    },
    async (request, reply) => {
      const defenseStats = await prisma.teamDefense.findMany({
        orderBy: { defEff: 'desc' },
      });

      return {
        success: true,
        data: defenseStats,
      };
    }
  );

  // Get defense for specific team
  app.get(
    '/defense/:team',
    {
      schema: {
        tags: ['Historical'],
        description: 'Get defense stats for a specific team',
        params: {
          type: 'object',
          properties: {
            team: { type: 'string' },
          },
          required: ['team'],
        },
      },
    },
    async (request, reply) => {
      const { team } = request.params as { team: string };

      const defense = await prisma.teamDefense.findUnique({
        where: { team: team.toUpperCase() },
      });

      if (!defense) {
        reply.notFound('Team defense data not found');
        return;
      }

      return {
        success: true,
        data: defense,
      };
    }
  );

  // Analyze usage bumps for a slate
  app.get(
    '/usage-bumps/:slateId',
    {
      schema: {
        tags: ['Historical'],
        description: 'Find players with potential usage bumps',
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
            minBump: { type: 'number', default: 5 },
          },
        },
      },
    },
    async (request, reply) => {
      const { slateId } = request.params as { slateId: string };
      const { minBump } = request.query as { minBump?: number };

      // Get players in slate
      const slatePlayers = await prisma.player.findMany({
        where: { slateId },
      });

      const slatePlayerNames = new Set(
        slatePlayers.map((p) => p.name.toLowerCase())
      );
      const teams = [...new Set(slatePlayers.map((p) => p.team))];

      // Find historical high-usage players for each team
      const usageBumps = [];

      for (const team of teams) {
        // Get historical team rosters
        const recentGames = await prisma.historicalGame.findMany({
          where: {
            team,
            gameDate: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
            },
          },
          orderBy: { dkFantasyPoints: 'desc' },
        });

        // Find high-usage players not in slate
        const historicalPlayers = new Set(
          recentGames.map((g) => g.playerName.toLowerCase())
        );
        const missingPlayers = [...historicalPlayers].filter(
          (name) => !slatePlayerNames.has(name)
        );

        // For each missing player, find beneficiaries
        for (const missingPlayer of missingPlayers) {
          const missingPlayerGames = recentGames.filter(
            (g) => g.playerName.toLowerCase() === missingPlayer
          );
          const avgMissingPts =
            missingPlayerGames.reduce((s, g) => s + g.dkFantasyPoints, 0) /
            missingPlayerGames.length;

          if (avgMissingPts < 25) continue; // Only care about high-usage players

          // Find games where this player was OUT vs IN
          // This is a simplified version - full implementation would compare rosters
          const teamPlayers = slatePlayers.filter((p) => p.team === team);

          for (const player of teamPlayers) {
            const bump = player.usageBump || 0;
            if (bump * 100 >= (minBump || 5)) {
              usageBumps.push({
                player: {
                  id: player.id,
                  name: player.name,
                  team: player.team,
                  salary: player.salary,
                  projectedPoints: player.projectedPoints,
                },
                missingTeammate: missingPlayer,
                avgMissingPts,
                bumpPercent: Math.round(bump * 100),
              });
            }
          }
        }
      }

      return {
        success: true,
        data: usageBumps,
      };
    }
  );

  // Get matchup analysis
  app.get(
    '/matchup',
    {
      schema: {
        tags: ['Historical'],
        description: 'Analyze player vs opponent matchup',
        querystring: {
          type: 'object',
          properties: {
            player: { type: 'string' },
            opponent: { type: 'string' },
          },
          required: ['player', 'opponent'],
        },
      },
    },
    async (request, reply) => {
      const { player, opponent } = request.query as {
        player: string;
        opponent: string;
      };

      // Get games vs this opponent
      const vsOppGames = await prisma.historicalGame.findMany({
        where: {
          playerName: { contains: player },
          opponent: opponent.toUpperCase(),
        },
        orderBy: { gameDate: 'desc' },
      });

      // Get all recent games
      const allGames = await prisma.historicalGame.findMany({
        where: {
          playerName: { contains: player },
        },
        orderBy: { gameDate: 'desc' },
        take: 20,
      });

      // Get opponent defense
      const oppDefense = await prisma.teamDefense.findUnique({
        where: { team: opponent.toUpperCase() },
      });

      // Calculate averages
      const vsOppAvg =
        vsOppGames.reduce((s, g) => s + g.dkFantasyPoints, 0) /
          vsOppGames.length || 0;
      const seasonAvg =
        allGames.reduce((s, g) => s + g.dkFantasyPoints, 0) / allGames.length ||
        0;

      return {
        success: true,
        data: {
          vsOpponent: {
            games: vsOppGames,
            avgDkPts: Math.round(vsOppAvg * 10) / 10,
            gamesPlayed: vsOppGames.length,
          },
          season: {
            avgDkPts: Math.round(seasonAvg * 10) / 10,
            gamesPlayed: allGames.length,
          },
          oppDefense,
          comparison: {
            difference: Math.round((vsOppAvg - seasonAvg) * 10) / 10,
            percentDiff: Math.round(((vsOppAvg - seasonAvg) / seasonAvg) * 100),
          },
        },
      };
    }
  );
};
