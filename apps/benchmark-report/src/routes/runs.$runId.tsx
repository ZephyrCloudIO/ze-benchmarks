import { createFileRoute, Link } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useQuery } from '@tanstack/react-query'
import { HumanScoreDisplay } from '@/components/HumanScoreDisplay'
import { HumanVsLLMComparison } from '@/components/HumanVsLLMComparison'

export const Route = createFileRoute('/runs/$runId')({
  component: RunDetailsPage,
})

function RunDetailsPage() {
  const { runId } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['runDetails', runId],
    queryFn: () => apiClient.getRunDetails(runId),
  });

  const { data: humanScores } = useQuery({
    queryKey: ['humanScores', runId],
    queryFn: () => apiClient.getHumanScores(runId),
    enabled: !!data?.run,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading run details...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>;
  }

  if (!data?.run) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Run not found</div>;
  }

  const runDetails = data.run;
  const telemetry = data.telemetry;
  const evaluations = data.evaluations;

  const getScoreColor = (score: number, maxScore: number) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 90) return 'text-green-600';
    if (percentage >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Run Details</h1>
        <p className="text-muted-foreground mt-2">
          Detailed information for benchmark run
        </p>
      </div>

      {/* Run Info Card */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold">{runDetails.scenario}</h2>
            <p className="text-muted-foreground mt-1">{runDetails.suite}</p>
          </div>
          <Badge variant={runDetails.status === 'completed' ? 'default' : 'destructive'}>
            {runDetails.status}
          </Badge>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-sm text-muted-foreground">Run ID</div>
            <div className="font-mono text-sm mt-1">{runDetails.runId}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Tier</div>
            <div className="font-semibold mt-1">{runDetails.tier}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Agent</div>
            <div className="font-semibold mt-1">{runDetails.agent}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Model</div>
            <div className="font-semibold mt-1">{runDetails.model || <span className="text-muted-foreground">None</span>}</div>
          </div>
          {runDetails.batchId && (
            <div>
              <div className="text-sm text-muted-foreground">Batch</div>
              <div className="mt-1">
                <Link
                  to="/batches/$batchId"
                  params={{ batchId: runDetails.batchId }}
                  className="text-blue-600 hover:underline font-mono text-sm"
                >
                  {runDetails.batchId.substring(0, 8)}...
                </Link>
              </div>
            </div>
          )}
          <div>
            <div className="text-sm text-muted-foreground">Started</div>
            <div className="font-semibold mt-1">
              {new Date(runDetails.startedAt).toLocaleString()}
            </div>
          </div>
          {runDetails.completedAt && (
            <div>
              <div className="text-sm text-muted-foreground">Completed</div>
              <div className="font-semibold mt-1">
                {new Date(runDetails.completedAt).toLocaleString()}
              </div>
            </div>
          )}
        </div>
        
        {/* Batch Action Button */}
        {runDetails.batchId && (
          <div className="mt-4 pt-4 border-t">
            <Button asChild variant="outline" size="sm">
              <Link to="/batches/$batchId" params={{ batchId: runDetails.batchId }}>
                View Full Batch
              </Link>
            </Button>
          </div>
        )}
      </div>

      {/* Error Details for Failed Runs */}
      {runDetails.status === 'failed' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="text-2xl font-semibold mb-4 text-red-700">Error Details</h2>
          <div className="space-y-2">
            <div className="p-3 bg-white border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">
                {(() => {
                  try {
                    // Try to get error from telemetry or other sources
                    return 'Run failed - check logs for details';
                  } catch {
                    return 'Unknown error occurred';
                  }
                })()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Score Breakdown */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Score Breakdown</h2>
        <div className="grid gap-4 md:grid-cols-2 mb-6">
          <div className="p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Total Score</div>
            <div className="text-3xl font-bold mt-1">
              {runDetails.totalScore?.toFixed(2) || 'N/A'}
            </div>
          </div>
          <div className="p-4 rounded-lg border">
            <div className="text-sm text-muted-foreground">Weighted Score</div>
            <div className="text-3xl font-bold mt-1">
              {runDetails.weightedScore?.toFixed(2) || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground mt-1">out of 10.0</div>
          </div>
        </div>

        <div className="space-y-4">
          {evaluations.map((evaluation, idx) => {
            const percentage = (evaluation.score / evaluation.maxScore) * 100;
            return (
              <div key={idx} className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">{evaluation.evaluatorName}</span>
                  <span className={`font-semibold ${getScoreColor(evaluation.score, evaluation.maxScore)}`}>
                    {evaluation.score.toFixed(2)} / {evaluation.maxScore.toFixed(2)}
                  </span>
                </div>
                <Progress value={percentage} className="h-2" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Telemetry Details */}
      {telemetry && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-2xl font-semibold mb-4">Telemetry</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground">Tool Calls</div>
              <div className="text-2xl font-bold mt-1">{telemetry.toolCalls || 'N/A'}</div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground">Tokens</div>
              <div className="text-2xl font-bold mt-1">
                {telemetry.tokensIn && telemetry.tokensOut
                  ? (telemetry.tokensIn + telemetry.tokensOut).toLocaleString()
                  : 'N/A'}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {telemetry.tokensIn && telemetry.tokensOut
                  ? `${telemetry.tokensIn.toLocaleString()} in / ${telemetry.tokensOut.toLocaleString()} out`
                  : ''}
              </div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground">Cost</div>
              <div className="text-2xl font-bold mt-1">
                {telemetry.costUsd ? `$${telemetry.costUsd.toFixed(3)}` : 'N/A'}
              </div>
            </div>
            <div className="p-4 rounded-lg border">
              <div className="text-sm text-muted-foreground">Duration</div>
              <div className="text-2xl font-bold mt-1">
                {telemetry.durationMs ? `${(telemetry.durationMs / 1000).toFixed(1)}s` : 'N/A'}
              </div>
            </div>
          </div>
          {telemetry.workspaceDir && (
            <div className="mt-4">
              <div className="text-sm text-muted-foreground">Workspace Directory</div>
              <div className="font-mono text-sm mt-1 p-2 rounded bg-muted">{telemetry.workspaceDir}</div>
            </div>
          )}
        </div>
      )}

      {/* Evaluation Details */}
      {evaluations.length > 0 && (
        <div className="rounded-lg border bg-card p-6">
          <h2 className="text-2xl font-semibold mb-4">Evaluation Details</h2>
          <Accordion type="single" collapsible className="w-full">
            {evaluations.map((evaluation, idx) => (
              <AccordionItem key={idx} value={`item-${idx}`}>
                <AccordionTrigger>
                  <div className="flex items-center gap-4">
                    <span className="font-medium">{evaluation.evaluatorName}</span>
                    <Badge variant="outline">
                      {evaluation.score.toFixed(2)} / {evaluation.maxScore.toFixed(2)}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  {evaluation.details ? (
                    <pre className="text-sm whitespace-pre-wrap bg-muted p-4 rounded">
                      {evaluation.details}
                    </pre>
                  ) : (
                    <div className="text-sm text-muted-foreground">No details available</div>
                  )}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      )}

      {/* Human vs LLM Comparison */}
      {humanScores && humanScores.length > 0 && evaluations.length > 0 && (
        <HumanVsLLMComparison
          humanScores={humanScores}
          evaluations={evaluations}
        />
      )}

      {/* Human Scores */}
      {humanScores && humanScores.length > 0 && (
        <HumanScoreDisplay humanScores={humanScores} />
      )}
    </div>
  );
}
