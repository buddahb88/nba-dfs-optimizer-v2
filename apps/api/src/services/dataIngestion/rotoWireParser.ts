/**
 * RotoWire Data Parser
 * Parses CSV exports from RotoWire/DraftKings
 */

export interface RotoWirePlayer {
  externalId: string;
  name: string;
  team: string;
  opponent: string;
  positions: string[];
  salary: number;
  projectedPoints: number | null;
  ownership: number | null;
  gameInfo: string | null;
}

export interface RotoWireSlate {
  id: string;
  name: string;
  sport: string;
  startTime: Date | null;
}

export interface ParsedSlateData {
  success: boolean;
  players?: RotoWirePlayer[];
  slate?: RotoWireSlate;
  errors?: string[];
}

// Standard DraftKings CSV headers
const EXPECTED_HEADERS = [
  'Name',
  'Position',
  'Salary',
  'TeamAbbrev',
  'Game Info',
];

export class RotoWireParser {
  /**
   * Parse DraftKings/RotoWire CSV content
   */
  parseCSV(csvContent: string): ParsedSlateData {
    const errors: string[] = [];
    const players: RotoWirePlayer[] = [];

    try {
      const lines = csvContent
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) {
        return {
          success: false,
          errors: ['CSV file is empty or has no data rows'],
        };
      }

      // Parse header row
      const headerLine = lines[0];
      if (!headerLine) {
        return {
          success: false,
          errors: ['CSV file has no header row'],
        };
      }
      const headers = this.parseCSVLine(headerLine);
      const headerMap = new Map<string, number>();
      headers.forEach((h, i) => headerMap.set(h.toLowerCase(), i));

      // Validate required headers
      const missingHeaders = EXPECTED_HEADERS.filter(
        (h) => !headerMap.has(h.toLowerCase())
      );
      if (missingHeaders.length > 0) {
        return {
          success: false,
          errors: [`Missing required headers: ${missingHeaders.join(', ')}`],
        };
      }

      // Parse data rows
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;
        const values = this.parseCSVLine(line);

        if (values.length < headers.length) {
          errors.push(`Row ${i + 1}: Incomplete data`);
          continue;
        }

        try {
          const player = this.parsePlayerRow(values, headerMap, i);
          if (player) {
            players.push(player);
          }
        } catch (err) {
          errors.push(`Row ${i + 1}: ${err}`);
        }
      }

      if (players.length === 0) {
        return {
          success: false,
          errors: errors.length > 0 ? errors : ['No valid players found'],
        };
      }

      return {
        success: true,
        players,
        errors: errors.length > 0 ? errors : undefined,
      };
    } catch (err) {
      return {
        success: false,
        errors: [`Parse error: ${err}`],
      };
    }
  }

  /**
   * Parse a single CSV line, handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    values.push(current.trim());
    return values;
  }

  /**
   * Parse a single player row
   */
  private parsePlayerRow(
    values: string[],
    headerMap: Map<string, number>,
    rowIndex: number
  ): RotoWirePlayer | null {
    const get = (header: string): string => {
      const idx = headerMap.get(header.toLowerCase());
      return idx !== undefined ? values[idx] || '' : '';
    };

    const name = get('Name');
    const positionStr = get('Position');
    const salaryStr = get('Salary');
    const team = get('TeamAbbrev');
    const gameInfo = get('Game Info');

    // Validate required fields
    if (!name || !positionStr || !salaryStr || !team) {
      throw new Error('Missing required fields');
    }

    // Parse salary
    const salary = parseInt(salaryStr.replace(/[^0-9]/g, ''), 10);
    if (isNaN(salary) || salary <= 0) {
      throw new Error(`Invalid salary: ${salaryStr}`);
    }

    // Parse positions
    const positions = this.parsePositions(positionStr);

    // Extract opponent from game info
    const opponent = this.extractOpponent(gameInfo, team);

    // Parse optional fields
    const projectedPoints = this.parseFloat(get('AvgPointsPerGame') || get('Projection'));
    const ownership = this.parseFloat(get('Ownership') || get('Projected Ownership'));

    // Generate external ID (DraftKings player ID or name-based)
    const externalId = get('ID') || get('Player ID') || this.generateId(name, team);

    return {
      externalId,
      name,
      team: team.toUpperCase(),
      opponent: opponent.toUpperCase(),
      positions,
      salary,
      projectedPoints,
      ownership,
      gameInfo,
    };
  }

  /**
   * Parse position string into array
   */
  private parsePositions(posStr: string): string[] {
    return posStr
      .split('/')
      .map((p) => p.trim().toUpperCase())
      .filter((p) => ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'].includes(p));
  }

  /**
   * Extract opponent team from game info
   * Game info format: "TOR@MIA 07:00PM ET" or "TOR vs MIA"
   */
  private extractOpponent(gameInfo: string | null, team: string): string {
    if (!gameInfo) return 'UNK';

    // Try to match "TEAM@TEAM" or "TEAM vs TEAM" pattern
    const matchAt = gameInfo.match(/([A-Z]{2,3})@([A-Z]{2,3})/i);
    const matchVs = gameInfo.match(/([A-Z]{2,3})\s*vs?\s*([A-Z]{2,3})/i);

    const match = matchAt || matchVs;
    if (match && match[1] && match[2]) {
      const team1 = match[1].toUpperCase();
      const team2 = match[2].toUpperCase();
      return team1 === team.toUpperCase() ? team2 : team1;
    }

    return 'UNK';
  }

  /**
   * Safely parse float value
   */
  private parseFloat(value: string | undefined): number | null {
    if (!value) return null;
    const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
    return isNaN(num) ? null : num;
  }

  /**
   * Generate a deterministic ID from name and team
   */
  private generateId(name: string, team: string): string {
    const normalized = `${name.toLowerCase().replace(/[^a-z]/g, '')}_${team.toLowerCase()}`;
    return normalized;
  }

  /**
   * Parse Vegas lines from supplementary data
   */
  parseVegasLines(
    data: Array<{ team: string; opponent: string; total: number; spread: number }>
  ): Map<string, { total: number; spread: number; implied: number }> {
    const vegasMap = new Map();

    for (const game of data) {
      // Home team implied = (total + spread) / 2
      // Away team implied = (total - spread) / 2
      const homeImplied = (game.total - game.spread) / 2;
      const awayImplied = (game.total + game.spread) / 2;

      vegasMap.set(game.team, {
        total: game.total,
        spread: game.spread,
        implied: homeImplied,
      });

      vegasMap.set(game.opponent, {
        total: game.total,
        spread: -game.spread,
        implied: awayImplied,
      });
    }

    return vegasMap;
  }

  /**
   * Merge Vegas data into player projections
   */
  enrichWithVegas(
    players: RotoWirePlayer[],
    vegasData: Map<string, { total: number; spread: number; implied: number }>
  ): RotoWirePlayer[] {
    return players.map((player) => {
      const vegas = vegasData.get(player.team);
      if (vegas) {
        return {
          ...player,
          // Vegas data would be stored in rawData or separate fields
        };
      }
      return player;
    });
  }
}
