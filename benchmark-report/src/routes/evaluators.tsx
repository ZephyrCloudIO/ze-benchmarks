import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/evaluators')({
  component: EvaluatorsPage,
})

function EvaluatorsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Evaluator Performance</h1>
        <p className="text-muted-foreground mt-2">
          Analyze individual evaluator effectiveness and patterns
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Evaluator Rankings</h2>
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Evaluator performance metrics and rankings will go here
        </div>
      </div>
    </div>
  )
}
