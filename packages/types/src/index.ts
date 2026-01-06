// =============================================================================
// NBA DFS OPTIMIZER V2 - SHARED TYPES
// =============================================================================

// =============================================================================
// POSITION TYPES
// =============================================================================

export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C';
export type RosterSlot = Position | 'G' | 'F' | 'UTIL';
export type Confidence = 'LOW' | 'MEDIUM' | 'HIGH';
export type LineupMode = 'CASH' | 'GPP';
export type SlateStatus = 'PENDING' | 'ACTIVE' | 'LOCKED' | 'COMPLETED';

// =============================================================================
// PLAYER TYPES
// =============================================================================

export interface Player {
  id: string;
  externalId: string;
  slateId: string;
  name: string;
  team: string;
  opponent: string;
  positions: Position[];
  salary: number;
  projection: Projection;
  matchup: MatchupData;
  historical: HistoricalStats;
  metadata: PlayerMetadata;
}

export interface Projection {
  points: number;
  floor: number;
  ceiling: number;
  value: number;
  minutes: number | null;
  confidence: Confidence;
  adjustments: ProjectionAdjustments;
}

export interface ProjectionAdjustments {
  streak: number;
  usageBump: number;
  homeAway: number;
  backToBack: number;
  defense: number;
  dvp: number;
  pace: number;
  vegas: number;
  blowout: number;
  total: number;
}

export interface MatchupData {
  dvpPtsAllowed: number | null;
  oppDefEff: number | null;
  vegasImplied: number | null;
  vegasSpread: number | null;
  vegasTotal: number | null;
  oppPace: number | null;
}

export interface HistoricalStats {
  seasonAvg: number | null;
  last3Avg: number | null;
  last7Avg: number | null;
  gamesPlayed: number;
  stdDev: number | null;
  vsOppAvg: number | null;
  vsOppGames: number;
}

export interface PlayerMetadata {
  ownership: number | null;
  boomProbability: number | null;
  bustProbability: number | null;
  leverageScore: number | null;
  usageBumpReason: string | null;
  headshot: string | null;
}

// =============================================================================
// SLATE TYPES
// =============================================================================

export interface Slate {
  id: string;
  externalId: string;
  name: string;
  sport: string;
  startTime: Date | null;
  status: SlateStatus;
  playerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface SlateWithPlayers extends Slate {
  players: Player[];
}

// =============================================================================
// LINEUP TYPES
// =============================================================================

export interface Lineup {
  id: string;
  slateId: string;
  name: string;
  totalSalary: number;
  projectedPoints: number | null;
  mode: LineupMode;
  isOptimized: boolean;
  players: LineupPlayer[];
  actualPoints: number | null;
  createdAt: Date;
}

export interface LineupPlayer {
  id: string;
  playerId: string;
  slot: RosterSlot;
  player: Player;
}

export interface LineupSlot {
  slot: RosterSlot;
  player: Player | null;
}

// =============================================================================
// OPTIMIZER TYPES
// =============================================================================

export interface OptimizerConfig {
  salaryCap: number;
  rosterSize: number;
  positionRequirements: PositionRequirement[];
  mode: LineupMode;
  numLineups: number;
  stacking: StackingConfig;
  maxExposure: number;
  filters: PlayerFilters;
}

export interface PositionRequirement {
  position: RosterSlot;
  min: number;
  max: number;
}

export interface StackingConfig {
  enabled: boolean;
  minStack: number;
  maxStack: number;
  correlationBonus: number;
}

export interface PlayerFilters {
  minProjection: number | null;
  maxSalary: number | null;
  minSalary: number | null;
  positions: Position[] | null;
  teams: string[] | null;
  excludedPlayers: string[];
  lockedPlayers: string[];
}

export interface OptimizedLineup extends Lineup {
  exposures: Map<string, number>;
  stackInfo: StackInfo | null;
}

export interface StackInfo {
  gameId: string;
  teams: string[];
  playerCount: number;
}

// =============================================================================
// HISTORICAL & ANALYTICS TYPES
// =============================================================================

export interface HistoricalGame {
  id: string;
  playerName: string;
  playerId: string | null;
  team: string;
  opponent: string;
  gameDate: Date;
  season: string;
  isHome: boolean;
  stats: BoxScoreStats;
  dkFantasyPoints: number;
  restDays: number | null;
  isBackToBack: boolean;
}

export interface BoxScoreStats {
  minutes: number | null;
  points: number | null;
  rebounds: number | null;
  assists: number | null;
  steals: number | null;
  blocks: number | null;
  turnovers: number | null;
  plusMinus: number | null;
  fgMade: number | null;
  fgAttempted: number | null;
  fg3Made: number | null;
  fg3Attempted: number | null;
  ftMade: number | null;
  ftAttempted: number | null;
  usagePct: number | null;
}

export interface TeamDefense {
  id: string;
  team: string;
  defEff: number;
  offEff: number | null;
  pace: number | null;
  dvp: PositionDVP;
}

export interface PositionDVP {
  PG: number | null;
  SG: number | null;
  SF: number | null;
  PF: number | null;
  C: number | null;
}

// =============================================================================
// BACKTEST TYPES
// =============================================================================

export interface BacktestConfig {
  startDate: Date;
  endDate: Date;
  projectionMethod: string;
}

export interface BacktestResults {
  totalSlates: number;
  totalPlayers: number;
  meanError: number;
  meanAbsoluteError: number;
  rmse: number;
  r2: number | null;
  byConfidence: ConfidenceAccuracy;
  byPosition: Record<Position, number>;
  bySalaryTier: Record<string, number>;
}

export interface ConfidenceAccuracy {
  HIGH: AccuracyMetrics;
  MEDIUM: AccuracyMetrics;
  LOW: AccuracyMetrics;
}

export interface AccuracyMetrics {
  count: number;
  meanError: number;
  meanAbsError: number;
}

export interface SlateBacktestResult {
  date: Date;
  playerCount: number;
  meanError: number;
  meanAbsoluteError: number;
  byConfidence: ConfidenceAccuracy;
}

// =============================================================================
// CHAT & AI TYPES
// =============================================================================

export type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM' | 'TOOL';

export interface ChatSession {
  id: string;
  title: string | null;
  slateId: string | null;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls: ToolCall[] | null;
  toolResults: ToolResult[] | null;
  createdAt: Date;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  result: unknown;
  error: string | null;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  meta?: ApiMeta;
}

export interface ApiMeta {
  total?: number;
  page?: number;
  limit?: number;
  took?: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PlayerQueryParams extends PaginationParams {
  slateId: string;
  minProjection?: number;
  maxSalary?: number;
  minSalary?: number;
  positions?: Position[];
  teams?: string[];
  search?: string;
}

// =============================================================================
// USAGE BUMP TYPES
// =============================================================================

export interface UsageBumpCandidate {
  player: Player;
  missingTeammate: MissingTeammate;
  historicalBump: number;
  projectedBump: number;
  gamesWithout: number;
  gamesWith: number;
  confidence: Confidence;
}

export interface MissingTeammate {
  name: string;
  avgDkPts: number;
  avgUsagePct: number | null;
  position: Position;
}

// =============================================================================
// ROSTER CONTEXT TYPES
// =============================================================================

export interface RosterContext {
  slateDate: Date;
  teamRosters: Map<string, string[]>;
  historicalRosters: Map<string, TeamHistoricalRoster[]>;
}

export interface TeamHistoricalRoster {
  date: Date;
  players: string[];
}

// =============================================================================
// CONFIG TYPES
// =============================================================================

export interface ProjectionConfig {
  blendWeights: BlendWeights;
  adjustmentCaps: AdjustmentCaps;
  leagueAverages: LeagueAverages;
}

export interface BlendWeights {
  season: number;
  last3: number;
  matchup: number;
  expert: number;
}

export interface AdjustmentCaps {
  streak: number;
  usageBump: number;
  homeAway: number;
  total: number;
}

export interface LeagueAverages {
  defEff: number;
  pace: number;
  impliedTotal: number;
}
