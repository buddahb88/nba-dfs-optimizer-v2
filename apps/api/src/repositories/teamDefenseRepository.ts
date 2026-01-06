import { PrismaClient, Prisma } from '@nba-dfs/database';
import { BaseRepository } from './baseRepository.js';

// Types for team defense operations
export interface TeamDefenseCreateInput {
  team: string;
  defEff: number;
  offEff?: number | null;
  pace?: number | null;
  dvpPg?: number | null;
  dvpSg?: number | null;
  dvpSf?: number | null;
  dvpPf?: number | null;
  dvpC?: number | null;
}

export interface TeamDefenseUpdateInput {
  defEff?: number;
  offEff?: number | null;
  pace?: number | null;
  dvpPg?: number | null;
  dvpSg?: number | null;
  dvpSf?: number | null;
  dvpPf?: number | null;
  dvpC?: number | null;
}

export interface DefenseRanking {
  team: string;
  defEff: number;
  rank: number;
  dvpByPosition: {
    PG: number | null;
    SG: number | null;
    SF: number | null;
    PF: number | null;
    C: number | null;
  };
}

type TeamDefense = Prisma.TeamDefenseGetPayload<{}>;

export class TeamDefenseRepository extends BaseRepository<
  TeamDefense,
  TeamDefenseCreateInput,
  TeamDefenseUpdateInput
> {
  protected get model() {
    return this.prisma.teamDefense;
  }

  /**
   * Find defense stats for a specific team
   */
  async findByTeam(team: string): Promise<TeamDefense | null> {
    return this.prisma.teamDefense.findUnique({
      where: { team: team.toUpperCase() },
    });
  }

  /**
   * Get all defense data as a Map for O(1) lookup
   */
  async getAllAsMap(): Promise<Map<string, TeamDefense>> {
    const defenses = await this.prisma.teamDefense.findMany();
    return new Map(defenses.map((d) => [d.team, d]));
  }

  /**
   * Get DVP (Defense vs Position) for specific position
   */
  async getDVPByPosition(
    position: 'PG' | 'SG' | 'SF' | 'PF' | 'C'
  ): Promise<Array<{ team: string; dvp: number | null; rank: number }>> {
    const positionField = `dvp${position}` as keyof TeamDefense;

    const defenses = await this.prisma.teamDefense.findMany({
      orderBy: { [positionField]: 'desc' },
    });

    return defenses.map((d, index) => ({
      team: d.team,
      dvp: d[positionField] as number | null,
      rank: index + 1,
    }));
  }

  /**
   * Get defense rankings (best to worst)
   */
  async getDefenseRankings(): Promise<DefenseRanking[]> {
    const defenses = await this.prisma.teamDefense.findMany({
      orderBy: { defEff: 'asc' }, // Lower is better for defense
    });

    return defenses.map((d, index) => ({
      team: d.team,
      defEff: d.defEff,
      rank: index + 1,
      dvpByPosition: {
        PG: d.dvpPg,
        SG: d.dvpSg,
        SF: d.dvpSf,
        PF: d.dvpPf,
        C: d.dvpC,
      },
    }));
  }

  /**
   * Get pace rankings
   */
  async getPaceRankings(): Promise<Array<{ team: string; pace: number | null; rank: number }>> {
    const defenses = await this.prisma.teamDefense.findMany({
      where: { pace: { not: null } },
      orderBy: { pace: 'desc' },
    });

    return defenses.map((d, index) => ({
      team: d.team,
      pace: d.pace,
      rank: index + 1,
    }));
  }

  /**
   * Get teams that are favorable matchups for a position
   */
  async getFavorableMatchups(
    position: 'PG' | 'SG' | 'SF' | 'PF' | 'C',
    topN: number = 10
  ): Promise<TeamDefense[]> {
    const positionField = `dvp${position}`;

    return this.prisma.teamDefense.findMany({
      where: { [positionField]: { not: null } },
      orderBy: { [positionField]: 'desc' }, // Higher DVP = worse defense
      take: topN,
    });
  }

  /**
   * Get teams that are unfavorable matchups for a position
   */
  async getUnfavorableMatchups(
    position: 'PG' | 'SG' | 'SF' | 'PF' | 'C',
    topN: number = 10
  ): Promise<TeamDefense[]> {
    const positionField = `dvp${position}`;

    return this.prisma.teamDefense.findMany({
      where: { [positionField]: { not: null } },
      orderBy: { [positionField]: 'asc' }, // Lower DVP = better defense
      take: topN,
    });
  }

  /**
   * Bulk upsert defense data (for daily updates)
   */
  async bulkUpsert(defenses: TeamDefenseCreateInput[]): Promise<number> {
    let updated = 0;

    await this.transaction(async (tx) => {
      for (const defense of defenses) {
        await tx.teamDefense.upsert({
          where: { team: defense.team.toUpperCase() },
          create: {
            ...defense,
            team: defense.team.toUpperCase(),
          },
          update: {
            defEff: defense.defEff,
            offEff: defense.offEff,
            pace: defense.pace,
            dvpPg: defense.dvpPg,
            dvpSg: defense.dvpSg,
            dvpSf: defense.dvpSf,
            dvpPf: defense.dvpPf,
            dvpC: defense.dvpC,
          },
        });
        updated++;
      }
    });

    return updated;
  }

  /**
   * Calculate league averages for defense/pace
   */
  async getLeagueAverages(): Promise<{
    avgDefEff: number;
    avgOffEff: number | null;
    avgPace: number | null;
  }> {
    const defenses = await this.prisma.teamDefense.findMany();

    const avgDefEff =
      defenses.reduce((sum, d) => sum + d.defEff, 0) / defenses.length;

    const offEffValues = defenses.filter((d) => d.offEff !== null);
    const avgOffEff =
      offEffValues.length > 0
        ? offEffValues.reduce((sum, d) => sum + (d.offEff || 0), 0) / offEffValues.length
        : null;

    const paceValues = defenses.filter((d) => d.pace !== null);
    const avgPace =
      paceValues.length > 0
        ? paceValues.reduce((sum, d) => sum + (d.pace || 0), 0) / paceValues.length
        : null;

    return {
      avgDefEff: Math.round(avgDefEff * 10) / 10,
      avgOffEff: avgOffEff ? Math.round(avgOffEff * 10) / 10 : null,
      avgPace: avgPace ? Math.round(avgPace * 10) / 10 : null,
    };
  }

  /**
   * Get game environment data (pace + implied total)
   */
  async getGameEnvironment(
    team1: string,
    team2: string
  ): Promise<{
    team1Pace: number | null;
    team2Pace: number | null;
    avgPace: number | null;
    team1DefEff: number;
    team2DefEff: number;
  } | null> {
    const [def1, def2] = await Promise.all([
      this.findByTeam(team1),
      this.findByTeam(team2),
    ]);

    if (!def1 || !def2) return null;

    const avgPace =
      def1.pace && def2.pace ? (def1.pace + def2.pace) / 2 : def1.pace || def2.pace;

    return {
      team1Pace: def1.pace,
      team2Pace: def2.pace,
      avgPace: avgPace ? Math.round(avgPace * 10) / 10 : null,
      team1DefEff: def1.defEff,
      team2DefEff: def2.defEff,
    };
  }
}
