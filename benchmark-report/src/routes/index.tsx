import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

interface DashboardStats {
  totalRuns: number;
  successRate: number;
  avgScore: number;
  avgCost: number;
}

function Dashboard() {
  const { db, isLoading, error } = useDatabase();
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    if (!db) return;

    try {
      // Query total runs
      const totalRunsResult = db.exec('SELECT COUNT(*) as count FROM benchmark_runs');
      const totalRuns = totalRunsResult[0]?.values[0]?.[0] as number || 0;

      // Query success rate (completed runs / total runs)
      const successRateResult = db.exec(`
        SELECT
          CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as success_rate
        FROM benchmark_runs
      `);
      const successRate = successRateResult[0]?.values[0]?.[0] as number || 0;

      // Query average score
      const avgScoreResult = db.exec(`
        SELECT AVG(weighted_score) as avg_score
        FROM benchmark_runs
        WHERE weighted_score IS NOT NULL
      `);
      const avgScore = avgScoreResult[0]?.values[0]?.[0] as number || 0;

      // Query average cost from telemetry
      const avgCostResult = db.exec(`
        SELECT AVG(cost_usd) as avg_cost
        FROM run_telemetry
        WHERE cost_usd IS NOT NULL
      `);
      const avgCost = avgCostResult[0]?.values[0]?.[0] as number || 0;

      setStats({
        totalRuns,
        successRate,
        avgScore,
        avgCost,
      });
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, [db]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading database...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          High-level overview of benchmark system health and performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Runs</div>
          <div className="text-3xl font-bold mt-2">{stats?.totalRuns.toLocaleString() || '-'}</div>
          <div className="text-xs text-muted-foreground mt-1">All time</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
          <div className="text-3xl font-bold mt-2">{stats ? `${stats.successRate.toFixed(1)}%` : '-'}</div>
          <div className="text-xs text-muted-foreground mt-1">Completed runs</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Avg Score</div>
          <div className="text-3xl font-bold mt-2">{stats ? stats.avgScore.toFixed(2) : '-'}</div>
          <div className="text-xs text-muted-foreground mt-1">out of 10.0</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Avg Cost</div>
          <div className="text-3xl font-bold mt-2">{stats ? `$${stats.avgCost.toFixed(2)}` : '-'}</div>
          <div className="text-xs text-muted-foreground mt-1">Per run</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Chart placeholder - Activity timeline will go here
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Top Performers</h2>
          <Button variant="outline" size="sm">View All</Button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="font-medium">Claude 3.5 Sonnet</div>
              <div className="text-sm text-muted-foreground">anthropic agent</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">9.2</div>
              <div className="text-xs text-muted-foreground">156 runs</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="font-medium">Claude Code</div>
              <div className="text-sm text-muted-foreground">claude-code agent</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">8.9</div>
              <div className="text-xs text-muted-foreground">234 runs</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
