// =============================================================================
// VALIDATION UTILITIES
// =============================================================================

import type { Position } from '@nba-dfs/types';

/**
 * Validate NBA team abbreviation
 */
const NBA_TEAMS = [
  'ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW',
  'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK',
  'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'
] as const;

export type NBATeam = (typeof NBA_TEAMS)[number];

export function isValidTeam(team: string): team is NBATeam {
  return NBA_TEAMS.includes(team.toUpperCase() as NBATeam);
}

/**
 * Validate position
 */
const VALID_POSITIONS: Position[] = ['PG', 'SG', 'SF', 'PF', 'C'];

export function isValidPosition(position: string): position is Position {
  return VALID_POSITIONS.includes(position.toUpperCase() as Position);
}

/**
 * Validate salary range
 */
export function isValidSalary(salary: number): boolean {
  return salary >= 3000 && salary <= 20000;
}

/**
 * Validate projection range
 */
export function isValidProjection(projection: number): boolean {
  return projection >= 0 && projection <= 100;
}

/**
 * Validate confidence level
 */
export function isValidConfidence(
  confidence: string
): confidence is 'LOW' | 'MEDIUM' | 'HIGH' {
  return ['LOW', 'MEDIUM', 'HIGH'].includes(confidence.toUpperCase());
}

/**
 * Validate date string (YYYY-MM-DD)
 */
export function isValidDateString(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Validate slate external ID (DraftKings format)
 */
export function isValidSlateId(slateId: string): boolean {
  // DK slate IDs are typically numeric
  return /^\d+$/.test(slateId);
}

/**
 * Sanitize player name for matching
 */
export function normalizePlayerName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z\s]/g, '') // Remove non-alpha
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Sanitize team abbreviation
 */
export function normalizeTeam(team: string): string {
  const normalized = team.toUpperCase().trim();

  // Common aliases
  const aliases: Record<string, string> = {
    'PHO': 'PHX',
    'SA': 'SAS',
    'NO': 'NOP',
    'NY': 'NYK',
    'GS': 'GSW',
    'BK': 'BKN',
    'BKLYN': 'BKN',
    'UTAH': 'UTA',
  };

  return aliases[normalized] || normalized;
}

/**
 * Validate CSV file structure for slate import
 */
export interface SlateCSVRow {
  Name: string;
  Position: string;
  Salary: string;
  TeamAbbrev: string;
  Game?: string;
  AvgPointsPerGame?: string;
}

export function validateSlateCSV(
  rows: Record<string, string>[]
): { valid: boolean; errors: string[]; validRows: SlateCSVRow[] } {
  const errors: string[] = [];
  const validRows: SlateCSVRow[] = [];

  const requiredColumns = ['Name', 'Position', 'Salary', 'TeamAbbrev'];

  if (rows.length === 0) {
    errors.push('CSV file is empty');
    return { valid: false, errors, validRows };
  }

  // Check required columns
  const firstRow = rows[0];
  if (firstRow) {
    for (const col of requiredColumns) {
      if (!(col in firstRow)) {
        errors.push(`Missing required column: ${col}`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, validRows };
  }

  // Validate each row
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const rowErrors: string[] = [];

    if (!row['Name'] || row['Name'].trim() === '') {
      rowErrors.push('Missing player name');
    }

    const salary = parseInt(row['Salary'] || '0', 10);
    if (isNaN(salary) || !isValidSalary(salary)) {
      rowErrors.push(`Invalid salary: ${row['Salary']}`);
    }

    const team = normalizeTeam(row['TeamAbbrev'] || '');
    if (!isValidTeam(team)) {
      rowErrors.push(`Invalid team: ${row['TeamAbbrev']}`);
    }

    if (rowErrors.length > 0) {
      errors.push(`Row ${i + 1}: ${rowErrors.join(', ')}`);
    } else {
      validRows.push(row as unknown as SlateCSVRow);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    validRows,
  };
}
