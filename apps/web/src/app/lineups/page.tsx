'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { optimizerApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { formatCurrency, formatNumber } from '@/lib/utils';

export default function LineupsPage() {
  const queryClient = useQueryClient();
  const { currentSlateId } = useAppStore();

  const { data: lineupsResponse, isLoading } = useQuery({
    queryKey: ['lineups', currentSlateId],
    queryFn: () => optimizerApi.getLineups(currentSlateId!),
    enabled: !!currentSlateId,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => optimizerApi.deleteLineup(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lineups', currentSlateId] });
    },
  });

  if (!currentSlateId) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">Saved Lineups</h1>
        <p className="mt-2 text-muted-foreground">
          Select a slate from the Slates page to view lineups
        </p>
      </div>
    );
  }

  const lineups = lineupsResponse?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Saved Lineups</h1>
        <span className="text-sm text-muted-foreground">
          {lineups.length} lineups
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Loading lineups...</div>
      ) : lineups.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No saved lineups. Generate lineups from the Optimizer page.
        </div>
      ) : (
        <div className="grid gap-4">
          {lineups.map((lineup: any) => (
            <div key={lineup.id} className="p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold">{lineup.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    Mode: {lineup.mode} | Created:{' '}
                    {new Date(lineup.createdAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="font-medium">
                      {formatCurrency(lineup.totalSalary)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatNumber(lineup.projectedPoints)} pts
                    </p>
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(lineup.id)}
                    disabled={deleteMutation.isPending}
                    className="px-3 py-1 text-sm bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/80"
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {lineup.players?.map((lp: any, i: number) => (
                  <div
                    key={i}
                    className="p-2 rounded bg-secondary text-center"
                  >
                    <div className="text-xs text-muted-foreground">
                      {lp.slot}
                    </div>
                    <div className="font-medium truncate text-sm">
                      {lp.player?.name?.split(' ').pop() || 'N/A'}
                    </div>
                    <div className="text-xs">
                      {lp.player ? formatCurrency(lp.player.salary) : '-'}
                    </div>
                  </div>
                ))}
              </div>

              {lineup.actualPoints && (
                <div className="mt-3 pt-3 border-t flex items-center justify-between">
                  <span className="text-sm">Actual Result:</span>
                  <span className="font-semibold">
                    {formatNumber(lineup.actualPoints)} pts
                    <span
                      className={`ml-2 text-sm ${
                        lineup.actualPoints > lineup.projectedPoints
                          ? 'text-green-500'
                          : 'text-red-500'
                      }`}
                    >
                      ({lineup.actualPoints > lineup.projectedPoints ? '+' : ''}
                      {formatNumber(
                        lineup.actualPoints - lineup.projectedPoints
                      )}
                      )
                    </span>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
