import { PrismaClient } from '@nba-dfs/database';
import { BaseRepository } from './baseRepository.js';

// Types for slate operations
export interface SlateCreateInput {
  externalId: string;
  name: string;
  sport?: string;
  startTime?: Date | null;
  status?: string;
}

export interface SlateUpdateInput {
  name?: string;
  startTime?: Date | null;
  status?: string;
}

export interface SlateWithCounts {
  id: string;
  externalId: string;
  name: string;
  sport: string;
  startTime: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  playerCount: number;
  lineupCount: number;
}

type Slate = Awaited<ReturnType<PrismaClient['slate']['findFirst']>> & {};
type Player = Awaited<ReturnType<PrismaClient['player']['findFirst']>> & {};
type LineupWithPlayerRelations = Awaited<ReturnType<PrismaClient['lineup']['findFirst']>> & {
  players: Array<{ player: Player }>;
};

export class SlateRepository extends BaseRepository<
  Slate,
  SlateCreateInput,
  SlateUpdateInput
> {
  protected get model() {
    return this.prisma.slate;
  }

  /**
   * Find all slates with player and lineup counts
   */
  async findAllWithCounts(options?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<SlateWithCounts[]> {
    const slates = await this.prisma.slate.findMany({
      where: options?.status ? { status: options.status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 20,
      skip: options?.offset || 0,
      include: {
        _count: {
          select: {
            players: true,
            lineups: true,
          },
        },
      },
    });

    type SlateWithCount = typeof slates[number];
    return slates.map((slate: SlateWithCount) => ({
      id: slate.id,
      externalId: slate.externalId,
      name: slate.name,
      sport: slate.sport,
      startTime: slate.startTime,
      status: slate.status,
      createdAt: slate.createdAt,
      updatedAt: slate.updatedAt,
      playerCount: slate._count.players,
      lineupCount: slate._count.lineups,
    }));
  }

  /**
   * Find slate by external ID (DraftKings slate ID)
   */
  async findByExternalId(externalId: string): Promise<Slate | null> {
    return this.prisma.slate.findUnique({
      where: { externalId },
    });
  }

  /**
   * Find slate with all players
   */
  async findWithPlayers(id: string) {
    return this.prisma.slate.findUnique({
      where: { id },
      include: {
        players: {
          orderBy: { salary: 'desc' },
        },
      },
    });
  }

  /**
   * Find slate with all lineups
   */
  async findWithLineups(id: string) {
    return this.prisma.slate.findUnique({
      where: { id },
      include: {
        lineups: {
          include: {
            players: {
              include: {
                player: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  /**
   * Update slate status
   */
  async updateStatus(id: string, status: string): Promise<Slate> {
    return this.prisma.slate.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Get active slates (not yet locked)
   */
  async getActiveSlates(): Promise<Slate[]> {
    return this.prisma.slate.findMany({
      where: {
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Get slates starting within a time window
   */
  async getUpcomingSlates(hoursAhead: number = 24): Promise<Slate[]> {
    const now = new Date();
    const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

    return this.prisma.slate.findMany({
      where: {
        startTime: {
          gte: now,
          lte: cutoff,
        },
        status: { in: ['PENDING', 'ACTIVE'] },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /**
   * Delete slate and all related data (cascading)
   */
  async deleteWithRelations(id: string): Promise<void> {
    // Prisma handles cascading deletes based on schema
    await this.prisma.slate.delete({
      where: { id },
    });
  }

  /**
   * Upsert slate (create or update by external ID)
   */
  async upsert(data: SlateCreateInput): Promise<Slate> {
    return this.prisma.slate.upsert({
      where: { externalId: data.externalId },
      create: data,
      update: {
        name: data.name,
        startTime: data.startTime,
        status: data.status,
      },
    });
  }

  /**
   * Get slate statistics summary
   */
  async getSlateStats(id: string): Promise<{
    playerCount: number;
    lineupCount: number;
    avgSalary: number;
    avgProjection: number;
    totalGames: number;
  } | null> {
    const slate = await this.prisma.slate.findUnique({
      where: { id },
      include: {
        players: {
          select: {
            salary: true,
            projectedPoints: true,
            team: true,
            opponent: true,
          },
        },
        _count: {
          select: { lineups: true },
        },
      },
    });

    if (!slate) return null;

    const players = slate.players;
    type SlatePlayer = { salary: number; projectedPoints: number | null; team: string; opponent: string };
    const avgSalary =
      players.length > 0
        ? players.reduce((sum: number, p: SlatePlayer) => sum + p.salary, 0) / players.length
        : 0;

    const validProjections = players.filter((p: SlatePlayer) => p.projectedPoints !== null);
    const avgProjection =
      validProjections.length > 0
        ? validProjections.reduce((sum: number, p: SlatePlayer) => sum + (p.projectedPoints || 0), 0) /
          validProjections.length
        : 0;

    // Count unique games
    const games = new Set<string>();
    for (const p of players) {
      const teams = [p.team, p.opponent].sort();
      games.add(`${teams[0]}@${teams[1]}`);
    }

    return {
      playerCount: players.length,
      lineupCount: slate._count.lineups,
      avgSalary: Math.round(avgSalary),
      avgProjection: Math.round(avgProjection * 10) / 10,
      totalGames: games.size,
    };
  }
}
