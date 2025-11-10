import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ChartContainer, ChartTooltip } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from 'recharts'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { generateSeriesColors } from '@/lib/chart-utils'

export const Route = createFileRoute('/batches/compare')({
  component: BatchComparePage,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      ids: Array.isArray(search.ids) ? search.ids as string[] : [],
    }
  },
})

interface BatchComparison {
  batchId: string
  createdAt: number
  completedAt: number | null
  totalRuns: number
  successfulRuns: number
  avgScore: number
  avgWeightedScore: number
  duration: number | null
}

function BatchComparePage() {
  const { ids } = Route.useSearch()
  const navigate = useNavigate()
  const { db, isLoading, error } = useDatabase()
  
  const [batches, setBatches] = useState<BatchComparison[]>([])
  const [availableBatches, setAvailableBatches] = useState<{id: string, label: string}[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>(ids || [])

  // Fetch available batches for selection
  useEffect(() => {
    if (!db) return

    try {
      const result = db.exec(`
        SELECT batchId, createdAt, totalRuns, avgWeightedScore
        FROM batch_runs
        WHERE completedAt IS NOT NULL
        ORDER BY createdAt DESC
        LIMIT 20
      `)

      if (result[0]) {
        const options = result[0].values.map((row) => ({
          id: row[0] as string,
          label: `${(row[0] as string).substring(0, 8)}... - ${row[2]} runs - ${row[3] ? (row[3] as number).toFixed(2) : 'N/A'}/10`,
        }))
        setAvailableBatches(options)
      }
    } catch (err) {
      console.error('Failed to fetch available batches:', err)
    }
  }, [db])

  // Fetch comparison data
  useEffect(() => {
    if (!db || selectedIds.length < 2) {
      setBatches([])
      return
    }

    try {
      // sql.js uses string interpolation for queries
      const safeQuery = `
        SELECT
          batchId,
          createdAt,
          completedAt,
          totalRuns,
          successfulRuns,
          avgScore,
          avgWeightedScore
        FROM batch_runs
        WHERE batchId IN (${selectedIds.map(id => `'${id}'`).join(',')})
        ORDER BY avgWeightedScore DESC
      `

      const result = db.exec(safeQuery)

      if (result[0]) {
        const batchData = result[0].values.map((row) => {
          const createdAt = row[1] as number
          const completedAt = row[2] as number | null
          return {
            batchId: row[0] as string,
            createdAt,
            completedAt,
            totalRuns: row[3] as number,
            successfulRuns: row[4] as number,
            avgScore: row[5] as number,
            avgWeightedScore: row[6] as number,
            duration: completedAt ? completedAt - createdAt : null,
          }
        })
        setBatches(batchData)
      } else {
        setBatches([])
      }
    } catch (err) {
      console.error('Failed to fetch batch comparison:', err)
      setBatches([])
    }
  }, [db, selectedIds])

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
    return <div className="flex items-center justify-center h-64">Loading...</div>
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
              .filter(b => !selectedIds.includes(b.id))
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
                            {batch.avgWeightedScore.toFixed(2)}
                          </span>
                          {idx > 0 && getDeltaIndicator(batch.avgWeightedScore, batches[0].avgWeightedScore)}
                        </div>
                      </td>
                    ))}
                  </tr>
                  
                  <tr className="border-b hover:bg-accent">
                    <td className="p-2 font-medium">Duration</td>
                    {batches.map((batch) => (
                      <td key={batch.batchId} className="text-center p-2">
                        {batch.duration ? `${(batch.duration / 1000).toFixed(0)}s` : 'N/A'}
                      </td>
                    ))}
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

          {/* Success Rate Comparison */}
          <Card className="p-6">
            <h2 className="text-2xl font-bold mb-4">Success Rate Comparison</h2>
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
                    name: 'Success Rate %',
                    ...batches.reduce((acc, batch, idx) => ({
                      ...acc,
                      [`batch${idx}`]: batch.totalRuns > 0 ? (batch.successfulRuns / batch.totalRuns) * 100 : 0,
                    }), {}),
                  }]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} label={{ value: 'Success %', angle: -90, position: 'insideLeft' }} />
                  <ChartTooltip />
                  {batches.map((batch, idx) => (
                    <Bar key={batch.batchId} dataKey={`batch${idx}`} fill={generateSeriesColors(batches.length)[idx]} name={batch.batchId.substring(0, 8)}>
                      <LabelList dataKey={`batch${idx}`} position="top" formatter={(v: number) => `${(v as number).toFixed(0)}%`} />
                    </Bar>
                  ))}
                </BarChart>
              </ChartContainer>
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
                      [`batch${idx}`]: (batch.avgWeightedScore ?? 0),
                    }), {}),
                  }]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    label={{ value: 'Metric', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    domain={[0, 10]} 
                    tickFormatter={(v) => `${v}`}
                    label={{ value: 'Score (0–10)', angle: -90, position: 'insideLeft' }}
                  />
                  <ChartTooltip />
                  {batches.map((batch, idx) => (
                    <Bar
                      key={batch.batchId}
                      dataKey={`batch${idx}`}
                      fill={generateSeriesColors(batches.length)[idx]}
                      name={batch.batchId.substring(0, 8)}
                    >
                      <LabelList dataKey={`batch${idx}`} position="top" formatter={(v: number) => (v as number).toFixed(2)} />
                    </Bar>
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
                    {bestBatch.avgWeightedScore.toFixed(2)}/10
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
