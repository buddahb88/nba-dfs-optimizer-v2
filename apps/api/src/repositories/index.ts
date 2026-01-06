import { PrismaClient } from '@nba-dfs/database';
import { PlayerRepository } from './playerRepository.js';
import { SlateRepository } from './slateRepository.js';
import { HistoricalRepository } from './historicalRepository.js';
import { TeamDefenseRepository } from './teamDefenseRepository.js';
import { LineupRepository } from './lineupRepository.js';

// Re-export all repositories
export { BaseRepository } from './baseRepository.js';
export { PlayerRepository } from './playerRepository.js';
export { SlateRepository } from './slateRepository.js';
export { HistoricalRepository } from './historicalRepository.js';
export { TeamDefenseRepository } from './teamDefenseRepository.js';
export { LineupRepository } from './lineupRepository.js';

// Re-export types
export type {
  PlayerCreateInput,
  PlayerUpdateInput,
  PlayerFilters,
  PlayerWithHistory,
} from './playerRepository.js';

export type {
  SlateCreateInput,
  SlateUpdateInput,
  SlateWithCounts,
} from './slateRepository.js';

export type {
  HistoricalGameCreateInput,
  PlayerStats,
  MatchupHistory,
  RosterContext,
} from './historicalRepository.js';

export type {
  TeamDefenseCreateInput,
  TeamDefenseUpdateInput,
  DefenseRanking,
} from './teamDefenseRepository.js';

export type {
  LineupCreateInput,
  LineupPlayerInput,
  LineupWithPlayers,
  LineupExposure,
} from './lineupRepository.js';

/**
 * Repository container for dependency injection
 * Provides a single point of access to all repositories
 */
export class RepositoryContainer {
  public readonly player: PlayerRepository;
  public readonly slate: SlateRepository;
  public readonly historical: HistoricalRepository;
  public readonly teamDefense: TeamDefenseRepository;
  public readonly lineup: LineupRepository;

  constructor(prisma: PrismaClient) {
    this.player = new PlayerRepository(prisma);
    this.slate = new SlateRepository(prisma);
    this.historical = new HistoricalRepository(prisma);
    this.teamDefense = new TeamDefenseRepository(prisma);
    this.lineup = new LineupRepository(prisma);
  }
}

// Singleton instance (initialized with global prisma client)
let repositoryContainer: RepositoryContainer | null = null;

/**
 * Get the repository container singleton
 * Must be initialized with a Prisma client first
 */
export function getRepositories(prisma: PrismaClient): RepositoryContainer {
  if (!repositoryContainer) {
    repositoryContainer = new RepositoryContainer(prisma);
  }
  return repositoryContainer;
}

/**
 * Create a fresh repository container (useful for testing)
 */
export function createRepositories(prisma: PrismaClient): RepositoryContainer {
  return new RepositoryContainer(prisma);
}
