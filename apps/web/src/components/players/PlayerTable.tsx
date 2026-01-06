'use client';

import { useState, useMemo } from 'react';
import type { Player } from '@/types';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';

interface PlayerTableProps {
  players: Player[];
  onPlayerSelect?: (player: Player) => void;
  lockedIds?: Set<string>;
  excludedIds?: Set<string>;
  onLockToggle?: (playerId: string) => void;
  onExcludeToggle?: (playerId: string) => void;
  compact?: boolean;
}

type SortField = 'name' | 'salary' | 'projection' | 'value' | 'ceiling' | 'floor' | 'ownership' | 'dvp';
type SortOrder = 'asc' | 'desc';

export function PlayerTable({
  players,
  onPlayerSelect,
  lockedIds = new Set(),
  excludedIds = new Set(),
  onLockToggle,
  onExcludeToggle,
  compact = false,
}: PlayerTableProps) {
  const [sortField, setSortField] = useState<SortField>('projection');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [search, setSearch] = useState('');
  const [positionFilter, setPositionFilter] = useState<string[]>([]);

  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];

  const filteredAndSorted = useMemo(() => {
    let result = [...players];

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          p.team.toLowerCase().includes(searchLower) ||
          p.opponent.toLowerCase().includes(searchLower)
      );
    }

    // Position filter
    if (positionFilter.length > 0) {
      result = result.filter((p) =>
        positionFilter.some((pos) => p.positions.includes(pos))
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string = 0;
      let bVal: number | string = 0;

      switch (sortField) {
        case 'name':
          aVal = a.name;
          bVal = b.name;
          break;
        case 'salary':
          aVal = a.salary;
          bVal = b.salary;
          break;
        case 'projection':
          aVal = a.projectedPoints || 0;
          bVal = b.projectedPoints || 0;
          break;
        case 'value':
          aVal = a.value || 0;
          bVal = b.value || 0;
          break;
        case 'ceiling':
          aVal = a.ceiling || 0;
          bVal = b.ceiling || 0;
          break;
        case 'floor':
          aVal = a.floor || 0;
          bVal = b.floor || 0;
          break;
        case 'ownership':
          aVal = a.ownership || 0;
          bVal = b.ownership || 0;
          break;
        case 'dvp':
          aVal = a.dvpPtsAllowed || 0;
          bVal = b.dvpPtsAllowed || 0;
          break;
      }

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? aVal.localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal);
      }

      return sortOrder === 'asc' ? aVal - (bVal as number) : (bVal as number) - aVal;
    });

    return result;
  }, [players, search, positionFilter, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const togglePosition = (pos: string) => {
    setPositionFilter((prev) =>
      prev.includes(pos) ? prev.filter((p) => p !== pos) : [...prev, pos]
    );
  };

  const SortHeader = ({
    field,
    children,
    className,
  }: {
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }) => (
    <th
      onClick={() => handleSort(field)}
      className={cn(
        'px-3 py-2 text-left cursor-pointer hover:bg-muted/50 select-none',
        className
      )}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-xs">{sortOrder === 'asc' ? '↑' : '↓'}</span>
        )}
      </div>
    </th>
  );

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search players..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-1.5 border rounded-md bg-background text-sm w-48"
        />

        <div className="flex gap-1">
          {positions.map((pos) => (
            <button
              key={pos}
              onClick={() => togglePosition(pos)}
              className={cn(
                'px-2 py-1 text-xs rounded border',
                positionFilter.includes(pos)
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted'
              )}
            >
              {pos}
            </button>
          ))}
        </div>

        <span className="text-sm text-muted-foreground">
          {filteredAndSorted.length} players
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto border rounded-lg">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {(onLockToggle || onExcludeToggle) && (
                <th className="px-2 py-2 w-16"></th>
              )}
              <SortHeader field="name">Player</SortHeader>
              <th className="px-3 py-2 text-left">Pos</th>
              <th className="px-3 py-2 text-left">Matchup</th>
              <SortHeader field="salary" className="text-right">
                Salary
              </SortHeader>
              <SortHeader field="projection" className="text-right">
                Proj
              </SortHeader>
              <SortHeader field="value" className="text-right">
                Value
              </SortHeader>
              {!compact && (
                <>
                  <SortHeader field="floor" className="text-right">
                    Floor
                  </SortHeader>
                  <SortHeader field="ceiling" className="text-right">
                    Ceil
                  </SortHeader>
                  <SortHeader field="dvp" className="text-right">
                    DVP
                  </SortHeader>
                  <SortHeader field="ownership" className="text-right">
                    Own%
                  </SortHeader>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {filteredAndSorted.map((player) => {
              const isLocked = lockedIds.has(player.id);
              const isExcluded = excludedIds.has(player.id);
              const value = player.projectedPoints
                ? (player.projectedPoints / player.salary) * 1000
                : 0;
              const dvp = player.dvpPtsAllowed;

              return (
                <tr
                  key={player.id}
                  onClick={() => onPlayerSelect?.(player)}
                  className={cn(
                    'border-t hover:bg-muted/30 cursor-pointer',
                    isExcluded && 'opacity-40 bg-red-50 dark:bg-red-950/20',
                    isLocked && 'bg-green-50 dark:bg-green-950/20'
                  )}
                >
                  {(onLockToggle || onExcludeToggle) && (
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        {onLockToggle && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onLockToggle(player.id);
                            }}
                            className={cn(
                              'w-6 h-6 text-xs rounded flex items-center justify-center',
                              isLocked
                                ? 'bg-green-500 text-white'
                                : 'bg-muted hover:bg-muted/80'
                            )}
                            title={isLocked ? 'Unlock' : 'Lock'}
                          >
                            L
                          </button>
                        )}
                        {onExcludeToggle && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onExcludeToggle(player.id);
                            }}
                            className={cn(
                              'w-6 h-6 text-xs rounded flex items-center justify-center',
                              isExcluded
                                ? 'bg-red-500 text-white'
                                : 'bg-muted hover:bg-muted/80'
                            )}
                            title={isExcluded ? 'Include' : 'Exclude'}
                          >
                            X
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2 font-medium">{player.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {player.positions}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{player.team}</span>
                    <span className="text-muted-foreground"> @ {player.opponent}</span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(player.salary)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono font-medium">
                    {formatNumber(player.projectedPoints || 0)}
                  </td>
                  <td
                    className={cn(
                      'px-3 py-2 text-right font-mono',
                      value >= 6 && 'text-green-600 font-medium',
                      value >= 5 && value < 6 && 'text-yellow-600',
                      value < 4 && 'text-red-500'
                    )}
                  >
                    {formatNumber(value)}
                  </td>
                  {!compact && (
                    <>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {formatNumber(player.floor || 0)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatNumber(player.ceiling || 0)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 text-right font-mono',
                          dvp && dvp >= 45 && 'text-green-600 font-medium',
                          dvp && dvp <= 35 && 'text-red-500'
                        )}
                      >
                        {dvp ? formatNumber(dvp) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-muted-foreground">
                        {player.ownership ? `${formatNumber(player.ownership)}%` : '-'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
