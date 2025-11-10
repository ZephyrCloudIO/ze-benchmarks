import { createFileRoute, Link } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { RefreshCw } from 'lucide-react'

export const Route = createFileRoute('/runs/')({
  component: RunsPage,
})

interface Run {
  runId: string;
  batchId: string | null;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model: string;
  status: string;
  weightedScore: number | null;
  startedAt: string;
  completedAt: string | null;
  metadata: string | null;
}

function RunsPage() {
  const { db, isLoading, error, refreshDatabase, isRefreshing } = useDatabase();
  const [runs, setRuns] = useState<Run[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'incomplete' | 'running'>('all');

  useEffect(() => {
    if (!db) return;

    try {
      let query = `
        SELECT
          run_id,
          batchId,
          suite,
          scenario,
          tier,
          agent,
          model,
          status,
          weighted_score,
          started_at,
          completed_at,
          metadata
        FROM benchmark_runs
      `;

      if (filter === 'completed') {
        query += " WHERE status = 'completed'";
      } else if (filter === 'failed') {
        query += " WHERE status = 'failed'";
      } else if (filter === 'incomplete') {
        query += " WHERE status = 'incomplete'";
      } else if (filter === 'running') {
        query += " WHERE status = 'running'";
      }

      query += ' ORDER BY started_at DESC LIMIT 100';

      const result = db.exec(query);

      if (result[0]) {
        const runsData = result[0].values.map((row) => ({
          runId: row[0] as string,
          batchId: row[1] as string | null,
          suite: row[2] as string,
          scenario: row[3] as string,
          tier: row[4] as string,
          agent: row[5] as string,
          model: row[6] as string,
          status: row[7] as string,
          weightedScore: row[8] as number | null,
          startedAt: row[9] as string,
          completedAt: row[10] as string | null,
          metadata: row[11] as string | null,
        }));
        setRuns(runsData);
      } else {
        setRuns([]);
      }
    } catch (err) {
      console.error('Failed to fetch runs:', err);
      setRuns([]);
    }
  }, [db, filter]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading database...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-destructive">Error: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold tracking-tight">Benchmark Runs</h1>
          <p className="text-muted-foreground mt-2">
            Browse and analyze all benchmark runs
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

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <Button
          variant={filter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('all')}
        >
          All
        </Button>
        <Button
          variant={filter === 'completed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('completed')}
        >
          Completed
        </Button>
        <Button
          variant={filter === 'failed' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('failed')}
        >
          Failed
        </Button>
        <Button
          variant={filter === 'incomplete' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('incomplete')}
        >
          Incomplete
        </Button>
        <Button
          variant={filter === 'running' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setFilter('running')}
        >
          Running
        </Button>
      </div>

      {/* Runs List */}
      {runs.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-muted-foreground mb-2">
            {filter === 'all' && 'No runs yet'}
            {filter === 'completed' && 'No completed runs'}
            {filter === 'failed' && 'No failed runs'}
            {filter === 'incomplete' && 'No incomplete runs'}
            {filter === 'running' && 'No running runs'}
          </p>
          <p className="text-sm text-muted-foreground">
            {filter === 'all' && 'Run some benchmarks to get started'}
            {filter === 'completed' && 'Completed runs will appear here'}
            {filter === 'failed' && 'Failed runs will appear here'}
            {filter === 'incomplete' && 'Incomplete runs will appear here'}
            {filter === 'running' && 'Running runs will appear here'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {runs.map((run) => (
            <Card key={run.runId} className="p-6 hover:shadow-md transition-shadow">
              <Link
                to="/runs/$runId"
                params={{ runId: run.runId }}
                className="block"
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="text-lg font-semibold hover:underline truncate">
                      {run.scenario}
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{run.suite}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                        {run.tier}
                      </span>
                      <span>•</span>
                      <span>{run.model || run.agent}</span>
                      {run.batchId && (
                        <>
                          <span>•</span>
                          <Link
                            to="/batches/$batchId"
                            params={{ batchId: run.batchId }}
                            className="text-blue-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            batch
                          </Link>
                        </>
                      )}
                    </div>
                    {run.status === 'failed' && run.metadata && (
                      <div className="text-xs text-destructive-foreground bg-destructive/20 px-3 py-2 rounded-lg">
                        {(() => {
                          try {
                            const metadata = JSON.parse(run.metadata);
                            const error = metadata.error || 'Unknown error';
                            return error.length > 80 ? error.substring(0, 80) + '...' : error;
                          } catch {
                            return 'Parse error';
                          }
                        })()}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-6 shrink-0">
                    <Badge
                      variant={
                        run.status === 'completed' ? 'success' :
                        run.status === 'failed' ? 'destructive' :
                        run.status === 'incomplete' ? 'incomplete' :
                        run.status === 'running' ? 'running' :
                        'secondary'
                      }
                    >
                      {run.status}
                    </Badge>
                    {run.weightedScore !== null ? (
                      <div className="text-center min-w-[60px]">
                        <div className="font-bold text-2xl">{run.weightedScore.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">score</div>
                      </div>
                    ) : (
                      <div className="text-center text-muted-foreground min-w-[60px]">—</div>
                    )}
                    <div className="text-right text-xs text-muted-foreground min-w-[100px]">
                      {new Date(run.startedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
