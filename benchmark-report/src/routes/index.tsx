import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Executive Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          High-level overview of benchmark system health and performance
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Total Runs</div>
          <div className="text-3xl font-bold mt-2">1,234</div>
          <div className="text-xs text-muted-foreground mt-1">+20% from last week</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Success Rate</div>
          <div className="text-3xl font-bold mt-2">94.5%</div>
          <div className="text-xs text-green-600 mt-1">+2.3% from last week</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Avg Score</div>
          <div className="text-3xl font-bold mt-2">8.42</div>
          <div className="text-xs text-muted-foreground mt-1">out of 10.0</div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <div className="text-sm font-medium text-muted-foreground">Avg Cost</div>
          <div className="text-3xl font-bold mt-2">$0.18</div>
          <div className="text-xs text-red-600 mt-1">+5% from last week</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Recent Activity</h2>
        <div className="h-64 flex items-center justify-center text-muted-foreground">
          Chart placeholder - Activity timeline will go here
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Top Performers</h2>
          <Button variant="outline" size="sm">View All</Button>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="font-medium">Claude 3.5 Sonnet</div>
              <div className="text-sm text-muted-foreground">anthropic agent</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">9.2</div>
              <div className="text-xs text-muted-foreground">156 runs</div>
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <div className="font-medium">Claude Code</div>
              <div className="text-sm text-muted-foreground">claude-code agent</div>
            </div>
            <div className="text-right">
              <div className="font-semibold">8.9</div>
              <div className="text-xs text-muted-foreground">234 runs</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
