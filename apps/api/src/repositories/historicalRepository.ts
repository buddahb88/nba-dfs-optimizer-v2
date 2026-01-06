import { PrismaClient } from '@nba-dfs/database';
import { BaseRepository } from './baseRepository.js';

// Types for historical game operations
export interface HistoricalGameCreateInput {
  playerName: string;
  playerId?: string | null;
  team: string;
  opponent: string;
  gameDate: Date;
  season: string;
  isHome?: boolean;
  minutes?: number | null;
  points?: number | null;
  rebounds?: number | null;
  assists?: number | null;
  steals?: number | null;
  blocks?: number | null;
  turnovers?: number | null;
  plusMinus?: number | null;
  fgMade?: number | null;
  fgAttempted?: number | null;
  fg3Made?: number | null;
  fg3Attempted?: number | null;
  ftMade?: number | null;
  ftAttempted?: number | null;
  usagePct?: number | null;
  trueShooting?: number | null;
  effectiveFg?: number | null;
  dkFantasyPoints: number;
  restDays?: number | null;
  isBackToBack?: boolean;
}

export interface PlayerStats {
  playerName: string;
  gamesPlayed: number;
  seasonAvg: number;
  last10Avg: number | null;
  last5Avg: number | null;
  last3Avg: number | null;
  stdDev: number | null;
  floorValue: number;
  ceilingValue: number;
  homeAvg: number | null;
  awayAvg: number | null;
}

export interface MatchupHistory {
  playerName: string;
  opponent: string;
  gamesVsOpp: number;
  avgVsOpp: number | null;
  seasonAvg: number | null;
  differential: number | null;
}

export interface RosterContext {
  team: string;
  playerName: string;
  gamesWithTeammate: number;
  avgWithTeammate: number;
  gamesWithoutTeammate: number;
  avgWithoutTeammate: number;
  usageBump: number | null;
}

// Use inferred type from the model
type HistoricalGame = Awaited<ReturnType<PrismaClient['historicalGame']['findFirst']>> & {};

export class HistoricalRepository extends BaseRepository<
  HistoricalGame,
  HistoricalGameCreateInput,
  Partial<HistoricalGameCreateInput>
> {
  protected get model() {
    return this.prisma.historicalGame;
  }

  /**
   * Get games for a specific player
   */
  async findByPlayer(
    playerName: string,
    options?: {
      season?: string;
      opponent?: string;
      limit?: number;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<HistoricalGame[]> {
    return this.prisma.historicalGame.findMany({
      where: {
        playerName: { contains: playerName },
        ...(options?.season && { season: options.season }),
        ...(options?.opponent && { opponent: options.opponent }),
        ...(options?.startDate && { gameDate: { gte: options.startDate } }),
        ...(options?.endDate && { gameDate: { lte: options.endDate } }),
      },
      orderBy: { gameDate: 'desc' },
      take: options?.limit || 50,
    });
  }

  /**
   * Batch load player stats for multiple players (fixes N+1 problem)
   */
  async getBatchPlayerStats(
    playerNames: string[],
    asOfDate?: Date
  ): Promise<PlayerStats[]> {
    const date = asOfDate || new Date();
    const last10Days = new Date(date.getTime() - 10 * 24 * 60 * 60 * 1000);
    const last5Days = new Date(date.getTime() - 5 * 24 * 60 * 60 * 1000);
    const last3Days = new Date(date.getTime() - 3 * 24 * 60 * 60 * 1000);

    // Use Prisma queries instead of raw SQL for better portability
    const stats: PlayerStats[] = [];

    for (const playerName of playerNames) {
      const games = await this.prisma.historicalGame.findMany({
        where: {
          playerName: { contains: playerName },
          gameDate: { gte: new Date(date.getTime() - 365 * 24 * 60 * 60 * 1000) },
        },
        orderBy: { gameDate: 'desc' },
      });

      if (games.length === 0) continue;

      const allPoints = games.map((g: { dkFantasyPoints: number }) => g.dkFantasyPoints);
      const last10Points = games.slice(0, 10).map((g: { dkFantasyPoints: number }) => g.dkFantasyPoints);
      const last5Points = games.slice(0, 5).map((g: { dkFantasyPoints: number }) => g.dkFantasyPoints);
      const last3Points = games.slice(0, 3).map((g: { dkFantasyPoints: number }) => g.dkFantasyPoints);
      const homePoints = games.filter((g: { isHome: boolean }) => g.isHome).map((g: { dkFantasyPoints: number }) => g.dkFantasyPoints);
      const awayPoints = games.filter((g: { isHome: boolean }) => !g.isHome).map((g: { dkFantasyPoints: number }) => g.dkFantasyPoints);

      const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a: number, b: number) => a + b, 0) / arr.length : null;
      const stdDev = (arr: number[]) => {
        if (arr.length < 2) return null;
        const mean = avg(arr) ?? 0;
        const sqDiffs = arr.map((v: number) => Math.pow(v - mean, 2));
        return Math.sqrt((sqDiffs.reduce((a: number, b: number) => a + b, 0)) / arr.length);
      };

      stats.push({
        playerName: games[0]?.playerName ?? playerName,
        gamesPlayed: games.length,
        seasonAvg: avg(allPoints) ?? 0,
        last10Avg: avg(last10Points),
        last5Avg: avg(last5Points),
        last3Avg: avg(last3Points),
        stdDev: stdDev(allPoints),
        floorValue: Math.min(...allPoints),
        ceilingValue: Math.max(...allPoints),
        homeAvg: avg(homePoints),
        awayAvg: avg(awayPoints),
      });
    }

    return stats;
  }

  /**
   * Get matchup history for player vs opponent
   */
  async getMatchupHistory(
    playerName: string,
    opponent: string
  ): Promise<MatchupHistory | null> {
    const [vsOppGames, allGames] = await Promise.all([
      this.prisma.historicalGame.findMany({
        where: {
          playerName: { contains: playerName },
          opponent: opponent.toUpperCase(),
        },
        select: { dkFantasyPoints: true },
      }),
      this.prisma.historicalGame.findMany({
        where: { playerName: { contains: playerName } },
        select: { dkFantasyPoints: true },
        take: 50,
        orderBy: { gameDate: 'desc' },
      }),
    ]);

    if (allGames.length === 0) return null;

    const avgVsOpp =
      vsOppGames.length > 0
        ? vsOppGames.reduce((sum: number, g: { dkFantasyPoints: number }) => sum + g.dkFantasyPoints, 0) / vsOppGames.length
        : null;

    const seasonAvg =
      allGames.reduce((sum: number, g: { dkFantasyPoints: number }) => sum + g.dkFantasyPoints, 0) / allGames.length;

    return {
      playerName,
      opponent,
      gamesVsOpp: vsOppGames.length,
      avgVsOpp: avgVsOpp ? Math.round(avgVsOpp * 10) / 10 : null,
      seasonAvg: Math.round(seasonAvg * 10) / 10,
      differential: avgVsOpp ? Math.round((avgVsOpp - seasonAvg) * 10) / 10 : null,
    };
  }

  /**
   * Get roster context for usage bump calculation
   * Finds games where high-usage teammates were absent
   */
  async getRosterContext(
    playerName: string,
    team: string,
    daysBack: number = 60
  ): Promise<RosterContext[]> {
    const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    // Get all team games in the period
    const teamGames = await this.prisma.historicalGame.findMany({
      where: {
        team,
        gameDate: { gte: cutoffDate },
      },
      select: {
        playerName: true,
        gameDate: true,
        dkFantasyPoints: true,
      },
      orderBy: { gameDate: 'desc' },
    });

    // Group games by date
    type TeamGame = (typeof teamGames)[number];
    const gamesByDate = new Map<string, TeamGame[]>();
    for (const game of teamGames) {
      const dateKey = game.gameDate.toISOString().split('T')[0] ?? '';
      const existing = gamesByDate.get(dateKey) ?? [];
      existing.push(game);
      gamesByDate.set(dateKey, existing);
    }

    // Find high-usage players on the team (avg > 25 DK pts)
    const playerTotals = new Map<string, { total: number; count: number }>();
    for (const game of teamGames) {
      const existing = playerTotals.get(game.playerName) || { total: 0, count: 0 };
      existing.total += game.dkFantasyPoints;
      existing.count++;
      playerTotals.set(game.playerName, existing);
    }

    const highUsagePlayers = Array.from(playerTotals.entries())
      .filter(([name, stats]: [string, { total: number; count: number }]) => stats.total / stats.count >= 25 && name.toLowerCase() !== playerName.toLowerCase())
      .map(([name]: [string, { total: number; count: number }]) => name);

    // Calculate context for each high-usage teammate
    const contexts: RosterContext[] = [];

    for (const teammate of highUsagePlayers) {
      let gamesWithTeammate = 0;
      let ptsWithTeammate = 0;
      let gamesWithoutTeammate = 0;
      let ptsWithoutTeammate = 0;

      for (const [dateKey, games] of gamesByDate) {
        const playerGame = games.find(
          (g) => g.playerName.toLowerCase() === playerName.toLowerCase()
        );
        const teammateGame = games.find(
          (g) => g.playerName.toLowerCase() === teammate.toLowerCase()
        );

        if (playerGame) {
          if (teammateGame) {
            gamesWithTeammate++;
            ptsWithTeammate += playerGame.dkFantasyPoints;
          } else {
            gamesWithoutTeammate++;
            ptsWithoutTeammate += playerGame.dkFantasyPoints;
          }
        }
      }

      if (gamesWithTeammate >= 3 && gamesWithoutTeammate >= 2) {
        const avgWith = ptsWithTeammate / gamesWithTeammate;
        const avgWithout = ptsWithoutTeammate / gamesWithoutTeammate;
        const bump = avgWith > 0 ? (avgWithout - avgWith) / avgWith : 0;

        if (bump > 0.05) {
          // Only include meaningful bumps (> 5%)
          contexts.push({
            team,
            playerName: teammate,
            gamesWithTeammate,
            avgWithTeammate: Math.round(avgWith * 10) / 10,
            gamesWithoutTeammate,
            avgWithoutTeammate: Math.round(avgWithout * 10) / 10,
            usageBump: Math.round(bump * 100) / 100,
          });
        }
      }
    }

    return contexts.sort((a, b) => (b.usageBump || 0) - (a.usageBump || 0));
  }

  /**
   * Bulk upsert historical games
   */
  async bulkUpsert(games: HistoricalGameCreateInput[]): Promise<number> {
    let inserted = 0;

    await this.transaction(async (tx) => {
      for (const game of games) {
        await tx.historicalGame.upsert({
          where: {
            playerName_team_gameDate: {
              playerName: game.playerName,
              team: game.team,
              gameDate: game.gameDate,
            },
          },
          create: game,
          update: {
            ...game,
          },
        });
        inserted++;
      }
    });

    return inserted;
  }

  /**
   * Get recent games for a team
   */
  async getTeamRecentGames(
    team: string,
    limit: number = 10
  ): Promise<HistoricalGame[]> {
    return this.prisma.historicalGame.findMany({
      where: { team },
      orderBy: { gameDate: 'desc' },
      take: limit,
      distinct: ['gameDate'],
    });
  }

  /**
   * Get player's back-to-back performance
   */
  async getBackToBackStats(playerName: string): Promise<{
    b2bGames: number;
    avgOnB2b: number | null;
    avgNonB2b: number | null;
    differential: number | null;
  }> {
    const games = await this.prisma.historicalGame.findMany({
      where: { playerName: { contains: playerName } },
      select: {
        dkFantasyPoints: true,
        isBackToBack: true,
      },
    });

    type B2bGame = { dkFantasyPoints: number; isBackToBack: boolean };
    const b2bGames = games.filter((g: B2bGame) => g.isBackToBack);
    const nonB2bGames = games.filter((g: B2bGame) => !g.isBackToBack);

    const avgOnB2b =
      b2bGames.length > 0
        ? b2bGames.reduce((sum: number, g: B2bGame) => sum + g.dkFantasyPoints, 0) / b2bGames.length
        : null;

    const avgNonB2b =
      nonB2bGames.length > 0
        ? nonB2bGames.reduce((sum: number, g: B2bGame) => sum + g.dkFantasyPoints, 0) / nonB2bGames.length
        : null;

    return {
      b2bGames: b2bGames.length,
      avgOnB2b: avgOnB2b ? Math.round(avgOnB2b * 10) / 10 : null,
      avgNonB2b: avgNonB2b ? Math.round(avgNonB2b * 10) / 10 : null,
      differential:
        avgOnB2b && avgNonB2b ? Math.round((avgOnB2b - avgNonB2b) * 10) / 10 : null,
    };
  }

  /**
   * Get season stats summary
   */
  async getSeasonSummary(season: string): Promise<{
    totalGames: number;
    uniquePlayers: number;
    avgDkPoints: number;
  }> {
    const games = await this.prisma.historicalGame.findMany({
      where: { season },
      select: {
        playerName: true,
        dkFantasyPoints: true,
      },
    });

    type SeasonGame = { playerName: string; dkFantasyPoints: number };
    const uniquePlayers = new Set(games.map((g: SeasonGame) => g.playerName)).size;
    const avgDkPoints =
      games.length > 0
        ? games.reduce((sum: number, g: SeasonGame) => sum + g.dkFantasyPoints, 0) / games.length
        : 0;

    return {
      totalGames: games.length,
      uniquePlayers,
      avgDkPoints: Math.round(avgDkPoints * 10) / 10,
    };
  }
}
