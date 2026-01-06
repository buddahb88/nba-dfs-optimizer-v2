// AI Services Index

export * from './types.js';
export * from './tools.js';
export { ToolExecutor } from './toolExecutor.js';
export { ChatService, PlaceholderProvider } from './chatService.js';
export type { ChatServiceConfig } from './chatService.js';

// AI Providers
export {
  createAIProvider,
  isAIConfigured,
  getProviderStatus,
  AzureOpenAIProvider,
} from './providers/index.js';
export type { AIProviderConfig, AIProviderType, AzureOpenAIConfig } from './providers/index.js';

// Multi-Agent System
export {
  BaseAgent,
  ResearchAgent,
  LineupBuilderAgent,
  StrategyAgent,
  GroupChatOrchestrator,
  AGENT_KEYWORDS,
} from './agents/index.js';
export type {
  Agent,
  AgentConfig,
  AgentContext,
  AgentRole,
  AgentHandoffResponse,
  GroupChatConfig,
  GroupChatSession,
  GroupChatMessage,
} from './agents/index.js';
