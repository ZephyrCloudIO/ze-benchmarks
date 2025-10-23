import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/suites')({
  component: SuitesPage,
})

function SuitesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Suite & Scenario Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Deep dive into specific test suites and scenarios
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Suite Performance</h2>
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Suite and scenario analysis will go here
        </div>
      </div>
    </div>
  )
}
