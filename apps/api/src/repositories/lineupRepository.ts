import { PrismaClient, Prisma } from '@nba-dfs/database';
import { BaseRepository } from './baseRepository.js';

// Types for lineup operations
export interface LineupCreateInput {
  slateId: string;
  name: string;
  totalSalary: number;
  projectedPoints?: number | null;
  mode?: string;
  isOptimized?: boolean;
  actualPoints?: number | null;
  contestId?: string | null;
  placement?: number | null;
}

export interface LineupPlayerInput {
  playerId: string;
  slot: string;
}

export interface LineupWithPlayers {
  id: string;
  slateId: string;
  name: string;
  totalSalary: number;
  projectedPoints: number | null;
  mode: string;
  isOptimized: boolean;
  actualPoints: number | null;
  contestId: string | null;
  placement: number | null;
  createdAt: Date;
  updatedAt: Date;
  players: Array<{
    id: string;
    slot: string;
    player: {
      id: string;
      name: string;
      team: string;
      positions: string;
      salary: number;
      projectedPoints: number | null;
    };
  }>;
}

export interface LineupExposure {
  playerId: string;
  playerName: string;
  count: number;
  percentage: number;
}

type Lineup = Prisma.LineupGetPayload<{}>;

export class LineupRepository extends BaseRepository<
  Lineup,
  LineupCreateInput,
  Partial<LineupCreateInput>
> {
  protected get model() {
    return this.prisma.lineup;
  }

  /**
   * Find all lineups for a slate with players
   */
  async findBySlateWithPlayers(slateId: string): Promise<LineupWithPlayers[]> {
    const lineups = await this.prisma.lineup.findMany({
      where: { slateId },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                positions: true,
                salary: true,
                projectedPoints: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return lineups as LineupWithPlayers[];
  }

  /**
   * Create lineup with players in a single transaction
   */
  async createWithPlayers(
    lineupData: LineupCreateInput,
    players: LineupPlayerInput[]
  ): Promise<LineupWithPlayers> {
    const lineup = await this.prisma.lineup.create({
      data: {
        ...lineupData,
        players: {
          create: players.map((p) => ({
            playerId: p.playerId,
            slot: p.slot,
          })),
        },
      },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                positions: true,
                salary: true,
                projectedPoints: true,
              },
            },
          },
        },
      },
    });

    return lineup as LineupWithPlayers;
  }

  /**
   * Bulk create multiple lineups (for optimizer output)
   */
  async bulkCreateWithPlayers(
    lineups: Array<{
      lineup: LineupCreateInput;
      players: LineupPlayerInput[];
    }>
  ): Promise<number> {
    let created = 0;

    await this.transaction(async (tx) => {
      for (const { lineup, players } of lineups) {
        await tx.lineup.create({
          data: {
            ...lineup,
            players: {
              create: players.map((p) => ({
                playerId: p.playerId,
                slot: p.slot,
              })),
            },
          },
        });
        created++;
      }
    });

    return created;
  }

  /**
   * Get lineup by ID with full player data
   */
  async findByIdWithPlayers(id: string): Promise<LineupWithPlayers | null> {
    const lineup = await this.prisma.lineup.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                positions: true,
                salary: true,
                projectedPoints: true,
              },
            },
          },
        },
      },
    });

    return lineup as LineupWithPlayers | null;
  }

  /**
   * Update lineup with actual results (for backtesting)
   */
  async updateActualResults(
    id: string,
    actualPoints: number,
    placement?: number,
    contestId?: string
  ): Promise<Lineup> {
    return this.prisma.lineup.update({
      where: { id },
      data: {
        actualPoints,
        placement,
        contestId,
      },
    });
  }

  /**
   * Calculate player exposure across lineups
   */
  async getPlayerExposure(slateId: string): Promise<LineupExposure[]> {
    const lineups = await this.prisma.lineup.findMany({
      where: { slateId },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    const totalLineups = lineups.length;
    if (totalLineups === 0) return [];

    const playerCounts = new Map<string, { name: string; count: number }>();

    for (const lineup of lineups) {
      for (const lp of lineup.players) {
        const existing = playerCounts.get(lp.player.id) || {
          name: lp.player.name,
          count: 0,
        };
        existing.count++;
        playerCounts.set(lp.player.id, existing);
      }
    }

    return Array.from(playerCounts.entries())
      .map(([playerId, data]) => ({
        playerId,
        playerName: data.name,
        count: data.count,
        percentage: Math.round((data.count / totalLineups) * 100),
      }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Get lineups by mode (cash vs GPP)
   */
  async findByMode(
    slateId: string,
    mode: 'CASH' | 'GPP'
  ): Promise<LineupWithPlayers[]> {
    const lineups = await this.prisma.lineup.findMany({
      where: { slateId, mode },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                positions: true,
                salary: true,
                projectedPoints: true,
              },
            },
          },
        },
      },
      orderBy: { projectedPoints: 'desc' },
    });

    return lineups as LineupWithPlayers[];
  }

  /**
   * Find optimal lineup (highest projected points)
   */
  async findOptimalLineup(slateId: string): Promise<LineupWithPlayers | null> {
    const lineup = await this.prisma.lineup.findFirst({
      where: { slateId, isOptimized: true },
      orderBy: { projectedPoints: 'desc' },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                team: true,
                positions: true,
                salary: true,
                projectedPoints: true,
              },
            },
          },
        },
      },
    });

    return lineup as LineupWithPlayers | null;
  }

  /**
   * Get lineup stats summary
   */
  async getLineupStats(slateId: string): Promise<{
    totalLineups: number;
    cashLineups: number;
    gppLineups: number;
    avgProjectedPoints: number;
    avgSalary: number;
    lineupsWithResults: number;
    avgActualPoints: number | null;
  }> {
    const lineups = await this.prisma.lineup.findMany({
      where: { slateId },
      select: {
        mode: true,
        projectedPoints: true,
        totalSalary: true,
        actualPoints: true,
      },
    });

    const cashLineups = lineups.filter((l) => l.mode === 'CASH');
    const gppLineups = lineups.filter((l) => l.mode === 'GPP');
    const lineupsWithResults = lineups.filter((l) => l.actualPoints !== null);

    const avgProjectedPoints =
      lineups.length > 0
        ? lineups.reduce((sum, l) => sum + (l.projectedPoints || 0), 0) / lineups.length
        : 0;

    const avgSalary =
      lineups.length > 0
        ? lineups.reduce((sum, l) => sum + l.totalSalary, 0) / lineups.length
        : 0;

    const avgActualPoints =
      lineupsWithResults.length > 0
        ? lineupsWithResults.reduce((sum, l) => sum + (l.actualPoints || 0), 0) /
          lineupsWithResults.length
        : null;

    return {
      totalLineups: lineups.length,
      cashLineups: cashLineups.length,
      gppLineups: gppLineups.length,
      avgProjectedPoints: Math.round(avgProjectedPoints * 10) / 10,
      avgSalary: Math.round(avgSalary),
      lineupsWithResults: lineupsWithResults.length,
      avgActualPoints: avgActualPoints ? Math.round(avgActualPoints * 10) / 10 : null,
    };
  }

  /**
   * Delete all lineups for a slate
   */
  async deleteBySlate(slateId: string): Promise<number> {
    const result = await this.prisma.lineup.deleteMany({
      where: { slateId },
    });
    return result.count;
  }

  /**
   * Check for duplicate lineups
   */
  async isDuplicate(
    slateId: string,
    playerIds: string[]
  ): Promise<boolean> {
    const existingLineups = await this.prisma.lineup.findMany({
      where: { slateId },
      include: {
        players: {
          select: { playerId: true },
        },
      },
    });

    const newLineupKey = [...playerIds].sort().join('|');

    for (const lineup of existingLineups) {
      const existingKey = lineup.players
        .map((p) => p.playerId)
        .sort()
        .join('|');
      if (existingKey === newLineupKey) {
        return true;
      }
    }

    return false;
  }
}
