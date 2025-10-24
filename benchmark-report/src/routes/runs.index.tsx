import { createFileRoute, Link } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/runs/')({
  component: RunsPage,
})

interface Run {
  runId: string;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  model: string;
  status: string;
  weightedScore: number | null;
  startedAt: string;
  completedAt: string | null;
}

function RunsPage() {
  const { db, isLoading, error } = useDatabase();
  const [runs, setRuns] = useState<Run[]>([]);
  const [filter, setFilter] = useState<'all' | 'completed' | 'failed'>('all');

  useEffect(() => {
    if (!db) return;

    try {
      let query = `
        SELECT
          run_id,
          suite,
          scenario,
          tier,
          agent,
          model,
          status,
          weighted_score,
          started_at,
          completed_at
        FROM benchmark_runs
      `;

      if (filter === 'completed') {
        query += " WHERE status = 'completed'";
      } else if (filter === 'failed') {
        query += " WHERE status = 'failed'";
      }

      query += ' ORDER BY started_at DESC LIMIT 100';

      const result = db.exec(query);

      if (result[0]) {
        const runsData = result[0].values.map((row) => ({
          runId: row[0] as string,
          suite: row[1] as string,
          scenario: row[2] as string,
          tier: row[3] as string,
          agent: row[4] as string,
          model: row[5] as string,
          status: row[6] as string,
          weightedScore: row[7] as number | null,
          startedAt: row[8] as string,
          completedAt: row[9] as string | null,
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
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Benchmark Runs</h1>
        <p className="text-muted-foreground mt-2">
          Browse and search all benchmark runs
        </p>
      </div>

      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('completed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'completed'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Completed
        </button>
        <button
          onClick={() => setFilter('failed')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            filter === 'failed'
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted hover:bg-muted/80'
          }`}
        >
          Failed
        </button>
      </div>

      {/* Runs Table */}
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">
              {filter === 'all' ? 'All' : filter.charAt(0).toUpperCase() + filter.slice(1)} Runs
            </h2>
            <div className="text-sm text-muted-foreground">
              {runs.length} run{runs.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div className="space-y-2">
            {runs.length > 0 ? (
              runs.map((run) => (
                <Link
                  key={run.runId}
                  to="/runs/$runId"
                  params={{ runId: run.runId }}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors cursor-pointer"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{run.scenario}</div>
                    <div className="text-sm text-muted-foreground flex gap-2 items-center flex-wrap">
                      <span>{run.suite}</span>
                      <span>•</span>
                      <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                        {run.tier}
                      </span>
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
                    <Badge
                      variant={
                        run.status === 'completed' ? 'default' :
                        run.status === 'failed' ? 'destructive' :
                        'secondary'
                      }
                    >
                      {run.status}
                    </Badge>
                  </div>
                  <div className="text-right min-w-[80px]">
                    {run.weightedScore !== null ? (
                      <>
                        <div className="font-bold text-lg">{run.weightedScore.toFixed(2)}</div>
                        <div className="text-xs text-muted-foreground">score</div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">-</div>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground min-w-[140px]">
                    <div>{new Date(run.startedAt).toLocaleDateString()}</div>
                    <div>{new Date(run.startedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-2">
                  {filter === 'all' && 'No benchmark runs found'}
                  {filter === 'completed' && 'No completed runs yet'}
                  {filter === 'failed' && 'No failed runs - great job! 🎉'}
                </div>
                <div className="text-sm text-muted-foreground">
                  {filter === 'all' && 'Run some benchmarks to see them here'}
                  {filter === 'completed' && 'Completed runs will appear here'}
                  {filter === 'failed' && 'Failed runs will appear here for debugging'}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
