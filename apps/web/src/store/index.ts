import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Player filter state
interface FilterState {
  minProjection: number | null;
  maxSalary: number | null;
  minSalary: number | null;
  positions: string[];
  teams: string[];
  search: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Optimizer settings state
interface OptimizerSettings {
  mode: 'CASH' | 'GPP';
  numLineups: number;
  maxExposure: number;
  minExposure: number;
  enableStacking: boolean;
  minStack: number;
  maxStack: number;
  diversityFactor: number;
}

// Lineup builder state
interface LineupBuilderState {
  lockedPlayers: string[];
  excludedPlayers: string[];
}

// Main app store
interface AppState {
  // Current slate
  currentSlateId: string | null;
  setCurrentSlateId: (id: string | null) => void;

  // Filters
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Optimizer settings
  optimizerSettings: OptimizerSettings;
  setOptimizerSettings: (settings: Partial<OptimizerSettings>) => void;

  // Lineup builder
  lineupBuilder: LineupBuilderState;
  toggleLockedPlayer: (playerId: string) => void;
  toggleExcludedPlayer: (playerId: string) => void;
  clearLineupBuilder: () => void;

  // Chat
  currentChatSessionId: string | null;
  setCurrentChatSessionId: (id: string | null) => void;
}

const defaultFilters: FilterState = {
  minProjection: null,
  maxSalary: null,
  minSalary: null,
  positions: [],
  teams: [],
  search: '',
  sortBy: 'projectedPoints',
  sortOrder: 'desc',
};

const defaultOptimizerSettings: OptimizerSettings = {
  mode: 'CASH',
  numLineups: 1,
  maxExposure: 100,
  minExposure: 0,
  enableStacking: false,
  minStack: 2,
  maxStack: 3,
  diversityFactor: 0.1,
};

const defaultLineupBuilder: LineupBuilderState = {
  lockedPlayers: [],
  excludedPlayers: [],
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      // Current slate
      currentSlateId: null,
      setCurrentSlateId: (id) => set({ currentSlateId: id }),

      // Filters
      filters: defaultFilters,
      setFilters: (filters) =>
        set((state) => ({
          filters: { ...state.filters, ...filters },
        })),
      resetFilters: () => set({ filters: defaultFilters }),

      // Optimizer settings
      optimizerSettings: defaultOptimizerSettings,
      setOptimizerSettings: (settings) =>
        set((state) => ({
          optimizerSettings: { ...state.optimizerSettings, ...settings },
        })),

      // Lineup builder
      lineupBuilder: defaultLineupBuilder,
      toggleLockedPlayer: (playerId) =>
        set((state) => {
          const locked = state.lineupBuilder.lockedPlayers;
          const isLocked = locked.includes(playerId);
          return {
            lineupBuilder: {
              ...state.lineupBuilder,
              lockedPlayers: isLocked
                ? locked.filter((id) => id !== playerId)
                : [...locked, playerId],
              // Remove from excluded if locking
              excludedPlayers: isLocked
                ? state.lineupBuilder.excludedPlayers
                : state.lineupBuilder.excludedPlayers.filter(
                    (id) => id !== playerId
                  ),
            },
          };
        }),
      toggleExcludedPlayer: (playerId) =>
        set((state) => {
          const excluded = state.lineupBuilder.excludedPlayers;
          const isExcluded = excluded.includes(playerId);
          return {
            lineupBuilder: {
              ...state.lineupBuilder,
              excludedPlayers: isExcluded
                ? excluded.filter((id) => id !== playerId)
                : [...excluded, playerId],
              // Remove from locked if excluding
              lockedPlayers: isExcluded
                ? state.lineupBuilder.lockedPlayers
                : state.lineupBuilder.lockedPlayers.filter(
                    (id) => id !== playerId
                  ),
            },
          };
        }),
      clearLineupBuilder: () => set({ lineupBuilder: defaultLineupBuilder }),

      // Chat
      currentChatSessionId: null,
      setCurrentChatSessionId: (id) => set({ currentChatSessionId: id }),
    }),
    {
      name: 'nba-dfs-storage',
      partialize: (state) => ({
        currentSlateId: state.currentSlateId,
        optimizerSettings: state.optimizerSettings,
        currentChatSessionId: state.currentChatSessionId,
      }),
    }
  )
);
