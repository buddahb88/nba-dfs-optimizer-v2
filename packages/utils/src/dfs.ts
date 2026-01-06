// =============================================================================
// DFS-SPECIFIC UTILITIES
// =============================================================================

import type { BoxScoreStats, Position, RosterSlot } from '@nba-dfs/types';

/**
 * Calculate DraftKings fantasy points from box score stats
 */
export function calculateDkFantasyPoints(stats: Partial<BoxScoreStats>): number {
  const {
    points = 0,
    rebounds = 0,
    assists = 0,
    steals = 0,
    blocks = 0,
    turnovers = 0,
  } = stats;

  // DraftKings scoring
  let dkPts =
    (points ?? 0) * 1 +
    (rebounds ?? 0) * 1.25 +
    (assists ?? 0) * 1.5 +
    (steals ?? 0) * 2 +
    (blocks ?? 0) * 2 -
    (turnovers ?? 0) * 0.5;

  // Double-double bonus (+1.5)
  const statCategories = [
    points ?? 0 >= 10,
    rebounds ?? 0 >= 10,
    assists ?? 0 >= 10,
    steals ?? 0 >= 10,
    blocks ?? 0 >= 10,
  ];
  const doubleDigits = statCategories.filter(Boolean).length;

  if (doubleDigits >= 2) dkPts += 1.5;
  if (doubleDigits >= 3) dkPts += 1.5; // Triple-double adds another 1.5

  return Math.round(dkPts * 10) / 10;
}

/**
 * Calculate value (pts per $1000 salary)
 */
export function calculateValue(
  projectedPoints: number,
  salary: number
): number {
  if (salary === 0) return 0;
  return Math.round((projectedPoints / (salary / 1000)) * 100) / 100;
}

/**
 * Calculate leverage score (boom potential vs ownership)
 */
export function calculateLeverageScore(
  ceiling: number,
  ownership: number,
  avgCeiling: number
): number {
  if (ownership <= 0 || avgCeiling <= 0) return 0;
  const ceilingMultiple = ceiling / avgCeiling;
  const ownershipPenalty = Math.max(1, ownership / 10);
  return Math.round((ceilingMultiple / ownershipPenalty) * 100) / 100;
}

/**
 * Parse position string to array (e.g., "PG/SG" -> ["PG", "SG"])
 */
export function parsePositions(positionString: string): Position[] {
  return positionString
    .split(/[,\/]/)
    .map((p) => p.trim().toUpperCase())
    .filter((p): p is Position =>
      ['PG', 'SG', 'SF', 'PF', 'C'].includes(p)
    );
}

/**
 * Check if a position can fill a roster slot
 */
export function canFillSlot(positions: Position[], slot: RosterSlot): boolean {
  switch (slot) {
    case 'PG':
      return positions.includes('PG');
    case 'SG':
      return positions.includes('SG');
    case 'SF':
      return positions.includes('SF');
    case 'PF':
      return positions.includes('PF');
    case 'C':
      return positions.includes('C');
    case 'G':
      return positions.includes('PG') || positions.includes('SG');
    case 'F':
      return positions.includes('SF') || positions.includes('PF');
    case 'UTIL':
      return true;
    default:
      return false;
  }
}

/**
 * Get all eligible slots for a set of positions
 */
export function getEligibleSlots(positions: Position[]): RosterSlot[] {
  const slots: RosterSlot[] = [];

  if (positions.includes('PG')) slots.push('PG', 'G');
  if (positions.includes('SG')) slots.push('SG', 'G');
  if (positions.includes('SF')) slots.push('SF', 'F');
  if (positions.includes('PF')) slots.push('PF', 'F');
  if (positions.includes('C')) slots.push('C');

  slots.push('UTIL');

  // Remove duplicates
  return [...new Set(slots)];
}

/**
 * DraftKings NBA roster configuration
 */
export const DK_NBA_CONFIG = {
  salaryCap: 50000,
  rosterSize: 8,
  slots: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'] as RosterSlot[],
  positionRequirements: [
    { position: 'PG' as RosterSlot, min: 1, max: 1 },
    { position: 'SG' as RosterSlot, min: 1, max: 1 },
    { position: 'SF' as RosterSlot, min: 1, max: 1 },
    { position: 'PF' as RosterSlot, min: 1, max: 1 },
    { position: 'C' as RosterSlot, min: 1, max: 1 },
    { position: 'G' as RosterSlot, min: 1, max: 1 },
    { position: 'F' as RosterSlot, min: 1, max: 1 },
    { position: 'UTIL' as RosterSlot, min: 1, max: 1 },
  ],
} as const;

/**
 * Validate a lineup's salary and roster composition
 */
export function validateLineup(
  players: Array<{ salary: number; positions: Position[] }>,
  assignedSlots: RosterSlot[]
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check roster size
  if (players.length !== DK_NBA_CONFIG.rosterSize) {
    errors.push(
      `Invalid roster size: ${players.length} (expected ${DK_NBA_CONFIG.rosterSize})`
    );
  }

  // Check salary cap
  const totalSalary = players.reduce((sum, p) => sum + p.salary, 0);
  if (totalSalary > DK_NBA_CONFIG.salaryCap) {
    errors.push(
      `Salary cap exceeded: $${totalSalary} (cap: $${DK_NBA_CONFIG.salaryCap})`
    );
  }

  // Check position eligibility
  for (let i = 0; i < players.length; i++) {
    const player = players[i];
    const slot = assignedSlots[i];
    if (player && slot && !canFillSlot(player.positions, slot)) {
      errors.push(`Player ${i + 1} cannot fill slot ${slot}`);
    }
  }

  // Check for duplicate slots
  const slotCounts = new Map<RosterSlot, number>();
  for (const slot of assignedSlots) {
    slotCounts.set(slot, (slotCounts.get(slot) || 0) + 1);
  }
  for (const [slot, count] of slotCounts) {
    if (count > 1) {
      errors.push(`Duplicate slot: ${slot} used ${count} times`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate game ID from teams (for stacking)
 */
export function generateGameId(team1: string, team2: string): string {
  const sorted = [team1, team2].sort();
  return `${sorted[0]}_${sorted[1]}`;
}

/**
 * Calculate rest days between dates
 */
export function calculateRestDays(
  currentDate: Date,
  previousDate: Date
): number {
  const diffTime = currentDate.getTime() - previousDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays - 1); // Days between games, not including game days
}

/**
 * Check if a game is back-to-back
 */
export function isBackToBack(currentDate: Date, previousDate: Date): boolean {
  return calculateRestDays(currentDate, previousDate) === 0;
}
