import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { safeScore } from '@/lib/chart-utils'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  const { data: stats, isLoading: statsLoading, error: statsError, refetch: refetchStats } = useQuery({
    queryKey: ['dashboardStats'],
    queryFn: () => apiClient.getDashboardStats(),
  });

  const { data: topPerformers = [], isLoading: performersLoading, refetch: refetchPerformers } = useQuery({
    queryKey: ['topPerformers'],
    queryFn: () => apiClient.getTopPerformers(5),
  });

  const { data: recentRuns = [], isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['recentRuns'],
    queryFn: () => apiClient.listRuns({ limit: 15 }),
  });

  const { data: scoreDistribution = [], isLoading: distributionLoading, refetch: refetchDistribution } = useQuery({
    queryKey: ['scoreDistribution'],
    queryFn: () => apiClient.getScoreDistribution(),
  });

  const { data: recentBatches = [], isLoading: batchesLoading, refetch: refetchBatches } = useQuery({
    queryKey: ['recentBatches'],
    queryFn: () => apiClient.listBatches(5),
  });

  const isLoading = statsLoading || performersLoading || runsLoading || distributionLoading || batchesLoading;

  const handleRefresh = async () => {
    await Promise.all([
      refetchStats(),
      refetchPerformers(),
      refetchRuns(),
      refetchDistribution(),
      refetchBatches(),
    ]);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading data...</div>;
  }

  if (statsError) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {statsError.message}</div>;
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
