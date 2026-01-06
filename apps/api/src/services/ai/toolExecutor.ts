// Tool Executor - Executes AI tool calls against the DFS system

import { PrismaClient } from '@nba-dfs/database';
import { getRepositories, RepositoryContainer } from '../../repositories/index.js';
import { OptimizerEngine, ProjectionEngine, BacktestEngine } from '../index.js';
import type { ToolCall, ToolResult } from './types.js';

export class ToolExecutor {
  private repos: RepositoryContainer;
  private projectionEngine: ProjectionEngine;
  private backtestEngine: BacktestEngine;

  constructor(private prisma: PrismaClient) {
    this.repos = getRepositories(prisma);
    this.projectionEngine = new ProjectionEngine(prisma);
    this.backtestEngine = new BacktestEngine(prisma);
  }

  /**
   * Execute a tool call and return the result
   */
  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const { name, arguments: argsJson } = toolCall.function;

    try {
      const args = JSON.parse(argsJson);
      let result: unknown;

      switch (name) {
        case 'get_player_projections':
          result = await this.getPlayerProjections(args);
          break;
        case 'build_lineup':
          result = await this.buildLineup(args);
          break;
        case 'analyze_matchup':
          result = await this.analyzeMatchup(args);
          break;
        case 'find_usage_bumps':
          result = await this.findUsageBumps(args);
          break;
        case 'get_team_defense':
          result = await this.getTeamDefense(args);
          break;
        case 'get_game_environment':
          result = await this.getGameEnvironment(args);
          break;
        case 'get_historical_stats':
          result = await this.getHistoricalStats(args);
          break;
        case 'get_slate_summary':
          result = await this.getSlateSummary(args);
          break;
        case 'compare_players':
          result = await this.comparePlayers(args);
          break;
        case 'find_stacking_targets':
          result = await this.findStackingTargets(args);
          break;
        case 'run_backtest':
          result = await this.runBacktest(args);
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        toolCallId: toolCall.id,
        result: JSON.stringify(result, null, 2),
      };
    } catch (error) {
      return {
        toolCallId: toolCall.id,
        result: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        isError: true,
      };
    }
  }

  /**
   * Execute multiple tool calls in parallel
   */
  async executeAll(toolCalls: ToolCall[]): Promise<ToolResult[]> {
    return Promise.all(toolCalls.map((tc) => this.execute(tc)));
  }

  // Tool implementations

  private async getPlayerProjections(args: {
    slateId: string;
    minProjection?: number;
    maxSalary?: number;
    minSalary?: number;
    positions?: string;
    team?: string;
    minValue?: number;
    sortBy?: string;
    limit?: number;
  }) {
    const players = await this.repos.player.findBySlate(args.slateId, {
      minProjection: args.minProjection,
      maxSalary: args.maxSalary,
      positions: args.positions?.split(',').map((p) => p.trim()),
      teams: args.team ? [args.team] : undefined,
    });

    // Apply additional filters
    let filtered = players;

    if (args.minSalary) {
      filtered = filtered.filter((p) => p.salary >= args.minSalary!);
    }

    if (args.minValue) {
      filtered = filtered.filter((p) => (p.value || 0) >= args.minValue!);
    }

    // Sort
    const sortField = args.sortBy || 'projection';
    filtered.sort((a, b) => {
      switch (sortField) {
        case 'value':
          return (b.value || 0) - (a.value || 0);
        case 'ceiling':
          return (b.ceiling || 0) - (a.ceiling || 0);
        case 'salary':
          return b.salary - a.salary;
        case 'ownership':
          return (b.ownership || 0) - (a.ownership || 0);
        default:
          return (b.projectedPoints || 0) - (a.projectedPoints || 0);
      }
    });

    // Limit
    const limit = args.limit || 20;
    filtered = filtered.slice(0, limit);

    return filtered.map((p) => ({
      name: p.name,
      team: p.team,
      opponent: p.opponent,
      positions: p.positions,
      salary: p.salary,
      projection: p.projectedPoints,
      floor: p.floor,
      ceiling: p.ceiling,
      value: p.value ? Math.round(p.value * 100) / 100 : null,
      ownership: p.ownership,
      confidence: p.confidence,
    }));
  }

  private async buildLineup(args: {
    slateId: string;
    mode?: string;
    numLineups?: number;
    lockedPlayers?: string;
    excludedPlayers?: string;
    maxExposure?: number;
    enableStacking?: boolean;
  }) {
    const players = await this.prisma.player.findMany({
      where: { slateId: args.slateId },
    });

    if (players.length < 8) {
      throw new Error('Not enough players to build a lineup');
    }

    type LineupPlayer = typeof players[number];
    const playerInputs = players.map((p: LineupPlayer) => ({
      id: p.id,
      name: p.name,
      team: p.team,
      opponent: p.opponent,
      positions: p.positions,
      salary: p.salary,
      projectedPoints: p.projectedPoints,
      ownership: p.ownership,
      floor: p.floor,
      ceiling: p.ceiling,
      value: p.value,
      boomProbability: p.boomProbability,
      leverageScore: p.leverageScore,
    }));

    const engine = new OptimizerEngine({
      salaryCap: 50000,
      rosterSize: 8,
      mode: (args.mode as 'CASH' | 'GPP') || 'GPP',
      numLineups: args.numLineups || 1,
      maxExposure: args.maxExposure || 60,
      minExposure: 0,
      stacking: {
        enabled: args.enableStacking !== false,
        minStack: 2,
        maxStack: 4,
        correlationBonus: 1.5,
        preferHighTotal: true,
      },
      lockedPlayers: args.lockedPlayers?.split(',').map((p) => p.trim()) || [],
      excludedPlayers: args.excludedPlayers?.split(',').map((p) => p.trim()) || [],
      diversityFactor: 0.15,
    });

    const lineups = engine.optimize(playerInputs);

    return lineups.map((lineup, i) => ({
      lineupNumber: i + 1,
      players: lineup.players.map((lp) => ({
        slot: lp.slot,
        name: lp.player.name,
        team: lp.player.team,
        salary: lp.player.salary,
        projection: lp.player.projectedPoints,
      })),
      totalSalary: lineup.totalSalary,
      projectedPoints: lineup.projectedPoints,
      ceiling: lineup.ceiling,
      ownership: lineup.ownership,
      stacks: lineup.gameStacks,
    }));
  }

  private async analyzeMatchup(args: { playerName: string; opponent: string }) {
    const [matchupHistory, defenseData] = await Promise.all([
      this.repos.historical.getMatchupHistory(args.playerName, args.opponent),
      this.repos.teamDefense.findByTeam(args.opponent),
    ]);

    return {
      player: args.playerName,
      opponent: args.opponent,
      matchupData: matchupHistory
        ? {
            gamesVsOpponent: matchupHistory.gamesVsOpp,
            avgVsOpponent: matchupHistory.avgVsOpp
              ? Math.round(matchupHistory.avgVsOpp * 10) / 10
              : null,
            seasonAvg: matchupHistory.seasonAvg
              ? Math.round(matchupHistory.seasonAvg * 10) / 10
              : null,
            differential: matchupHistory.differential
              ? Math.round(matchupHistory.differential * 10) / 10
              : null,
          }
        : 'No matchup data available',
      defenseRatings: defenseData
        ? {
            defEff: defenseData.defEff,
            pace: defenseData.pace,
            dvpPg: defenseData.dvpPg,
            dvpSg: defenseData.dvpSg,
            dvpSf: defenseData.dvpSf,
            dvpPf: defenseData.dvpPf,
            dvpC: defenseData.dvpC,
          }
        : 'No defense data available',
    };
  }

  private async findUsageBumps(args: { slateId: string; minBumpPercent?: number }) {
    // Get slate players and their historical context
    const slatePlayers = await this.prisma.player.findMany({
      where: { slateId: args.slateId },
    });

    // Find players with existing usage bump data
    const bumps: Array<{
      player: string;
      team: string;
      projectedBump: number;
      salary: number;
      projection: number | null;
    }> = [];

    for (const player of slatePlayers) {
      // Check if player has usageBump data set
      if (player.usageBump && player.usageBump >= (args.minBumpPercent || 5)) {
        bumps.push({
          player: player.name,
          team: player.team,
          projectedBump: player.usageBump,
          salary: player.salary,
          projection: player.projectedPoints,
        });
      }
    }

    // If no explicit usage bumps, look for potential value plays
    // (players with high ceiling relative to salary)
    if (bumps.length === 0) {
      type BumpPlayer = typeof slatePlayers[number];
      type ValuePlay = { player: string; team: string; projectedBump: number; salary: number; projection: number | null; value: number };
      const valuePlays = slatePlayers
        .filter((p: BumpPlayer) => p.ceiling && p.salary)
        .map((p: BumpPlayer): ValuePlay => ({
          player: p.name,
          team: p.team,
          projectedBump: 0,
          salary: p.salary,
          projection: p.projectedPoints,
          value: (p.ceiling || 0) / (p.salary / 1000),
        }))
        .sort((a: ValuePlay, b: ValuePlay) => b.value - a.value)
        .slice(0, 10);

      return {
        usageBumps: [],
        potentialValuePlays: valuePlays,
        message: 'No explicit usage bumps found. Showing high-value potential plays instead.',
      };
    }

    return {
      usageBumps: bumps.sort((a, b) => b.projectedBump - a.projectedBump),
      count: bumps.length,
    };
  }

  private async getTeamDefense(args: { team: string }) {
    const defense = await this.repos.teamDefense.findByTeam(args.team);

    if (!defense) {
      return { error: `No defense data found for team: ${args.team}` };
    }

    return {
      team: defense.team,
      defensiveEfficiency: defense.defEff,
      offensiveEfficiency: defense.offEff,
      pace: defense.pace,
      dvpByPosition: {
        PG: defense.dvpPg,
        SG: defense.dvpSg,
        SF: defense.dvpSf,
        PF: defense.dvpPf,
        C: defense.dvpC,
      },
      lastUpdated: defense.updatedAt,
    };
  }

  private async getGameEnvironment(args: { team1: string; team2: string }) {
    const [def1, def2, _leagueAvg] = await Promise.all([
      this.repos.teamDefense.findByTeam(args.team1),
      this.repos.teamDefense.findByTeam(args.team2),
      this.repos.teamDefense.getLeagueAverages(),
    ]);

    if (!def1 || !def2) {
      return { error: 'Defense data not found for one or both teams' };
    }

    const projectedPace = def1.pace && def2.pace ? (def1.pace + def2.pace) / 2 : null;

    return {
      game: `${args.team1} vs ${args.team2}`,
      projectedPace,
      team1: {
        team: args.team1,
        defEff: def1.defEff,
        pace: def1.pace,
      },
      team2: {
        team: args.team2,
        defEff: def2.defEff,
        pace: def2.pace,
      },
      analysis: {
        paceRating: projectedPace && projectedPace > 100 ? 'Fast' : 'Average',
        scoringEnvironment:
          def1.defEff && def2.defEff && def1.defEff > 113 && def2.defEff > 113
            ? 'High Scoring'
            : 'Average',
      },
    };
  }

  private async getHistoricalStats(args: {
    playerName: string;
    lastNGames?: number;
    opponent?: string;
    homeOnly?: boolean;
    awayOnly?: boolean;
  }) {
    const games = await this.repos.historical.findByPlayer(args.playerName, {
      limit: args.lastNGames || 20,
    });

    let filtered = games;

    if (args.opponent) {
      filtered = filtered.filter((g) => g.opponent === args.opponent);
    }
    if (args.homeOnly) {
      filtered = filtered.filter((g) => g.isHome);
    }
    if (args.awayOnly) {
      filtered = filtered.filter((g) => !g.isHome);
    }

    if (filtered.length === 0) {
      return { error: `No historical data found for ${args.playerName}` };
    }

    const avgPoints = filtered.reduce((sum, g) => sum + g.dkFantasyPoints, 0) / filtered.length;
    const avgMinutes = filtered.reduce((sum, g) => sum + (g.minutes || 0), 0) / filtered.length;

    // Calculate floor/ceiling
    const sortedPoints = filtered.map((g) => g.dkFantasyPoints).sort((a, b) => a - b);
    const floor = sortedPoints[Math.floor(sortedPoints.length * 0.25)] || 0;
    const ceiling = sortedPoints[Math.floor(sortedPoints.length * 0.75)] || 0;

    return {
      player: args.playerName,
      gamesAnalyzed: filtered.length,
      averages: {
        dkPoints: Math.round(avgPoints * 10) / 10,
        minutes: Math.round(avgMinutes * 10) / 10,
      },
      range: {
        floor: Math.round(floor * 10) / 10,
        ceiling: Math.round(ceiling * 10) / 10,
        min: Math.min(...sortedPoints),
        max: Math.max(...sortedPoints),
      },
      recentGames: filtered.slice(0, 5).map((g) => ({
        date: g.gameDate,
        opponent: g.opponent,
        points: g.dkFantasyPoints,
        minutes: g.minutes,
      })),
    };
  }

  private async getSlateSummary(args: { slateId: string }) {
    const [slate, players, _stats] = await Promise.all([
      this.repos.slate.findById(args.slateId),
      this.prisma.player.findMany({
        where: { slateId: args.slateId },
        orderBy: { projectedPoints: 'desc' },
      }),
      this.repos.slate.getSlateStats(args.slateId),
    ]);

    if (!slate) {
      return { error: 'Slate not found' };
    }

    // Top projections
    type OverviewPlayer = typeof players[number];
    const topProjections = players.slice(0, 10).map((p: OverviewPlayer) => ({
      name: p.name,
      team: p.team,
      salary: p.salary,
      projection: p.projectedPoints,
    }));

    // Best values
    const byValue = [...players].sort((a: OverviewPlayer, b: OverviewPlayer) => (b.value || 0) - (a.value || 0));
    const topValues = byValue.slice(0, 10).map((p: OverviewPlayer) => ({
      name: p.name,
      team: p.team,
      salary: p.salary,
      value: p.value ? Math.round(p.value * 100) / 100 : null,
      projection: p.projectedPoints,
    }));

    // Team breakdown
    const teams = new Map<string, number>();
    for (const p of players) {
      teams.set(p.team, (teams.get(p.team) || 0) + 1);
    }

    return {
      slate: {
        id: slate.id,
        name: slate.name,
        startTime: slate.startTime,
        status: slate.status,
      },
      stats: {
        playerCount: players.length,
        gameCount: Math.ceil(teams.size / 2),
        avgSalary: Math.round(players.reduce((s: number, p: OverviewPlayer) => s + p.salary, 0) / players.length),
      },
      topProjections,
      topValues,
      teamBreakdown: Object.fromEntries(teams),
    };
  }

  private async comparePlayers(args: { playerNames: string; slateId?: string }) {
    const names = args.playerNames.split(',').map((n) => n.trim());

    const comparisons = await Promise.all(
      names.map(async (name) => {
        // Try to find in slate first
        let player = null;
        if (args.slateId) {
          player = await this.prisma.player.findFirst({
            where: {
              slateId: args.slateId,
              name: { contains: name },
            },
          });
        }

        // Get historical stats
        const history = await this.repos.historical.findByPlayer(name, { limit: 10 });
        type HistGame = typeof history[number];
        const avgPoints = history.length > 0
          ? history.reduce((s: number, g: HistGame) => s + g.dkFantasyPoints, 0) / history.length
          : null;

        return {
          name,
          currentSlate: player
            ? {
                salary: player.salary,
                projection: player.projectedPoints,
                value: player.value,
                ceiling: player.ceiling,
              }
            : null,
          historical: {
            gamesPlayed: history.length,
            avgDkPoints: avgPoints ? Math.round(avgPoints * 10) / 10 : null,
          },
        };
      })
    );

    return comparisons;
  }

  private async findStackingTargets(args: {
    slateId: string;
    minGameTotal?: number;
    stackSize?: number;
  }) {
    const players = await this.prisma.player.findMany({
      where: { slateId: args.slateId },
    });

    // Group by game
    const games = new Map<string, typeof players>();
    for (const p of players) {
      const teams = [p.team, p.opponent].sort();
      const gameKey = `${teams[0]}@${teams[1]}`;
      const existing = games.get(gameKey) || [];
      existing.push(p);
      games.set(gameKey, existing);
    }

    // Analyze each game
    const stacks = [];
    type StackPlayer = typeof players[number];
    for (const [game, gamePlayers] of games) {
      // Sort by ceiling for GPP stacking
      const sorted = gamePlayers.sort((a: StackPlayer, b: StackPlayer) => (b.ceiling || 0) - (a.ceiling || 0));

      const stackSize = args.stackSize || 3;
      const topPlayers = sorted.slice(0, stackSize);

      const totalCeiling = topPlayers.reduce((s: number, p: StackPlayer) => s + (p.ceiling || 0), 0);
      const avgOwnership =
        topPlayers.reduce((s: number, p: StackPlayer) => s + (p.ownership || 10), 0) / topPlayers.length;

      stacks.push({
        game,
        players: topPlayers.map((p: StackPlayer) => ({
          name: p.name,
          team: p.team,
          salary: p.salary,
          ceiling: p.ceiling,
          ownership: p.ownership,
        })),
        totalSalary: topPlayers.reduce((s: number, p: StackPlayer) => s + p.salary, 0),
        combinedCeiling: Math.round(totalCeiling * 10) / 10,
        avgOwnership: Math.round(avgOwnership * 10) / 10,
      });
    }

    return stacks.sort((a, b) => b.combinedCeiling - a.combinedCeiling);
  }

  private async runBacktest(args: { startDate: string; endDate: string }) {
    const results = await this.backtestEngine.runBacktest({
      startDate: new Date(args.startDate),
      endDate: new Date(args.endDate),
    });

    return {
      summary: results.summary,
      byConfidence: results.byConfidence,
    };
  }
}
