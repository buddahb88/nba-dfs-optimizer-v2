'use client';

import { useState } from 'react';
import { formatNumber, formatPercent } from '@/lib/utils';

// Placeholder data for backtesting - will be connected to real data in Phase 4
const mockBacktestData = {
  overall: {
    totalProjections: 0,
    avgError: 0,
    rmse: 0,
    correlation: 0,
  },
  byPosition: [],
  bySalary: [],
  recent: [],
};

export default function BacktestPage() {
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backtest Analysis</h1>
        <div className="flex space-x-2">
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setDateRange(range)}
              className={`px-3 py-1 text-sm rounded-md ${
                dateRange === range
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {range === 'all' ? 'All Time' : range.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Coming Soon Banner */}
      <div className="p-6 rounded-lg border bg-card text-center">
        <h2 className="text-xl font-semibold mb-2">Backtesting Module</h2>
        <p className="text-muted-foreground mb-4">
          The backtesting engine is being developed as part of Phase 4.
          It will provide projection accuracy analysis, position-based performance,
          and historical lineup tracking.
        </p>
        <div className="grid gap-4 md:grid-cols-4 mt-6">
          <div className="p-4 rounded-lg bg-muted">
            <h3 className="text-sm font-medium text-muted-foreground">
              Projection Accuracy
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <h3 className="text-sm font-medium text-muted-foreground">
              Average Error
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <h3 className="text-sm font-medium text-muted-foreground">
              RMSE
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
          <div className="p-4 rounded-lg bg-muted">
            <h3 className="text-sm font-medium text-muted-foreground">
              Correlation
            </h3>
            <p className="text-2xl font-bold mt-1">--</p>
            <p className="text-sm text-muted-foreground">Coming Soon</p>
          </div>
        </div>
      </div>

      {/* Planned Features */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-2">Projection Analysis</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Compare projected vs actual fantasy points</li>
            <li>- Track accuracy by position</li>
            <li>- Analyze performance by salary tier</li>
            <li>- Identify consistent over/under projections</li>
          </ul>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-2">Lineup Performance</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Track lineup ROI over time</li>
            <li>- Cash vs GPP performance metrics</li>
            <li>- Optimal exposure analysis</li>
            <li>- Stacking correlation results</li>
          </ul>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-2">Factor Analysis</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- DVP impact on projections</li>
            <li>- Usage bump effectiveness</li>
            <li>- Pace factor correlation</li>
            <li>- Vegas line accuracy</li>
          </ul>
        </div>
        <div className="p-4 rounded-lg border bg-card">
          <h3 className="font-semibold mb-2">Learning System</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>- Automatic factor weight adjustment</li>
            <li>- Ownership prediction refinement</li>
            <li>- Model performance tracking</li>
            <li>- A/B testing for strategies</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
