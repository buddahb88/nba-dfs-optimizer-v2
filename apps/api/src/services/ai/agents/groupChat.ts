// Group Chat Orchestrator - Manages multi-agent collaboration

import { PrismaClient } from '@nba-dfs/database';
import type { AIProvider, ChatMessage } from '../types.js';
import type {
  Agent,
  AgentContext,
  AgentRole,
  AgentSelection,
  GroupChatConfig,
  GroupChatMessage,
  GroupChatSession,
  AGENT_KEYWORDS,
} from './types.js';
import { ResearchAgent } from './researchAgent.js';
import { LineupBuilderAgent } from './lineupBuilderAgent.js';
import { StrategyAgent } from './strategyAgent.js';

const DEFAULT_CONFIG: GroupChatConfig = {
  maxRounds: 3,
  selectionMethod: 'auto',
  allowRevisit: true,
  timeoutMs: 30000,
};

export class GroupChatOrchestrator {
  private agents: Map<AgentRole, Agent>;
  private provider: AIProvider | null = null;
  private config: GroupChatConfig;
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient, config?: Partial<GroupChatConfig>) {
    this.prisma = prisma;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize agents
    this.agents = new Map();
    this.agents.set('research', new ResearchAgent(prisma));
    this.agents.set('lineup-builder', new LineupBuilderAgent(prisma));
    this.agents.set('strategy', new StrategyAgent(prisma));
  }

  /**
   * Initialize all agents with the AI provider
   */
  initialize(provider: AIProvider): void {
    this.provider = provider;

    const emptyContext: AgentContext = {
      conversationHistory: [],
      sharedMemory: new Map(),
    };

    for (const agent of this.agents.values()) {
      agent.initialize(provider, emptyContext);
    }
  }

  /**
   * Process a user message through the multi-agent system
   */
  async chat(
    userMessage: string,
    sessionOrHistory: GroupChatSession | ChatMessage[] = [],
    slateId?: string,
    mode?: 'CASH' | 'GPP'
  ): Promise<{
    response: string;
    agentUsed: AgentRole;
    session: GroupChatSession;
    toolsUsed: string[];
  }> {
    if (!this.provider) {
      throw new Error('Orchestrator not initialized. Call initialize() first.');
    }

    // Create or restore session
    const session = this.getOrCreateSession(sessionOrHistory, slateId, mode);

    // Add user message to session
    session.messages.push({
      id: `msg-${Date.now()}`,
      agentRole: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    // Select the best agent for this query
    const selection = this.selectAgent(userMessage, session);
    const agent = this.agents.get(selection.agent);

    if (!agent) {
      throw new Error(`Agent not found: ${selection.agent}`);
    }

    session.currentAgent = selection.agent;

    // Process through selected agent
    const response = await agent.process(userMessage, session.context);

    // Track tools used
    const toolsUsed = response.toolCalls?.map((tc) => tc.function.name) || [];

    // Add agent response to session
    session.messages.push({
      id: `msg-${Date.now()}-response`,
      agentRole: selection.agent,
      content: response.content,
      toolCalls: response.toolCalls,
      toolResults: response.toolResults,
      timestamp: new Date(),
    });

    // Handle potential handoff
    if (response.shouldHandoff && response.handoffTo && session.roundCount < this.config.maxRounds) {
      return this.handleHandoff(response.handoffTo, userMessage, session, toolsUsed);
    }

    // Update conversation history with proper tool message sequence
    session.context.conversationHistory.push({ role: 'user', content: userMessage });

    // Add assistant message
    session.context.conversationHistory.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // IMPORTANT: Add tool response messages for each tool call
    // OpenAI API requires tool responses to follow assistant messages with tool_calls
    if (response.toolCalls && response.toolResults) {
      for (const toolResult of response.toolResults) {
        session.context.conversationHistory.push({
          role: 'tool',
          content: toolResult.result,
          toolCallId: toolResult.toolCallId,
        });
      }
    }

    session.roundCount++;

    return {
      response: response.content,
      agentUsed: selection.agent,
      session,
      toolsUsed,
    };
  }

  /**
   * Select the best agent for a query
   */
  private selectAgent(query: string, session: GroupChatSession): AgentSelection {
    const scores: Array<{ agent: AgentRole; score: number; reason: string }> = [];

    // Get scores from each agent
    for (const [role, agent] of this.agents) {
      const result = agent.canHandle(query);
      scores.push({
        agent: role as AgentRole,
        score: result.score,
        reason: result.reason,
      });
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];

    // If no agents or no clear winner, default to research
    if (!best || best.score < 0.2) {
      return {
        agent: 'research',
        confidence: 0.5,
        reason: 'Default to research for general queries',
        suggestedTools: [],
      };
    }

    return {
      agent: best.agent,
      confidence: best.score,
      reason: best.reason,
      suggestedTools: [],
    };
  }

  /**
   * Handle handoff to another agent
   */
  private async handleHandoff(
    targetAgent: AgentRole,
    originalMessage: string,
    session: GroupChatSession,
    previousToolsUsed: string[]
  ): Promise<{
    response: string;
    agentUsed: AgentRole;
    session: GroupChatSession;
    toolsUsed: string[];
  }> {
    if (!this.config.allowRevisit && session.currentAgent === targetAgent) {
      // Can't revisit the same agent
      const lastMessage = session.messages[session.messages.length - 1];
      return {
        response: lastMessage?.content || '',
        agentUsed: session.currentAgent || 'research',
        session,
        toolsUsed: previousToolsUsed,
      };
    }

    session.roundCount++;
    session.currentAgent = targetAgent;

    const agent = this.agents.get(targetAgent);
    if (!agent) {
      throw new Error(`Handoff target agent not found: ${targetAgent}`);
    }

    // Add handoff context to the message
    const handoffMessage = `[Handed off from previous agent] ${originalMessage}`;

    const response = await agent.process(handoffMessage, session.context);

    const newToolsUsed = response.toolCalls?.map((tc) => tc.function.name) || [];
    const allToolsUsed = [...previousToolsUsed, ...newToolsUsed];

    // Add agent response to session
    session.messages.push({
      id: `msg-${Date.now()}-handoff`,
      agentRole: targetAgent,
      content: response.content,
      toolCalls: response.toolCalls,
      toolResults: response.toolResults,
      timestamp: new Date(),
    });

    // Update conversation history with proper tool message sequence
    session.context.conversationHistory.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // Add tool response messages for each tool call
    if (response.toolCalls && response.toolResults) {
      for (const toolResult of response.toolResults) {
        session.context.conversationHistory.push({
          role: 'tool',
          content: toolResult.result,
          toolCallId: toolResult.toolCallId,
        });
      }
    }

    // Check for further handoffs
    if (
      response.shouldHandoff &&
      response.handoffTo &&
      session.roundCount < this.config.maxRounds
    ) {
      return this.handleHandoff(response.handoffTo, originalMessage, session, allToolsUsed);
    }

    return {
      response: response.content,
      agentUsed: targetAgent,
      session,
      toolsUsed: allToolsUsed,
    };
  }

  /**
   * Get or create a session from history
   */
  private getOrCreateSession(
    sessionOrHistory: GroupChatSession | ChatMessage[],
    slateId?: string,
    mode?: 'CASH' | 'GPP'
  ): GroupChatSession {
    // If it's already a session, return it
    if ('id' in sessionOrHistory && 'messages' in sessionOrHistory) {
      // Update context if new slate/mode provided
      if (slateId) sessionOrHistory.context.slateId = slateId;
      if (mode) sessionOrHistory.context.mode = mode;
      return sessionOrHistory;
    }

    // Create new session from history
    const history = sessionOrHistory as ChatMessage[];

    return {
      id: `session-${Date.now()}`,
      messages: history.map((m, i) => ({
        id: `msg-${i}`,
        agentRole: m.role === 'user' ? 'user' : 'research', // Assume research for old messages
        content: m.content,
        toolCalls: m.toolCalls,
        timestamp: new Date(),
      })),
      context: {
        slateId,
        mode,
        conversationHistory: history,
        sharedMemory: new Map(),
      },
      currentAgent: null,
      roundCount: 0,
      isComplete: false,
    };
  }

  /**
   * Get list of available agents
   */
  getAvailableAgents(): Array<{
    role: AgentRole;
    name: string;
    description: string;
    capabilities: string[];
  }> {
    return Array.from(this.agents.entries()).map(([role, agent]) => ({
      role: role as AgentRole,
      name: agent.config.name,
      description: agent.config.description,
      capabilities: agent.config.capabilities.map((c) => c.toolName),
    }));
  }

  /**
   * Force selection of a specific agent (for testing)
   */
  async chatWithAgent(
    agentRole: AgentRole,
    userMessage: string,
    session?: GroupChatSession,
    slateId?: string,
    mode?: 'CASH' | 'GPP'
  ): Promise<{
    response: string;
    session: GroupChatSession;
    toolsUsed: string[];
  }> {
    if (!this.provider) {
      throw new Error('Orchestrator not initialized');
    }

    const agent = this.agents.get(agentRole);
    if (!agent) {
      throw new Error(`Agent not found: ${agentRole}`);
    }

    const currentSession = session || this.getOrCreateSession([], slateId, mode);

    currentSession.messages.push({
      id: `msg-${Date.now()}`,
      agentRole: 'user',
      content: userMessage,
      timestamp: new Date(),
    });

    currentSession.currentAgent = agentRole;

    const response = await agent.process(userMessage, currentSession.context);

    currentSession.messages.push({
      id: `msg-${Date.now()}-response`,
      agentRole,
      content: response.content,
      toolCalls: response.toolCalls,
      toolResults: response.toolResults,
      timestamp: new Date(),
    });

    // Update conversation history with proper tool message sequence
    currentSession.context.conversationHistory.push({ role: 'user', content: userMessage });

    currentSession.context.conversationHistory.push({
      role: 'assistant',
      content: response.content,
      toolCalls: response.toolCalls,
    });

    // Add tool response messages for each tool call
    if (response.toolCalls && response.toolResults) {
      for (const toolResult of response.toolResults) {
        currentSession.context.conversationHistory.push({
          role: 'tool',
          content: toolResult.result,
          toolCallId: toolResult.toolCallId,
        });
      }
    }

    return {
      response: response.content,
      session: currentSession,
      toolsUsed: response.toolCalls?.map((tc) => tc.function.name) || [],
    };
  }
}
