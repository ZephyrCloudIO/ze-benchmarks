import { createFileRoute } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/costs')({
  component: CostsPage,
})

interface CostStats {
  totalCost: number;
  avgCost: number;
  totalRuns: number;
}

interface AgentCostEfficiency {
  agent: string;
  model: string;
  avgCost: number;
  avgScore: number;
  totalRuns: number;
  scorePerDollar: number;
}

function CostsPage() {
  const { db, isLoading, error } = useDatabase();
  const [costStats, setCostStats] = useState<CostStats | null>(null);
  const [costEfficiency, setCostEfficiency] = useState<AgentCostEfficiency[]>([]);

  useEffect(() => {
    if (!db) return;

    try {
      // Query overall cost statistics
      const costStatsResult = db.exec(`
        SELECT
          SUM(rt.cost_usd) as total_cost,
          AVG(rt.cost_usd) as avg_cost,
          COUNT(*) as total_runs
        FROM run_telemetry rt
        WHERE rt.cost_usd IS NOT NULL
      `);

      if (costStatsResult[0]) {
        const row = costStatsResult[0].values[0];
        setCostStats({
          totalCost: row[0] as number || 0,
          avgCost: row[1] as number || 0,
          totalRuns: row[2] as number || 0,
        });
      }

      // Query cost efficiency by agent/model
      const efficiencyResult = db.exec(`
        SELECT
          br.agent,
          br.model,
          AVG(rt.cost_usd) as avg_cost,
          AVG(br.weighted_score) as avg_score,
          COUNT(*) as total_runs,
          CASE
            WHEN AVG(rt.cost_usd) > 0 THEN AVG(br.weighted_score) / AVG(rt.cost_usd)
            ELSE 0
          END as score_per_dollar
        FROM benchmark_runs br
        LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE br.weighted_score IS NOT NULL AND rt.cost_usd IS NOT NULL
        GROUP BY br.agent, br.model
        ORDER BY score_per_dollar DESC
      `);

      if (efficiencyResult[0]) {
        const efficiency = efficiencyResult[0].values.map((row) => ({
          agent: row[0] as string,
          model: row[1] as string,
          avgCost: row[2] as number,
          avgScore: row[3] as number,
          totalRuns: row[4] as number,
          scorePerDollar: row[5] as number,
        }));
        setCostEfficiency(efficiency);
      }
    } catch (err) {
      console.error('Failed to fetch cost stats:', err);
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
        <h1 className="text-4xl font-bold tracking-tight">Cost & Efficiency Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Track spending and optimize for cost-efficiency
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Cost</div>
          <div className="text-3xl font-bold mt-2">${costStats?.totalCost.toFixed(2) || '0.00'}</div>
          <div className="text-xs text-muted-foreground mt-1">All time</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Avg per Run</div>
          <div className="text-3xl font-bold mt-2">${costStats?.avgCost.toFixed(3) || '0.000'}</div>
          <div className="text-xs text-muted-foreground mt-1">Across all runs</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Runs</div>
          <div className="text-3xl font-bold mt-2">{costStats?.totalRuns.toLocaleString() || '0'}</div>
          <div className="text-xs text-muted-foreground mt-1">With cost data</div>
        </div>
      </div>

      {/* Cost Efficiency Table */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Cost Efficiency Rankings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Agent/model combinations ranked by score per dollar (higher is better)
        </p>
        <div className="space-y-3">
          {costEfficiency.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{item.model || 'Unknown Model'}</div>
                <div className="text-sm text-muted-foreground">{item.agent}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">{item.scorePerDollar.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">score/$</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{item.avgScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">avg score</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${item.avgCost.toFixed(3)}</div>
                <div className="text-xs text-muted-foreground">avg cost</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{item.totalRuns}</div>
                <div className="text-xs text-muted-foreground">runs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
