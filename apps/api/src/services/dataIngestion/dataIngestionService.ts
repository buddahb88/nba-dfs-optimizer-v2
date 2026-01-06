import { PrismaClient } from '@nba-dfs/database';
import {
  RepositoryContainer,
  getRepositories,
} from '../../repositories/index.js';
import { RotoWireParser } from './rotoWireParser.js';
import { HistoricalDataLoader } from './historicalDataLoader.js';
import { DefenseDataLoader } from './defenseDataLoader.js';

export interface IngestionResult {
  success: boolean;
  message: string;
  counts?: {
    slates?: number;
    players?: number;
    historicalGames?: number;
    defenseStats?: number;
  };
  errors?: string[];
}

export interface IngestionConfig {
  sources: {
    rotowire: boolean;
    espn: boolean;
    basketballReference: boolean;
  };
  autoSync: boolean;
  syncIntervalMinutes: number;
}

/**
 * Main data ingestion service that orchestrates all data loading
 */
export class DataIngestionService {
  private repos: RepositoryContainer;
  private rotoWireParser: RotoWireParser;
  private historicalLoader: HistoricalDataLoader;
  private defenseLoader: DefenseDataLoader;

  constructor(prisma: PrismaClient) {
    this.repos = getRepositories(prisma);
    this.rotoWireParser = new RotoWireParser();
    this.historicalLoader = new HistoricalDataLoader(prisma);
    this.defenseLoader = new DefenseDataLoader(prisma);
  }

  /**
   * Full sync of all data sources for a slate
   */
  async syncSlate(slateId: string): Promise<IngestionResult> {
    const errors: string[] = [];
    const counts: IngestionResult['counts'] = {};

    try {
      // 1. Get slate info
      const slate = await this.repos.slate.findById(slateId);
      if (!slate) {
        return {
          success: false,
          message: 'Slate not found',
          errors: ['Slate does not exist'],
        };
      }

      // 2. Update slate status to ACTIVE
      await this.repos.slate.updateStatus(slateId, 'ACTIVE');

      // 3. Sync defense data (needed for projections)
      try {
        const defenseResult = await this.defenseLoader.loadLatestDefenseData();
        counts.defenseStats = defenseResult.count;
      } catch (err) {
        errors.push(`Defense sync failed: ${err}`);
      }

      // 4. Player projections would be synced here when RotoWire API is available
      // For now, this is a placeholder

      return {
        success: errors.length === 0,
        message:
          errors.length === 0
            ? 'Slate synced successfully'
            : 'Slate synced with some errors',
        counts,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      return {
        success: false,
        message: 'Slate sync failed',
        errors: [String(err)],
      };
    }
  }

  /**
   * Import slate data from RotoWire CSV
   */
  async importRotoWireCSV(
    csvContent: string,
    slateName: string,
    externalId: string,
    startTime?: Date
  ): Promise<IngestionResult> {
    try {
      // Parse CSV
      const parsed = this.rotoWireParser.parseCSV(csvContent);

      if (!parsed.success || !parsed.players) {
        return {
          success: false,
          message: 'Failed to parse CSV',
          errors: parsed.errors,
        };
      }

      // Create or update slate
      const slate = await this.repos.slate.upsert({
        externalId,
        name: slateName,
        startTime,
        status: 'PENDING',
      });

      // Bulk upsert players
      const playerCount = await this.repos.player.bulkUpsert(
        slate.id,
        parsed.players.map((p) => ({
          externalId: p.externalId,
          slateId: slate.id,
          name: p.name,
          team: p.team,
          opponent: p.opponent,
          positions: p.positions.join(','),
          salary: p.salary,
          projectedPoints: p.projectedPoints,
          ownership: p.ownership,
        }))
      );

      return {
        success: true,
        message: `Imported ${playerCount} players for slate "${slateName}"`,
        counts: {
          slates: 1,
          players: playerCount,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: 'Import failed',
        errors: [String(err)],
      };
    }
  }

  /**
   * Load historical game data
   */
  async loadHistoricalData(
    season: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<IngestionResult> {
    try {
      const result = await this.historicalLoader.loadSeasonData(
        season,
        startDate,
        endDate
      );

      return {
        success: true,
        message: `Loaded ${result.count} historical games`,
        counts: {
          historicalGames: result.count,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: 'Historical data load failed',
        errors: [String(err)],
      };
    }
  }

  /**
   * Update defense vs position data
   */
  async updateDefenseData(): Promise<IngestionResult> {
    try {
      const result = await this.defenseLoader.loadLatestDefenseData();

      return {
        success: true,
        message: `Updated defense data for ${result.count} teams`,
        counts: {
          defenseStats: result.count,
        },
      };
    } catch (err) {
      return {
        success: false,
        message: 'Defense data update failed',
        errors: [String(err)],
      };
    }
  }

  /**
   * Run full nightly sync
   */
  async runNightlySync(): Promise<IngestionResult> {
    const errors: string[] = [];
    const counts: IngestionResult['counts'] = {};

    // 1. Update defense data
    try {
      const defResult = await this.defenseLoader.loadLatestDefenseData();
      counts.defenseStats = defResult.count;
    } catch (err) {
      errors.push(`Defense sync: ${err}`);
    }

    // 2. Update historical data (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    try {
      const histResult = await this.historicalLoader.loadSeasonData(
        this.getCurrentSeason(),
        weekAgo
      );
      counts.historicalGames = histResult.count;
    } catch (err) {
      errors.push(`Historical sync: ${err}`);
    }

    // 3. Mark expired slates as completed
    try {
      await this.markExpiredSlates();
    } catch (err) {
      errors.push(`Slate cleanup: ${err}`);
    }

    return {
      success: errors.length === 0,
      message:
        errors.length === 0
          ? 'Nightly sync completed'
          : 'Nightly sync completed with errors',
      counts,
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Mark old slates as completed
   */
  private async markExpiredSlates(): Promise<void> {
    const activeSlates = await this.repos.slate.getActiveSlates();
    const now = new Date();

    for (const slate of activeSlates) {
      if (slate.startTime && slate.startTime < now) {
        // Slate has started, check if it's been > 5 hours (games should be done)
        const hoursSinceStart =
          (now.getTime() - slate.startTime.getTime()) / (1000 * 60 * 60);
        if (hoursSinceStart > 5) {
          await this.repos.slate.updateStatus(slate.id, 'COMPLETED');
        } else {
          await this.repos.slate.updateStatus(slate.id, 'LOCKED');
        }
      }
    }
  }

  /**
   * Get current NBA season string
   */
  private getCurrentSeason(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    // NBA season typically runs October-April
    // If we're in Jan-June, we're in the previous year's season
    if (month <= 5) {
      return `${year - 1}-${year.toString().slice(2)}`;
    }
    return `${year}-${(year + 1).toString().slice(2)}`;
  }
}
