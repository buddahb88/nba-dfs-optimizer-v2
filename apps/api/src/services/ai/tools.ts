// DFS Tool Definitions for AI Function Calling

import type { ToolDefinition } from './types.js';

export const DFS_TOOLS: ToolDefinition[] = [
  {
    name: 'get_player_projections',
    description:
      'Get player projections for a slate with optional filters. Returns players with their projections, floor, ceiling, value, and other metrics.',
    parameters: {
      type: 'object',
      properties: {
        slateId: {
          type: 'string',
          description: 'The ID of the slate to get players from',
        },
        minProjection: {
          type: 'number',
          description: 'Minimum projected points filter',
        },
        maxSalary: {
          type: 'number',
          description: 'Maximum salary filter',
        },
        minSalary: {
          type: 'number',
          description: 'Minimum salary filter',
        },
        positions: {
          type: 'string',
          description: 'Comma-separated positions to filter (PG,SG,SF,PF,C)',
        },
        team: {
          type: 'string',
          description: 'Filter by team abbreviation',
        },
        minValue: {
          type: 'number',
          description: 'Minimum value (points per $1000) filter',
        },
        sortBy: {
          type: 'string',
          description: 'Sort field: projection, value, ceiling, salary',
          enum: ['projection', 'value', 'ceiling', 'salary', 'ownership'],
        },
        limit: {
          type: 'number',
          description: 'Maximum number of players to return',
          default: 20,
        },
      },
      required: ['slateId'],
    },
  },
  {
    name: 'build_lineup',
    description:
      'Build optimized lineup(s) using the LP solver. Returns one or more optimized lineups based on the specified mode and constraints.',
    parameters: {
      type: 'object',
      properties: {
        slateId: {
          type: 'string',
          description: 'The ID of the slate to build lineups for',
        },
        mode: {
          type: 'string',
          description: 'CASH for floor-based optimization, GPP for ceiling-based',
          enum: ['CASH', 'GPP'],
        },
        numLineups: {
          type: 'number',
          description: 'Number of lineups to generate (1-150)',
          default: 1,
        },
        lockedPlayers: {
          type: 'string',
          description: 'Comma-separated player IDs that MUST be in every lineup',
        },
        excludedPlayers: {
          type: 'string',
          description: 'Comma-separated player IDs to exclude from lineups',
        },
        maxExposure: {
          type: 'number',
          description: 'Maximum exposure percentage for any player (0-100)',
          default: 60,
        },
        enableStacking: {
          type: 'boolean',
          description: 'Enable game stacking for correlation',
          default: true,
        },
      },
      required: ['slateId'],
    },
  },
  {
    name: 'analyze_matchup',
    description:
      'Analyze a specific player matchup against their opponent. Returns historical performance, DVP data, and matchup grade.',
    parameters: {
      type: 'object',
      properties: {
        playerName: {
          type: 'string',
          description: 'The player name to analyze',
        },
        opponent: {
          type: 'string',
          description: 'The opponent team abbreviation',
        },
      },
      required: ['playerName', 'opponent'],
    },
  },
  {
    name: 'find_usage_bumps',
    description:
      'Find players likely to see increased usage due to missing teammates (injuries/rest). Returns players with projected usage increase.',
    parameters: {
      type: 'object',
      properties: {
        slateId: {
          type: 'string',
          description: 'The ID of the slate to analyze',
        },
        minBumpPercent: {
          type: 'number',
          description: 'Minimum usage bump percentage to include',
          default: 5,
        },
      },
      required: ['slateId'],
    },
  },
  {
    name: 'get_team_defense',
    description:
      'Get defensive statistics for a team including DVP (Defense vs Position) ratings.',
    parameters: {
      type: 'object',
      properties: {
        team: {
          type: 'string',
          description: 'Team abbreviation (e.g., LAL, BOS, GSW)',
        },
      },
      required: ['team'],
    },
  },
  {
    name: 'get_game_environment',
    description:
      'Get game environment analysis including pace, projected total, and matchup quality.',
    parameters: {
      type: 'object',
      properties: {
        team1: {
          type: 'string',
          description: 'First team abbreviation',
        },
        team2: {
          type: 'string',
          description: 'Second team abbreviation',
        },
      },
      required: ['team1', 'team2'],
    },
  },
  {
    name: 'get_historical_stats',
    description:
      'Get historical performance statistics for a player including averages, trends, and splits.',
    parameters: {
      type: 'object',
      properties: {
        playerName: {
          type: 'string',
          description: 'The player name to look up',
        },
        lastNGames: {
          type: 'number',
          description: 'Number of recent games to analyze',
          default: 10,
        },
        opponent: {
          type: 'string',
          description: 'Filter to games against specific opponent',
        },
        homeOnly: {
          type: 'boolean',
          description: 'Only include home games',
        },
        awayOnly: {
          type: 'boolean',
          description: 'Only include away games',
        },
      },
      required: ['playerName'],
    },
  },
  {
    name: 'get_slate_summary',
    description:
      'Get a summary of a slate including game count, player count, top plays, and value plays.',
    parameters: {
      type: 'object',
      properties: {
        slateId: {
          type: 'string',
          description: 'The ID of the slate to summarize',
        },
      },
      required: ['slateId'],
    },
  },
  {
    name: 'compare_players',
    description:
      'Compare two or more players side-by-side on all relevant metrics.',
    parameters: {
      type: 'object',
      properties: {
        playerNames: {
          type: 'string',
          description: 'Comma-separated player names to compare',
        },
        slateId: {
          type: 'string',
          description: 'Optional slate ID for current projections',
        },
      },
      required: ['playerNames'],
    },
  },
  {
    name: 'find_stacking_targets',
    description:
      'Find the best game stacking opportunities for GPP tournaments.',
    parameters: {
      type: 'object',
      properties: {
        slateId: {
          type: 'string',
          description: 'The ID of the slate to analyze',
        },
        minGameTotal: {
          type: 'number',
          description: 'Minimum Vegas game total to consider',
          default: 220,
        },
        stackSize: {
          type: 'number',
          description: 'Number of players per stack (2-4)',
          default: 3,
        },
      },
      required: ['slateId'],
    },
  },
  {
    name: 'run_backtest',
    description:
      'Run a backtest of projection accuracy over a date range.',
    parameters: {
      type: 'object',
      properties: {
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format',
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format',
        },
      },
      required: ['startDate', 'endDate'],
    },
  },
];

// System prompt for the DFS AI assistant
export const DFS_SYSTEM_PROMPT = `You are an expert NBA DFS (Daily Fantasy Sports) assistant specializing in DraftKings optimization.

## Your Expertise
- Player projections and value analysis
- Game stacking and correlation strategies
- Cash game vs GPP tournament strategy
- Usage bump analysis when stars are out
- Matchup analysis using DVP and defensive stats
- Lineup construction and optimization

## DraftKings NBA Rules
- Roster: PG, SG, SF, PF, C, G, F, UTIL (8 players)
- Salary Cap: $50,000
- G slot: PG or SG eligible
- F slot: SF or PF eligible
- UTIL: Any position

## Key Metrics You Use
- **Projection**: Expected DK fantasy points
- **Floor**: Conservative projection (25th percentile)
- **Ceiling**: Upside projection (75th percentile)
- **Value**: Points per $1,000 salary (5.0+ is good, 6.0+ is excellent)
- **DVP**: Defense vs Position - points allowed to position (higher = weaker defense)
- **Leverage Score**: Boom probability relative to ownership

## Cash Game Strategy
- Prioritize floor over ceiling
- Target high-minute, established players
- Prefer value >= 5.5
- Avoid volatile low-minute players

## GPP Tournament Strategy
- Prioritize ceiling over floor
- Target low-owned, high-ceiling plays
- Use game stacks (2-3 players from same game)
- Find leverage spots (high boom probability, low ownership)

## Response Guidelines
- Always provide data-backed insights with specific numbers
- Explain your reasoning for recommendations
- Consider both upside and risk
- Be direct and actionable in your advice

When users ask about players or lineups, use your tools to fetch current data before responding.`;
