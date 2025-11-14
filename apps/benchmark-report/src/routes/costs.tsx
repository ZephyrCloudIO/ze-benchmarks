import { createFileRoute } from '@tanstack/react-router'
import { apiClient } from '@/lib/api-client'
import { useQuery } from '@tanstack/react-query'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { Pie, PieChart, Cell, Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

export const Route = createFileRoute('/costs')({
  component: CostsPage,
})

function CostsPage() {
  const { data: costStats, isLoading: loadingCostStats } = useQuery({
    queryKey: ['cost-stats'],
    queryFn: () => apiClient.getCostStats(),
  })

  const { data: costEfficiency, isLoading: loadingEfficiency } = useQuery({
    queryKey: ['cost-efficiency'],
    queryFn: () => apiClient.getCostEfficiency(),
  })

  const { data: costBreakdown, isLoading: loadingBreakdown } = useQuery({
    queryKey: ['cost-breakdown'],
    queryFn: () => apiClient.getCostBreakdown(),
  })

  const { data: tokenUsage, isLoading: loadingTokens } = useQuery({
    queryKey: ['token-usage'],
    queryFn: () => apiClient.getTokenUsage(),
  })

  const isLoading = loadingCostStats || loadingEfficiency || loadingBreakdown || loadingTokens

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading cost data...</div>
  }

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
          <div className="text-3xl font-bold mt-2">${costStats?.totalCost.toFixed(2) || '0.00'}</div>
          <div className="text-xs text-muted-foreground mt-1">All time</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Avg per Run</div>
          <div className="text-3xl font-bold mt-2">${costStats?.avgCost.toFixed(3) || '0.000'}</div>
          <div className="text-xs text-muted-foreground mt-1">Across all runs</div>
        </div>

        <div className="rounded-lg border bg-card p-6">
          <div className="text-sm font-medium text-muted-foreground">Total Runs</div>
          <div className="text-3xl font-bold mt-2">{costStats?.totalRuns.toLocaleString() || '0'}</div>
          <div className="text-xs text-muted-foreground mt-1">With cost data</div>
        </div>
      </div>

      {/* Cost Breakdown Pie Chart */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Cost Breakdown by Agent</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Total cost distribution across different agents
        </p>
        {costBreakdown && costBreakdown.length > 0 ? (
          <ChartContainer
            config={{
              value: {
                label: "Cost (USD)",
              },
            }}
            className="h-[300px]"
          >
            <PieChart>
              <Pie
                data={costBreakdown}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={(entry) => `${entry.name}: $${entry.value.toFixed(2)}`}
              >
                {costBreakdown.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={`hsl(${index * 60}, 70%, 50%)`} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
            </PieChart>
          </ChartContainer>
        ) : (
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        )}
      </div>

      {/* Token Usage Chart */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Token Usage by Agent/Model</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Average input and output tokens per run (top 10)
        </p>
        {tokenUsage && tokenUsage.length > 0 ? (
          <ChartContainer
            config={{
              avgTokensIn: {
                label: "Tokens In",
                color: "hsl(var(--chart-1))",
              },
              avgTokensOut: {
                label: "Tokens Out",
                color: "hsl(var(--chart-2))",
              },
            }}
            className="h-[400px]"
          >
            <BarChart data={tokenUsage} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis type="category" dataKey="model" width={150} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="avgTokensIn" stackId="a" fill="var(--color-avgTokensIn)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgTokensOut" stackId="a" fill="var(--color-avgTokensOut)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        ) : (
          <div className="h-[400px] flex items-center justify-center text-muted-foreground">
            No data available
          </div>
        )}
      </div>

      {/* Cost Efficiency Table */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Cost Efficiency Rankings</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Agent/model combinations ranked by score per dollar (higher is better)
        </p>
        <div className="space-y-3">
          {costEfficiency?.map((item, idx) => (
            <div key={idx} className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                {idx + 1}
              </div>
              <div className="flex-1">
                <div className="font-medium">{item.model || 'Unknown Model'}</div>
                <div className="text-sm text-muted-foreground">{item.agent}</div>
              </div>
              <div className="text-right">
                <div className="font-bold text-green-600">{item.scorePerDollar.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">score/$</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{item.avgScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">avg score</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">${item.avgCost.toFixed(3)}</div>
                <div className="text-xs text-muted-foreground">avg cost</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{item.totalRuns}</div>
                <div className="text-xs text-muted-foreground">runs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
