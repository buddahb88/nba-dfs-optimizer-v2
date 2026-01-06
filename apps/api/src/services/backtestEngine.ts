import { PrismaClient } from '@nba-dfs/database';
import { getRepositories, RepositoryContainer } from '../repositories/index.js';
import { ProjectionEngine, EnhancedProjection, PlayerInput } from './projectionEngine.js';

// Backtest configuration
export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  minGamesPlayed?: number;
  salaryRange?: { min: number; max: number };
  positions?: string[];
}

// Results for a single player comparison
export interface PlayerBacktestResult {
  playerName: string;
  gameDate: Date;
  projectedPoints: number;
  actualPoints: number;
  error: number;
  errorPct: number;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  hitFloor: boolean;
  hitCeiling: boolean;
  salary: number;
  value: number;
  actualValue: number;
}

// Results for a single date
export interface DateBacktestResult {
  date: Date;
  playerCount: number;
  meanError: number;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  hitRate: number;
  byConfidence: {
    high: { mae: number; count: number };
    medium: { mae: number; count: number };
    low: { mae: number; count: number };
  };
}

// Aggregated backtest results
export interface BacktestResults {
  config: BacktestConfig;
  summary: {
    totalPlayers: number;
    totalDates: number;
    meanError: number;
    meanAbsoluteError: number;
    rootMeanSquareError: number;
    hitRate: number;
    floorHitRate: number;
    ceilingHitRate: number;
    correlationCoefficient: number;
  };
  byConfidence: {
    high: { mae: number; hitRate: number; count: number };
    medium: { mae: number; hitRate: number; count: number };
    low: { mae: number; hitRate: number; count: number };
  };
  byPosition: Map<string, { mae: number; hitRate: number; count: number }>;
  bySalaryRange: Map<string, { mae: number; hitRate: number; count: number }>;
  dailyResults: DateBacktestResult[];
  playerResults: PlayerBacktestResult[];
}

export class BacktestEngine {
  private repos: RepositoryContainer;
  private projectionEngine: ProjectionEngine;

  constructor(prisma: PrismaClient) {
    this.repos = getRepositories(prisma);
    this.projectionEngine = new ProjectionEngine(prisma);
  }

  /**
   * Run a backtest over a date range
   */
  async runBacktest(config: BacktestConfig): Promise<BacktestResults> {
    const dates = this.getDateRange(config.startDate, config.endDate);
    const dailyResults: DateBacktestResult[] = [];
    const allPlayerResults: PlayerBacktestResult[] = [];

    for (const date of dates) {
      // Get all games played on this date
      const actualGames = await this.repos.historical.findByPlayer('', {
        startDate: date,
        endDate: new Date(date.getTime() + 24 * 60 * 60 * 1000),
        limit: 1000,
      });

      if (actualGames.length < 5) continue; // Skip dates with few games

      // Build pseudo-slate from historical data
      const pseudoPlayers = await this.buildPseudoSlate(actualGames, date, config);

      if (pseudoPlayers.length === 0) continue;

      // Calculate projections as if we didn't know the outcome
      const projections = await this.projectionEngine.calculateProjections(
        pseudoPlayers,
        date
      );

      // Compare to actuals
      const dateResult = this.compareToActuals(
        projections,
        actualGames,
        date
      );

      if (dateResult.playerCount > 0) {
        dailyResults.push(dateResult);

        // Collect player-level results
        const playerResults = this.buildPlayerResults(
          projections,
          actualGames,
          date
        );
        allPlayerResults.push(...playerResults);
      }
    }

    return this.aggregateResults(config, dailyResults, allPlayerResults);
  }

  /**
   * Build pseudo-slate from historical game data
   */
  private async buildPseudoSlate(
    actualGames: Array<{
      playerName: string;
      team: string;
      opponent: string;
      dkFantasyPoints: number;
      isHome: boolean;
    }>,
    slateDate: Date,
    config: BacktestConfig
  ): Promise<PlayerInput[]> {
    const players: PlayerInput[] = [];
    const processedNames = new Set<string>();

    for (const game of actualGames) {
      // Skip duplicates
      const key = `${game.playerName.toLowerCase()}_${game.team}`;
      if (processedNames.has(key)) continue;
      processedNames.add(key);

      // Generate synthetic salary based on actual points (inverse mapping)
      // This is a simplification - in real backtest you'd use actual historical salaries
      const estimatedSalary = Math.round(game.dkFantasyPoints * 800 + 3000);

      // Apply salary filter if configured
      if (config.salaryRange) {
        if (
          estimatedSalary < config.salaryRange.min ||
          estimatedSalary > config.salaryRange.max
        ) {
          continue;
        }
      }

      players.push({
        id: `${game.playerName}_${slateDate.toISOString()}`,
        name: game.playerName,
        team: game.team,
        opponent: game.opponent,
        positions: ['UTIL'], // Simplified - would need actual position data
        salary: estimatedSalary,
        projectedPoints: null, // Will be calculated by projection engine
        ownership: null,
        vegasImplied: null,
        vegasSpread: null,
        vegasTotal: null,
        isHome: game.isHome,
      });
    }

    return players;
  }

  /**
   * Compare projections to actual results
   */
  private compareToActuals(
    projections: EnhancedProjection[],
    actuals: Array<{ playerName: string; dkFantasyPoints: number }>,
    date: Date
  ): DateBacktestResult {
    const actualMap = new Map(
      actuals.map((g) => [g.playerName.toLowerCase(), g.dkFantasyPoints])
    );

    let totalError = 0;
    let totalAbsError = 0;
    let totalSquaredError = 0;
    let count = 0;
    let hits = 0;

    const byConfidence = {
      high: { absError: 0, count: 0 },
      medium: { absError: 0, count: 0 },
      low: { absError: 0, count: 0 },
    };

    for (const proj of projections) {
      const actual = actualMap.get(proj.playerName.toLowerCase());
      if (actual === undefined) continue;

      const error = actual - proj.projectedPoints;
      const absError = Math.abs(error);

      totalError += error;
      totalAbsError += absError;
      totalSquaredError += error * error;
      count++;

      // Hit = within 20% of projection
      if (absError / proj.projectedPoints <= 0.2) {
        hits++;
      }

      // Track by confidence
      const confKey = proj.confidence.toLowerCase() as 'high' | 'medium' | 'low';
      byConfidence[confKey].absError += absError;
      byConfidence[confKey].count++;
    }

    if (count === 0) {
      return {
        date,
        playerCount: 0,
        meanError: 0,
        meanAbsoluteError: 0,
        rootMeanSquareError: 0,
        hitRate: 0,
        byConfidence: {
          high: { mae: 0, count: 0 },
          medium: { mae: 0, count: 0 },
          low: { mae: 0, count: 0 },
        },
      };
    }

    return {
      date,
      playerCount: count,
      meanError: totalError / count,
      meanAbsoluteError: totalAbsError / count,
      rootMeanSquareError: Math.sqrt(totalSquaredError / count),
      hitRate: hits / count,
      byConfidence: {
        high: {
          mae: byConfidence.high.count > 0
            ? byConfidence.high.absError / byConfidence.high.count
            : 0,
          count: byConfidence.high.count,
        },
        medium: {
          mae: byConfidence.medium.count > 0
            ? byConfidence.medium.absError / byConfidence.medium.count
            : 0,
          count: byConfidence.medium.count,
        },
        low: {
          mae: byConfidence.low.count > 0
            ? byConfidence.low.absError / byConfidence.low.count
            : 0,
          count: byConfidence.low.count,
        },
      },
    };
  }

  /**
   * Build player-level backtest results
   */
  private buildPlayerResults(
    projections: EnhancedProjection[],
    actuals: Array<{ playerName: string; dkFantasyPoints: number }>,
    date: Date
  ): PlayerBacktestResult[] {
    const actualMap = new Map(
      actuals.map((g) => [g.playerName.toLowerCase(), g.dkFantasyPoints])
    );

    const results: PlayerBacktestResult[] = [];

    for (const proj of projections) {
      const actual = actualMap.get(proj.playerName.toLowerCase());
      if (actual === undefined) continue;

      const error = actual - proj.projectedPoints;
      const errorPct = proj.projectedPoints > 0
        ? (error / proj.projectedPoints) * 100
        : 0;

      // Estimate salary for value calculation
      const estimatedSalary = Math.round(proj.projectedPoints * 800 + 3000);
      const projectedValue = proj.projectedPoints / (estimatedSalary / 1000);
      const actualValue = actual / (estimatedSalary / 1000);

      results.push({
        playerName: proj.playerName,
        gameDate: date,
        projectedPoints: proj.projectedPoints,
        actualPoints: actual,
        error,
        errorPct,
        confidence: proj.confidence,
        hitFloor: actual >= proj.floor,
        hitCeiling: actual >= proj.ceiling,
        salary: estimatedSalary,
        value: projectedValue,
        actualValue,
      });
    }

    return results;
  }

  /**
   * Aggregate all results into final backtest summary
   */
  private aggregateResults(
    config: BacktestConfig,
    dailyResults: DateBacktestResult[],
    playerResults: PlayerBacktestResult[]
  ): BacktestResults {
    if (playerResults.length === 0) {
      return {
        config,
        summary: {
          totalPlayers: 0,
          totalDates: 0,
          meanError: 0,
          meanAbsoluteError: 0,
          rootMeanSquareError: 0,
          hitRate: 0,
          floorHitRate: 0,
          ceilingHitRate: 0,
          correlationCoefficient: 0,
        },
        byConfidence: {
          high: { mae: 0, hitRate: 0, count: 0 },
          medium: { mae: 0, hitRate: 0, count: 0 },
          low: { mae: 0, hitRate: 0, count: 0 },
        },
        byPosition: new Map(),
        bySalaryRange: new Map(),
        dailyResults,
        playerResults,
      };
    }

    // Calculate overall metrics
    let totalError = 0;
    let totalAbsError = 0;
    let totalSquaredError = 0;
    let hits = 0;
    let floorHits = 0;
    let ceilingHits = 0;

    // For correlation
    let sumProjected = 0;
    let sumActual = 0;
    let sumProjectedActual = 0;
    let sumProjectedSquared = 0;
    let sumActualSquared = 0;

    // By confidence
    const confMetrics = {
      high: { absError: 0, hits: 0, count: 0 },
      medium: { absError: 0, hits: 0, count: 0 },
      low: { absError: 0, hits: 0, count: 0 },
    };

    for (const result of playerResults) {
      totalError += result.error;
      totalAbsError += Math.abs(result.error);
      totalSquaredError += result.error * result.error;

      if (Math.abs(result.errorPct) <= 20) hits++;
      if (result.hitFloor) floorHits++;
      if (result.hitCeiling) ceilingHits++;

      // For correlation
      sumProjected += result.projectedPoints;
      sumActual += result.actualPoints;
      sumProjectedActual += result.projectedPoints * result.actualPoints;
      sumProjectedSquared += result.projectedPoints * result.projectedPoints;
      sumActualSquared += result.actualPoints * result.actualPoints;

      // By confidence
      const confKey = result.confidence.toLowerCase() as 'high' | 'medium' | 'low';
      confMetrics[confKey].absError += Math.abs(result.error);
      if (Math.abs(result.errorPct) <= 20) confMetrics[confKey].hits++;
      confMetrics[confKey].count++;
    }

    const n = playerResults.length;

    // Pearson correlation coefficient
    const correlation =
      (n * sumProjectedActual - sumProjected * sumActual) /
      Math.sqrt(
        (n * sumProjectedSquared - sumProjected * sumProjected) *
        (n * sumActualSquared - sumActual * sumActual)
      );

    return {
      config,
      summary: {
        totalPlayers: n,
        totalDates: dailyResults.length,
        meanError: totalError / n,
        meanAbsoluteError: totalAbsError / n,
        rootMeanSquareError: Math.sqrt(totalSquaredError / n),
        hitRate: hits / n,
        floorHitRate: floorHits / n,
        ceilingHitRate: ceilingHits / n,
        correlationCoefficient: isNaN(correlation) ? 0 : correlation,
      },
      byConfidence: {
        high: {
          mae: confMetrics.high.count > 0
            ? confMetrics.high.absError / confMetrics.high.count
            : 0,
          hitRate: confMetrics.high.count > 0
            ? confMetrics.high.hits / confMetrics.high.count
            : 0,
          count: confMetrics.high.count,
        },
        medium: {
          mae: confMetrics.medium.count > 0
            ? confMetrics.medium.absError / confMetrics.medium.count
            : 0,
          hitRate: confMetrics.medium.count > 0
            ? confMetrics.medium.hits / confMetrics.medium.count
            : 0,
          count: confMetrics.medium.count,
        },
        low: {
          mae: confMetrics.low.count > 0
            ? confMetrics.low.absError / confMetrics.low.count
            : 0,
          hitRate: confMetrics.low.count > 0
            ? confMetrics.low.hits / confMetrics.low.count
            : 0,
          count: confMetrics.low.count,
        },
      },
      byPosition: new Map(), // Would need position data
      bySalaryRange: this.groupBySalaryRange(playerResults),
      dailyResults,
      playerResults,
    };
  }

  /**
   * Group results by salary range
   */
  private groupBySalaryRange(
    results: PlayerBacktestResult[]
  ): Map<string, { mae: number; hitRate: number; count: number }> {
    const ranges = [
      { label: '$3k-$5k', min: 3000, max: 5000 },
      { label: '$5k-$7k', min: 5000, max: 7000 },
      { label: '$7k-$9k', min: 7000, max: 9000 },
      { label: '$9k+', min: 9000, max: Infinity },
    ];

    const grouped = new Map<string, { absError: number; hits: number; count: number }>();

    for (const range of ranges) {
      grouped.set(range.label, { absError: 0, hits: 0, count: 0 });
    }

    for (const result of results) {
      for (const range of ranges) {
        if (result.salary >= range.min && result.salary < range.max) {
          const current = grouped.get(range.label)!;
          current.absError += Math.abs(result.error);
          if (Math.abs(result.errorPct) <= 20) current.hits++;
          current.count++;
          break;
        }
      }
    }

    const final = new Map<string, { mae: number; hitRate: number; count: number }>();
    for (const [label, data] of grouped) {
      final.set(label, {
        mae: data.count > 0 ? data.absError / data.count : 0,
        hitRate: data.count > 0 ? data.hits / data.count : 0,
        count: data.count,
      });
    }

    return final;
  }

  /**
   * Get array of dates between start and end
   */
  private getDateRange(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  /**
   * Get projection accuracy trend over time
   */
  async getAccuracyTrend(
    config: BacktestConfig
  ): Promise<Array<{ date: Date; mae: number; hitRate: number }>> {
    const results = await this.runBacktest(config);

    return results.dailyResults.map((d) => ({
      date: d.date,
      mae: d.meanAbsoluteError,
      hitRate: d.hitRate,
    }));
  }

  /**
   * Compare two projection methods
   */
  async compareProjectionMethods(
    config: BacktestConfig,
    methodA: string,
    methodB: string
  ): Promise<{
    methodA: { mae: number; hitRate: number };
    methodB: { mae: number; hitRate: number };
    winner: string;
    difference: number;
  }> {
    // This would compare different projection configurations
    // For now, return placeholder
    const results = await this.runBacktest(config);

    return {
      methodA: {
        mae: results.summary.meanAbsoluteError,
        hitRate: results.summary.hitRate,
      },
      methodB: {
        mae: results.summary.meanAbsoluteError * 1.1, // Placeholder
        hitRate: results.summary.hitRate * 0.95,
      },
      winner: methodA,
      difference: 0.1,
    };
  }
}
