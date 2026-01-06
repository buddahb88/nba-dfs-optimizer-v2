'use client';

import type { Lineup, LineupPlayer } from '@/types';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';

interface LineupCardProps {
  lineup: Lineup;
  index?: number;
  onSave?: () => void;
  onDelete?: () => void;
  showStacks?: boolean;
  compact?: boolean;
}

const SLOT_ORDER = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'];

export function LineupCard({
  lineup,
  index,
  onSave,
  onDelete,
  showStacks = true,
  compact = false,
}: LineupCardProps) {
  // Sort players by slot order
  const sortedPlayers = [...lineup.players].sort(
    (a, b) => SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot)
  );

  const remainingSalary = 50000 - lineup.totalSalary;

  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b">
        <div className="flex items-center gap-3">
          {index !== undefined && (
            <span className="font-semibold text-lg">#{index + 1}</span>
          )}
          <div className="flex gap-4 text-sm">
            <span>
              <span className="text-muted-foreground">Salary:</span>{' '}
              <span className="font-mono font-medium">
                {formatCurrency(lineup.totalSalary)}
              </span>
              {remainingSalary > 0 && (
                <span className="text-green-600 ml-1">
                  (+{formatCurrency(remainingSalary)})
                </span>
              )}
            </span>
            <span>
              <span className="text-muted-foreground">Proj:</span>{' '}
              <span className="font-mono font-medium">
                {formatNumber(lineup.projectedPoints)}
              </span>
            </span>
            {lineup.ceiling > 0 && (
              <span>
                <span className="text-muted-foreground">Ceil:</span>{' '}
                <span className="font-mono">{formatNumber(lineup.ceiling)}</span>
              </span>
            )}
            <span>
              <span className="text-muted-foreground">Own:</span>{' '}
              <span className="font-mono">{formatNumber(lineup.ownership)}%</span>
            </span>
          </div>
        </div>

        <div className="flex gap-2">
          {onSave && (
            <button
              onClick={onSave}
              className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Save
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded hover:bg-destructive/90"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {/* Players Grid */}
      <div className={cn('p-3', compact ? 'grid grid-cols-4 gap-2' : 'grid grid-cols-8 gap-2')}>
        {sortedPlayers.map((lp, i) => (
          <PlayerSlot key={i} lineupPlayer={lp} compact={compact} />
        ))}
      </div>

      {/* Game Stacks */}
      {showStacks && lineup.gameStacks && lineup.gameStacks.length > 0 && (
        <div className="px-4 py-2 border-t bg-muted/20">
          <div className="text-xs text-muted-foreground mb-1">Game Stacks:</div>
          <div className="flex flex-wrap gap-2">
            {lineup.gameStacks.map((stack, i) => (
              <div
                key={i}
                className="px-2 py-1 bg-primary/10 rounded text-xs"
              >
                <span className="font-medium">{stack.game}</span>
                <span className="text-muted-foreground ml-1">
                  ({stack.players.length} players)
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerSlot({
  lineupPlayer,
  compact,
}: {
  lineupPlayer: LineupPlayer;
  compact?: boolean;
}) {
  const { player, slot } = lineupPlayer;
  const value = player.projectedPoints
    ? (player.projectedPoints / player.salary) * 1000
    : 0;

  return (
    <div className="p-2 rounded bg-muted/50 text-center">
      <div className="text-xs font-medium text-muted-foreground mb-1">{slot}</div>
      <div className="font-medium truncate text-sm" title={player.name}>
        {compact ? player.name.split(' ').pop() : player.name}
      </div>
      <div className="text-xs text-muted-foreground">
        {player.team} • {formatCurrency(player.salary)}
      </div>
      {!compact && (
        <div className="text-xs mt-1">
          <span
            className={cn(
              'font-mono',
              value >= 6 && 'text-green-600',
              value < 4 && 'text-red-500'
            )}
          >
            {formatNumber(player.projectedPoints || 0)} pts
          </span>
        </div>
      )}
    </div>
  );
}

// Export for use in multi-lineup views
export function LineupList({
  lineups,
  onSave,
  onDelete,
}: {
  lineups: Lineup[];
  onSave?: (index: number) => void;
  onDelete?: (index: number) => void;
}) {
  if (lineups.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No lineups generated yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {lineups.map((lineup, index) => (
        <LineupCard
          key={index}
          lineup={lineup}
          index={index}
          onSave={onSave ? () => onSave(index) : undefined}
          onDelete={onDelete ? () => onDelete(index) : undefined}
        />
      ))}
    </div>
  );
}
