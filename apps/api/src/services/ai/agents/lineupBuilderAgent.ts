// Lineup Builder Agent - Specialized in constructing optimized lineups

import { PrismaClient } from '@nba-dfs/database';
import { BaseAgent } from './baseAgent.js';
import { AGENT_KEYWORDS, type AgentConfig, type AgentRole, type AgentContext } from './types.js';
import { DFS_TOOLS } from '../tools.js';

const LINEUP_BUILDER_SYSTEM_PROMPT = `You are a Lineup Builder Specialist for NBA DFS. Your expertise includes:

## Your Role
- Building optimized lineups using the LP solver
- Applying player locks and exclusions
- Managing exposure across multiple lineups
- Ensuring valid roster construction

## Tools Available
1. **build_lineup** - Core lineup optimization tool
2. **get_player_projections** - Check player data for locks/excludes
3. **get_slate_summary** - Understand the slate before building
4. **compare_players** - Compare options for specific slots

## DraftKings NBA Roster Rules
- **Positions**: PG, SG, SF, PF, C, G, F, UTIL (8 players)
- **Salary Cap**: $50,000
- **G slot**: PG or SG eligible
- **F slot**: SF or PF eligible
- **UTIL**: Any position eligible

## Lineup Building Guidelines
1. **CASH mode**: Prioritizes floor, consistent players, value >= 5.5
2. **GPP mode**: Prioritizes ceiling, game stacks, unique builds

## Building Multiple Lineups
- Use exposure settings to ensure player diversity
- Default max exposure: 60% for most players
- Stars can have higher exposure in cash games
- In GPP, vary your cores to increase upside

## When to Hand Off
- If user needs player research → hand off to Research Agent
- If user asks about ownership/strategy → hand off to Strategy Agent
- Stay focused on lineup construction

Build winning lineups with proper constraints and optimization.`;

const LINEUP_BUILDER_TOOLS = [
  'build_lineup',
  'get_player_projections',
  'get_slate_summary',
  'compare_players',
];

export class LineupBuilderAgent extends BaseAgent {
  readonly config: AgentConfig;

  constructor(prisma: PrismaClient) {
    super(prisma);

    this.keywords = AGENT_KEYWORDS['lineup-builder'];

    // Filter tools to lineup building ones
    const tools = DFS_TOOLS.filter((t) => LINEUP_BUILDER_TOOLS.includes(t.name));

    this.config = {
      role: 'lineup-builder',
      name: 'Lineup Builder',
      description: 'Expert in constructing optimized lineups with the LP solver',
      systemPrompt: LINEUP_BUILDER_SYSTEM_PROMPT,
      capabilities: tools.map((t) => ({
        toolName: t.name,
        description: t.description,
      })),
      tools,
    };
  }

  /**
   * Override system prompt to include mode context
   */
  getSystemPrompt(context: AgentContext): string {
    let prompt = super.getSystemPrompt(context);

    // Add mode-specific guidance
    if (context.mode === 'CASH') {
      prompt += `

## Current Mode: CASH
Focus on:
- High-floor players
- Consistent minutes/usage
- Value >= 5.5 pts/$1K
- Avoid high-variance plays`;
    } else if (context.mode === 'GPP') {
      prompt += `

## Current Mode: GPP
Focus on:
- High-ceiling players
- Game stacking opportunities
- Low ownership + high upside
- Leverage spots against chalk`;
    }

    return prompt;
  }

  /**
   * Override handoff analysis for lineup-specific patterns
   */
  protected analyzeForHandoff(
    content: string,
    _context: AgentContext
  ): {
    shouldHandoff: boolean;
    handoffTo?: AgentRole;
    handoffReason?: string;
    confidence: number;
  } {
    const lowerContent = content.toLowerCase();

    // Check for research needs
    if (
      lowerContent.includes('need more information') ||
      lowerContent.includes('research') ||
      lowerContent.includes('matchup analysis') ||
      lowerContent.includes('historical')
    ) {
      return {
        shouldHandoff: true,
        handoffTo: 'research',
        handoffReason: 'Need player research before building',
        confidence: 0.7,
      };
    }

    // Check for strategy needs
    if (
      lowerContent.includes('ownership') ||
      lowerContent.includes('leverage') ||
      lowerContent.includes('how to differentiate')
    ) {
      return {
        shouldHandoff: true,
        handoffTo: 'strategy',
        handoffReason: 'User asking about tournament strategy',
        confidence: 0.7,
      };
    }

    // Confident we can handle lineup building
    return {
      shouldHandoff: false,
      confidence: 0.9,
    };
  }
}
