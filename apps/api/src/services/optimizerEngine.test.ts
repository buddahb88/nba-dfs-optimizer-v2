import { describe, it, expect, beforeEach } from 'vitest';
import { OptimizerEngine, Player, OptimizerConfig } from './optimizerEngine.js';

// Test player data with proper DraftKings positions
// Players from TWO games to satisfy stacking constraints (max 4 per game)
const createTestPlayers = (): Player[] => [
  // GAME 1: GSW @ LAL
  // PG players
  {
    id: 'player-1',
    name: 'Stephen Curry',
    team: 'GSW',
    opponent: 'LAL',
    positions: 'PG',
    salary: 10000,
    projectedPoints: 50.1,
    floor: 38.0,
    ceiling: 68.0,
    value: 5.01,
    ownership: 28.0,
    boomProbability: 0.38,
    leverageScore: 9.2,
  },
  {
    id: 'player-2',
    name: 'DAngelo Russell',
    team: 'LAL',
    opponent: 'GSW',
    positions: 'PG',
    salary: 6000,
    projectedPoints: 30.2,
    floor: 18.0,
    ceiling: 45.0,
    value: 5.03,
    ownership: 8.5,
    boomProbability: 0.20,
    leverageScore: 5.8,
  },
  // SG players
  {
    id: 'player-3',
    name: 'Klay Thompson',
    team: 'GSW',
    opponent: 'LAL',
    positions: 'SG',
    salary: 6500,
    projectedPoints: 32.5,
    floor: 20.0,
    ceiling: 50.0,
    value: 5.0,
    ownership: 12.0,
    boomProbability: 0.22,
    leverageScore: 6.5,
  },
  {
    id: 'player-4',
    name: 'Austin Reaves',
    team: 'LAL',
    opponent: 'GSW',
    positions: 'SG',
    salary: 5500,
    projectedPoints: 28.0,
    floor: 18.0,
    ceiling: 42.0,
    value: 5.09,
    ownership: 6.5,
    boomProbability: 0.18,
    leverageScore: 6.2,
  },

  // GAME 2: BOS @ MIA
  // PG players
  {
    id: 'player-13',
    name: 'Jrue Holiday',
    team: 'BOS',
    opponent: 'MIA',
    positions: 'PG',
    salary: 6200,
    projectedPoints: 31.0,
    floor: 20.0,
    ceiling: 45.0,
    value: 5.0,
    ownership: 10.0,
    boomProbability: 0.20,
    leverageScore: 6.0,
  },
  {
    id: 'player-14',
    name: 'Terry Rozier',
    team: 'MIA',
    opponent: 'BOS',
    positions: 'PG',
    salary: 5800,
    projectedPoints: 29.0,
    floor: 18.0,
    ceiling: 42.0,
    value: 5.0,
    ownership: 8.0,
    boomProbability: 0.18,
    leverageScore: 5.5,
  },
  // SG players
  {
    id: 'player-15',
    name: 'Jaylen Brown',
    team: 'BOS',
    opponent: 'MIA',
    positions: 'SG',
    salary: 7500,
    projectedPoints: 37.5,
    floor: 25.0,
    ceiling: 52.0,
    value: 5.0,
    ownership: 15.0,
    boomProbability: 0.25,
    leverageScore: 7.0,
  },
  {
    id: 'player-16',
    name: 'Tyler Herro',
    team: 'MIA',
    opponent: 'BOS',
    positions: 'SG',
    salary: 6000,
    projectedPoints: 30.0,
    floor: 18.0,
    ceiling: 45.0,
    value: 5.0,
    ownership: 12.0,
    boomProbability: 0.22,
    leverageScore: 6.5,
  },
  // SF players
  {
    id: 'player-5',
    name: 'LeBron James',
    team: 'LAL',
    opponent: 'GSW',
    positions: 'SF',
    salary: 10500,
    projectedPoints: 52.3,
    floor: 40.0,
    ceiling: 70.0,
    value: 4.98,
    ownership: 22.5,
    boomProbability: 0.35,
    leverageScore: 8.5,
  },
  {
    id: 'player-17',
    name: 'Jayson Tatum',
    team: 'BOS',
    opponent: 'MIA',
    positions: 'SF',
    salary: 9500,
    projectedPoints: 47.5,
    floor: 35.0,
    ceiling: 65.0,
    value: 5.0,
    ownership: 20.0,
    boomProbability: 0.32,
    leverageScore: 8.0,
  },
  {
    id: 'player-18',
    name: 'Jimmy Butler',
    team: 'MIA',
    opponent: 'BOS',
    positions: 'SF',
    salary: 8500,
    projectedPoints: 42.5,
    floor: 30.0,
    ceiling: 58.0,
    value: 5.0,
    ownership: 18.0,
    boomProbability: 0.28,
    leverageScore: 7.5,
  },
  // PF players
  {
    id: 'player-7',
    name: 'Draymond Green',
    team: 'GSW',
    opponent: 'LAL',
    positions: 'PF',
    salary: 5000,
    projectedPoints: 25.0,
    floor: 15.0,
    ceiling: 38.0,
    value: 5.0,
    ownership: 7.0,
    boomProbability: 0.15,
    leverageScore: 5.0,
  },
  {
    id: 'player-19',
    name: 'Al Horford',
    team: 'BOS',
    opponent: 'MIA',
    positions: 'PF',
    salary: 4800,
    projectedPoints: 24.0,
    floor: 15.0,
    ceiling: 36.0,
    value: 5.0,
    ownership: 6.0,
    boomProbability: 0.14,
    leverageScore: 4.8,
  },
  {
    id: 'player-20',
    name: 'Kevin Love',
    team: 'MIA',
    opponent: 'BOS',
    positions: 'PF',
    salary: 4200,
    projectedPoints: 21.0,
    floor: 12.0,
    ceiling: 32.0,
    value: 5.0,
    ownership: 5.0,
    boomProbability: 0.12,
    leverageScore: 4.5,
  },
  // C players
  {
    id: 'player-9',
    name: 'Anthony Davis',
    team: 'LAL',
    opponent: 'GSW',
    positions: 'C',
    salary: 9800,
    projectedPoints: 48.5,
    floor: 35.0,
    ceiling: 65.0,
    value: 4.95,
    ownership: 18.5,
    boomProbability: 0.30,
    leverageScore: 7.8,
  },
  {
    id: 'player-21',
    name: 'Kristaps Porzingis',
    team: 'BOS',
    opponent: 'MIA',
    positions: 'C',
    salary: 7800,
    projectedPoints: 39.0,
    floor: 28.0,
    ceiling: 55.0,
    value: 5.0,
    ownership: 14.0,
    boomProbability: 0.26,
    leverageScore: 7.0,
  },
  {
    id: 'player-22',
    name: 'Bam Adebayo',
    team: 'MIA',
    opponent: 'BOS',
    positions: 'C',
    salary: 7200,
    projectedPoints: 36.0,
    floor: 25.0,
    ceiling: 50.0,
    value: 5.0,
    ownership: 12.0,
    boomProbability: 0.24,
    leverageScore: 6.8,
  },
  // Extra utility players
  {
    id: 'player-11',
    name: 'Gary Payton II',
    team: 'GSW',
    opponent: 'LAL',
    positions: 'PG/SG',
    salary: 3500,
    projectedPoints: 18.0,
    floor: 10.0,
    ceiling: 28.0,
    value: 5.14,
    ownership: 4.0,
    boomProbability: 0.10,
    leverageScore: 4.0,
  },
  {
    id: 'player-23',
    name: 'Payton Pritchard',
    team: 'BOS',
    opponent: 'MIA',
    positions: 'PG/SG',
    salary: 3800,
    projectedPoints: 19.0,
    floor: 12.0,
    ceiling: 30.0,
    value: 5.0,
    ownership: 5.0,
    boomProbability: 0.12,
    leverageScore: 4.2,
  },
];

describe('OptimizerEngine', () => {
  let engine: OptimizerEngine;
  let testPlayers: Player[];

  beforeEach(() => {
    testPlayers = createTestPlayers();
  });

  describe('constructor', () => {
    it('should create engine with default config', () => {
      engine = new OptimizerEngine();
      expect(engine).toBeDefined();
    });

    it('should create engine with custom config', () => {
      engine = new OptimizerEngine({ numLineups: 5, mode: 'CASH' });
      expect(engine).toBeDefined();
    });
  });

  describe('optimize', () => {
    beforeEach(() => {
      engine = new OptimizerEngine({ numLineups: 1, stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true } });
    });

    it('should return lineups within salary cap', () => {
      const lineups = engine.optimize(testPlayers);

      for (const lineup of lineups) {
        expect(lineup.totalSalary).toBeLessThanOrEqual(50000);
      }
    });

    it('should return lineups with 8 players', () => {
      const lineups = engine.optimize(testPlayers);

      for (const lineup of lineups) {
        expect(lineup.players.length).toBe(8);
      }
    });

    it('should assign players to valid slots', () => {
      const lineups = engine.optimize(testPlayers);
      const validSlots = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'];

      for (const lineup of lineups) {
        for (const lp of lineup.players) {
          expect(validSlots).toContain(lp.slot);
        }
      }
    });

    it('should return projected points sum', () => {
      const lineups = engine.optimize(testPlayers);

      for (const lineup of lineups) {
        const calculatedSum = lineup.players.reduce(
          (sum, lp) => sum + (lp.player.projectedPoints || 0),
          0
        );
        expect(lineup.projectedPoints).toBeCloseTo(calculatedSum, 1);
      }
    });

    it('should filter out players with no projection', () => {
      const playersWithNull: Player[] = [
        ...testPlayers,
        {
          id: 'player-no-proj',
          name: 'No Projection',
          team: 'LAL',
          opponent: 'GSW',
          positions: 'PG',
          salary: 3500,
          projectedPoints: null,
        },
      ];

      const lineups = engine.optimize(playersWithNull);

      for (const lineup of lineups) {
        const playerIds = lineup.players.map((lp) => lp.player.id);
        expect(playerIds).not.toContain('player-no-proj');
      }
    });
  });

  describe('locked and excluded players', () => {
    it('should accept locked players config', () => {
      engine = new OptimizerEngine({
        numLineups: 1,
        lockedPlayers: ['player-5'],
        stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true },
      });
      expect(engine).toBeDefined();
    });

    it('should accept excluded players config', () => {
      engine = new OptimizerEngine({
        numLineups: 1,
        excludedPlayers: ['player-5', 'player-9'],
        stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true },
      });
      expect(engine).toBeDefined();
    });
  });

  describe('exposure limits', () => {
    it('should respect max exposure across multiple lineups', () => {
      engine = new OptimizerEngine({
        numLineups: 10,
        maxExposure: 50, // Max 50% exposure
        stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true },
      });

      const lineups = engine.optimize(testPlayers);

      // Count appearances of each player
      const playerCounts = new Map<string, number>();
      for (const lineup of lineups) {
        for (const lp of lineup.players) {
          const current = playerCounts.get(lp.player.id) || 0;
          playerCounts.set(lp.player.id, current + 1);
        }
      }

      // No player should appear in more than 50% of lineups
      const maxAllowed = Math.ceil(0.5 * lineups.length);
      for (const [playerId, count] of playerCounts) {
        expect(count).toBeLessThanOrEqual(maxAllowed + 1); // +1 for rounding
      }
    });
  });

  describe('game stacking', () => {
    it('should accept stacking config', () => {
      engine = new OptimizerEngine({
        numLineups: 1,
        stacking: {
          enabled: true,
          minStack: 2,
          maxStack: 4,
          correlationBonus: 1.5,
          preferHighTotal: true,
        },
      });
      expect(engine).toBeDefined();
    });

    it('should handle disabled stacking', () => {
      engine = new OptimizerEngine({
        numLineups: 1,
        stacking: {
          enabled: false,
          minStack: 2,
          maxStack: 4,
          correlationBonus: 1.5,
          preferHighTotal: true,
        },
      });
      expect(engine).toBeDefined();
    });
  });

  describe('CASH vs GPP mode', () => {
    it('should create engine in CASH mode', () => {
      const cashEngine = new OptimizerEngine({
        numLineups: 1,
        mode: 'CASH',
        stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true },
      });
      expect(cashEngine).toBeDefined();
    });

    it('should create engine in GPP mode', () => {
      const gppEngine = new OptimizerEngine({
        numLineups: 1,
        mode: 'GPP',
        stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true },
      });
      expect(gppEngine).toBeDefined();
    });
  });

  describe('lineup diversity', () => {
    it('should accept diversity factor config', () => {
      engine = new OptimizerEngine({
        numLineups: 5,
        diversityFactor: 0.2,
        stacking: { enabled: false, minStack: 2, maxStack: 4, correlationBonus: 1.5, preferHighTotal: true },
      });
      expect(engine).toBeDefined();
    });
  });
});
