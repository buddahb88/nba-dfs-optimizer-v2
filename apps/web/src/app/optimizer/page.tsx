'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { playersApi, optimizerApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { PlayerTable } from '@/components/players';
import { LineupCard } from '@/components/lineup';
import { formatNumber } from '@/lib/utils';
import type { Player, Lineup, ExposureStat } from '@/types';

export default function OptimizerPage() {
  const {
    currentSlateId,
    optimizerSettings,
    setOptimizerSettings,
    lineupBuilder,
    toggleLockedPlayer,
    toggleExcludedPlayer,
  } = useAppStore();

  const [generatedLineups, setGeneratedLineups] = useState<Lineup[]>([]);
  const [exposureStats, setExposureStats] = useState<ExposureStat[]>([]);
  const [activeTab, setActiveTab] = useState<'lineups' | 'exposure'>('lineups');

  const { data: playersResponse, isLoading } = useQuery({
    queryKey: ['players', currentSlateId],
    queryFn: () => playersApi.getBySlate(currentSlateId!),
    enabled: !!currentSlateId,
  });

  const optimizeMutation = useMutation({
    mutationFn: () =>
      optimizerApi.optimize({
        slateId: currentSlateId!,
        mode: optimizerSettings.mode,
        numLineups: optimizerSettings.numLineups,
        maxExposure: optimizerSettings.maxExposure,
        minExposure: optimizerSettings.minExposure || 0,
        lockedPlayers: lineupBuilder.lockedPlayers,
        excludedPlayers: lineupBuilder.excludedPlayers,
        enableStacking: optimizerSettings.enableStacking,
        minStack: optimizerSettings.minStack,
        maxStack: optimizerSettings.maxStack,
        diversityFactor: optimizerSettings.diversityFactor || 0.1,
      }),
    onSuccess: (response) => {
      setGeneratedLineups(response.data?.lineups || []);
      setExposureStats(response.data?.exposureStats || []);
    },
  });

  if (!currentSlateId) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold">Lineup Optimizer</h1>
        <p className="mt-2 text-muted-foreground">
          Select a slate from the Slates page to begin
        </p>
      </div>
    );
  }

  const players: Player[] = playersResponse?.data || [];
  const lockedSet = new Set(lineupBuilder.lockedPlayers);
  const excludedSet = new Set(lineupBuilder.excludedPlayers);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Lineup Optimizer</h1>
        <div className="flex items-center gap-4">
          {generatedLineups.length > 0 && (
            <span className="text-sm text-muted-foreground">
              {generatedLineups.length} lineups generated
            </span>
          )}
          <button
            onClick={() => optimizeMutation.mutate()}
            disabled={optimizeMutation.isPending}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
          >
            {optimizeMutation.isPending ? 'Optimizing...' : 'Generate Lineups'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Settings Panel */}
        <div className="space-y-4 p-4 rounded-lg border bg-card">
          <h2 className="font-semibold">Settings</h2>

          <div>
            <label className="block text-sm font-medium mb-1">Mode</label>
            <select
              value={optimizerSettings.mode}
              onChange={(e) =>
                setOptimizerSettings({ mode: e.target.value as 'CASH' | 'GPP' })
              }
              className="w-full p-2 border rounded-md bg-background"
            >
              <option value="CASH">Cash</option>
              <option value="GPP">GPP</option>
            </select>
            <p className="text-xs text-muted-foreground mt-1">
              {optimizerSettings.mode === 'CASH'
                ? 'Focus on floor & consistency'
                : 'Focus on ceiling & upside'}
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Number of Lineups
            </label>
            <input
              type="number"
              min={1}
              max={150}
              value={optimizerSettings.numLineups}
              onChange={(e) =>
                setOptimizerSettings({ numLineups: parseInt(e.target.value) || 1 })
              }
              className="w-full p-2 border rounded-md bg-background"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">Min Exp%</label>
              <input
                type="number"
                min={0}
                max={100}
                value={optimizerSettings.minExposure || 0}
                onChange={(e) =>
                  setOptimizerSettings({
                    minExposure: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Max Exp%</label>
              <input
                type="number"
                min={0}
                max={100}
                value={optimizerSettings.maxExposure}
                onChange={(e) =>
                  setOptimizerSettings({
                    maxExposure: parseInt(e.target.value) || 100,
                  })
                }
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="stacking"
                checked={optimizerSettings.enableStacking}
                onChange={(e) =>
                  setOptimizerSettings({ enableStacking: e.target.checked })
                }
                className="rounded"
              />
              <label htmlFor="stacking" className="text-sm">
                Enable Game Stacking
              </label>
            </div>

            {optimizerSettings.enableStacking && (
              <div className="grid grid-cols-2 gap-2 pl-6">
                <div>
                  <label className="block text-xs mb-1">Min Stack</label>
                  <input
                    type="number"
                    min={2}
                    max={5}
                    value={optimizerSettings.minStack}
                    onChange={(e) =>
                      setOptimizerSettings({
                        minStack: parseInt(e.target.value) || 2,
                      })
                    }
                    className="w-full p-1 text-sm border rounded-md bg-background"
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Max Stack</label>
                  <input
                    type="number"
                    min={2}
                    max={6}
                    value={optimizerSettings.maxStack}
                    onChange={(e) =>
                      setOptimizerSettings({
                        maxStack: parseInt(e.target.value) || 4,
                      })
                    }
                    className="w-full p-1 text-sm border rounded-md bg-background"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Diversity Factor
            </label>
            <input
              type="range"
              min={0}
              max={50}
              value={(optimizerSettings.diversityFactor || 0.1) * 100}
              onChange={(e) =>
                setOptimizerSettings({
                  diversityFactor: parseInt(e.target.value) / 100,
                })
              }
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Similar</span>
              <span>{((optimizerSettings.diversityFactor || 0.1) * 100).toFixed(0)}%</span>
              <span>Diverse</span>
            </div>
          </div>

          <div className="pt-2 border-t text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Locked:</span>
              <span className="font-medium text-green-600">
                {lineupBuilder.lockedPlayers.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Excluded:</span>
              <span className="font-medium text-red-500">
                {lineupBuilder.excludedPlayers.length}
              </span>
            </div>
          </div>

          {(lineupBuilder.lockedPlayers.length > 0 ||
            lineupBuilder.excludedPlayers.length > 0) && (
            <button
              onClick={() => {
                lineupBuilder.lockedPlayers.forEach((id) => toggleLockedPlayer(id));
                lineupBuilder.excludedPlayers.forEach((id) => toggleExcludedPlayer(id));
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground"
            >
              Clear All
            </button>
          )}
        </div>

        {/* Player Pool */}
        <div className="lg:col-span-3">
          <h2 className="font-semibold mb-3">Player Pool ({players.length})</h2>

          {isLoading ? (
            <div className="text-center py-8">Loading players...</div>
          ) : (
            <PlayerTable
              players={players}
              lockedIds={lockedSet}
              excludedIds={excludedSet}
              onLockToggle={toggleLockedPlayer}
              onExcludeToggle={toggleExcludedPlayer}
            />
          )}
        </div>
      </div>

      {/* Generated Lineups */}
      {generatedLineups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Results ({generatedLineups.length} lineups)
            </h2>
            <div className="flex gap-2">
              <button
                onClick={() => setActiveTab('lineups')}
                className={`px-3 py-1 text-sm rounded ${
                  activeTab === 'lineups'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                Lineups
              </button>
              <button
                onClick={() => setActiveTab('exposure')}
                className={`px-3 py-1 text-sm rounded ${
                  activeTab === 'exposure'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted hover:bg-muted/80'
                }`}
              >
                Exposure
              </button>
            </div>
          </div>

          {activeTab === 'lineups' ? (
            <div className="space-y-4">
              {generatedLineups.map((lineup, index) => (
                <LineupCard
                  key={index}
                  lineup={lineup}
                  index={index}
                  showStacks={optimizerSettings.enableStacking}
                />
              ))}
            </div>
          ) : (
            <ExposureTable stats={exposureStats} totalLineups={generatedLineups.length} />
          )}
        </div>
      )}
    </div>
  );
}

function ExposureTable({
  stats,
  totalLineups,
}: {
  stats: ExposureStat[];
  totalLineups: number;
}) {
  const sortedStats = [...stats].sort((a, b) => b.percentage - a.percentage);

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-left">Player</th>
            <th className="px-4 py-2 text-right">Count</th>
            <th className="px-4 py-2 text-right">Exposure</th>
            <th className="px-4 py-2 text-left w-1/3">Distribution</th>
          </tr>
        </thead>
        <tbody>
          {sortedStats.map((stat) => (
            <tr key={stat.playerId} className="border-t">
              <td className="px-4 py-2 font-medium">{stat.playerName}</td>
              <td className="px-4 py-2 text-right font-mono">
                {stat.count}/{totalLineups}
              </td>
              <td className="px-4 py-2 text-right font-mono">
                {formatNumber(stat.percentage)}%
              </td>
              <td className="px-4 py-2">
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${stat.percentage}%` }}
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
