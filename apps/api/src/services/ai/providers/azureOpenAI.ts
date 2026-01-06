// Azure OpenAI Provider - Connects to Azure OpenAI GPT models

import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  ChatMessage,
  ToolCall,
  ToolDefinition,
} from '../types.js';

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deployment: string;
  apiVersion: string;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OpenAIChatResponse {
  id: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenAIToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class AzureOpenAIProvider implements AIProvider {
  private endpoint: string;
  private apiKey: string;
  private deployment: string;
  private apiVersion: string;

  constructor(config: AzureOpenAIConfig) {
    this.endpoint = config.endpoint.replace(/\/$/, ''); // Remove trailing slash
    this.apiKey = config.apiKey;
    this.deployment = config.deployment;
    this.apiVersion = config.apiVersion;
  }

  getName(): string {
    return `azure-openai:${this.deployment}`;
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;

    const body: Record<string, unknown> = {
      messages: this.convertMessages(request.messages),
      max_completion_tokens: request.maxTokens ?? 4096,
    };

    // Only add temperature if model supports it (some newer models don't)
    // Skip for models that error with temperature parameter
    if (request.temperature !== undefined && !this.deployment.includes('5.2')) {
      body.temperature = request.temperature;
    }

    // Add tools if provided
    if (request.tools && request.tools.length > 0) {
      body.tools = this.convertTools(request.tools);
      body.tool_choice = 'auto';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as OpenAIChatResponse;

    return this.convertResponse(data);
  }

  /**
   * Convert internal message format to OpenAI format
   */
  private convertMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map((msg) => {
      const openAIMsg: OpenAIMessage = {
        role: msg.role,
        content: msg.content,
      };

      // Add tool calls for assistant messages
      if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
        openAIMsg.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function',
          function: {
            name: tc.function.name,
            arguments: tc.function.arguments,
          },
        }));
        // OpenAI expects null content when there are tool calls
        if (!msg.content) {
          openAIMsg.content = null;
        }
      }

      // Add tool_call_id for tool response messages
      if (msg.role === 'tool' && msg.toolCallId) {
        openAIMsg.tool_call_id = msg.toolCallId;
      }

      return openAIMsg;
    });
  }

  /**
   * Convert internal tool format to OpenAI function format
   */
  private convertTools(tools: ToolDefinition[]): OpenAITool[] {
    return tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: 'object',
          properties: tool.parameters.properties,
          required: tool.parameters.required,
        },
      },
    }));
  }

  /**
   * Convert OpenAI response to internal format
   */
  private convertResponse(response: OpenAIChatResponse): ChatResponse {
    const choice = response.choices[0];

    if (!choice) {
      throw new Error('No response choice from Azure OpenAI');
    }

    const result: ChatResponse = {
      content: choice.message.content || '',
      finishReason: this.mapFinishReason(choice.finish_reason),
      usage: {
        promptTokens: response.usage.prompt_tokens,
        completionTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
    };

    // Convert tool calls if present
    if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      result.toolCalls = choice.message.tool_calls.map((tc): ToolCall => ({
        id: tc.id,
        type: 'function',
        function: {
          name: tc.function.name,
          arguments: tc.function.arguments,
        },
      }));
    }

    return result;
  }

  /**
   * Map OpenAI finish reason to internal format
   */
  private mapFinishReason(reason: string): 'stop' | 'tool_calls' | 'length' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'tool_calls':
        return 'tool_calls';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'error';
      default:
        return 'stop';
    }
  }
}
