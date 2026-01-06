import { PrismaClient } from '@nba-dfs/database';
import { getRepositories, RepositoryContainer } from '../repositories/index.js';

// Configuration for projection calculation
export interface ProjectionConfig {
  blendWeights: {
    season: number;      // Weight for season average
    last10: number;      // Weight for last 10 games
    last5: number;       // Weight for last 5 games
    last3: number;       // Weight for last 3 games
    expert: number;      // Weight for RotoWire/expert projection
  };
  adjustmentCaps: {
    streak: number;      // Max streak adjustment
    usageBump: number;   // Max usage bump adjustment
    homeAway: number;    // Max home/away adjustment
    defense: number;     // Max defense adjustment
    total: number;       // Max total adjustment
  };
  leagueAverages: {
    defEff: number;      // League average defensive efficiency
    pace: number;        // League average pace
    impliedTotal: number; // Average Vegas implied team total
  };
}

// Default configuration
const DEFAULT_CONFIG: ProjectionConfig = {
  blendWeights: {
    season: 0.25,
    last10: 0.15,
    last5: 0.15,
    last3: 0.20,
    expert: 0.25,
  },
  adjustmentCaps: {
    streak: 0.08,
    usageBump: 0.15,
    homeAway: 0.05,
    defense: 0.12,
    total: 0.30,
  },
  leagueAverages: {
    defEff: 113.0,
    pace: 100.0,
    impliedTotal: 115.0,
  },
};

// Player data for projection
export interface PlayerInput {
  id: string;
  name: string;
  team: string;
  opponent: string;
  positions: string | string[]; // Can be comma-separated string or array
  salary: number;
  projectedPoints: number | null;
  ownership: number | null;
  vegasImplied: number | null;
  vegasSpread: number | null;
  vegasTotal: number | null;
  isHome: boolean;
}

// Historical stats for a player
interface PlayerHistoricalStats {
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

// Defense data for team
interface TeamDefenseData {
  team: string;
  defEff: number;
  offEff: number | null;
  pace: number | null;
  dvpPg: number | null;
  dvpSg: number | null;
  dvpSf: number | null;
  dvpPf: number | null;
  dvpC: number | null;
}

// Individual adjustment values
export interface ProjectionAdjustments {
  streak: number;
  usageBump: number;
  homeAway: number;
  defense: number;
  dvp: number;
  pace: number;
  vegas: number;
  blowoutRisk: number;
  total: number;
}

// Enhanced projection output
export interface EnhancedProjection {
  playerId: string;
  playerName: string;
  baseline: number;
  projectedPoints: number;
  floor: number;
  ceiling: number;
  value: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  adjustments: ProjectionAdjustments;
  boomProbability: number;
  bustProbability: number;
  leverageScore: number;
}

export class ProjectionEngine {
  private config: ProjectionConfig;
  private repos: RepositoryContainer;

  constructor(prisma: PrismaClient, config?: Partial<ProjectionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.repos = getRepositories(prisma);
  }

  /**
   * Calculate projections for all players in a slate
   * Uses batch loading to avoid N+1 queries
   */
  async calculateProjections(
    players: PlayerInput[],
    slateDate?: Date
  ): Promise<EnhancedProjection[]> {
    const date = slateDate || new Date();
    const playerNames = players.map((p) => p.name);
    const _opponentTeams = [...new Set(players.map((p) => p.opponent))];

    // BATCH LOAD all data in parallel (fixes N+1 problem)
    const [historicalData, defenseData] = await Promise.all([
      this.repos.historical.getBatchPlayerStats(playerNames, date),
      this.repos.teamDefense.getAllAsMap(),
    ]);

    // Build lookup maps for O(1) access
    const historyMap = new Map<string, PlayerHistoricalStats>();
    for (const h of historicalData) {
      historyMap.set(h.playerName.toLowerCase(), h);
    }

    // Calculate projections for all players
    const projections: EnhancedProjection[] = [];

    for (const player of players) {
      const history = historyMap.get(player.name.toLowerCase());
      const oppDefense = defenseData.get(player.opponent);

      const projection = this.calculateEnhancedProjection(
        player,
        history || null,
        oppDefense || null
      );

      projections.push(projection);
    }

    return projections;
  }

  /**
   * Get primary position from positions field
   */
  private getPrimaryPosition(positions: string | string[]): string {
    if (Array.isArray(positions)) {
      return positions[0] || 'UTIL';
    }
    // Parse comma-separated string
    const parsed = positions.split(/[,/]/).map(p => p.trim()).filter(p => p.length > 0);
    return parsed[0] || 'UTIL';
  }

  /**
   * Calculate enhanced projection for a single player
   */
  private calculateEnhancedProjection(
    player: PlayerInput,
    history: PlayerHistoricalStats | null,
    oppDefense: TeamDefenseData | null
  ): EnhancedProjection {
    // 1. Build blended baseline
    const baseline = this.buildBlendedBaseline(player, history);

    // Get primary position
    const primaryPosition = this.getPrimaryPosition(player.positions);

    // 2. Calculate all adjustments
    const adjustments: ProjectionAdjustments = {
      streak: this.calculateStreakAdjustment(history),
      usageBump: 0, // TODO: Calculate from roster context
      homeAway: this.calculateHomeAwayAdjustment(player, history),
      defense: this.calculateDefenseAdjustment(oppDefense),
      dvp: this.calculateDVPAdjustment(primaryPosition, oppDefense),
      pace: this.calculatePaceAdjustment(oppDefense),
      vegas: this.calculateVegasAdjustment(player),
      blowoutRisk: this.calculateBlowoutRisk(player),
      total: 0,
    };

    // 3. Apply adjustments with caps
    const totalAdjustment = this.applyAdjustmentsWithCaps(adjustments);
    adjustments.total = totalAdjustment;

    const projectedPoints = Math.max(0, baseline * (1 + totalAdjustment));

    // 4. Calculate variance metrics
    const { floor, ceiling, stdDev } = this.calculateVariance(
      history,
      projectedPoints
    );

    // 5. Calculate boom/bust probabilities
    const { boomProbability, bustProbability } = this.calculateBoomBust(
      projectedPoints,
      stdDev,
      player.salary
    );

    // 6. Calculate leverage score
    const leverageScore = this.calculateLeverageScore(
      boomProbability,
      player.ownership || 10
    );

    // 7. Determine confidence
    const confidence = this.calculateConfidence(history);

    // 8. Calculate value
    const value = projectedPoints / (player.salary / 1000);

    return {
      playerId: player.id,
      playerName: player.name,
      baseline: Math.round(baseline * 10) / 10,
      projectedPoints: Math.round(projectedPoints * 10) / 10,
      floor: Math.round(floor * 10) / 10,
      ceiling: Math.round(ceiling * 10) / 10,
      value: Math.round(value * 100) / 100,
      confidence,
      adjustments,
      boomProbability: Math.round(boomProbability * 100) / 100,
      bustProbability: Math.round(bustProbability * 100) / 100,
      leverageScore: Math.round(leverageScore * 10) / 10,
    };
  }

  /**
   * Build blended baseline from multiple sources
   */
  private buildBlendedBaseline(
    player: PlayerInput,
    history: PlayerHistoricalStats | null
  ): number {
    const weights = this.config.blendWeights;
    let totalWeight = 0;
    let weightedSum = 0;

    // Expert projection (RotoWire)
    if (player.projectedPoints && player.projectedPoints > 0) {
      weightedSum += player.projectedPoints * weights.expert;
      totalWeight += weights.expert;
    }

    if (history && history.gamesPlayed > 0) {
      // Season average
      if (history.seasonAvg > 0) {
        weightedSum += history.seasonAvg * weights.season;
        totalWeight += weights.season;
      }

      // Last 10 games
      if (history.last10Avg && history.last10Avg > 0) {
        weightedSum += history.last10Avg * weights.last10;
        totalWeight += weights.last10;
      }

      // Last 5 games
      if (history.last5Avg && history.last5Avg > 0) {
        weightedSum += history.last5Avg * weights.last5;
        totalWeight += weights.last5;
      }

      // Last 3 games
      if (history.last3Avg && history.last3Avg > 0) {
        weightedSum += history.last3Avg * weights.last3;
        totalWeight += weights.last3;
      }
    }

    if (totalWeight === 0) {
      // Fallback to expert projection or salary-based estimate
      return player.projectedPoints || player.salary / 1000 * 4;
    }

    return weightedSum / totalWeight;
  }

  /**
   * Calculate streak adjustment based on recent performance trend
   */
  private calculateStreakAdjustment(
    history: PlayerHistoricalStats | null
  ): number {
    if (!history || !history.last3Avg || !history.seasonAvg) {
      return 0;
    }

    // Compare last 3 to season average
    const diff = (history.last3Avg - history.seasonAvg) / history.seasonAvg;

    // Cap the adjustment
    return Math.max(
      -this.config.adjustmentCaps.streak,
      Math.min(this.config.adjustmentCaps.streak, diff * 0.5)
    );
  }

  /**
   * Calculate home/away adjustment
   */
  private calculateHomeAwayAdjustment(
    player: PlayerInput,
    history: PlayerHistoricalStats | null
  ): number {
    if (!history || !history.homeAvg || !history.awayAvg) {
      // Default small home court advantage
      return player.isHome ? 0.02 : -0.02;
    }

    const avg = (history.homeAvg + history.awayAvg) / 2;
    if (avg === 0) return 0;

    const expected = player.isHome ? history.homeAvg : history.awayAvg;
    const diff = (expected - avg) / avg;

    return Math.max(
      -this.config.adjustmentCaps.homeAway,
      Math.min(this.config.adjustmentCaps.homeAway, diff)
    );
  }

  /**
   * Calculate defense adjustment based on opponent defense efficiency
   */
  private calculateDefenseAdjustment(
    oppDefense: TeamDefenseData | null
  ): number {
    if (!oppDefense) return 0;

    const leagueAvg = this.config.leagueAverages.defEff;
    const diff = (oppDefense.defEff - leagueAvg) / leagueAvg;

    // Positive diff means worse defense (higher def eff), which is good for offense
    return Math.max(
      -this.config.adjustmentCaps.defense,
      Math.min(this.config.adjustmentCaps.defense, diff * 0.5)
    );
  }

  /**
   * Calculate DVP (Defense vs Position) adjustment
   */
  private calculateDVPAdjustment(
    position: string,
    oppDefense: TeamDefenseData | null
  ): number {
    if (!oppDefense) return 0;

    let dvp: number | null = null;
    switch (position.toUpperCase()) {
      case 'PG':
        dvp = oppDefense.dvpPg;
        break;
      case 'SG':
        dvp = oppDefense.dvpSg;
        break;
      case 'SF':
        dvp = oppDefense.dvpSf;
        break;
      case 'PF':
        dvp = oppDefense.dvpPf;
        break;
      case 'C':
        dvp = oppDefense.dvpC;
        break;
      default:
        // G slot: average of PG and SG
        if (position === 'G') {
          dvp =
            oppDefense.dvpPg && oppDefense.dvpSg
              ? (oppDefense.dvpPg + oppDefense.dvpSg) / 2
              : null;
        }
        // F slot: average of SF and PF
        if (position === 'F') {
          dvp =
            oppDefense.dvpSf && oppDefense.dvpPf
              ? (oppDefense.dvpSf + oppDefense.dvpPf) / 2
              : null;
        }
    }

    if (!dvp) return 0;

    // League average DVP is around 30 DK points
    const leagueAvgDvp = 30;
    const diff = (dvp - leagueAvgDvp) / leagueAvgDvp;

    // DVP > avg means opponent gives up more points (good)
    return Math.max(-0.08, Math.min(0.08, diff * 0.4));
  }

  /**
   * Calculate pace adjustment
   */
  private calculatePaceAdjustment(
    oppDefense: TeamDefenseData | null
  ): number {
    if (!oppDefense || !oppDefense.pace) return 0;

    const leagueAvg = this.config.leagueAverages.pace;
    const diff = (oppDefense.pace - leagueAvg) / leagueAvg;

    // Higher pace = more possessions = more opportunities
    return Math.max(-0.05, Math.min(0.05, diff * 0.3));
  }

  /**
   * Calculate Vegas-based adjustment
   */
  private calculateVegasAdjustment(player: PlayerInput): number {
    if (!player.vegasImplied) return 0;

    const leagueAvg = this.config.leagueAverages.impliedTotal;
    const diff = (player.vegasImplied - leagueAvg) / leagueAvg;

    // Higher implied total = more scoring expected
    return Math.max(-0.10, Math.min(0.10, diff * 0.5));
  }

  /**
   * Calculate blowout risk adjustment
   */
  private calculateBlowoutRisk(player: PlayerInput): number {
    if (!player.vegasSpread) return 0;

    const spread = Math.abs(player.vegasSpread);

    // Large spreads (>10) indicate potential blowout
    if (spread > 12) {
      // Heavy favorite or underdog - risk of reduced minutes
      return -0.05;
    } else if (spread > 8) {
      return -0.02;
    }

    return 0;
  }

  /**
   * Apply all adjustments with total cap
   */
  private applyAdjustmentsWithCaps(adjustments: ProjectionAdjustments): number {
    const total =
      adjustments.streak +
      adjustments.usageBump +
      adjustments.homeAway +
      adjustments.defense +
      adjustments.dvp +
      adjustments.pace +
      adjustments.vegas +
      adjustments.blowoutRisk;

    // Cap total adjustment
    return Math.max(
      -this.config.adjustmentCaps.total,
      Math.min(this.config.adjustmentCaps.total, total)
    );
  }

  /**
   * Calculate variance metrics (floor, ceiling)
   */
  private calculateVariance(
    history: PlayerHistoricalStats | null,
    projection: number
  ): { floor: number; ceiling: number; stdDev: number } {
    // Use historical std dev if available
    const stdDev = history?.stdDev || projection * 0.25;

    // Floor is ~25th percentile (projection - 0.67 * stdDev)
    const floor = Math.max(0, projection - 0.67 * stdDev);

    // Ceiling is ~75th percentile (projection + 0.67 * stdDev)
    const ceiling = projection + 0.67 * stdDev;

    return { floor, ceiling, stdDev };
  }

  /**
   * Calculate boom/bust probabilities
   */
  private calculateBoomBust(
    projection: number,
    stdDev: number,
    salary: number
  ): { boomProbability: number; bustProbability: number } {
    // Boom threshold: 6x salary value
    const boomThreshold = (salary / 1000) * 6;
    // Bust threshold: 3x salary value
    const bustThreshold = (salary / 1000) * 3;

    // Using normal distribution approximation
    // P(X > boom) = 1 - Φ((boom - μ) / σ)
    const boomZ = (boomThreshold - projection) / stdDev;
    const bustZ = (bustThreshold - projection) / stdDev;

    // Approximate CDF using error function approximation
    const boomProbability = 1 - this.normalCDF(boomZ);
    const bustProbability = this.normalCDF(bustZ);

    return {
      boomProbability: Math.max(0, Math.min(1, boomProbability)),
      bustProbability: Math.max(0, Math.min(1, bustProbability)),
    };
  }

  /**
   * Approximate normal CDF
   */
  private normalCDF(z: number): number {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    z = Math.abs(z) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * z);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Calculate leverage score (boom potential vs ownership)
   */
  private calculateLeverageScore(
    boomProbability: number,
    ownership: number
  ): number {
    // Leverage = boom probability / ownership
    // High leverage = underowned player with boom potential
    if (ownership <= 0) return boomProbability * 100;
    return (boomProbability * 100) / ownership;
  }

  /**
   * Determine confidence level based on data quality
   */
  private calculateConfidence(
    history: PlayerHistoricalStats | null
  ): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (!history || history.gamesPlayed < 5) {
      return 'LOW';
    }

    if (history.gamesPlayed >= 20 && history.stdDev !== null) {
      // High confidence: lots of games and low variance
      const cv = history.stdDev / history.seasonAvg; // Coefficient of variation
      if (cv < 0.3) return 'HIGH';
    }

    if (history.gamesPlayed >= 10) {
      return 'MEDIUM';
    }

    return 'LOW';
  }

  /**
   * Update projections with usage bump data
   */
  async enrichWithUsageBumps(
    projections: EnhancedProjection[],
    teamRosters: Map<string, string[]>
  ): Promise<EnhancedProjection[]> {
    // Get roster context for each team
    const _teams = [...new Set(projections.map((p) => p.playerName))];

    // For each player, check if high-usage teammates are missing
    // This would require comparing slate roster to historical team rosters
    // Implementation depends on having injury/roster data

    return projections;
  }
}
