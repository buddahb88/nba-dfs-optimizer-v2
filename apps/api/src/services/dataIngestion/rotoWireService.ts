import { PrismaClient } from '@nba-dfs/database';
import { getRepositories, RepositoryContainer } from '../../repositories/index.js';

// =============================================================================
// RotoWire API Response Types (Actual API Structure)
// =============================================================================

/**
 * Slate response from /slate-list.php
 * Response is an array where first object contains slates, second contains games
 */
export interface RotoWireSlate {
  slateID: number;
  contestType: string;       // "Classic", "Showdown", "Tiers"
  slateName: string;         // "All", "Night", "CLE @ IND", etc.
  salaryCap: number;         // 50000
  startDate: string;         // "2026-01-06 19:00:00"
  endDate: string;           // "2026-01-06 20:00:00"
  defaultSlate: boolean;
  startDateOnly: string;     // "2026-01-06"
  timeOnly: string;          // "07:00 PM"
  games: number[];           // Array of game IDs
}

/**
 * Team object nested in player response
 */
export interface RotoWireTeam {
  abbr: string;              // "MIL"
  city: string;              // "Milwaukee"
  nickname: string;          // "Bucks"
}

/**
 * Odds/Vegas data nested in player response
 */
export interface RotoWireOdds {
  moneyline: string;
  overUnder: string;
  spread: string;
  impliedPts: number;
  impliedWinProb: number;
}

/**
 * Advanced stats from stats.advanced
 */
export interface RotoWireAdvancedStats {
  per: string;               // Player Efficiency Rating
  usage: string;             // Usage rate
  rest: string;              // Days of rest
}

/**
 * Average fantasy points from stats.avgFpts
 */
export interface RotoWireAvgFpts {
  last3: string;
  last5: string;
  last7: string;
  last14: string;
  season: string;
}

/**
 * Full stats object
 */
export interface RotoWireStats {
  season: Record<string, string>;  // Season stats
  advanced: RotoWireAdvancedStats;
  avgFpts: RotoWireAvgFpts;
}

/**
 * Player response from /players.php
 */
export interface RotoWirePlayer {
  rwID: number;              // RotoWire player ID
  slateID: number;           // Slate-specific player ID
  firstName: string;
  lastName: string;
  rotoPos: string;           // Primary position: "C", "PG", "SF", etc.
  pos: string[];             // Eligible positions: ["C", "UTIL"]
  injuryStatus: string | null; // null, "QUES", "GTD", "OUT", etc.
  isHome: boolean;
  team: RotoWireTeam;
  game: { dateTime: string };
  salary: number;
  pts: string;               // Projected fantasy points
  rostership: number;        // Ownership %
  minutes: number;           // Projected minutes
  opponent: { team: string };
  odds: RotoWireOdds;
  stats: RotoWireStats;
}

export interface FetchResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SyncResult {
  success: boolean;
  message: string;
  counts?: {
    slates?: number;
    players?: number;
  };
  errors?: string[];
}

// Site IDs for different platforms
export const SITE_IDS = {
  DRAFTKINGS: 1,
  FANDUEL: 2,
  YAHOO: 3,
} as const;

/**
 * RotoWire Data Service
 * Fetches slate and player data from RotoWire's API
 */
export class RotoWireService {
  private repos: RepositoryContainer;
  private baseUrl = 'https://www.rotowire.com/daily/nba/api';
  private cookies: string;

  constructor(prisma: PrismaClient) {
    this.repos = getRepositories(prisma);
    // Get cookies from environment variable
    this.cookies = process.env.ROTOWIRE_COOKIES || '';
  }

  /**
   * Get common headers for RotoWire API requests
   */
  private getHeaders(): HeadersInit {
    return {
      'accept': 'application/json, text/plain, */*',
      'accept-language': 'en-US,en;q=0.9',
      'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"Windows"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'cookie': this.cookies,
      'Referer': 'https://www.rotowire.com/daily/nba/optimizer.php',
    };
  }

  /**
   * Fetch available slates from RotoWire
   * API returns: { slates: [...], games: {...} }
   */
  async fetchSlates(siteId: number = SITE_IDS.DRAFTKINGS): Promise<FetchResult<RotoWireSlate[]>> {
    try {
      const url = `${this.baseUrl}/slate-list.php?siteID=${siteId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      // API returns { slates: [...], games: {...} }
      const rawData = await response.json() as { slates: RotoWireSlate[]; games: Record<string, unknown> };

      return {
        success: true,
        data: rawData.slates || [],
      };
    } catch (error) {
      return {
        success: false,
        error: `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Fetch players for a specific slate
   */
  async fetchPlayers(slateId: number): Promise<FetchResult<RotoWirePlayer[]>> {
    try {
      const url = `${this.baseUrl}/players.php?slateID=${slateId}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const data = await response.json() as RotoWirePlayer[];

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error: `Fetch failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * Sync all available slates to database
   */
  async syncSlates(siteId: number = SITE_IDS.DRAFTKINGS): Promise<SyncResult> {
    const result = await this.fetchSlates(siteId);

    if (!result.success || !result.data) {
      return {
        success: false,
        message: 'Failed to fetch slates',
        errors: [result.error || 'Unknown error'],
      };
    }

    let syncedCount = 0;
    const errors: string[] = [];

    for (const slate of result.data) {
      try {
        // Parse dates (format: "2026-01-06 19:00:00")
        const startTime = slate.startDate ? new Date(slate.startDate) : undefined;
        const endTime = slate.endDate ? new Date(slate.endDate) : undefined;

        await this.repos.slate.upsert({
          externalId: String(slate.slateID),
          name: slate.slateName,
          contestType: slate.contestType, // Classic, Showdown, Tiers
          startTime: startTime && !isNaN(startTime.getTime()) ? startTime : undefined,
          endTime: endTime && !isNaN(endTime.getTime()) ? endTime : undefined,
          salaryCap: slate.salaryCap || 50000,
          gameCount: slate.games?.length || undefined,
          isDefault: slate.defaultSlate || false,
          status: 'PENDING',
        });

        syncedCount++;
      } catch (error) {
        errors.push(`Failed to sync slate ${slate.slateID}: ${error}`);
      }
    }

    return {
      success: errors.length === 0,
      message: `Synced ${syncedCount} slates`,
      counts: { slates: syncedCount },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Sync players for a specific slate
   */
  async syncPlayers(slateExternalId: string): Promise<SyncResult> {
    // First, get or create the slate in our database
    let slate = await this.repos.slate.findByExternalId(slateExternalId);

    if (!slate) {
      // Create the slate if it doesn't exist
      slate = await this.repos.slate.upsert({
        externalId: slateExternalId,
        name: `Slate ${slateExternalId}`,
        status: 'PENDING',
      });
    }

    // Fetch players from RotoWire
    const result = await this.fetchPlayers(parseInt(slateExternalId));

    if (!result.success || !result.data) {
      return {
        success: false,
        message: 'Failed to fetch players',
        errors: [result.error || 'Unknown error'],
      };
    }

    // Map RotoWire players to our format
    const players = result.data.map((p) => {
      // Parse string stats to numbers
      const toFloat = (val: string | number | undefined | null) =>
        val !== null && val !== undefined ? Number.parseFloat(String(val)) || null : null;
      const toInt = (val: string | number | undefined | null) =>
        val !== null && val !== undefined ? Number.parseInt(String(val), 10) || null : null;

      // Calculate value (pts per $1000 salary)
      const projPts = toFloat(p.pts);
      const value = projPts && p.salary ? (projPts / p.salary) * 1000 : null;

      return {
        externalId: String(p.rwID),
        slateId: slate.id,
        name: `${p.firstName} ${p.lastName}`.trim(),
        team: p.team?.abbr || '',
        opponent: p.opponent?.team || '',
        positions: p.pos?.join(',') || p.rotoPos, // Join array: ["C", "UTIL"] -> "C,UTIL"
        salary: p.salary || 0,

        // Projections
        projectedPoints: toFloat(p.pts),
        projectedMinutes: p.minutes || null,
        ownership: p.rostership || null,
        value,

        // Historical averages from RotoWire stats.avgFpts
        avgFptsLast3: toFloat(p.stats?.avgFpts?.last3),
        avgFptsLast5: toFloat(p.stats?.avgFpts?.last5),
        avgFptsLast7: toFloat(p.stats?.avgFpts?.last7),
        avgFptsLast14: toFloat(p.stats?.avgFpts?.last14),
        avgFptsSeason: toFloat(p.stats?.avgFpts?.season),

        // Advanced stats
        per: toFloat(p.stats?.advanced?.per),
        usageRate: toFloat(p.stats?.advanced?.usage),
        restDays: toInt(p.stats?.advanced?.rest),

        // Game context
        isHome: p.isHome === true,
        injuryStatus: p.injuryStatus || null,

        // Vegas data from odds object
        vegasTotal: toFloat(p.odds?.overUnder),
        vegasSpread: toFloat(p.odds?.spread),
        vegasImplied: p.odds?.impliedPts || null,

        // Store raw data for debugging/future use
        rawData: JSON.stringify(p),
      };
    });

    // Bulk upsert players
    const count = await this.repos.player.bulkUpsert(slate.id, players);

    // Update slate status
    await this.repos.slate.updateStatus(slate.id, 'ACTIVE');

    return {
      success: true,
      message: `Synced ${count} players for slate ${slateExternalId}`,
      counts: { players: count },
    };
  }

  /**
   * Full sync: fetch slates and players for all active slates
   */
  async fullSync(siteId: number = SITE_IDS.DRAFTKINGS): Promise<SyncResult> {
    const errors: string[] = [];
    let slateCount = 0;
    let playerCount = 0;

    // 1. Sync slates
    const slateResult = await this.syncSlates(siteId);
    if (!slateResult.success) {
      errors.push(...(slateResult.errors || []));
    }
    slateCount = slateResult.counts?.slates || 0;

    // 2. Get all active slates and sync players
    const slates = await this.repos.slate.getActiveSlates();

    for (const slate of slates) {
      const playerResult = await this.syncPlayers(slate.externalId);
      if (!playerResult.success) {
        errors.push(...(playerResult.errors || []));
      } else {
        playerCount += playerResult.counts?.players || 0;
      }
    }

    return {
      success: errors.length === 0,
      message: `Full sync complete: ${slateCount} slates, ${playerCount} players`,
      counts: { slates: slateCount, players: playerCount },
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  /**
   * Check if cookies are configured
   */
  hasCookies(): boolean {
    return this.cookies.length > 0;
  }
}
