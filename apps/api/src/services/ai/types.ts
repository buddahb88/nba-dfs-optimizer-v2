// AI Service Types

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolResult {
  toolCallId: string;
  result: string;
  isError?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required?: string[];
  };
}

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  items?: { type: string };
  default?: unknown;
}

export interface ChatRequest {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_calls' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface AIProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  getName(): string;
}

// DFS-specific types
export interface DFSContext {
  slateId?: string;
  mode?: 'CASH' | 'GPP';
  playerPool?: string[];
  lockedPlayers?: string[];
  excludedPlayers?: string[];
}

export interface AgentResponse {
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  context?: DFSContext;
  metadata?: Record<string, unknown>;
}
