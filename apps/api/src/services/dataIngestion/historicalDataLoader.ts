import { PrismaClient } from '@nba-dfs/database';
import { getRepositories, RepositoryContainer } from '../../repositories/index.js';

export interface HistoricalGameInput {
  playerName: string;
  playerId?: string;
  team: string;
  opponent: string;
  gameDate: Date;
  season: string;
  isHome: boolean;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fgMade: number;
  fgAttempted: number;
  fg3Made: number;
  fg3Attempted: number;
  ftMade: number;
  ftAttempted: number;
  plusMinus?: number;
  usagePct?: number;
}

export interface BoxScoreData {
  gameId: string;
  gameDate: Date;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  players: HistoricalGameInput[];
}

export interface LoadResult {
  success: boolean;
  count: number;
  errors?: string[];
}

/**
 * Historical Data Loader
 * Loads and processes historical NBA game data
 */
export class HistoricalDataLoader {
  private repos: RepositoryContainer;

  constructor(prisma: PrismaClient) {
    this.repos = getRepositories(prisma);
  }

  /**
   * Load historical data for a season
   */
  async loadSeasonData(
    season: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<LoadResult> {
    // This is a placeholder for actual data fetching
    // In production, this would call an API or scrape data
    console.log(`Loading historical data for season ${season}`);

    return {
      success: true,
      count: 0,
      errors: ['Data source not configured - implement API integration'],
    };
  }

  /**
   * Process and store box score data
   */
  async processBoxScores(boxScores: BoxScoreData[]): Promise<LoadResult> {
    const errors: string[] = [];
    let totalCount = 0;

    for (const boxScore of boxScores) {
      try {
        const games = boxScore.players.map((player) => ({
          playerName: player.playerName,
          playerId: player.playerId || null,
          team: player.team,
          opponent: player.opponent,
          gameDate: boxScore.gameDate,
          season: player.season,
          isHome: player.isHome,
          minutes: player.minutes,
          points: player.points,
          rebounds: player.rebounds,
          assists: player.assists,
          steals: player.steals,
          blocks: player.blocks,
          turnovers: player.turnovers,
          plusMinus: player.plusMinus || null,
          fgMade: player.fgMade,
          fgAttempted: player.fgAttempted,
          fg3Made: player.fg3Made,
          fg3Attempted: player.fg3Attempted,
          ftMade: player.ftMade,
          ftAttempted: player.ftAttempted,
          usagePct: player.usagePct || null,
          trueShooting: this.calculateTrueShooting(player),
          effectiveFg: this.calculateEffectiveFg(player),
          dkFantasyPoints: this.calculateDkPoints(player),
          restDays: null, // Calculated in post-processing
          isBackToBack: false, // Calculated in post-processing
        }));

        const count = await this.repos.historical.bulkUpsert(games);
        totalCount += count;
      } catch (err) {
        errors.push(`Box score ${boxScore.gameId}: ${err}`);
      }
    }

    // Post-process to calculate rest days and B2B
    await this.calculateRestDays();

    return {
      success: errors.length === 0,
      count: totalCount,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Calculate DraftKings fantasy points
   */
  private calculateDkPoints(player: HistoricalGameInput): number {
    let pts =
      player.points * 1 +
      player.rebounds * 1.25 +
      player.assists * 1.5 +
      player.steals * 2 +
      player.blocks * 2 -
      player.turnovers * 0.5;

    // Double-double bonus
    const statCategories = [
      player.points >= 10,
      player.rebounds >= 10,
      player.assists >= 10,
      player.steals >= 10,
      player.blocks >= 10,
    ];
    const doubleDigits = statCategories.filter(Boolean).length;

    if (doubleDigits >= 2) pts += 1.5;
    if (doubleDigits >= 3) pts += 1.5; // Triple-double adds another 1.5

    return Math.round(pts * 10) / 10;
  }

  /**
   * Calculate true shooting percentage
   */
  private calculateTrueShooting(player: HistoricalGameInput): number | null {
    const tsa = player.fgAttempted + 0.44 * player.ftAttempted;
    if (tsa === 0) return null;
    return Math.round((player.points / (2 * tsa)) * 1000) / 10;
  }

  /**
   * Calculate effective field goal percentage
   */
  private calculateEffectiveFg(player: HistoricalGameInput): number | null {
    if (player.fgAttempted === 0) return null;
    return (
      Math.round(
        ((player.fgMade + 0.5 * player.fg3Made) / player.fgAttempted) * 1000
      ) / 10
    );
  }

  /**
   * Calculate rest days and back-to-back flags for all games
   */
  private async calculateRestDays(): Promise<void> {
    // This would update restDays and isBackToBack fields
    // by comparing game dates for each player
    // Implementation depends on database-specific bulk update capabilities
    console.log('Calculating rest days...');
  }

  /**
   * Import historical data from JSON format
   */
  async importFromJSON(jsonData: BoxScoreData[]): Promise<LoadResult> {
    return this.processBoxScores(jsonData);
  }

  /**
   * Backfill missing games for specific players
   */
  async backfillPlayer(
    playerName: string,
    season: string
  ): Promise<LoadResult> {
    // Check what games we have
    const existingGames = await this.repos.historical.findByPlayer(playerName, {
      season,
    });

    console.log(
      `Found ${existingGames.length} existing games for ${playerName} in ${season}`
    );

    // In production, fetch missing games from API
    return {
      success: true,
      count: 0,
      errors: ['Backfill source not configured'],
    };
  }

  /**
   * Validate historical data integrity
   */
  async validateData(season: string): Promise<{
    totalGames: number;
    playersWithData: number;
    gamesWithIssues: number;
    issues: string[];
  }> {
    const summary = await this.repos.historical.getSeasonSummary(season);
    const issues: string[] = [];

    // Check for games with suspicious data
    // e.g., DK points that don't match calculated values

    return {
      totalGames: summary.totalGames,
      playersWithData: summary.uniquePlayers,
      gamesWithIssues: 0,
      issues,
    };
  }
}
