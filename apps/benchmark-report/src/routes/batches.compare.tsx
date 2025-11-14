import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { scoreTickFormatter, formatTooltipScore, safeScore, generateSeriesColors } from '@/lib/chart-utils'

export const Route = createFileRoute('/batches/compare')({
  component: BatchComparePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      ids: Array.isArray(search.ids) ? search.ids as string[] : [],
    }
  },
})

function BatchComparePage() {
  const { ids } = Route.useSearch()
  const navigate = useNavigate()
  const [selectedIds, setSelectedIds] = useState<string[]>(ids || [])

  // Fetch available batches for selection
  const { data: availableBatches } = useQuery({
    queryKey: ['batches-for-comparison', 20],
    queryFn: async () => {
      const batches = await apiClient.listBatches(20)
      return batches
        .filter(b => b.completedAt !== null && b.completedAt !== undefined)
        .map(b => ({
          id: b.batchId,
          label: `${b.batchId.substring(0, 8)}... - ${b.totalRuns} runs - ${b.avgWeightedScore ? b.avgWeightedScore.toFixed(2) : 'N/A'}/10`,
        }))
    },
  })

  // Fetch selected batches
  const { data: batchesData, isLoading, error } = useQuery({
    queryKey: ['batch-comparison', selectedIds],
    queryFn: async () => {
      if (selectedIds.length < 2) return []

      const batchPromises = selectedIds.map(id => apiClient.getBatchDetails(id))
      return await Promise.all(batchPromises)
    },
    enabled: selectedIds.length >= 2,
  })

  // Sort batches by avgWeightedScore
  const batches = useMemo(() => {
    if (!batchesData) return []
    return [...batchesData].sort((a, b) => (b.avgWeightedScore || 0) - (a.avgWeightedScore || 0))
  }, [batchesData])

  const handleAddBatch = (batchId: string) => {
    if (selectedIds.length >= 5) {
      alert('Maximum 5 batches can be compared')
      return
    }
    if (!selectedIds.includes(batchId)) {
      const newIds = [...selectedIds, batchId]
      setSelectedIds(newIds)
      navigate({ to: '/batches/compare', search: { ids: newIds } })
    }
  }

  const handleRemoveBatch = (batchId: string) => {
    const newIds = selectedIds.filter(id => id !== batchId)
    setSelectedIds(newIds)
    navigate({ to: '/batches/compare', search: { ids: newIds } })
  }

  const getDeltaIndicator = (value: number, comparedTo: number) => {
    const delta = value - comparedTo
    if (Math.abs(delta) < 0.01) {
      return <Minus className="h-4 w-4 text-gray-500" />
    }
    if (delta > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600" />
    }
    return <TrendingDown className="h-4 w-4 text-red-600" />
  }

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading batch comparison...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>
  }

  const bestBatch = batches.length > 0 ? batches[0] : null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Compare Batches</h1>
        <p className="text-muted-foreground mt-2">
          Compare performance metrics across multiple benchmark batches
        </p>
      </div>

      {/* Batch Selection */}
      <Card className="p-6">
        <h2 className="text-xl font-bold mb-4">Select Batches to Compare (2-5)</h2>

        {/* Selected Batches */}
        {selectedIds.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {selectedIds.map(id => (
              <Badge key={id} variant="secondary" className="px-3 py-1">
                {id.substring(0, 8)}...
                <button
                  onClick={() => handleRemoveBatch(id)}
                  className="ml-2 hover:text-red-600"
                >
                  ×
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Add Batch Selector */}
        {selectedIds.length < 5 && (
          <select
            onChange={(e) => {
              if (e.target.value) {
                handleAddBatch(e.target.value)
                e.target.value = ''
              }
            }}
            className="w-full px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value="">Select a batch to add...</option>
            {availableBatches
              ?.filter(b => !selectedIds.includes(b.id))
              .map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.label}
                </option>
              ))}
          </select>
        )}
      </Card>

      {/* Comparison Results */}
      {batches.length < 2 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">
            Select at least 2 batches to compare
          </p>
        </Card>
      ) : (
        <>
          {/* Comparison Table */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Comparison</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2 font-semibold">Metric</th>
                    {batches.map((batch) => (
                      <th key={batch.batchId} className="text-center p-2 font-semibold">
                        {batch.batchId.substring(0, 8)}...
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b hover:bg-accent">
                    <td className="p-2 font-medium">Total Runs</td>
                    {batches.map((batch) => (
                      <td key={batch.batchId} className="text-center p-2">
                        {batch.totalRuns}
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b hover:bg-accent">
                    <td className="p-2 font-medium">Success Rate</td>
                    {batches.map((batch, idx) => {
                      const rate = batch.totalRuns > 0
                        ? (batch.successfulRuns / batch.totalRuns) * 100
                        : 0
                      return (
                        <td key={batch.batchId} className="text-center p-2">
                          <div className="flex items-center justify-center gap-2">
                            {rate.toFixed(1)}%
                            {idx > 0 && getDeltaIndicator(rate, (batches[0].successfulRuns / batches[0].totalRuns) * 100)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>

                  <tr className="border-b hover:bg-accent">
                    <td className="p-2 font-medium">Average Score</td>
                    {batches.map((batch, idx) => (
                      <td key={batch.batchId} className="text-center p-2">
                        <div className="flex items-center justify-center gap-2">
                          <span className="font-bold">
                            {(batch.avgWeightedScore || 0).toFixed(2)}
                          </span>
                          {idx > 0 && getDeltaIndicator(batch.avgWeightedScore || 0, batches[0].avgWeightedScore || 0)}
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr className="border-b hover:bg-accent">
                    <td className="p-2 font-medium">Duration</td>
                    {batches.map((batch) => {
                      const duration = batch.completedAt && batch.createdAt
                        ? (batch.completedAt - batch.createdAt) / 1000
                        : null
                      return (
                        <td key={batch.batchId} className="text-center p-2">
                          {duration ? `${duration.toFixed(0)}s` : 'N/A'}
                        </td>
                      )
                    })}
                  </tr>

                  <tr className="border-b hover:bg-accent">
                    <td className="p-2 font-medium">Created</td>
                    {batches.map((batch) => (
                      <td key={batch.batchId} className="text-center p-2 text-xs">
                        {new Date(batch.createdAt).toLocaleDateString()}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Score Comparison Chart */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Score Comparison</h2>
            <div className="h-64">
              <ChartContainer
                config={batches.reduce((acc, batch, idx) => ({
                  ...acc,
                  [`batch${idx}`]: {
                    label: batch.batchId.substring(0, 8),
                    color: generateSeriesColors(batches.length)[idx],
                  },
                }), {})}
              >
                <BarChart
                  data={[{
                    name: 'Average Score',
                    ...batches.reduce((acc, batch, idx) => ({
                      ...acc,
                      [`batch${idx}`]: safeScore(batch.avgWeightedScore || 0),
                    }), {}),
                  }]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="name"
                    label={{ value: 'Metric', position: 'insideBottom', offset: -5 }}
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
                            <div className="text-sm font-medium mb-2">Batch Comparison</div>
                            {payload.map((entry, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-2">
                                <span className="text-sm">{entry.name}</span>
                                <span className="text-sm font-bold">{formatTooltipScore(entry.value as number)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    }}
                  />
                  {batches.map((batch, idx) => (
                    <Bar
                      key={batch.batchId}
                      dataKey={`batch${idx}`}
                      fill={generateSeriesColors(batches.length)[idx]}
                      name={batch.batchId.substring(0, 8)}
                    />
                  ))}
                </BarChart>
              </ChartContainer>
            </div>
          </Card>

          {/* Best Performer */}
          {bestBatch && (
            <Card className="p-6 bg-green-50 border-green-200">
              <h2 className="text-xl font-bold mb-2 text-green-700">Best Performing Batch</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">
                    {bestBatch.batchId.substring(0, 16)}...
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {bestBatch.successfulRuns}/{bestBatch.totalRuns} runs successful
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-bold text-green-600">
                    {(bestBatch.avgWeightedScore || 0).toFixed(2)}/10
                  </p>
                  <Button asChild size="sm" variant="outline" className="mt-2">
                    <Link to="/batches/$batchId" params={{ batchId: bestBatch.batchId }}>
                      View Details
                    </Link>
                  </Button>
                </div>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
