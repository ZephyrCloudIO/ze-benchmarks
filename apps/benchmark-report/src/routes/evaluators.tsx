import { createFileRoute } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/evaluators')({
  component: EvaluatorsPage,
})

function EvaluatorsPage() {
  const { data: evaluatorStats, isLoading, error } = useQuery({
    queryKey: ['evaluator-stats'],
    queryFn: () => apiClient.getEvaluatorStats(),
  })

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading evaluator data...</div>
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Evaluator Performance</h1>
        <p className="text-muted-foreground mt-2">
          Analyze individual evaluator effectiveness and patterns
        </p>
      </div>

      {/* Evaluator Rankings */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Evaluator Rankings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Evaluators ranked by average score. Pass rate shows percentage of evaluations that achieved maximum score.
        </p>
        <div className="space-y-3">
          {evaluatorStats?.map((evaluator, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-primary font-bold">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{evaluator.evaluatorName}</div>
                <div className="text-sm text-muted-foreground">{evaluator.totalEvaluations} evaluations</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-lg">{evaluator.avgScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">avg score</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{evaluator.passRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">pass rate</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">
                  {evaluator.minScore.toFixed(2)} - {evaluator.maxScore.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">range</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Evaluator Score Distribution */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {evaluatorStats?.map((evaluator, idx) => (
          <div key={idx} className="rounded-lg border bg-card p-6 shadow-sm">
            <h3 className="text-lg font-semibold mb-4">{evaluator.evaluatorName}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Average Score</span>
                <span className="font-bold">{evaluator.avgScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Max Possible</span>
                <span className="font-semibold">{evaluator.avgMaxScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Pass Rate</span>
                <span className="font-semibold">{evaluator.passRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Min Score</span>
                <span className="font-semibold">{evaluator.minScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Max Score</span>
                <span className="font-semibold">{evaluator.maxScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t">
                <span className="text-sm text-muted-foreground">Total Evaluations</span>
                <span className="font-semibold">{evaluator.totalEvaluations}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
