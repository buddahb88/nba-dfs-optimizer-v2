// Agent Types for Multi-Agent System

import type {
  AIProvider,
  ChatMessage,
  ToolCall,
  ToolResult,
  ToolDefinition,
  DFSContext,
} from '../types.js';

/**
 * Agent role in the group chat
 */
export type AgentRole = 'research' | 'lineup-builder' | 'strategy' | 'orchestrator';

/**
 * Agent capability - tools the agent can use
 */
export interface AgentCapability {
  toolName: string;
  description: string;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  role: AgentRole;
  name: string;
  description: string;
  systemPrompt: string;
  capabilities: AgentCapability[];
  tools: ToolDefinition[];
}

/**
 * Agent context during conversation
 */
export interface AgentContext {
  slateId?: string;
  mode?: 'CASH' | 'GPP';
  conversationHistory: ChatMessage[];
  sharedMemory: Map<string, unknown>;
  dfsContext?: DFSContext;
}

/**
 * Agent response with handoff support
 */
export interface AgentHandoffResponse {
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  shouldHandoff: boolean;
  handoffTo?: AgentRole;
  handoffReason?: string;
  confidence: number; // 0-1 confidence in completing the task
}

/**
 * Message in the group chat
 */
export interface GroupChatMessage {
  id: string;
  agentRole: AgentRole | 'user';
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  timestamp: Date;
}

/**
 * Group chat configuration
 */
export interface GroupChatConfig {
  maxRounds: number;
  selectionMethod: 'auto' | 'round-robin' | 'keyword';
  allowRevisit: boolean;
  timeoutMs: number;
}

/**
 * Group chat session
 */
export interface GroupChatSession {
  id: string;
  messages: GroupChatMessage[];
  context: AgentContext;
  currentAgent: AgentRole | null;
  roundCount: number;
  isComplete: boolean;
}

/**
 * Agent interface - all agents must implement this
 */
export interface Agent {
  readonly config: AgentConfig;

  /**
   * Initialize the agent with a provider
   */
  initialize(provider: AIProvider, context: AgentContext): void;

  /**
   * Process a message and return a response
   */
  process(message: string, context: AgentContext): Promise<AgentHandoffResponse>;

  /**
   * Check if this agent can handle a given query
   */
  canHandle(query: string): { score: number; reason: string };

  /**
   * Get the agent's system prompt with context
   */
  getSystemPrompt(context: AgentContext): string;
}

/**
 * Query analysis result for agent selection
 */
export interface QueryAnalysis {
  intent: 'research' | 'build' | 'strategy' | 'general';
  entities: {
    players?: string[];
    teams?: string[];
    slateId?: string;
    mode?: 'CASH' | 'GPP';
  };
  complexity: 'simple' | 'moderate' | 'complex';
  requiredTools: string[];
}

/**
 * Agent selection result
 */
export interface AgentSelection {
  agent: AgentRole;
  confidence: number;
  reason: string;
  suggestedTools: string[];
}

/**
 * Keyword patterns for agent selection
 */
export interface AgentKeywordPatterns {
  research: string[];
  'lineup-builder': string[];
  strategy: string[];
}

export const AGENT_KEYWORDS: AgentKeywordPatterns = {
  research: [
    'projection',
    'projections',
    'who',
    'player',
    'players',
    'matchup',
    'defense',
    'dvp',
    'historical',
    'stats',
    'compare',
    'comparison',
    'usage',
    'bump',
    'injury',
    'news',
    'outlook',
    'value',
    'values',
    'slate',
    'games',
    'environment',
    'pace',
    'total',
    'spread',
  ],
  'lineup-builder': [
    'lineup',
    'lineups',
    'build',
    'create',
    'optimize',
    'optimized',
    'generate',
    'make',
    'roster',
    'lock',
    'exclude',
    'exposure',
    'flex',
  ],
  strategy: [
    'strategy',
    'gpp',
    'tournament',
    'cash',
    'stack',
    'stacking',
    'correlation',
    'leverage',
    'ownership',
    'contrarian',
    'chalk',
    'pivot',
    'differentiate',
    'tournament',
    'approach',
    'how should',
  ],
};
