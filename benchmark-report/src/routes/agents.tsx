import { createFileRoute } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
})

interface AgentStats {
  agent: string;
  model: string;
  avgScore: number;
  successRate: number;
  avgCost: number;
  avgDuration: number;
  totalRuns: number;
}

interface AgentModelHeatmap {
  agent: string;
  models: { [key: string]: number };
}

function AgentsPage() {
  const { db, isLoading, error } = useDatabase();
  const [agentStats, setAgentStats] = useState<AgentStats[]>([]);
  const [heatmapData, setHeatmapData] = useState<AgentModelHeatmap[]>([]);

  useEffect(() => {
    if (!db) return;

    try {
      // Query agent/model performance statistics
      const result = db.exec(`
        SELECT
          br.agent,
          br.model,
          AVG(br.weighted_score) as avg_score,
          CAST(SUM(CASE WHEN br.status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as success_rate,
          AVG(rt.cost_usd) as avg_cost,
          AVG(rt.duration_ms) as avg_duration,
          COUNT(*) as total_runs
        FROM benchmark_runs br
        LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE br.weighted_score IS NOT NULL
        GROUP BY br.agent, br.model
        ORDER BY avg_score DESC
      `);

      if (result[0]) {
        const stats = result[0].values.map((row) => ({
          agent: row[0] as string,
          model: row[1] as string,
          avgScore: row[2] as number,
          successRate: row[3] as number,
          avgCost: row[4] as number || 0,
          avgDuration: row[5] as number || 0,
          totalRuns: row[6] as number,
        }));
        setAgentStats(stats);

        // Process data for heatmap
        const agentModelMap: { [agent: string]: { [model: string]: number } } = {};
        stats.forEach(stat => {
          if (!agentModelMap[stat.agent]) {
            agentModelMap[stat.agent] = {};
          }
          agentModelMap[stat.agent][stat.model || 'unknown'] = stat.avgScore;
        });

        const heatmap = Object.keys(agentModelMap).map(agent => ({
          agent,
          models: agentModelMap[agent],
        }));
        setHeatmapData(heatmap);
      }
    } catch (err) {
      console.error('Failed to fetch agent stats:', err);
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
        <h1 className="text-4xl font-bold tracking-tight">Agent Performance</h1>
        <p className="text-muted-foreground mt-2">
          Compare and analyze different agents and models
        </p>
      </div>

      {/* Agent Comparison Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agentStats.map((stat, idx) => (
          <div key={idx} className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="mb-4">
              <h3 className="text-lg font-semibold">
                {stat.model ? stat.model : `${stat.agent} (no model)`}
              </h3>
              <p className="text-sm text-muted-foreground">{stat.agent} agent</p>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Score</span>
                <span className="font-bold text-lg">{stat.avgScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="font-semibold">{stat.successRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Cost</span>
                <span className="font-semibold">${stat.avgCost.toFixed(3)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Duration</span>
                <span className="font-semibold">{(stat.avgDuration / 1000).toFixed(1)}s</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">Total Runs</span>
                <span className="font-semibold">{stat.totalRuns}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent vs Model Heatmap */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Agent vs Model Performance</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Average scores by agent and model combination
        </p>
        <div className="grid gap-3">
          {heatmapData.map((item, idx) => (
            <div key={idx}>
              <div className="font-medium mb-2">{item.agent}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(item.models).map(([model, score]) => (
                  <div
                    key={model}
                    className="p-3 rounded border text-center"
                    style={{
                      backgroundColor: `rgba(34, 197, 94, ${score / 10})`,
                    }}
                  >
                    <div className="text-xs font-medium truncate">{model}</div>
                    <div className="text-lg font-bold mt-1">{score.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Model Performance Rankings */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Model Performance Rankings</h2>
        <div className="space-y-3">
          {agentStats.map((stat, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold">
                {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">
                  {stat.model ? stat.model : `${stat.agent} (no model)`}
                </div>
                <div className="text-sm text-muted-foreground">{stat.agent} agent</div>
              </div>
              <div className="text-right">
                <div className="font-bold">{stat.avgScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">score</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${stat.avgCost.toFixed(3)}</div>
                <div className="text-xs text-muted-foreground">avg cost</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{stat.totalRuns}</div>
                <div className="text-xs text-muted-foreground">runs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
