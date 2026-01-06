// Frontend Types for NBA DFS Optimizer

// Slate types
export interface Slate {
  id: string;
  externalId: string;
  name: string;
  startTime: string | null;
  status: 'PENDING' | 'ACTIVE' | 'LOCKED' | 'COMPLETED';
  createdAt: string;
  updatedAt: string;
  playerCount?: number;
  lineupCount?: number;
}

// Player types
export interface Player {
  id: string;
  externalId: string;
  slateId: string;
  name: string;
  team: string;
  opponent: string;
  positions: string;
  salary: number;
  projectedPoints: number | null;
  projectedMinutes: number | null;
  floor: number | null;
  ceiling: number | null;
  value: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  dvpPtsAllowed: number | null;
  oppDefEff: number | null;
  vegasImplied: number | null;
  vegasSpread: number | null;
  vegasTotal: number | null;
  usageBump: number | null;
  boomProbability: number | null;
  bustProbability: number | null;
  leverageScore: number | null;
  ownership: number | null;
}

// Lineup types
export interface LineupPlayer {
  player: Player;
  slot: string;
}

export interface GameStack {
  game: string;
  players: string[];
  correlation: number;
}

export interface Lineup {
  id?: string;
  name?: string;
  players: LineupPlayer[];
  totalSalary: number;
  projectedPoints: number;
  ceiling: number;
  ownership: number;
  gameStacks: GameStack[];
}

export interface SavedLineup extends Lineup {
  id: string;
  slateId: string;
  name: string;
  mode: 'CASH' | 'GPP';
  isOptimized: boolean;
  actualPoints: number | null;
  createdAt: string;
}

// Optimizer types
export interface OptimizerConfig {
  slateId: string;
  mode: 'CASH' | 'GPP';
  numLineups: number;
  maxExposure: number;
  minExposure: number;
  enableStacking: boolean;
  minStack: number;
  maxStack: number;
  lockedPlayers: string[];
  excludedPlayers: string[];
  diversityFactor: number;
}

export interface ExposureStat {
  playerId: string;
  playerName: string;
  count: number;
  percentage: number;
}

export interface OptimizeResult {
  lineups: Lineup[];
  exposureStats: ExposureStat[];
  meta: {
    count: number;
    mode: string;
    slateId: string;
    stackingEnabled: boolean;
  };
}

// Chat types
export interface ChatSession {
  id: string;
  name: string;
  slateId: string | null;
  createdAt: string;
  updatedAt: string;
  messageCount?: number;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls: string | null;
  metadata: string | null;
  createdAt: string;
}

export interface ChatResponse {
  userMessage: ChatMessage;
  assistantMessage: ChatMessage;
  toolsUsed: string[];
}

// Historical types
export interface HistoricalGame {
  id: string;
  playerName: string;
  team: string;
  opponent: string;
  gameDate: string;
  season: string;
  isHome: boolean;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  dkFantasyPoints: number;
}

export interface PlayerStats {
  playerName: string;
  gamesPlayed: number;
  seasonAvg: number;
  last10Avg: number | null;
  last5Avg: number | null;
  last3Avg: number | null;
  stdDev: number | null;
  floor: number;
  ceiling: number;
}

export interface TeamDefense {
  id: string;
  team: string;
  defEff: number;
  offEff: number | null;
  pace: number | null;
  dvpPg: number | null;
  dvpSg: number | null;
  dvpSf: number | null;
  dvpPf: number | null;
  dvpC: number | null;
}

// Backtest types
export interface BacktestSummary {
  totalPlayers: number;
  totalDates: number;
  meanError: number;
  meanAbsoluteError: number;
  rootMeanSquareError: number;
  hitRate: number;
  floorHitRate: number;
  ceilingHitRate: number;
  correlationCoefficient: number;
}

export interface BacktestResult {
  summary: BacktestSummary;
  byConfidence: {
    high: { mae: number; hitRate: number; count: number };
    medium: { mae: number; hitRate: number; count: number };
    low: { mae: number; hitRate: number; count: number };
  };
  bySalaryRange: Record<string, { mae: number; hitRate: number; count: number }>;
  dailyResults: Array<{
    date: string;
    playerCount: number;
    meanAbsoluteError: number;
    hitRate: number;
  }>;
}

// Filter types
export interface PlayerFilters {
  minProjection: number | null;
  maxSalary: number | null;
  minSalary: number | null;
  positions: string[];
  teams: string[];
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// API response wrapper
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
