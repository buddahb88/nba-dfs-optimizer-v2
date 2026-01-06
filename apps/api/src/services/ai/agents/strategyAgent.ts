// Strategy Agent - Specialized in GPP tournament strategy and game theory

import { PrismaClient } from '@nba-dfs/database';
import { BaseAgent } from './baseAgent.js';
import { AGENT_KEYWORDS, type AgentConfig, type AgentRole, type AgentContext } from './types.js';
import { DFS_TOOLS } from '../tools.js';

const STRATEGY_SYSTEM_PROMPT = `You are a GPP Strategy Specialist for NBA DFS tournaments. Your expertise includes:

## Your Role
- Tournament strategy and game theory
- Identifying leverage opportunities
- Analyzing ownership projections
- Game stacking for correlation
- Differentiating lineups from the field
- Backtesting and historical analysis

## Tools Available
1. **find_stacking_targets** - Find optimal game stacks
2. **get_player_projections** - Check ownership projections
3. **get_game_environment** - Identify high-scoring game environments
4. **run_backtest** - Validate strategies with historical data

## Key Strategy Concepts

### Leverage
- **Formula**: (Boom% - Ownership%) = Leverage
- **Positive leverage**: Player booms more than owned
- **Target**: Players with leverage > 5%

### Game Stacking
- 2-3 players from same game correlate well
- Stack the side you think will shoot more
- Bring-back: Add player from other team
- Target games with highest totals (225+)

### Ownership Buckets
- **Chalk** (>20%): Must hit to cash but limits upside
- **Moderate** (8-20%): Balanced risk/reward
- **Low** (<8%): Differentiators if they hit
- **Contrarian** (<3%): High risk, GPP winners

### Tournament Types
- **Single Entry**: Can be more balanced
- **3-Max**: Vary cores, similar values
- **20-Max/150-Max**: Need unique builds

## When to Hand Off
- If user needs specific player data → hand off to Research Agent
- If user wants to build lineups → hand off to Lineup Builder
- Stay focused on strategy and game theory

Provide strategic advice that helps users differentiate and win tournaments.`;

const STRATEGY_TOOLS = [
  'find_stacking_targets',
  'get_player_projections',
  'get_game_environment',
  'run_backtest',
];

export class StrategyAgent extends BaseAgent {
  readonly config: AgentConfig;

  constructor(prisma: PrismaClient) {
    super(prisma);

    this.keywords = AGENT_KEYWORDS.strategy;

    // Filter tools to strategy-related ones
    const tools = DFS_TOOLS.filter((t) => STRATEGY_TOOLS.includes(t.name));

    this.config = {
      role: 'strategy',
      name: 'Strategy Specialist',
      description: 'Expert in GPP tournament strategy, game stacking, and leverage plays',
      systemPrompt: STRATEGY_SYSTEM_PROMPT,
      capabilities: tools.map((t) => ({
        toolName: t.name,
        description: t.description,
      })),
      tools,
    };
  }

  /**
   * Override system prompt for strategy context
   */
  getSystemPrompt(context: AgentContext): string {
    let prompt = super.getSystemPrompt(context);

    if (context.mode === 'CASH') {
      prompt += `

## Note: CASH Mode Active
While you're a GPP specialist, the user is in CASH mode. Adjust advice:
- Focus on floor over leverage
- Minimize variance
- Suggest switching to GPP for tournament-specific strategies`;
    }

    return prompt;
  }

  /**
   * Override handoff analysis for strategy-specific patterns
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
      lowerContent.includes('specific player') ||
      lowerContent.includes('matchup') ||
      lowerContent.includes('projection') ||
      lowerContent.includes('historical stats')
    ) {
      return {
        shouldHandoff: true,
        handoffTo: 'research',
        handoffReason: 'User needs specific player research',
        confidence: 0.7,
      };
    }

    // Check for lineup building needs
    if (
      lowerContent.includes('build lineup') ||
      lowerContent.includes('generate') ||
      lowerContent.includes('create lineup') ||
      lowerContent.includes('lock player')
    ) {
      return {
        shouldHandoff: true,
        handoffTo: 'lineup-builder',
        handoffReason: 'User wants to build lineups',
        confidence: 0.7,
      };
    }

    // Confident we can handle strategy questions
    return {
      shouldHandoff: false,
      confidence: 0.85,
    };
  }
}
