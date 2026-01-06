import { PrismaClient } from '@nba-dfs/database';
import { getRepositories, RepositoryContainer } from '../../repositories/index.js';

export interface DefenseStats {
  team: string;
  defEff: number;
  offEff: number;
  pace: number;
}

export interface DVPData {
  team: string;
  position: 'PG' | 'SG' | 'SF' | 'PF' | 'C';
  dkPointsAllowed: number;
  rank: number;
}

export interface LoadResult {
  success: boolean;
  count: number;
  errors?: string[];
}

// NBA team abbreviations
const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN',
  'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA',
  'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX',
  'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS',
];

/**
 * Defense Data Loader
 * Loads team defense and DVP (Defense vs Position) data
 */
export class DefenseDataLoader {
  private repos: RepositoryContainer;

  constructor(prisma: PrismaClient) {
    this.repos = getRepositories(prisma);
  }

  /**
   * Load latest defense data from external sources
   */
  async loadLatestDefenseData(): Promise<LoadResult> {
    // This is a placeholder for actual data fetching
    // In production, this would call an API or scrape data from:
    // - Basketball Reference
    // - NBA.com
    // - Hashtag Basketball

    console.log('Loading defense data...');

    // For now, return empty result
    // Real implementation would fetch and process data
    return {
      success: true,
      count: 0,
      errors: ['Defense data source not configured'],
    };
  }

  /**
   * Process and store defense statistics
   */
  async processDefenseStats(stats: DefenseStats[]): Promise<LoadResult> {
    const errors: string[] = [];

    const validStats = stats.filter((s) => {
      if (!NBA_TEAMS.includes(s.team.toUpperCase())) {
        errors.push(`Invalid team: ${s.team}`);
        return false;
      }
      return true;
    });

    const count = await this.repos.teamDefense.bulkUpsert(
      validStats.map((s) => ({
        team: s.team.toUpperCase(),
        defEff: s.defEff,
        offEff: s.offEff,
        pace: s.pace,
      }))
    );

    return {
      success: errors.length === 0,
      count,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Process and store DVP (Defense vs Position) data
   */
  async processDVPData(dvpData: DVPData[]): Promise<LoadResult> {
    // Group by team
    const teamDvp = new Map<
      string,
      {
        dvpPg?: number;
        dvpSg?: number;
        dvpSf?: number;
        dvpPf?: number;
        dvpC?: number;
      }
    >();

    for (const dvp of dvpData) {
      const team = dvp.team.toUpperCase();
      const existing = teamDvp.get(team) || {};

      switch (dvp.position) {
        case 'PG':
          existing.dvpPg = dvp.dkPointsAllowed;
          break;
        case 'SG':
          existing.dvpSg = dvp.dkPointsAllowed;
          break;
        case 'SF':
          existing.dvpSf = dvp.dkPointsAllowed;
          break;
        case 'PF':
          existing.dvpPf = dvp.dkPointsAllowed;
          break;
        case 'C':
          existing.dvpC = dvp.dkPointsAllowed;
          break;
      }

      teamDvp.set(team, existing);
    }

    // Update each team's DVP data
    let updated = 0;
    for (const [team, dvp] of teamDvp) {
      const existing = await this.repos.teamDefense.findByTeam(team);
      if (existing) {
        await this.repos.teamDefense.update(existing.id, dvp);
        updated++;
      }
    }

    return {
      success: true,
      count: updated,
    };
  }

  /**
   * Calculate DVP from historical data
   * Uses actual game results to compute position-based defense
   */
  async calculateDVPFromHistory(
    season: string,
    lastNGames?: number
  ): Promise<LoadResult> {
    // This would aggregate historical games to calculate DVP
    // For each team, calculate average DK points allowed by position

    console.log(`Calculating DVP from history for ${season}...`);

    // Implementation would:
    // 1. Get all games for the season
    // 2. Group by opponent team
    // 3. Calculate average DK points by position
    // 4. Update team defense records

    return {
      success: true,
      count: 0,
      errors: ['DVP calculation requires historical data'],
    };
  }

  /**
   * Get defense matchup analysis for a specific game
   */
  async getMatchupAnalysis(
    team1: string,
    team2: string
  ): Promise<{
    gameEnvironment: {
      projectedPace: number | null;
      projectedTotal: number | null;
    };
    team1Matchups: {
      position: string;
      dvp: number | null;
      advantage: 'favorable' | 'neutral' | 'unfavorable';
    }[];
    team2Matchups: {
      position: string;
      dvp: number | null;
      advantage: 'favorable' | 'neutral' | 'unfavorable';
    }[];
  } | null> {
    const [def1, def2, _leagueAvg] = await Promise.all([
      this.repos.teamDefense.findByTeam(team1),
      this.repos.teamDefense.findByTeam(team2),
      this.repos.teamDefense.getLeagueAverages(),
    ]);

    if (!def1 || !def2) return null;

    const projectedPace =
      def1.pace && def2.pace ? (def1.pace + def2.pace) / 2 : null;

    const getAdvantage = (
      dvp: number | null,
      avgDvp: number
    ): 'favorable' | 'neutral' | 'unfavorable' => {
      if (!dvp) return 'neutral';
      const diff = dvp - avgDvp;
      if (diff > 2) return 'favorable';
      if (diff < -2) return 'unfavorable';
      return 'neutral';
    };

    // Calculate average DVP for comparison
    const avgDvp = 30; // Approximate league average DK points per position

    return {
      gameEnvironment: {
        projectedPace,
        projectedTotal: null, // Would come from Vegas
      },
      team1Matchups: [
        { position: 'PG', dvp: def2.dvpPg, advantage: getAdvantage(def2.dvpPg, avgDvp) },
        { position: 'SG', dvp: def2.dvpSg, advantage: getAdvantage(def2.dvpSg, avgDvp) },
        { position: 'SF', dvp: def2.dvpSf, advantage: getAdvantage(def2.dvpSf, avgDvp) },
        { position: 'PF', dvp: def2.dvpPf, advantage: getAdvantage(def2.dvpPf, avgDvp) },
        { position: 'C', dvp: def2.dvpC, advantage: getAdvantage(def2.dvpC, avgDvp) },
      ],
      team2Matchups: [
        { position: 'PG', dvp: def1.dvpPg, advantage: getAdvantage(def1.dvpPg, avgDvp) },
        { position: 'SG', dvp: def1.dvpSg, advantage: getAdvantage(def1.dvpSg, avgDvp) },
        { position: 'SF', dvp: def1.dvpSf, advantage: getAdvantage(def1.dvpSf, avgDvp) },
        { position: 'PF', dvp: def1.dvpPf, advantage: getAdvantage(def1.dvpPf, avgDvp) },
        { position: 'C', dvp: def1.dvpC, advantage: getAdvantage(def1.dvpC, avgDvp) },
      ],
    };
  }

  /**
   * Initialize default defense data for all teams
   */
  async initializeDefaultData(): Promise<LoadResult> {
    const defaultDefense = NBA_TEAMS.map((team) => ({
      team,
      defEff: 113.0, // League average
      offEff: 113.0,
      pace: 100.0,
      dvpPg: 30.0,
      dvpSg: 28.0,
      dvpSf: 27.0,
      dvpPf: 28.0,
      dvpC: 32.0,
    }));

    const count = await this.repos.teamDefense.bulkUpsert(defaultDefense);

    return {
      success: true,
      count,
    };
  }
}
