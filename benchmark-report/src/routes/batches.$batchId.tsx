import { createFileRoute, Link } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell, ErrorBar } from 'recharts'
import { Copy, Download, RefreshCw } from 'lucide-react'
import { scoreTickFormatter, formatTooltipScore, computeQuantiles } from '@/lib/chart-utils'

export const Route = createFileRoute('/batches/$batchId')({
  component: BatchDetailsPage,
})

interface BatchDetails {
  batchId: string
  createdAt: number
  completedAt: number | null
  totalRuns: number
  successfulRuns: number
  avgScore: number
  avgWeightedScore: number
  duration: number
}

interface SuiteBreakdown {
  suite: string
  scenario: string
  runs: number
  successfulRuns: number
  avgScore: number
  avgWeightedScore: number
}

interface AgentPerformance {
  agent: string
  model: string | null
  runs: number
  successfulRuns: number
  avgWeightedScore: number
  minScore: number
  maxScore: number
}

interface TierDistribution {
  tier: string
  runs: number
  successfulRuns: number
  avgWeightedScore: number
}

interface EvaluatorBreakdown {
  evaluatorName: string
  avgScore: number
  maxScore: number
  count: number
}

interface Run {
  runId: string
  suite: string
  scenario: string
  tier: string
  agent: string
  model: string
  status: string
  weightedScore: number | null
}

interface FailedRun {
  runId: string
  suite: string
  scenario: string
  tier: string
  agent: string
  model: string
  error: string | null
}

function BatchDetailsPage() {
  const { batchId } = Route.useParams()
  const { db, isLoading, error, refreshDatabase, isRefreshing } = useDatabase()
  
  const [batchDetails, setBatchDetails] = useState<BatchDetails | null>(null)
  const [suiteBreakdown, setSuiteBreakdown] = useState<SuiteBreakdown[]>([])
  const [agentPerformance, setAgentPerformance] = useState<AgentPerformance[]>([])
  const [tierDistribution, setTierDistribution] = useState<TierDistribution[]>([])
  const [evaluatorBreakdown, setEvaluatorBreakdown] = useState<EvaluatorBreakdown[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [failedRuns, setFailedRuns] = useState<FailedRun[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!db) return

    try {
      // Fetch batch details
      const batchResult = db.exec(`
        SELECT
          batchId,
          createdAt,
          completedAt,
          totalRuns,
          successfulRuns,
          avgScore,
          avgWeightedScore
        FROM batch_runs
        WHERE batchId = '${batchId}'
      `)

      if (batchResult[0] && batchResult[0].values[0]) {
        const row = batchResult[0].values[0]
        const createdAt = row[1] as number
        const completedAt = row[2] as number | null
        setBatchDetails({
          batchId: row[0] as string,
          createdAt,
          completedAt,
          totalRuns: row[3] as number,
          successfulRuns: row[4] as number,
          avgScore: row[5] as number,
          avgWeightedScore: row[6] as number,
          duration: completedAt ? completedAt - createdAt : Date.now() - createdAt,
        })
      }

      // Fetch suite breakdown
      const suiteResult = db.exec(`
        SELECT
          suite,
          scenario,
          COUNT(*) as runs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successfulRuns,
          AVG(CASE WHEN status = 'completed' THEN total_score END) as avgScore,
          AVG(CASE WHEN status = 'completed' THEN weighted_score END) as avgWeightedScore
        FROM benchmark_runs
        WHERE batchId = '${batchId}'
        GROUP BY suite, scenario
        ORDER BY suite, scenario
      `)

      if (suiteResult[0]) {
        setSuiteBreakdown(
          suiteResult[0].values.map((row) => ({
            suite: row[0] as string,
            scenario: row[1] as string,
            runs: row[2] as number,
            successfulRuns: row[3] as number,
            avgScore: row[4] as number,
            avgWeightedScore: row[5] as number,
          }))
        )
      }

      // Fetch agent performance
      const agentResult = db.exec(`
        SELECT
          agent,
          model,
          COUNT(*) as runs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successfulRuns,
          AVG(CASE WHEN status = 'completed' THEN weighted_score END) as avgWeightedScore,
          MIN(CASE WHEN status = 'completed' THEN weighted_score END) as minScore,
          MAX(CASE WHEN status = 'completed' THEN weighted_score END) as maxScore
        FROM benchmark_runs
        WHERE batchId = '${batchId}'
        GROUP BY agent, model
        ORDER BY avgWeightedScore DESC
      `)

      if (agentResult[0]) {
        setAgentPerformance(
          agentResult[0].values.map((row) => ({
            agent: row[0] as string,
            model: row[1] as string | null,
            runs: row[2] as number,
            successfulRuns: row[3] as number,
            avgWeightedScore: row[4] as number,
            minScore: row[5] as number,
            maxScore: row[6] as number,
          }))
        )
      }

      // Fetch tier distribution
      const tierResult = db.exec(`
        SELECT
          tier,
          COUNT(*) as runs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as successfulRuns,
          AVG(CASE WHEN status = 'completed' THEN weighted_score END) as avgWeightedScore
        FROM benchmark_runs
        WHERE batchId = '${batchId}'
        GROUP BY tier
        ORDER BY tier
      `)

      if (tierResult[0]) {
        setTierDistribution(
          tierResult[0].values.map((row) => ({
            tier: row[0] as string,
            runs: row[1] as number,
            successfulRuns: row[2] as number,
            avgWeightedScore: row[3] as number,
          }))
        )
      }

      // Fetch evaluator breakdown
      const evaluatorResult = db.exec(`
        SELECT
          er.evaluator_name as evaluatorName,
          AVG(er.score) as avgScore,
          MAX(er.max_score) as maxScore,
          COUNT(*) as count
        FROM evaluation_results er
        JOIN benchmark_runs br ON er.run_id = br.run_id
        WHERE br.batchId = '${batchId}' AND br.status = 'completed'
        GROUP BY er.evaluator_name
        ORDER BY avgScore DESC
      `)

      if (evaluatorResult[0]) {
        setEvaluatorBreakdown(
          evaluatorResult[0].values.map((row) => ({
            evaluatorName: row[0] as string,
            avgScore: row[1] as number,
            maxScore: row[2] as number,
            count: row[3] as number,
          }))
        )
      }

      // Fetch all runs
      const runsResult = db.exec(`
        SELECT
          run_id,
          suite,
          scenario,
          tier,
          agent,
          model,
          status,
          weighted_score
        FROM benchmark_runs
        WHERE batchId = '${batchId}'
        ORDER BY started_at
      `)

      if (runsResult[0]) {
        setRuns(
          runsResult[0].values.map((row) => ({
            runId: row[0] as string,
            suite: row[1] as string,
            scenario: row[2] as string,
            tier: row[3] as string,
            agent: row[4] as string,
            model: row[5] as string,
            status: row[6] as string,
            weightedScore: row[7] as number | null,
          }))
        )
      }

      // Fetch failed runs
      const failedResult = db.exec(`
        SELECT
          run_id,
          suite,
          scenario,
          tier,
          agent,
          model,
          metadata
        FROM benchmark_runs
        WHERE batchId = '${batchId}' AND status = 'failed'
        ORDER BY started_at
      `)

      if (failedResult[0]) {
        setFailedRuns(
          failedResult[0].values.map((row) => {
            let error = null
            try {
              const metadata = row[6] as string
              if (metadata) {
                const parsed = JSON.parse(metadata)
                error = parsed.error
              }
            } catch {}
            
            return {
              runId: row[0] as string,
              suite: row[1] as string,
              scenario: row[2] as string,
              tier: row[3] as string,
              agent: row[4] as string,
              model: row[5] as string,
              error,
            }
          })
        )
      }
    } catch (err) {
      console.error('Failed to fetch batch details:', err)
    }
  }, [db, batchId])

  const copyBatchId = () => {
    navigator.clipboard.writeText(batchId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const exportAsJson = () => {
    const data = {
      batch: batchDetails,
      suiteBreakdown,
      agentPerformance,
      tierDistribution,
      evaluatorBreakdown,
      runs,
      failedRuns,
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `batch-${batchId.substring(0, 8)}.json`
    a.click()
  }

  if (isLoading || !batchDetails) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 text-red-600">
        Error: {error.message}
      </div>
    )
  }

  const successRate = batchDetails.totalRuns > 0
    ? (batchDetails.successfulRuns / batchDetails.totalRuns) * 100
    : 0

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-green-600'
    if (score >= 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Batch Details</h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive analytics for batch {batchId.substring(0, 16)}...
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={refreshDatabase} 
            disabled={isRefreshing}
            variant="outline" 
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
          </Button>
          <Button variant="outline" size="sm" onClick={copyBatchId}>
            <Copy className="h-4 w-4 mr-2" />
            {copied ? 'Copied!' : 'Copy ID'}
          </Button>
          <Button variant="outline" size="sm" onClick={exportAsJson}>
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Overview Card */}
      <Card className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Status</p>
            <Badge variant={batchDetails.completedAt ? 'success' : 'info'} className="text-sm">
              {batchDetails.completedAt ? 'Completed' : 'Running'}
            </Badge>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Total Runs</p>
            <p className="text-2xl font-bold">{batchDetails.totalRuns}</p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Success Rate</p>
            <div className="flex items-center gap-2">
              <Progress value={successRate} className="w-20 h-2" />
              <p className="text-lg font-semibold">{successRate.toFixed(1)}%</p>
            </div>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Average Score</p>
            <p className={`text-2xl font-bold ${getScoreColor(batchDetails.avgWeightedScore)}`}>
              {batchDetails.avgWeightedScore.toFixed(2)}/10
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Duration</p>
            <p className="text-lg font-semibold">
              {(batchDetails.duration / 1000).toFixed(2)}s
            </p>
          </div>
          
          <div>
            <p className="text-sm text-muted-foreground mb-1">Created</p>
            <p className="text-sm">{new Date(batchDetails.createdAt).toLocaleString()}</p>
          </div>
          
          {batchDetails.completedAt && (
            <div>
              <p className="text-sm text-muted-foreground mb-1">Completed</p>
              <p className="text-sm">{new Date(batchDetails.completedAt).toLocaleString()}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Suite Breakdown */}
      {suiteBreakdown.length > 0 && (
        <Card className="p-6">
          <h2 className="text-2xl font-bold mb-4">Suite Breakdown</h2>
          <div className="space-y-3">
            {suiteBreakdown.map((suite) => {
              const rate = suite.runs > 0 ? (suite.successfulRuns / suite.runs) * 100 : 0
              const scoreColor = getScoreColor(suite.avgWeightedScore)
              
              return (
                <div
                  key={`${suite.suite}-${suite.scenario}`}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold">
                      {suite.suite}/{suite.scenario}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={rate} className="w-24 h-1.5" />
                      <span className="text-xs text-muted-foreground">
                        {suite.successfulRuns}/{suite.runs} runs ({rate.toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                  <div className={`text-xl font-bold ${scoreColor}`}>
                    {suite.avgWeightedScore.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Agent Performance */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">Agent Performance</h2>
        
        {agentPerformance.length > 0 ? (
          <>
            {/* Bar Chart */}
            <div className="h-48 mb-4">
            <ChartContainer
              config={{
                score: {
                  label: 'Average Score',
                  color: 'hsl(var(--primary))',
                },
              }}
              className="h-full w-full !aspect-auto"
            >
              <BarChart data={agentPerformance.map(a => {
                const valuesResult = db!.exec(`
                  SELECT weighted_score FROM benchmark_runs
                  WHERE batchId = '${batchId}' AND agent = '${a.agent}' AND ${a.model ? `model = '${a.model}'` : `model IS NULL`}
                    AND status = 'completed' AND weighted_score IS NOT NULL
                `);
                const values = valuesResult[0]?.values.map(v => v[0] as number) || [];
                const [, p50, , p75] = computeQuantiles(values, [0.25, 0.5, 0.75]);
                const p25 = computeQuantiles(values, [0.25])[0];
                return {
                  name: a.model && a.model !== 'default' ? `${a.agent} [${a.model}]` : a.agent,
                  score: (a.avgWeightedScore ?? 0) / 10,
                  q25: (isNaN(p25) ? 0 : p25) / 10,
                  q75: (isNaN(p75) ? 0 : p75) / 10,
                  p50: (isNaN(p50) ? 0 : p50) / 10,
                };
              })}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  label={{ value: 'Agent', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  domain={[0, 1]} 
                  tickFormatter={scoreTickFormatter}
                  label={{ value: 'Score (0-10)', angle: -90, position: 'insideLeft' }}
                />
                <ChartTooltip 
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-background p-2 shadow-sm">
                        <div className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium">{payload[0].payload.name}</span>
                            <span className="text-sm font-bold">{formatTooltipScore(payload[0].value as number)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="score" fill="hsl(var(--primary))">
                  <ErrorBar dataKey="p50" xAxis={false} direction="y" width={2} stroke="hsl(var(--chart-3))" />
                  <ErrorBar dataKey="score" xAxis={false} direction="y" data={[{lowKey: 'q25', highKey: 'q75'}]} stroke="hsl(var(--chart-2))" />
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>

          {/* Table */}
          <div className="space-y-2">
            {agentPerformance.map((agent, index) => {
              const rankDisplay = index < 3 ? `#${index + 1}` : `${index + 1}.`
              const scoreColor = getScoreColor(agent.avgWeightedScore)
              
              return (
                <div key={`${agent.agent}-${agent.model}`} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm w-8">{rankDisplay}</span>
                    <span className="font-semibold">
                      {agent.model ? agent.model : agent.agent}
                    </span>
                    {agent.model && (
                      <span className="text-sm text-muted-foreground">({agent.agent})</span>
                    )}
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="text-sm text-muted-foreground">
                      {agent.successfulRuns}/{agent.runs} runs
                    </span>
                    <span className={`text-lg font-bold ${scoreColor}`}>
                      {agent.avgWeightedScore.toFixed(2)}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
          </>
        ) : (
          <div className="h-32 flex flex-col items-center justify-center text-muted-foreground">
            <p className="text-lg font-medium">No agent performance data available</p>
            <p className="text-sm mt-2">This batch may not have completed runs yet</p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tier Distribution */}
        {tierDistribution.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Tier Distribution</h2>
            
            {/* Pie Chart */}
            <div className="h-40 mb-4">
              <ChartContainer
                config={tierDistribution.reduce((acc, tier, idx) => ({
                  ...acc,
                  [tier.tier]: {
                    label: tier.tier,
                    color: COLORS[idx % COLORS.length],
                  },
                }), {})}
                className="h-full w-full !aspect-auto"
              >
                <PieChart>
                  <Pie
                    data={tierDistribution.map(t => ({
                      name: t.tier,
                      value: t.runs,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={50}
                  >
                    {tierDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </div>

            {/* Table */}
            <div className="space-y-2">
              {tierDistribution.map((tier) => (
                <div key={tier.tier} className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{tier.tier}</span>
                  <span className="text-muted-foreground">
                    {tier.runs} runs - {tier.avgWeightedScore.toFixed(2)}/10
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Evaluator Performance */}
        {evaluatorBreakdown.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Evaluator Performance</h2>
            <div className="space-y-2">
              {evaluatorBreakdown.map((evaluator) => {
                const percentage = (evaluator.avgScore / evaluator.maxScore) * 100
                const color = percentage >= 90 ? 'text-green-600' : percentage >= 70 ? 'text-yellow-600' : 'text-red-600'
                
                return (
                  <div key={evaluator.evaluatorName} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{evaluator.evaluatorName}</span>
                      <span className={`font-bold ${color}`}>
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={percentage} className="h-1.5" />
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>

      {/* Failed Runs */}
      {failedRuns.length > 0 && (
        <>
          {/* Failure Statistics */}
          <Card className="p-6 border-red-200 bg-red-50">
            <h2 className="text-xl font-bold mb-4 text-red-700">Failure Analysis</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{failedRuns.length}</p>
                <p className="text-sm text-red-700">Total Failed</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {((failedRuns.length / (batchDetails.totalRuns || 1)) * 100).toFixed(1)}%
                </p>
                <p className="text-sm text-red-700">Failure Rate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {new Set(failedRuns.map(r => r.error?.split(':')[0] || 'Unknown')).size}
                </p>
                <p className="text-sm text-red-700">Error Types</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">
                  {failedRuns.filter(r => r.error?.includes('workspace')).length}
                </p>
                <p className="text-sm text-red-700">Workspace Issues</p>
              </div>
            </div>
          </Card>

          {/* Failed Runs List */}
          <Card className="p-6 border-red-200 bg-red-50">
            <h2 className="text-xl font-bold mb-4 text-red-700">Failed Runs ({failedRuns.length})</h2>
            <div className="space-y-2">
            {failedRuns.map((run) => (
              <div key={run.runId} className="p-3 bg-white border border-red-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold text-red-700">
                      {run.suite}/{run.scenario} ({run.tier})
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Agent: {run.agent} {run.model && run.model !== 'default' ? `[${run.model}]` : ''}
                    </p>
                    {run.error && (
                      <p className="text-xs text-red-600 mt-1">Error: {run.error}</p>
                    )}
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/runs/$runId" params={{ runId: run.runId }}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
        </>
      )}

      {/* All Runs Table */}
      <Card className="p-6">
        <h2 className="text-2xl font-bold mb-4">All Runs ({runs.length})</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-semibold">Run ID</th>
                <th className="text-left p-2 font-semibold">Suite/Scenario</th>
                <th className="text-left p-2 font-semibold">Tier</th>
                <th className="text-left p-2 font-semibold">Agent</th>
                <th className="text-left p-2 font-semibold">Status</th>
                <th className="text-right p-2 font-semibold">Score</th>
                <th className="text-right p-2 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.runId} className="border-b hover:bg-accent">
                  <td className="p-2 font-mono text-xs">{run.runId.substring(0, 8)}...</td>
                  <td className="p-2">{run.suite}/{run.scenario}</td>
                  <td className="p-2">{run.tier}</td>
                  <td className="p-2">
                    {run.agent}
                    {run.model && run.model !== 'default' && (
                      <span className="text-xs text-muted-foreground ml-1">[{run.model}]</span>
                    )}
                  </td>
                  <td className="p-2">
                    <Badge variant={
                      run.status === 'completed' ? 'success' : 
                      run.status === 'failed' ? 'destructive' : 
                      run.status === 'running' ? 'info' : 'warning'
                    }>
                      {run.status}
                    </Badge>
                  </td>
                  <td className={`p-2 text-right font-semibold ${run.weightedScore ? getScoreColor(run.weightedScore) : 'text-gray-500'}`}>
                    {run.weightedScore?.toFixed(2) || 'N/A'}
                  </td>
                  <td className="p-2 text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/runs/$runId" params={{ runId: run.runId }}>
                        View
                      </Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
