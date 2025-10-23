import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/agents')({
  component: AgentsPage,
})

function AgentsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Agent Performance</h1>
        <p className="text-muted-foreground mt-2">
          Compare and analyze different agents and models
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Agent Comparison</h2>
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Agent performance charts and comparison tables will go here
        </div>
      </div>
    </div>
  )
}
