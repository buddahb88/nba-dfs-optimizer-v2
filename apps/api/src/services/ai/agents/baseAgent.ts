// Base Agent - Abstract base class for all specialized agents

import type {
  AIProvider,
  ChatMessage,
  ChatRequest,
  ToolDefinition,
} from '../types.js';
import { ToolExecutor } from '../toolExecutor.js';
import { PrismaClient } from '@nba-dfs/database';
import type {
  Agent,
  AgentConfig,
  AgentContext,
  AgentHandoffResponse,
  AgentRole,
  AGENT_KEYWORDS,
} from './types.js';

const MAX_TOOL_ITERATIONS = 5;

export abstract class BaseAgent implements Agent {
  abstract readonly config: AgentConfig;

  protected provider: AIProvider | null = null;
  protected toolExecutor: ToolExecutor;
  protected keywords: string[] = [];

  constructor(prisma: PrismaClient) {
    this.toolExecutor = new ToolExecutor(prisma);
  }

  initialize(provider: AIProvider, _context: AgentContext): void {
    this.provider = provider;
  }

  /**
   * Process a message - implements the agentic loop with tool calling
   */
  async process(message: string, context: AgentContext): Promise<AgentHandoffResponse> {
    if (!this.provider) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    // Build messages array with system prompt and history
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.getSystemPrompt(context),
      },
      ...context.conversationHistory,
      {
        role: 'user',
        content: message,
      },
    ];

    let iteration = 0;
    const allToolCalls: ChatMessage['toolCalls'] = [];
    const allToolResults: { toolCallId: string; result: string; isError?: boolean }[] = [];

    while (iteration < MAX_TOOL_ITERATIONS) {
      iteration++;

      const request: ChatRequest = {
        messages,
        tools: this.config.tools,
        temperature: 0.7,
        maxTokens: 4096,
      };

      const response = await this.provider.chat(request);

      // If no tool calls, analyze for handoff and return
      if (!response.toolCalls || response.toolCalls.length === 0) {
        const handoffAnalysis = this.analyzeForHandoff(response.content, context);

        return {
          content: response.content,
          toolCalls: allToolCalls.length > 0 ? [...allToolCalls] : undefined,
          toolResults: allToolResults.length > 0 ? [...allToolResults] : undefined,
          ...handoffAnalysis,
        };
      }

      // Execute tool calls
      const toolResults = await this.toolExecutor.executeAll(response.toolCalls);

      // Track all tool calls and results
      allToolCalls.push(...response.toolCalls);
      allToolResults.push(...toolResults);

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: response.content || '',
        toolCalls: response.toolCalls,
      });

      // Add tool results
      for (const result of toolResults) {
        messages.push({
          role: 'tool',
          content: result.result,
          toolCallId: result.toolCallId,
        });
      }
    }

    // Max iterations - return what we have
    const finalRequest: ChatRequest = {
      messages,
      tools: [], // No more tools
      temperature: 0.7,
      maxTokens: 4096,
    };

    const finalResponse = await this.provider.chat(finalRequest);
    const handoffAnalysis = this.analyzeForHandoff(finalResponse.content, context);

    return {
      content: finalResponse.content,
      toolCalls: allToolCalls.length > 0 ? [...allToolCalls] : undefined,
      toolResults: allToolResults.length > 0 ? [...allToolResults] : undefined,
      ...handoffAnalysis,
    };
  }

  /**
   * Check if this agent can handle a query based on keyword matching
   */
  canHandle(query: string): { score: number; reason: string } {
    const lowerQuery = query.toLowerCase();
    const words = lowerQuery.split(/\s+/);

    let matchCount = 0;
    const matchedKeywords: string[] = [];

    for (const keyword of this.keywords) {
      if (lowerQuery.includes(keyword)) {
        matchCount++;
        matchedKeywords.push(keyword);
      }
    }

    // Calculate score (0-1)
    const score = Math.min(matchCount / 3, 1); // 3+ keywords = max score

    return {
      score,
      reason:
        matchedKeywords.length > 0
          ? `Matched keywords: ${matchedKeywords.join(', ')}`
          : 'No keyword matches',
    };
  }

  /**
   * Get system prompt with context - can be overridden by subclasses
   */
  getSystemPrompt(context: AgentContext): string {
    let prompt = this.config.systemPrompt;

    if (context.slateId) {
      prompt += `\n\n## Current Context\n- Slate ID: ${context.slateId}`;
    }

    if (context.mode) {
      prompt += `\n- Mode: ${context.mode}`;
    }

    return prompt;
  }

  /**
   * Analyze response for potential handoff to another agent
   * Subclasses can override for custom logic
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

    // Check for explicit handoff indicators
    if (lowerContent.includes("i can't help with") || lowerContent.includes("outside my expertise")) {
      return {
        shouldHandoff: true,
        confidence: 0.3,
        handoffReason: 'Agent indicated inability to help',
      };
    }

    // Default: no handoff needed
    return {
      shouldHandoff: false,
      confidence: 0.8,
    };
  }

  /**
   * Filter tools to only those relevant to this agent
   */
  protected filterTools(allTools: ToolDefinition[]): ToolDefinition[] {
    const allowedToolNames = this.config.capabilities.map((c) => c.toolName);
    return allTools.filter((t) => allowedToolNames.includes(t.name));
  }
}
