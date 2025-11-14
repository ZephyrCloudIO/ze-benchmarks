import { createFileRoute, Link } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
import { Copy, Download, RefreshCw } from 'lucide-react'
import { scoreTickFormatter, formatTooltipScore, safeScore } from '@/lib/chart-utils'
import { useQuery } from '@tanstack/react-query'

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
  const [copied, setCopied] = useState(false)

  // Fetch batch details with runs
  const { data: batchData, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['batch', batchId],
    queryFn: () => apiClient.getBatchDetails(batchId),
  })

  // Compute batch details with duration
  const batchDetails = useMemo<BatchDetails | null>(() => {
    if (!batchData) return null

    const createdAt = batchData.createdAt
    const completedAt = batchData.completedAt || null
    const duration = completedAt ? completedAt - createdAt : Date.now() - createdAt

    return {
      batchId: batchData.batchId,
      createdAt,
      completedAt,
      totalRuns: batchData.totalRuns,
      successfulRuns: batchData.successfulRuns,
      avgScore: batchData.avgScore || 0,
      avgWeightedScore: batchData.avgWeightedScore || 0,
      duration,
    }
  }, [batchData])

  // Compute suite breakdown from batch runs
  const suiteBreakdown = useMemo<SuiteBreakdown[]>(() => {
    if (!batchData?.runs) return []

    const grouped = new Map<string, {
      suite: string
      scenario: string
      runs: number
      successfulRuns: number
      scores: number[]
      weightedScores: number[]
    }>()

    for (const run of batchData.runs) {
      const key = `${run.suite}::${run.scenario}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          suite: run.suite,
          scenario: run.scenario,
          runs: 0,
          successfulRuns: 0,
          scores: [],
          weightedScores: [],
        })
      }

      const group = grouped.get(key)!
      group.runs++

      if (run.status === 'completed') {
        group.successfulRuns++
        if (run.totalScore !== null && run.totalScore !== undefined) {
          group.scores.push(run.totalScore)
        }
        if (run.weightedScore !== null && run.weightedScore !== undefined) {
          group.weightedScores.push(run.weightedScore)
        }
      }
    }

    return Array.from(grouped.values()).map(g => ({
      suite: g.suite,
      scenario: g.scenario,
      runs: g.runs,
      successfulRuns: g.successfulRuns,
      avgScore: g.scores.length > 0 ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 0,
      avgWeightedScore: g.weightedScores.length > 0 ? g.weightedScores.reduce((a, b) => a + b, 0) / g.weightedScores.length : 0,
    })).sort((a, b) => {
      const suiteCompare = a.suite.localeCompare(b.suite)
      if (suiteCompare !== 0) return suiteCompare
      return a.scenario.localeCompare(b.scenario)
    })
  }, [batchData?.runs])

  // Compute agent performance from batch runs
  const agentPerformance = useMemo<AgentPerformance[]>(() => {
    if (!batchData?.runs) return []

    const grouped = new Map<string, {
      agent: string
      model: string | null
      runs: number
      successfulRuns: number
      weightedScores: number[]
    }>()

    for (const run of batchData.runs) {
      const key = `${run.agent}::${run.model || 'default'}`
      if (!grouped.has(key)) {
        grouped.set(key, {
          agent: run.agent,
          model: run.model || null,
          runs: 0,
          successfulRuns: 0,
          weightedScores: [],
        })
      }

      const group = grouped.get(key)!
      group.runs++

      if (run.status === 'completed') {
        group.successfulRuns++
        if (run.weightedScore !== null && run.weightedScore !== undefined) {
          group.weightedScores.push(run.weightedScore)
        }
      }
    }

    return Array.from(grouped.values()).map(g => ({
      agent: g.agent,
      model: g.model,
      runs: g.runs,
      successfulRuns: g.successfulRuns,
      avgWeightedScore: g.weightedScores.length > 0 ? g.weightedScores.reduce((a, b) => a + b, 0) / g.weightedScores.length : 0,
      minScore: g.weightedScores.length > 0 ? Math.min(...g.weightedScores) : 0,
      maxScore: g.weightedScores.length > 0 ? Math.max(...g.weightedScores) : 0,
    })).sort((a, b) => b.avgWeightedScore - a.avgWeightedScore)
  }, [batchData?.runs])

  // Compute tier distribution from batch runs
  const tierDistribution = useMemo<TierDistribution[]>(() => {
    if (!batchData?.runs) return []

    const grouped = new Map<string, {
      tier: string
      runs: number
      successfulRuns: number
      weightedScores: number[]
    }>()

    for (const run of batchData.runs) {
      if (!grouped.has(run.tier)) {
        grouped.set(run.tier, {
          tier: run.tier,
          runs: 0,
          successfulRuns: 0,
          weightedScores: [],
        })
      }

      const group = grouped.get(run.tier)!
      group.runs++

      if (run.status === 'completed') {
        group.successfulRuns++
        if (run.weightedScore !== null && run.weightedScore !== undefined) {
          group.weightedScores.push(run.weightedScore)
        }
      }
    }

    return Array.from(grouped.values()).map(g => ({
      tier: g.tier,
      runs: g.runs,
      successfulRuns: g.successfulRuns,
      avgWeightedScore: g.weightedScores.length > 0 ? g.weightedScores.reduce((a, b) => a + b, 0) / g.weightedScores.length : 0,
    })).sort((a, b) => a.tier.localeCompare(b.tier))
  }, [batchData?.runs])

  // Compute all runs list from batch runs
  const runs = useMemo<Run[]>(() => {
    if (!batchData?.runs) return []

    return batchData.runs.map(run => ({
      runId: run.runId,
      suite: run.suite,
      scenario: run.scenario,
      tier: run.tier,
      agent: run.agent,
      model: run.model || 'default',
      status: run.status,
      weightedScore: run.weightedScore,
    }))
  }, [batchData?.runs])

  // Compute failed runs from batch runs
  const failedRuns = useMemo<FailedRun[]>(() => {
    if (!batchData?.runs) return []

    return batchData.runs
      .filter(run => run.status === 'failed')
      .map(run => {
        let error = null
        try {
          if (run.metadata) {
            const parsed = JSON.parse(run.metadata)
            error = parsed.error
          }
        } catch {}

        return {
          runId: run.runId,
          suite: run.suite,
          scenario: run.scenario,
          tier: run.tier,
          agent: run.agent,
          model: run.model || 'default',
          error,
        }
      })
  }, [batchData?.runs])

  // Fetch evaluations for completed runs separately
  const completedRunIds = useMemo(() => {
    if (!batchData?.runs) return []
    return batchData.runs
      .filter(run => run.status === 'completed')
      .map(run => run.runId)
  }, [batchData?.runs])

  const { data: evaluationsData } = useQuery({
    queryKey: ['batch-evaluations', batchId, completedRunIds],
    queryFn: async () => {
      if (completedRunIds.length === 0) return []

      // Fetch evaluations for all completed runs
      const evaluationPromises = completedRunIds.map(runId =>
        apiClient.getRunEvaluations(runId).catch(() => [])
      )
      const allEvaluations = (await Promise.all(evaluationPromises)).flat()
      return allEvaluations
    },
    enabled: completedRunIds.length > 0,
  })

  // Compute evaluator breakdown from evaluations
  const evaluatorBreakdown = useMemo<EvaluatorBreakdown[]>(() => {
    if (!evaluationsData || evaluationsData.length === 0) return []

    const grouped = new Map<string, {
      scores: number[]
      maxScores: number[]
    }>()

    for (const evaluation of evaluationsData) {
      if (!grouped.has(evaluation.evaluatorName)) {
        grouped.set(evaluation.evaluatorName, {
          scores: [],
          maxScores: [],
        })
      }

      const group = grouped.get(evaluation.evaluatorName)!
      group.scores.push(evaluation.score)
      group.maxScores.push(evaluation.maxScore)
    }

    return Array.from(grouped.entries()).map(([evaluatorName, data]) => ({
      evaluatorName,
      avgScore: data.scores.reduce((a, b) => a + b, 0) / data.scores.length,
      maxScore: Math.max(...data.maxScores),
      count: data.scores.length,
    })).sort((a, b) => b.avgScore - a.avgScore)
  }, [evaluationsData])

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

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-green-600'
    if (score >= 7) return 'text-yellow-600'
    return 'text-red-600'
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
            onClick={() => refetch()}
            disabled={isRefetching}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
            {isRefetching ? 'Refreshing...' : 'Refresh Data'}
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
            <Badge variant={batchDetails.completedAt ? 'default' : 'secondary'} className="text-sm">
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
              <BarChart data={agentPerformance.map(a => ({
                name: a.model && a.model !== 'default' ? `${a.agent} [${a.model}]` : a.agent,
                score: safeScore(a.avgWeightedScore),
              }))}>
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
                <Bar dataKey="score" fill="hsl(var(--primary))" />
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
                      run.status === 'completed' ? 'default' :
                      run.status === 'failed' ? 'destructive' :
                      'secondary'
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
