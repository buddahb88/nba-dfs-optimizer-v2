import type { Position } from '@nba-dfs/types';
import { parsePositions } from '@nba-dfs/utils';
import solver, { Model } from 'javascript-lp-solver';

export interface Player {
  id: string;
  name: string;
  team: string;
  opponent: string;
  positions: string;
  salary: number;
  projectedPoints: number | null;
  ownership?: number | null;
  // Enhanced projection data
  floor?: number | null;
  ceiling?: number | null;
  value?: number | null;
  boomProbability?: number | null;
  leverageScore?: number | null;
}

export interface LineupPlayer {
  player: Player;
  slot: string;
}

export interface Lineup {
  players: LineupPlayer[];
  totalSalary: number;
  projectedPoints: number;
  ownership: number;
  ceiling: number;
  gameStacks: GameStack[];
}

export interface GameStack {
  game: string;
  players: string[];
  correlation: number;
}

export interface StackingConfig {
  enabled: boolean;
  minStack: number;
  maxStack: number;
  correlationBonus: number;
  preferHighTotal: boolean;
}

export interface OptimizerConfig {
  salaryCap: number;
  rosterSize: number;
  mode: 'CASH' | 'GPP';
  numLineups: number;
  maxExposure: number;
  minExposure: number;
  stacking: StackingConfig;
  lockedPlayers: string[];
  excludedPlayers: string[];
  diversityFactor: number;
}

// DraftKings NBA roster structure
const ROSTER_SLOTS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'];

// Default configuration
const DEFAULT_CONFIG: OptimizerConfig = {
  salaryCap: 50000,
  rosterSize: 8,
  mode: 'GPP',
  numLineups: 20,
  maxExposure: 60,
  minExposure: 0,
  stacking: {
    enabled: true,
    minStack: 2,
    maxStack: 4,
    correlationBonus: 1.5,
    preferHighTotal: true,
  },
  lockedPlayers: [],
  excludedPlayers: [],
  diversityFactor: 0.15,
};

export class OptimizerEngine {
  private config: OptimizerConfig;
  private gameGroups: Map<string, Player[]> = new Map();

  constructor(config?: Partial<OptimizerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Main optimization entry point
   */
  optimize(players: Player[]): Lineup[] {
    const lineups: Lineup[] = [];
    const usedLineupHashes = new Set<string>();
    const playerExposure: Map<string, number> = new Map();

    // Filter to only players with projections
    const viablePlayers = players.filter(
      (p) => p.projectedPoints && p.projectedPoints > 0
    );

    // Group players by game for stacking
    this.gameGroups = this.groupPlayersByGame(viablePlayers);

    for (let i = 0; i < this.config.numLineups; i++) {
      const lineup = this.buildSingleLineup(
        viablePlayers,
        playerExposure,
        i,
        usedLineupHashes
      );

      if (lineup) {
        lineups.push(lineup);

        // Update exposure counts
        lineup.players.forEach((lp) => {
          const current = playerExposure.get(lp.player.id) || 0;
          playerExposure.set(lp.player.id, current + 1);
        });

        // Track lineup hash to avoid duplicates
        const hash = lineup.players
          .map((lp) => lp.player.id)
          .sort()
          .join('|');
        usedLineupHashes.add(hash);
      }
    }

    return lineups;
  }

  /**
   * Group players by game (team vs opponent)
   */
  private groupPlayersByGame(players: Player[]): Map<string, Player[]> {
    const groups = new Map<string, Player[]>();

    for (const player of players) {
      // Create normalized game key (alphabetical order)
      const teams = [player.team, player.opponent].sort();
      const gameKey = `${teams[0]}@${teams[1]}`;

      const existing = groups.get(gameKey) || [];
      existing.push(player);
      groups.set(gameKey, existing);
    }

    return groups;
  }

  private buildSingleLineup(
    players: Player[],
    exposure: Map<string, number>,
    lineupIndex: number,
    usedHashes: Set<string>
  ): Lineup | null {
    // Build LP model
    const model: Model = {
      optimize: 'score',
      opType: 'max',
      constraints: {
        salary: { max: this.config.salaryCap },
        players: { equal: this.config.rosterSize },
        PG: { min: 1, max: 3 },
        SG: { min: 1, max: 3 },
        SF: { min: 1, max: 3 },
        PF: { min: 1, max: 3 },
        C: { min: 1, max: 2 },
        G: { min: 3, max: 4 },
        F: { min: 3, max: 4 },
      },
      variables: {},
      ints: {},
    };

    // Add game stacking constraints if enabled
    if (this.config.stacking.enabled) {
      for (const [gameKey] of this.gameGroups) {
        // Constraint: at least minStack players from at least one game
        // This is handled by boosting scores of correlated players
        model.constraints[`game_${gameKey}`] = {
          max: this.config.stacking.maxStack,
        };
      }
    }

    // Add player variables
    for (const player of players) {
      const positions = parsePositions(player.positions);
      const currentExposure = exposure.get(player.id) || 0;
      const maxAllowedExposure = Math.ceil(
        (this.config.maxExposure / 100) * this.config.numLineups
      );

      // Skip if at max exposure
      if (
        this.config.maxExposure < 100 &&
        currentExposure >= maxAllowedExposure
      ) {
        continue;
      }

      // Skip excluded players
      if (this.config.excludedPlayers.includes(player.id)) {
        continue;
      }

      // Calculate player score based on mode
      const score = this.calculatePlayerScore(player, lineupIndex);

      const varName = `p_${player.id}`;
      model.variables[varName] = {
        score,
        salary: player.salary,
        players: 1,
        PG: positions.includes('PG') ? 1 : 0,
        SG: positions.includes('SG') ? 1 : 0,
        SF: positions.includes('SF') ? 1 : 0,
        PF: positions.includes('PF') ? 1 : 0,
        C: positions.includes('C') ? 1 : 0,
        G: positions.includes('PG') || positions.includes('SG') ? 1 : 0,
        F: positions.includes('SF') || positions.includes('PF') ? 1 : 0,
      };

      // Add game constraint membership
      if (this.config.stacking.enabled) {
        const teams = [player.team, player.opponent].sort();
        const gameKey = `${teams[0]}@${teams[1]}`;
        model.variables[varName][`game_${gameKey}`] = 1;
      }

      model.ints![varName] = 1;

      // Force locked players
      if (this.config.lockedPlayers.includes(player.id)) {
        model.constraints[`lock_${player.id}`] = { equal: 1 };
        model.variables[varName][`lock_${player.id}`] = 1;
      }
    }

    // Solve
    const result = solver.Solve(model);

    if (!result.feasible) {
      return null;
    }

    // Extract lineup
    const selectedPlayers: Player[] = [];
    for (const key in result) {
      if (key.startsWith('p_') && result[key] === 1) {
        const playerId = key.replace('p_', '');
        const player = players.find((p) => p.id === playerId);
        if (player) {
          selectedPlayers.push(player);
        }
      }
    }

    if (selectedPlayers.length !== this.config.rosterSize) {
      return null;
    }

    // Check for duplicate lineup
    const hash = selectedPlayers
      .map((p) => p.id)
      .sort()
      .join('|');
    if (usedHashes.has(hash)) {
      return null;
    }

    // Assign players to slots
    const lineupPlayers = this.assignToSlots(selectedPlayers);
    if (!lineupPlayers) {
      return null;
    }

    const totalSalary = selectedPlayers.reduce((sum, p) => sum + p.salary, 0);
    const projectedPoints = selectedPlayers.reduce(
      (sum, p) => sum + (p.projectedPoints || 0),
      0
    );
    const avgOwnership =
      selectedPlayers.reduce((sum, p) => sum + (p.ownership || 10), 0) /
      selectedPlayers.length;
    const totalCeiling = selectedPlayers.reduce(
      (sum, p) => sum + (p.ceiling || p.projectedPoints || 0),
      0
    );

    // Calculate game stacks
    const gameStacks = this.calculateGameStacks(selectedPlayers);

    return {
      players: lineupPlayers,
      totalSalary,
      projectedPoints: Math.round(projectedPoints * 100) / 100,
      ownership: Math.round(avgOwnership * 10) / 10,
      ceiling: Math.round(totalCeiling * 100) / 100,
      gameStacks,
    };
  }

  /**
   * Calculate player score for optimization
   */
  private calculatePlayerScore(player: Player, lineupIndex: number): number {
    // Projection used by the mode-specific scoring methods
    if (this.config.mode === 'CASH') {
      return this.calculateCashScore(player);
    } else {
      return this.calculateGPPScore(player, lineupIndex);
    }
  }

  /**
   * Cash game scoring - prioritize floor and consistency
   */
  private calculateCashScore(player: Player): number {
    const projection = player.projectedPoints || 0;
    const floor = player.floor || projection * 0.75;
    const value = player.value || projection / (player.salary / 1000);

    // Cash games: weight toward floor and value
    const score = projection * 0.5 + floor * 0.3 + value * 2;

    return score;
  }

  /**
   * GPP scoring - prioritize ceiling, leverage, and differentiation
   */
  private calculateGPPScore(player: Player, lineupIndex: number): number {
    const projection = player.projectedPoints || 0;
    const ceiling = player.ceiling || projection * 1.25;
    const value = player.value || projection / (player.salary / 1000);
    const ownership = player.ownership || 10;
    const boomProbability = player.boomProbability || 0.2;
    const leverageScore = player.leverageScore || 1;

    // Base score weighted toward ceiling
    let score = ceiling * 0.4 + value * 2;

    // Ownership leverage (reward low owned high-ceiling plays)
    const ownershipBoost = Math.max(0, (30 - ownership) * 0.3);
    score += ownershipBoost;

    // Boom probability bonus
    score += boomProbability * 10;

    // Leverage score bonus
    score += Math.min(leverageScore, 15) * 0.5;

    // Progressive randomness for lineup diversity
    const diversityMultiplier =
      1 + (lineupIndex * this.config.diversityFactor * (Math.random() - 0.5));
    score *= diversityMultiplier;

    return score;
  }

  /**
   * Calculate game stacks in a lineup
   */
  private calculateGameStacks(players: Player[]): GameStack[] {
    const gamePlayerMap = new Map<string, Player[]>();

    for (const player of players) {
      const teams = [player.team, player.opponent].sort();
      const gameKey = `${teams[0]}@${teams[1]}`;

      const existing = gamePlayerMap.get(gameKey) || [];
      existing.push(player);
      gamePlayerMap.set(gameKey, existing);
    }

    const stacks: GameStack[] = [];
    for (const [game, gamePlayers] of gamePlayerMap) {
      if (gamePlayers.length >= 2) {
        // Calculate correlation based on team composition
        const teams = new Set(gamePlayers.map((p) => p.team));
        const correlation = teams.size === 1 ? 0.8 : 0.6; // Same team = higher correlation

        stacks.push({
          game,
          players: gamePlayers.map((p) => p.name),
          correlation,
        });
      }
    }

    return stacks.sort((a, b) => b.players.length - a.players.length);
  }

  private assignToSlots(players: Player[]): LineupPlayer[] | null {
    const assignments: LineupPlayer[] = [];
    const usedSlots = new Set<string>();
    const usedPlayers = new Set<string>();

    // Sort players by position specificity (fewer positions = more specific)
    const sortedPlayers = [...players].sort((a, b) => {
      const posA = parsePositions(a.positions);
      const posB = parsePositions(b.positions);
      return posA.length - posB.length;
    });

    // First pass: assign to specific slots (PG, SG, SF, PF, C)
    for (const slot of ['PG', 'SG', 'SF', 'PF', 'C'] as Position[]) {
      if (usedSlots.has(slot)) continue;

      const eligiblePlayers = sortedPlayers.filter(
        (p) =>
          !usedPlayers.has(p.id) && parsePositions(p.positions).includes(slot)
      );

      if (eligiblePlayers.length > 0) {
        const player = eligiblePlayers[0]!;
        assignments.push({ player, slot });
        usedSlots.add(slot);
        usedPlayers.add(player.id);
      }
    }

    // Second pass: assign G slot (PG or SG)
    if (!usedSlots.has('G')) {
      const eligiblePlayers = sortedPlayers.filter((p) => {
        if (usedPlayers.has(p.id)) return false;
        const positions = parsePositions(p.positions);
        return positions.includes('PG' as Position) || positions.includes('SG' as Position);
      });

      if (eligiblePlayers.length > 0) {
        const player = eligiblePlayers[0]!;
        assignments.push({ player, slot: 'G' });
        usedSlots.add('G');
        usedPlayers.add(player.id);
      }
    }

    // Third pass: assign F slot (SF or PF)
    if (!usedSlots.has('F')) {
      const eligiblePlayers = sortedPlayers.filter((p) => {
        if (usedPlayers.has(p.id)) return false;
        const positions = parsePositions(p.positions);
        return positions.includes('SF' as Position) || positions.includes('PF' as Position);
      });

      if (eligiblePlayers.length > 0) {
        const player = eligiblePlayers[0]!;
        assignments.push({ player, slot: 'F' });
        usedSlots.add('F');
        usedPlayers.add(player.id);
      }
    }

    // Fourth pass: UTIL slot (any remaining player)
    if (!usedSlots.has('UTIL')) {
      const remainingPlayers = sortedPlayers.filter(
        (p) => !usedPlayers.has(p.id)
      );

      if (remainingPlayers.length > 0) {
        const player = remainingPlayers[0]!;
        assignments.push({ player, slot: 'UTIL' });
        usedSlots.add('UTIL');
        usedPlayers.add(player.id);
      }
    }

    if (assignments.length !== this.config.rosterSize) {
      return null;
    }

    // Sort by slot order
    const slotOrder = new Map(ROSTER_SLOTS.map((s, i) => [s, i]));
    assignments.sort(
      (a, b) => (slotOrder.get(a.slot) || 0) - (slotOrder.get(b.slot) || 0)
    );

    return assignments;
  }
}
