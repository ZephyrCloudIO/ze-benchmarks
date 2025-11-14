import { createFileRoute, Link } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/batches/')({
  component: BatchesPage,
})

type FilterStatus = 'all' | 'completed' | 'running'
type SortBy = 'newest' | 'oldest' | 'highest' | 'lowest'

function BatchesPage() {
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  const { data: batchesData, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['batches', 100],
    queryFn: () => apiClient.listBatches(100),
  })

  // Filter and sort batches
  const batches = useMemo(() => {
    if (!batchesData) return []

    let filtered = [...batchesData]

    // Apply status filter
    if (filter === 'completed') {
      filtered = filtered.filter(b => b.completedAt !== null && b.completedAt !== undefined)
    } else if (filter === 'running') {
      filtered = filtered.filter(b => b.completedAt === null || b.completedAt === undefined)
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(b => b.batchId.toLowerCase().includes(searchTerm.toLowerCase()))
    }

    // Apply sorting
    if (sortBy === 'newest') {
      filtered.sort((a, b) => b.createdAt - a.createdAt)
    } else if (sortBy === 'oldest') {
      filtered.sort((a, b) => a.createdAt - b.createdAt)
    } else if (sortBy === 'highest') {
      filtered.sort((a, b) => (b.avgWeightedScore || 0) - (a.avgWeightedScore || 0))
    } else if (sortBy === 'lowest') {
      filtered.sort((a, b) => (a.avgWeightedScore || 0) - (b.avgWeightedScore || 0))
    }

    return filtered
  }, [batchesData, filter, sortBy, searchTerm])

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
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

  // Pagination
  const totalPages = Math.ceil(batches.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBatches = batches.slice(startIndex, startIndex + itemsPerPage)

  const getScoreColor = (score: number | null | undefined) => {
    if (!score) return 'text-gray-500'
    if (score >= 9) return 'text-green-600'
    if (score >= 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDuration = (createdAt: number, completedAt: number | null | undefined) => {
    if (!completedAt) return 'Running...'
    const duration = (completedAt - createdAt) / 1000
    if (duration < 60) return `${duration.toFixed(0)}s`
    if (duration < 3600) return `${(duration / 60).toFixed(1)}m`
    return `${(duration / 3600).toFixed(1)}h`
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Batches</h1>
          <p className="text-muted-foreground mt-2">
            View and manage benchmark batch runs
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isRefetching}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          {isRefetching ? 'Refreshing...' : 'Refresh Data'}
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        {/* Filter Tabs */}
        <div className="flex gap-2">
          <Button
            variant={filter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter('all')
              setCurrentPage(1)
            }}
          >
            All
          </Button>
          <Button
            variant={filter === 'completed' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter('completed')
              setCurrentPage(1)
            }}
          >
            Completed
          </Button>
          <Button
            variant={filter === 'running' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setFilter('running')
              setCurrentPage(1)
            }}
          >
            Running
          </Button>
        </div>

        {/* Sort and Search */}
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-3 py-2 border rounded-md text-sm bg-background"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest">Highest Score</option>
            <option value="lowest">Lowest Score</option>
          </select>
          <input
            type="text"
            placeholder="Search batch ID..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value)
              setCurrentPage(1)
            }}
            className="px-3 py-2 border rounded-md text-sm flex-1 md:w-64"
          />
        </div>
      </div>

      {/* Batches List */}
      {paginatedBatches.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No batches found. Run some benchmarks to see batch statistics here.
          </p>
          <Button asChild variant="outline">
            <Link to="/">Go to Dashboard</Link>
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {paginatedBatches.map((batch) => {
            const successRate = batch.totalRuns > 0
              ? (batch.successfulRuns / batch.totalRuns) * 100
              : 0
            const duration = formatDuration(batch.createdAt, batch.completedAt)
            const scoreColor = getScoreColor(batch.avgWeightedScore)

            return (
              <Card key={batch.batchId} className="p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col md:flex-row gap-4 justify-between">
                  {/* Left: Batch Info */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-3">
                      <Link
                        to="/batches/$batchId"
                        params={{ batchId: batch.batchId }}
                        className="text-lg font-semibold hover:underline"
                      >
                        {batch.batchId.substring(0, 8)}...
                      </Link>
                      <Badge variant={batch.completedAt ? 'default' : 'secondary'}>
                        {batch.completedAt ? 'Completed' : 'Running'}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      Created {new Date(batch.createdAt).toLocaleString()}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {batch.successfulRuns}/{batch.totalRuns} runs
                      </span>
                      <Progress value={successRate} className="w-32 h-2" />
                      <span className="text-sm font-medium">{successRate.toFixed(0)}%</span>
                      {batch.totalRuns - batch.successfulRuns > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {batch.totalRuns - batch.successfulRuns} failed
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right: Metrics */}
                  <div className="flex gap-6 items-center">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Avg Score</p>
                      <p className={`text-2xl font-bold ${scoreColor}`}>
                        {batch.avgWeightedScore?.toFixed(2) || 'N/A'}
                      </p>
                    </div>

                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-1">Duration</p>
                      <p className="text-lg font-semibold">{duration}</p>
                    </div>

                    <div className="flex flex-col gap-2">
                      <Button asChild size="sm">
                        <Link
                          to="/batches/$batchId"
                          params={{ batchId: batch.batchId }}
                        >
                          View Details
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          to="/batches/compare"
                          search={{ ids: [batch.batchId] }}
                        >
                          Compare
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </Button>
          <div className="flex items-center gap-2 px-4">
            <span className="text-sm">
              Page {currentPage} of {totalPages}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
