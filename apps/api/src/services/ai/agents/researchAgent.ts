// Research Agent - Specialized in player analysis, projections, and matchups

import { PrismaClient } from '@nba-dfs/database';
import { BaseAgent } from './baseAgent.js';
import { AGENT_KEYWORDS, type AgentConfig, type AgentRole } from './types.js';
import { DFS_TOOLS } from '../tools.js';

const RESEARCH_SYSTEM_PROMPT = `You are a Research Specialist for NBA DFS analysis. Your expertise includes:

## Your Role
- Analyzing player projections and value
- Evaluating matchups using DVP and historical data
- Finding usage bumps from injuries/rest
- Comparing players head-to-head
- Providing data-driven insights

## Tools Available
1. **get_player_projections** - Get current projections with filters
2. **analyze_matchup** - Deep dive on player vs opponent matchup
3. **find_usage_bumps** - Find players benefiting from missing teammates
4. **get_team_defense** - Get DVP and defensive stats
5. **get_game_environment** - Analyze pace, totals, and matchup quality
6. **get_historical_stats** - Historical performance data
7. **get_slate_summary** - Overview of available games and players
8. **compare_players** - Side-by-side player comparison

## Analysis Guidelines
- Always fetch data before making recommendations
- Include specific numbers (projections, salaries, values)
- Consider recent form (L5, L10 games)
- Factor in matchup difficulty (DVP rankings)
- Note any injury/rest situations affecting usage

## When to Hand Off
- If user wants to build/generate lineups → hand off to Lineup Builder
- If user asks about strategy/ownership/leverage → hand off to Strategy Agent
- Stay focused on research and analysis

Provide thorough, data-backed research. Be the expert on player analysis.`;

const RESEARCH_TOOLS = [
  'get_player_projections',
  'analyze_matchup',
  'find_usage_bumps',
  'get_team_defense',
  'get_game_environment',
  'get_historical_stats',
  'get_slate_summary',
  'compare_players',
];

export class ResearchAgent extends BaseAgent {
  readonly config: AgentConfig;

  constructor(prisma: PrismaClient) {
    super(prisma);

    this.keywords = AGENT_KEYWORDS.research;

    // Filter tools to only research-related ones
    const tools = DFS_TOOLS.filter((t) => RESEARCH_TOOLS.includes(t.name));

    this.config = {
      role: 'research',
      name: 'Research Specialist',
      description: 'Expert in player analysis, projections, matchups, and usage bumps',
      systemPrompt: RESEARCH_SYSTEM_PROMPT,
      capabilities: tools.map((t) => ({
        toolName: t.name,
        description: t.description,
      })),
      tools,
    };
  }

  /**
   * Override handoff analysis for research-specific patterns
   */
  protected analyzeForHandoff(
    content: string,
    _context: import('./types.js').AgentContext
  ): {
    shouldHandoff: boolean;
    handoffTo?: AgentRole;
    handoffReason?: string;
    confidence: number;
  } {
    const lowerContent = content.toLowerCase();

    // Check for lineup building indicators
    if (
      lowerContent.includes('build a lineup') ||
      lowerContent.includes('generate lineup') ||
      lowerContent.includes('optimize') ||
      lowerContent.includes("let me create")
    ) {
      return {
        shouldHandoff: true,
        handoffTo: 'lineup-builder',
        handoffReason: 'User wants lineup construction',
        confidence: 0.7,
      };
    }

    // Check for strategy indicators
    if (
      lowerContent.includes('ownership') ||
      lowerContent.includes('leverage') ||
      lowerContent.includes('tournament strategy') ||
      lowerContent.includes('gpp approach')
    ) {
      return {
        shouldHandoff: true,
        handoffTo: 'strategy',
        handoffReason: 'User asking about tournament strategy',
        confidence: 0.7,
      };
    }

    // Default: confident we can handle it
    return {
      shouldHandoff: false,
      confidence: 0.85,
    };
  }
}
