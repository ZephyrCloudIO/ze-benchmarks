import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { apiClient } from '@/lib/api-client';
import { OutputViewer } from '@/components/OutputViewer';
import { ScoreForm } from '@/components/ScoreForm';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2 } from 'lucide-react';

export const Route = createFileRoute('/score/$runId')({
  component: ScoreRunPage,
});

function ScoreRunPage() {
  const { runId } = Route.useParams();
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // Fetch run details
  const { data: runDetails, isLoading: isLoadingRun } = useQuery({
    queryKey: ['run', runId],
    queryFn: () => apiClient.getRunDetails(runId),
  });

  // Fetch evaluations
  const { data: evaluations, isLoading: isLoadingEvals } = useQuery({
    queryKey: ['evaluations', runId],
    queryFn: () => apiClient.getRunEvaluations(runId),
    enabled: !!runDetails,
  });

  // Fetch telemetry
  const { data: telemetry, isLoading: isLoadingTelemetry } = useQuery({
    queryKey: ['telemetry', runId],
    queryFn: () => apiClient.getRunTelemetry(runId),
    enabled: !!runDetails,
  });

  // Fetch existing human scores
  const { data: humanScores } = useQuery({
    queryKey: ['humanScores', runId],
    queryFn: () => apiClient.getHumanScores(runId),
    enabled: !!runDetails,
  });

  if (isLoadingRun || isLoadingEvals || isLoadingTelemetry) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading benchmark run...</p>
        </div>
      </div>
    );
  }

  if (!runDetails) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Run Not Found</h2>
          <p className="text-muted-foreground">
            The benchmark run with ID "{runId}" could not be found.
          </p>
        </div>
      </div>
    );
  }

  // Extract categories from evaluations or use default
  const categories = evaluations && evaluations.length > 0
    ? evaluations.map((e) => e.evaluatorName)
    : ['Correctness', 'Code Quality', 'Best Practices'];

  return (
    <div className="space-y-6">
      {/* Run Info Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-2">
              {runDetails.run.suite} / {runDetails.run.scenario}
            </h2>
            <div className="flex gap-4 text-sm text-muted-foreground">
              <span>Run ID: {runDetails.run.runId}</span>
              <span>Agent: {runDetails.run.agent}</span>
              {runDetails.run.model && <span>Model: {runDetails.run.model}</span>}
              <span>Tier: {runDetails.run.tier}</span>
            </div>
            {humanScores && humanScores.length > 0 && (
              <div className="mt-3 flex gap-2">
                <Badge variant="success" className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {humanScores.length} human score{humanScores.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {runDetails.run.weightedScore?.toFixed(2) || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">LLM Score</div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      {submitSuccess && (
        <div className="bg-success/10 border border-success rounded-lg p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="font-semibold text-success">Score submitted successfully!</p>
              <p className="text-sm text-success-foreground">
                Thank you for your feedback on this benchmark run.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Split Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left Panel - Output Viewer (60% / 3 cols) */}
        <div className="lg:col-span-3">
          <OutputViewer
            runData={{
              suite: runDetails.run.suite,
              scenario: runDetails.run.scenario,
              agent: runDetails.run.agent,
              model: runDetails.run.model,
              metadata: runDetails.run.metadata,
            }}
            evaluations={evaluations}
            telemetry={telemetry}
          />
        </div>

        {/* Right Panel - Score Form (40% / 2 cols) */}
        <div className="lg:col-span-2">
          <ScoreForm
            runId={runId}
            categories={categories}
            evaluations={evaluations}
            onSubmitSuccess={() => setSubmitSuccess(true)}
          />
        </div>
      </div>

      {/* Debug Info */}
      {import.meta.env.DEV && (
        <div className="bg-muted rounded-lg p-4">
          <details>
            <summary className="cursor-pointer font-semibold mb-2">
              Debug: Run Data
            </summary>
            <pre className="text-xs overflow-auto">
              {JSON.stringify({ runDetails, evaluations, telemetry, humanScores }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
