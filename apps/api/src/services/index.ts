// Services Index
// Export all services for easy importing

export { OptimizerEngine } from './optimizerEngine.js';
export type {
  Player as OptimizerPlayer,
  Lineup,
  LineupPlayer,
  GameStack,
  OptimizerConfig,
  StackingConfig,
} from './optimizerEngine.js';

export { ProjectionEngine } from './projectionEngine.js';
export type {
  ProjectionConfig,
  PlayerInput,
  EnhancedProjection,
  ProjectionAdjustments,
} from './projectionEngine.js';

export { BacktestEngine } from './backtestEngine.js';
export type {
  BacktestConfig,
  BacktestResults,
  PlayerBacktestResult,
  DateBacktestResult,
} from './backtestEngine.js';

export {
  DataIngestionService,
  RotoWireParser,
  HistoricalDataLoader,
  DefenseDataLoader,
} from './dataIngestion/index.js';

export type {
  RotoWirePlayer,
  RotoWireSlate,
  ParsedSlateData,
} from './dataIngestion/index.js';

// AI Services
export {
  ChatService,
  PlaceholderProvider,
  ToolExecutor,
  DFS_TOOLS,
  DFS_SYSTEM_PROMPT,
} from './ai/index.js';

export type {
  ChatMessage,
  ToolCall,
  ToolResult,
  ToolDefinition,
  AIProvider,
  AgentResponse,
  ChatServiceConfig,
} from './ai/index.js';
