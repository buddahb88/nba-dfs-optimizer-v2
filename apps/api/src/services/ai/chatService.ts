// AI Chat Service - Handles conversation with tool calling

import { PrismaClient } from '@nba-dfs/database';
import type {
  ChatMessage,
  ChatRequest,
  ChatResponse,
  ToolCall,
  ToolResult,
  AIProvider,
  AgentResponse,
} from './types.js';
import { DFS_TOOLS, DFS_SYSTEM_PROMPT } from './tools.js';
import { ToolExecutor } from './toolExecutor.js';

// Maximum iterations for tool calling loop
const MAX_TOOL_ITERATIONS = 5;

export interface ChatServiceConfig {
  provider: AIProvider;
  maxIterations?: number;
  temperature?: number;
  maxTokens?: number;
}

export class ChatService {
  private provider: AIProvider;
  private toolExecutor: ToolExecutor;
  private maxIterations: number;
  private temperature: number;
  private maxTokens: number;

  constructor(prisma: PrismaClient, config: ChatServiceConfig) {
    this.provider = config.provider;
    this.toolExecutor = new ToolExecutor(prisma);
    this.maxIterations = config.maxIterations || MAX_TOOL_ITERATIONS;
    this.temperature = config.temperature || 0.7;
    this.maxTokens = config.maxTokens || 4096;
  }

  /**
   * Process a user message and return the AI response
   * Handles multi-turn tool calling automatically
   */
  async chat(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    slateId?: string
  ): Promise<AgentResponse> {
    // Build messages array with system prompt
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: this.buildSystemPrompt(slateId),
      },
      ...conversationHistory,
      {
        role: 'user',
        content: userMessage,
      },
    ];

    let iteration = 0;
    const allToolCalls: ToolCall[] = [];
    const allToolResults: ToolResult[] = [];

    while (iteration < this.maxIterations) {
      iteration++;

      // Call the AI
      const response = await this.provider.chat({
        messages,
        tools: DFS_TOOLS,
        temperature: this.temperature,
        maxTokens: this.maxTokens,
      });

      // If no tool calls, we're done
      if (!response.toolCalls || response.toolCalls.length === 0) {
        return {
          content: response.content,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
          toolResults: allToolResults.length > 0 ? allToolResults : undefined,
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

    // Max iterations reached - return what we have
    const finalResponse = await this.provider.chat({
      messages,
      tools: [], // No more tools
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    return {
      content: finalResponse.content,
      toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
      toolResults: allToolResults.length > 0 ? allToolResults : undefined,
      metadata: { maxIterationsReached: true },
    };
  }

  /**
   * Build system prompt with optional slate context
   */
  private buildSystemPrompt(slateId?: string): string {
    let prompt = DFS_SYSTEM_PROMPT;

    if (slateId) {
      prompt += `\n\n## Current Context\nYou are analyzing slate ID: ${slateId}. Use this ID when calling tools that require a slateId parameter.`;
    }

    return prompt;
  }

  /**
   * Stream a response (for real-time UI updates)
   */
  async *chatStream(
    userMessage: string,
    conversationHistory: ChatMessage[] = [],
    slateId?: string
  ): AsyncGenerator<{
    type: 'text' | 'tool_start' | 'tool_result' | 'done';
    content?: string;
    toolCall?: ToolCall;
    toolResult?: ToolResult;
  }> {
    // For now, yield the full response
    // In the future, this can be enhanced to stream tokens
    const response = await this.chat(userMessage, conversationHistory, slateId);

    // Yield tool calls and results if any
    if (response.toolCalls && response.toolResults) {
      for (let i = 0; i < response.toolCalls.length; i++) {
        yield { type: 'tool_start', toolCall: response.toolCalls[i] };
        if (response.toolResults[i]) {
          yield { type: 'tool_result', toolResult: response.toolResults[i] };
        }
      }
    }

    // Yield final text
    yield { type: 'text', content: response.content };
    yield { type: 'done' };
  }
}

// Placeholder AI Provider for development/testing
export class PlaceholderProvider implements AIProvider {
  getName(): string {
    return 'placeholder';
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const lastMessage = request.messages[request.messages.length - 1];

    if (!lastMessage) {
      return {
        content: 'No messages provided.',
        finishReason: 'stop',
      };
    }

    // Check if this is a tool result message
    if (lastMessage.role === 'tool') {
      // Generate response based on tool results
      return {
        content: this.generateToolResponse(request.messages),
        finishReason: 'stop',
      };
    }

    // Check if user is asking about specific topics
    const userMessage = lastMessage.content.toLowerCase();

    // If tools available and message suggests tool use needed
    if (request.tools && request.tools.length > 0) {
      const toolCall = this.suggestTool(userMessage, request.tools);
      if (toolCall) {
        return {
          content: '',
          toolCalls: [toolCall],
          finishReason: 'tool_calls',
        };
      }
    }

    // Default response
    return {
      content: this.generateDefaultResponse(userMessage),
      finishReason: 'stop',
    };
  }

  private suggestTool(
    message: string,
    tools: { name: string }[]
  ): ToolCall | null {
    // Simple keyword matching to suggest tools
    const toolNames = tools.map((t) => t.name);

    if (
      (message.includes('player') || message.includes('projection')) &&
      toolNames.includes('get_player_projections')
    ) {
      // This is a placeholder - real implementation would need a slateId
      return null;
    }

    if (
      (message.includes('lineup') || message.includes('optimize')) &&
      toolNames.includes('build_lineup')
    ) {
      return null;
    }

    return null;
  }

  private generateToolResponse(messages: ChatMessage[]): string {
    // Find tool results in messages
    const toolResults = messages
      .filter((m) => m.role === 'tool')
      .map((m) => m.content);

    if (toolResults.length === 0) {
      return 'No tool results available.';
    }

    return `Based on the data I retrieved:\n\n${toolResults.join('\n\n')}\n\nNote: This is a placeholder response. Connect an AI provider (Azure OpenAI, Anthropic, etc.) for intelligent analysis.`;
  }

  private generateDefaultResponse(message: string): string {
    if (message.includes('hello') || message.includes('hi')) {
      return "Hello! I'm your NBA DFS assistant. I can help you analyze players, build lineups, find value plays, and develop winning strategies. What would you like to know?";
    }

    return `I understand you're asking about: "${message}"\n\nTo provide accurate DFS analysis, I need to be connected to an AI provider. Currently running in placeholder mode.\n\nAvailable capabilities:\n- Player projections and analysis\n- Lineup optimization (Cash & GPP)\n- Matchup analysis\n- Usage bump detection\n- Game stacking recommendations\n- Historical backtesting`;
  }
}
