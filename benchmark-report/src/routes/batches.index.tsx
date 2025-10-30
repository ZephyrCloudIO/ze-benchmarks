import { createFileRoute, Link } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/batches/')({
  component: BatchesPage,
})

interface Batch {
  batchId: string
  createdAt: number
  completedAt: number | null
  totalRuns: number
  successfulRuns: number
  avgScore: number | null
  avgWeightedScore: number | null
  metadata: string | null
}

type FilterStatus = 'all' | 'completed' | 'running'
type SortBy = 'newest' | 'oldest' | 'highest' | 'lowest'

function BatchesPage() {
  const { db, isLoading, error, refreshDatabase, isRefreshing } = useDatabase()
  const [batches, setBatches] = useState<Batch[]>([])
  const [filter, setFilter] = useState<FilterStatus>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  useEffect(() => {
    if (!db) return

    try {
      let query = `
        SELECT
          batchId,
          createdAt,
          completedAt,
          totalRuns,
          successfulRuns,
          avgScore,
          avgWeightedScore,
          metadata
        FROM batch_runs
      `

      const whereClauses: string[] = []
      
      if (filter === 'completed') {
        whereClauses.push("completedAt IS NOT NULL")
      } else if (filter === 'running') {
        whereClauses.push("completedAt IS NULL")
      }

      if (searchTerm) {
        whereClauses.push(`batchId LIKE '%${searchTerm}%'`)
      }

      if (whereClauses.length > 0) {
        query += ' WHERE ' + whereClauses.join(' AND ')
      }

      // Add sorting
      if (sortBy === 'newest') {
        query += ' ORDER BY createdAt DESC'
      } else if (sortBy === 'oldest') {
        query += ' ORDER BY createdAt ASC'
      } else if (sortBy === 'highest') {
        query += ' ORDER BY avgWeightedScore DESC'
      } else if (sortBy === 'lowest') {
        query += ' ORDER BY avgWeightedScore ASC'
      }

      const result = db.exec(query)

      if (result[0]) {
        const batchesData = result[0].values.map((row) => ({
          batchId: row[0] as string,
          createdAt: row[1] as number,
          completedAt: row[2] as number | null,
          totalRuns: row[3] as number,
          successfulRuns: row[4] as number,
          avgScore: row[5] as number | null,
          avgWeightedScore: row[6] as number | null,
          metadata: row[7] as string | null,
        }))
        setBatches(batchesData)
      } else {
        setBatches([])
      }
    } catch (err) {
      console.error('Failed to fetch batches:', err)
      setBatches([])
    }
  }, [db, filter, sortBy, searchTerm])

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
      <div className="flex items-center justify-center h-64 text-destructive">
        Error: {error.message}
      </div>
    )
  }

  // Pagination
  const totalPages = Math.ceil(batches.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedBatches = batches.slice(startIndex, startIndex + itemsPerPage)

  const getScoreColor = (score: number | null) => {
    if (!score) return 'text-gray-500'
    if (score >= 9) return 'text-green-600'
    if (score >= 7) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDuration = (createdAt: number, completedAt: number | null) => {
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
          onClick={refreshDatabase} 
          disabled={isRefreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Data'}
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
