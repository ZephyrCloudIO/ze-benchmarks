import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/costs')({
  component: CostsPage,
})

function CostsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Cost & Efficiency Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Track spending and optimize for cost-efficiency
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Cost</div>
          <div className="text-3xl font-bold mt-2">$1,234.56</div>
          <div className="text-xs text-muted-foreground mt-1">All time</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">This Month</div>
          <div className="text-3xl font-bold mt-2">$342.18</div>
          <div className="text-xs text-red-600 mt-1">+12% vs last month</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Avg per Run</div>
          <div className="text-3xl font-bold mt-2">$0.18</div>
          <div className="text-xs text-green-600 mt-1">-3% vs last month</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Cost Over Time</h2>
        <div className="h-96 flex items-center justify-center text-muted-foreground">
          Cost trends and analysis charts will go here
        </div>
      </div>
    </div>
  )
}
