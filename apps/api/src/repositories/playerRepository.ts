import { PrismaClient, Prisma } from '@nba-dfs/database';
import { BaseRepository } from './baseRepository.js';

// Types for player operations
export interface PlayerCreateInput {
  externalId: string;
  slateId: string;
  name: string;
  team: string;
  opponent: string;
  positions: string;
  salary: number;
  projectedPoints?: number | null;
  projectedMinutes?: number | null;
  floor?: number | null;
  ceiling?: number | null;
  value?: number | null;
  confidence?: string;
  dvpPtsAllowed?: number | null;
  oppDefEff?: number | null;
  vegasImplied?: number | null;
  vegasSpread?: number | null;
  vegasTotal?: number | null;
  usageBump?: number | null;
  boomProbability?: number | null;
  bustProbability?: number | null;
  leverageScore?: number | null;
  ownership?: number | null;
  rawData?: string | null;
}

export interface PlayerUpdateInput {
  projectedPoints?: number | null;
  projectedMinutes?: number | null;
  floor?: number | null;
  ceiling?: number | null;
  value?: number | null;
  confidence?: string;
  usageBump?: number | null;
  boomProbability?: number | null;
  bustProbability?: number | null;
  leverageScore?: number | null;
  ownership?: number | null;
}

export interface PlayerFilters {
  minProjection?: number;
  maxSalary?: number;
  minSalary?: number;
  positions?: string[];
  teams?: string[];
  excludeIds?: string[];
  search?: string;
}

export interface PlayerWithHistory {
  id: string;
  name: string;
  team: string;
  opponent: string;
  positions: string;
  salary: number;
  projectedPoints: number | null;
  seasonAvg: number | null;
  last7Avg: number | null;
  last3Avg: number | null;
  gamesPlayed: number;
}

type Player = Prisma.PlayerGetPayload<{}>;

export class PlayerRepository extends BaseRepository<
  Player,
  PlayerCreateInput,
  PlayerUpdateInput
> {
  protected get model() {
    return this.prisma.player;
  }

  /**
   * Find all players for a specific slate with optional filters
   */
  async findBySlate(
    slateId: string,
    filters?: PlayerFilters,
    orderBy?: { field: string; direction: 'asc' | 'desc' }
  ): Promise<Player[]> {
    const where: Prisma.PlayerWhereInput = {
      slateId,
      ...(filters?.minProjection && {
        projectedPoints: { gte: filters.minProjection },
      }),
      ...(filters?.maxSalary && { salary: { lte: filters.maxSalary } }),
      ...(filters?.minSalary && { salary: { gte: filters.minSalary } }),
      ...(filters?.teams && { team: { in: filters.teams } }),
      ...(filters?.excludeIds && { id: { notIn: filters.excludeIds } }),
      ...(filters?.search && {
        name: { contains: filters.search },
      }),
    };

    const players = await this.prisma.player.findMany({
      where,
      orderBy: orderBy
        ? { [orderBy.field]: orderBy.direction }
        : { projectedPoints: 'desc' },
    });

    // Filter by positions if specified (handled in-memory for complex matching)
    if (filters?.positions && filters.positions.length > 0) {
      return players.filter((p) => {
        const playerPositions = p.positions.split(',').map((pos) => pos.trim());
        return playerPositions.some((pos) => filters.positions!.includes(pos));
      });
    }

    return players;
  }

  /**
   * Bulk upsert players for a slate (atomic operation)
   * Replaces all existing players for the slate
   */
  async bulkUpsert(slateId: string, players: PlayerCreateInput[]): Promise<number> {
    return this.transaction(async (tx) => {
      // Delete existing players for this slate
      await tx.player.deleteMany({ where: { slateId } });

      // Insert new players
      const result = await tx.player.createMany({
        data: players.map((p) => ({
          ...p,
          slateId,
        })),
      });

      return result.count;
    });
  }

  /**
   * Update projections for multiple players
   */
  async bulkUpdateProjections(
    updates: Array<{ id: string; projectedPoints: number; floor?: number; ceiling?: number; value?: number }>
  ): Promise<number> {
    let updated = 0;

    await this.transaction(async (tx) => {
      for (const update of updates) {
        await tx.player.update({
          where: { id: update.id },
          data: {
            projectedPoints: update.projectedPoints,
            floor: update.floor,
            ceiling: update.ceiling,
            value: update.value,
          },
        });
        updated++;
      }
    });

    return updated;
  }

  /**
   * Get players with their historical stats aggregated
   * Uses raw SQL for efficient aggregation (fixes N+1 query problem)
   */
  async getWithHistoricalStats(slateId: string): Promise<PlayerWithHistory[]> {
    // For SQL Server, we need to use different date functions
    const players = await this.prisma.$queryRaw<PlayerWithHistory[]>`
      SELECT
        p.id,
        p.name,
        p.team,
        p.opponent,
        p.positions,
        p.salary,
        p.[projectedPoints],
        (
          SELECT AVG(h.[dkFantasyPoints])
          FROM [HistoricalGame] h
          WHERE LOWER(p.name) = LOWER(h.[playerName])
        ) as seasonAvg,
        (
          SELECT AVG(h.[dkFantasyPoints])
          FROM [HistoricalGame] h
          WHERE LOWER(p.name) = LOWER(h.[playerName])
          AND h.[gameDate] >= DATEADD(day, -7, GETDATE())
        ) as last7Avg,
        (
          SELECT AVG(h.[dkFantasyPoints])
          FROM [HistoricalGame] h
          WHERE LOWER(p.name) = LOWER(h.[playerName])
          AND h.[gameDate] >= DATEADD(day, -3, GETDATE())
        ) as last3Avg,
        (
          SELECT COUNT(*)
          FROM [HistoricalGame] h
          WHERE LOWER(p.name) = LOWER(h.[playerName])
        ) as gamesPlayed
      FROM [Player] p
      WHERE p.[slateId] = ${slateId}
    `;

    return players;
  }

  /**
   * Get player IDs grouped by team for stacking optimization
   */
  async getPlayersByTeam(slateId: string): Promise<Map<string, string[]>> {
    const players = await this.prisma.player.findMany({
      where: { slateId },
      select: { id: true, team: true },
    });

    const teamMap = new Map<string, string[]>();
    for (const player of players) {
      const existing = teamMap.get(player.team) || [];
      existing.push(player.id);
      teamMap.set(player.team, existing);
    }

    return teamMap;
  }

  /**
   * Get player IDs grouped by game (team + opponent matchup)
   */
  async getPlayersByGame(slateId: string): Promise<Map<string, string[]>> {
    const players = await this.prisma.player.findMany({
      where: { slateId },
      select: { id: true, team: true, opponent: true },
    });

    const gameMap = new Map<string, string[]>();
    for (const player of players) {
      // Create a normalized game key (alphabetically sorted teams)
      const teams = [player.team, player.opponent].sort();
      const gameKey = `${teams[0]}@${teams[1]}`;

      const existing = gameMap.get(gameKey) || [];
      existing.push(player.id);
      gameMap.set(gameKey, existing);
    }

    return gameMap;
  }

  /**
   * Find player by external ID (DraftKings/RotoWire ID)
   */
  async findByExternalId(slateId: string, externalId: string): Promise<Player | null> {
    return this.prisma.player.findUnique({
      where: {
        slateId_externalId: {
          slateId,
          externalId,
        },
      },
    });
  }

  /**
   * Get top value players for quick picks
   */
  async getTopValuePlayers(
    slateId: string,
    limit: number = 20
  ): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: {
        slateId,
        projectedPoints: { not: null },
        value: { not: null },
      },
      orderBy: { value: 'desc' },
      take: limit,
    });
  }

  /**
   * Get chalk (high ownership) players
   */
  async getChalkPlayers(
    slateId: string,
    minOwnership: number = 20
  ): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: {
        slateId,
        ownership: { gte: minOwnership },
      },
      orderBy: { ownership: 'desc' },
    });
  }

  /**
   * Get contrarian (low ownership, high projection) players
   */
  async getContrarianPlayers(
    slateId: string,
    maxOwnership: number = 10,
    minProjection: number = 25
  ): Promise<Player[]> {
    return this.prisma.player.findMany({
      where: {
        slateId,
        ownership: { lte: maxOwnership },
        projectedPoints: { gte: minProjection },
      },
      orderBy: { projectedPoints: 'desc' },
    });
  }
}
