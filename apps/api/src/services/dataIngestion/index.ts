// Data Ingestion Services
// Responsible for fetching and importing data from external sources

export { DataIngestionService } from './dataIngestionService.js';
export { RotoWireParser } from './rotoWireParser.js';
export { HistoricalDataLoader } from './historicalDataLoader.js';
export { DefenseDataLoader } from './defenseDataLoader.js';

export type {
  RotoWirePlayer,
  RotoWireSlate,
  ParsedSlateData,
} from './rotoWireParser.js';

export type {
  HistoricalGameInput,
  BoxScoreData,
} from './historicalDataLoader.js';

export type {
  DefenseStats,
  DVPData,
} from './defenseDataLoader.js';
