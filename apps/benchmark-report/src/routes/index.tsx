import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { safeScore } from '@/lib/chart-utils'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const { db, isLoading: dbLoading, error, refreshDatabase, isRefreshing } = useDatabase();
  const [stats, setStats] = useState<any>(null);
  const [topPerformers, setTopPerformers] = useState<any[]>([]);
  const [recentRuns, setRecentRuns] = useState<any[]>([]);
  const [scoreDistribution, setScoreDistribution] = useState<any[]>([]);
  const [recentBatches, setRecentBatches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) return;

    try {
      // Get global stats
      const statsResult = db.exec(`
        SELECT 
          COUNT(*) as totalRuns,
          COUNT(CASE WHEN status = 'completed' AND is_successful = 1 THEN 1 END) as successfulRuns,
          AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN weighted_score END) as avgScore,
          AVG(CASE WHEN status = 'completed' AND is_successful = 1 THEN 
            (SELECT cost_usd FROM run_telemetry WHERE run_telemetry.run_id = benchmark_runs.run_id LIMIT 1)
          END) as avgCost
        FROM benchmark_runs
      `);
      
      if (statsResult[0]) {
        const row = statsResult[0].values[0];
        const totalRuns = row[0] as number;
        const successfulRuns = row[1] as number;
        setStats({
          totalRuns,
          successfulRuns,
          successRate: totalRuns > 0 ? (successfulRuns / totalRuns) * 100 : 0,
          avgScore: row[2] || 0,
          avgCost: row[3] || 0,
        });
      }

      // Get top performers
      const performersResult = db.exec(`
        SELECT 
          agent,
          model,
          AVG(weighted_score) as avgScore,
          COUNT(*) as runCount,
          AVG((SELECT cost_usd FROM run_telemetry WHERE run_telemetry.run_id = benchmark_runs.run_id LIMIT 1)) as avgCost
        FROM benchmark_runs
        WHERE status = 'completed' AND is_successful = 1 AND weighted_score IS NOT NULL
        GROUP BY agent, model
        ORDER BY avgScore DESC
        LIMIT 5
      `);
      
      if (performersResult[0]) {
        setTopPerformers(performersResult[0].values.map(row => ({
          agent: row[0],
          model: row[1],
          avgScore: row[2] || 0,
          runCount: row[3],
          avgCost: row[4] || 0,
        })));
      }

      // Get recent runs
      const runsResult = db.exec(`
        SELECT 
          run_id, batchId, suite, scenario, tier, agent, model, status,
          weighted_score, started_at
        FROM benchmark_runs
        ORDER BY started_at DESC
        LIMIT 15
      `);
      
      if (runsResult[0]) {
        setRecentRuns(runsResult[0].values.map(row => ({
          runId: row[0],
          batchId: row[1],
          suite: row[2],
          scenario: row[3],
          tier: row[4],
          agent: row[5],
          model: row[6],
          status: row[7],
          weightedScore: row[8],
          startedAt: row[9],
        })));
      }

      // Get score distribution
      const distResult = db.exec(`
        SELECT 
          CASE 
            WHEN weighted_score < 2 THEN '0-2'
            WHEN weighted_score < 4 THEN '2-4'
            WHEN weighted_score < 6 THEN '4-6'
            WHEN weighted_score < 8 THEN '6-8'
            WHEN weighted_score < 10 THEN '8-10'
            ELSE '10+'
          END as range,
          COUNT(*) as count
        FROM benchmark_runs
        WHERE status = 'completed' AND is_successful = 1 AND weighted_score IS NOT NULL
        GROUP BY range
        ORDER BY range
      `);
      
      if (distResult[0]) {
        setScoreDistribution(distResult[0].values.map(row => ({
          range: row[0],
          count: row[1],
        })));
      }

      // Get recent batches
      const batchesResult = db.exec(`
        SELECT 
          batchId, createdAt, completedAt, totalRuns, successfulRuns,
          avgScore, avgWeightedScore
        FROM batch_runs
        ORDER BY createdAt DESC
        LIMIT 5
      `);
      
      if (batchesResult[0]) {
        setRecentBatches(batchesResult[0].values.map(row => ({
          batchId: row[0],
          createdAt: row[1],
          completedAt: row[2],
          totalRuns: row[3],
          successfulRuns: row[4],
          avgScore: row[5],
          avgWeightedScore: row[6],
        })));
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setIsLoading(false);
    }
  }, [db]);

  const handleRefresh = async () => {
    await refreshDatabase();
  };

  if (dbLoading || isLoading) {
    return <div className="flex items-center justify-center h-64">Loading data...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            High-level overview of benchmark system health and performance
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Data
          </Button>
        </div>
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

      {/* Score Distribution Chart */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Score Distribution</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Distribution of weighted scores across all benchmark runs
        </p>
        {scoreDistribution.length > 0 ? (
          <ChartContainer
            config={{
              count: {
                label: "Number of Runs",
                color: "hsl(var(--chart-1))",
              },
            }}
            className="h-[300px] w-full"
          >
            <BarChart data={scoreDistribution}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                dataKey="range" 
                label={{ value: 'Score Range', position: 'insideBottom', offset: -5 }}
              />
              <YAxis 
                label={{ value: 'Number of Runs', angle: -90, position: 'insideLeft' }}
              />
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{payload[0].payload.range}</span>
                          <span className="text-sm font-bold">{payload[0].value} runs</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="count" fill="var(--color-count)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-lg font-medium">No benchmark data available</p>
            <p className="text-sm mt-2">Run some benchmarks to see score distribution</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Recent Runs</h2>
        <div className="space-y-2">
          {recentRuns.length > 0 ? (
            recentRuns.map((run) => (
              <Link
                key={run.runId}
                to="/runs/$runId"
                params={{ runId: run.runId }}
                className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{run.scenario}</div>
                  <div className="text-sm text-muted-foreground flex gap-2 items-center">
                    <span>{run.suite}</span>
                    <span>•</span>
                    <span>{run.agent}</span>
                    {run.model && (
                      <>
                        <span>•</span>
                        <span className="truncate">{run.model}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className={`px-2 py-1 rounded text-xs font-medium ${
                    run.status === 'completed' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                    run.status === 'failed' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }`}>
                    {run.status}
                  </div>
                </div>
                <div className="text-right min-w-[60px]">
                  {run.weightedScore !== null && run.weightedScore !== undefined ? (
                    <>
                      <div className="font-bold">{safeScore(run.weightedScore).toFixed(2)}</div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">-</div>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground min-w-[120px]">
                  {new Date(run.startedAt).toLocaleDateString()} {new Date(run.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">No recent runs</div>
          )}
        </div>
      </div>

      {/* Recent Batches */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Recent Batches</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/batches">View All</Link>
          </Button>
        </div>
        <div className="space-y-2">
          {recentBatches.length > 0 ? (
            recentBatches.map((batch) => {
              const successRate = batch.totalRuns > 0 
                ? (batch.successfulRuns / batch.totalRuns) * 100 
                : 0
              const scoreColor =
                (batch.avgWeightedScore || 0) >= 9 ? 'text-green-600' :
                (batch.avgWeightedScore || 0) >= 7 ? 'text-yellow-600' :
                'text-red-600'
              
              return (
                <Link
                  key={batch.batchId}
                  to="/batches/$batchId"
                  params={{ batchId: batch.batchId }}
                  className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
                >
                  <div className="flex-1">
                    <div className="font-mono text-sm">{batch.batchId.substring(0, 12)}...</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {new Date(batch.createdAt).toLocaleDateString()} - {batch.totalRuns} runs ({successRate.toFixed(0)}% success)
                    </div>
                  </div>
                  <div className={`text-right font-bold text-lg ${scoreColor}`}>
                    {batch.avgWeightedScore?.toFixed(2) || 'N/A'}
                  </div>
                </Link>
              )
            })
          ) : (
            <div className="text-center text-muted-foreground py-8">No batches yet</div>
          )}
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Top Performers</h2>
          <Button asChild variant="outline" size="sm">
            <Link to="/agents">View All</Link>
          </Button>
        </div>
        <div className="space-y-4">
          {topPerformers.length > 0 ? (
            topPerformers.map((performer, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <div className="font-medium">
                    {performer.model ? performer.model : `${performer.agent} (no model)`}
                  </div>
                  <div className="text-sm text-muted-foreground">{performer.agent} agent</div>
                </div>
                <div className="text-right mr-4">
                  <div className="font-semibold">{performer.avgScore.toFixed(2)}</div>
                  <div className="text-xs text-muted-foreground">{performer.runCount} runs</div>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  ${performer.avgCost.toFixed(3)}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">No data available</div>
          )}
        </div>
      </div>
    </div>
  )
}
