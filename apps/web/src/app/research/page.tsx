'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { historicalApi, playersApi } from '@/lib/api';
import { useAppStore } from '@/store';
import { formatNumber } from '@/lib/utils';

export default function ResearchPage() {
  const { currentSlateId } = useAppStore();
  const [selectedTab, setSelectedTab] = useState<
    'defense' | 'usage' | 'matchup'
  >('defense');
  const [playerSearch, setPlayerSearch] = useState('');
  const [opponentSearch, setOpponentSearch] = useState('');

  const { data: defenseResponse, isLoading: loadingDefense } = useQuery({
    queryKey: ['defense'],
    queryFn: () => historicalApi.getTeamDefense(),
  });

  const { data: usageBumpsResponse, isLoading: loadingUsage } = useQuery({
    queryKey: ['usageBumps', currentSlateId],
    queryFn: () => historicalApi.getUsageBumps(currentSlateId!, 5),
    enabled: !!currentSlateId,
  });

  const { data: matchupResponse, isLoading: loadingMatchup } = useQuery({
    queryKey: ['matchup', playerSearch, opponentSearch],
    queryFn: () => historicalApi.getMatchup(playerSearch, opponentSearch),
    enabled: playerSearch.length > 2 && opponentSearch.length > 1,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Research</h1>

      {/* Tab Navigation */}
      <div className="flex space-x-4 border-b">
        {(['defense', 'usage', 'matchup'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              selectedTab === tab
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'defense'
              ? 'Team Defense'
              : tab === 'usage'
              ? 'Usage Bumps'
              : 'Matchup Analysis'}
          </button>
        ))}
      </div>

      {/* Defense Tab */}
      {selectedTab === 'defense' && (
        <div className="space-y-4">
          <h2 className="font-semibold">Team Defense Rankings</h2>
          {loadingDefense ? (
            <div className="text-center py-8">Loading defense stats...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Team</th>
                    <th className="text-right p-2">Def Eff</th>
                    <th className="text-right p-2">Pace</th>
                    <th className="text-right p-2">vs PG</th>
                    <th className="text-right p-2">vs SG</th>
                    <th className="text-right p-2">vs SF</th>
                    <th className="text-right p-2">vs PF</th>
                    <th className="text-right p-2">vs C</th>
                  </tr>
                </thead>
                <tbody>
                  {(defenseResponse?.data || []).map((defense: any) => (
                    <tr key={defense.team} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium">{defense.team}</td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.defEff || 0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.pace || 0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.dvpPg || 0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.dvpSg || 0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.dvpSf || 0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.dvpPf || 0)}
                      </td>
                      <td className="p-2 text-right">
                        {formatNumber(defense.dvpC || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Usage Bumps Tab */}
      {selectedTab === 'usage' && (
        <div className="space-y-4">
          <h2 className="font-semibold">Potential Usage Bumps</h2>
          {!currentSlateId ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a slate to view usage bump opportunities
            </div>
          ) : loadingUsage ? (
            <div className="text-center py-8">Loading usage bumps...</div>
          ) : (usageBumpsResponse?.data || []).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No significant usage bumps detected
            </div>
          ) : (
            <div className="grid gap-4">
              {(usageBumpsResponse?.data || []).map((bump: any, index: number) => (
                <div key={index} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold">{bump.player.name}</span>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {bump.player.team}
                      </span>
                    </div>
                    <span className="text-green-500 font-semibold">
                      +{bump.bumpPercent}%
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Without {bump.missingTeammate} (avg{' '}
                    {formatNumber(bump.avgMissingPts)} DK pts)
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Matchup Analysis Tab */}
      {selectedTab === 'matchup' && (
        <div className="space-y-4">
          <h2 className="font-semibold">Matchup Analysis</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium mb-1">
                Player Name
              </label>
              <input
                type="text"
                value={playerSearch}
                onChange={(e) => setPlayerSearch(e.target.value)}
                placeholder="e.g., LeBron James"
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Opponent Team
              </label>
              <input
                type="text"
                value={opponentSearch}
                onChange={(e) => setOpponentSearch(e.target.value)}
                placeholder="e.g., LAL"
                className="w-full p-2 border rounded-md bg-background"
              />
            </div>
          </div>

          {loadingMatchup ? (
            <div className="text-center py-8">Loading matchup data...</div>
          ) : matchupResponse?.data ? (
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="text-sm font-medium text-muted-foreground">
                  vs {opponentSearch.toUpperCase()}
                </h3>
                <p className="text-2xl font-bold mt-1">
                  {formatNumber(matchupResponse.data.vsOpponent.avgDkPts)} DK
                </p>
                <p className="text-sm text-muted-foreground">
                  {matchupResponse.data.vsOpponent.gamesPlayed} games
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Season Average
                </h3>
                <p className="text-2xl font-bold mt-1">
                  {formatNumber(matchupResponse.data.season.avgDkPts)} DK
                </p>
                <p className="text-sm text-muted-foreground">
                  {matchupResponse.data.season.gamesPlayed} games
                </p>
              </div>
              <div className="p-4 rounded-lg border bg-card">
                <h3 className="text-sm font-medium text-muted-foreground">
                  Difference
                </h3>
                <p
                  className={`text-2xl font-bold mt-1 ${
                    matchupResponse.data.comparison.difference > 0
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}
                >
                  {matchupResponse.data.comparison.difference > 0 ? '+' : ''}
                  {formatNumber(matchupResponse.data.comparison.difference)} DK
                </p>
                <p className="text-sm text-muted-foreground">
                  {matchupResponse.data.comparison.percentDiff > 0 ? '+' : ''}
                  {matchupResponse.data.comparison.percentDiff}%
                </p>
              </div>
            </div>
          ) : playerSearch.length > 2 && opponentSearch.length > 1 ? (
            <div className="text-center py-8 text-muted-foreground">
              No matchup data found
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Enter a player name and opponent to analyze the matchup
            </div>
          )}
        </div>
      )}
    </div>
  );
}
