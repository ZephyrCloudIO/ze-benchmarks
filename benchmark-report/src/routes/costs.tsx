import { createFileRoute } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart'
import { Pie, PieChart, Cell, Bar, BarChart, CartesianGrid, XAxis, YAxis, LineChart, Line, Legend } from 'recharts'
import { computeQuantiles, tokenFormatter } from '@/lib/chart-utils'

export const Route = createFileRoute('/costs')({
  component: CostsPage,
})

interface CostStats {
  totalCost: number;
  avgCost: number;
  totalRuns: number;
}

interface AgentCostEfficiency {
  agent: string;
  model: string;
  avgCost: number;
  avgScore: number;
  totalRuns: number;
  scorePerDollar: number;
}

interface CostBreakdown {
  name: string;
  value: number;
}

interface TokenUsage {
  agent: string;
  model: string;
  avgTokensIn: number;
  avgTokensOut: number;
  avgTotalTokens: number;
  runsWithTelemetry: number;
  totalRuns: number;
  name: string;
  medianTokensIn: number;
  medianTokensOut: number;
  medianTotalTokens: number;
}

function CostsPage() {
  const { db, isLoading, error } = useDatabase();
  const [costStats, setCostStats] = useState<CostStats | null>(null);
  const [costEfficiency, setCostEfficiency] = useState<AgentCostEfficiency[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostBreakdown[]>([]);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage[]>([]);
  const [tokenMetric, setTokenMetric] = useState<'avg' | 'median'>('avg');
  const [tokenView, setTokenView] = useState<'bar' | 'line'>('bar');
  const [tokenSeries, setTokenSeries] = useState<Array<Record<string, any>>>([]);
  const [costTrend, setCostTrend] = useState<{ date: string; avg: number; p50: number; p95: number }[]>([]);
  const [durationTrend, setDurationTrend] = useState<{ date: string; avg: number; p50: number; p95: number }[]>([]);
  const [costMetric, setCostMetric] = useState<'avg' | 'median'>('avg');
  const [durationMetric, setDurationMetric] = useState<'avg' | 'median'>('avg');

  useEffect(() => {
    if (!db) return;

    try {
      // Query overall cost statistics
      const costStatsResult = db.exec(`
        SELECT
          SUM(rt.cost_usd) as total_cost,
          AVG(rt.cost_usd) as avg_cost,
          COUNT(*) as total_runs
        FROM run_telemetry rt
        WHERE rt.cost_usd IS NOT NULL
      `);

      if (costStatsResult[0]) {
        const row = costStatsResult[0].values[0];
        setCostStats({
          totalCost: row[0] as number || 0,
          avgCost: row[1] as number || 0,
          totalRuns: row[2] as number || 0,
        });
      }

      // Query cost efficiency by agent/model
      const efficiencyResult = db.exec(`
        SELECT
          br.agent,
          br.model,
          AVG(rt.cost_usd) as avg_cost,
          AVG(br.weighted_score) as avg_score,
          COUNT(*) as total_runs,
          CASE
            WHEN AVG(rt.cost_usd) > 0 THEN AVG(br.weighted_score) / AVG(rt.cost_usd)
            ELSE 0
          END as score_per_dollar
        FROM benchmark_runs br
        LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE br.weighted_score IS NOT NULL AND rt.cost_usd IS NOT NULL
        GROUP BY br.agent, br.model
        ORDER BY score_per_dollar DESC
      `);

      if (efficiencyResult[0]) {
        const efficiency = efficiencyResult[0].values.map((row) => ({
          agent: row[0] as string,
          model: row[1] as string,
          avgCost: row[2] as number,
          avgScore: row[3] as number,
          totalRuns: row[4] as number,
          scorePerDollar: row[5] as number,
        }));
        setCostEfficiency(efficiency);
      }

      // Query cost breakdown by agent
      const breakdownResult = db.exec(`
        SELECT
          br.agent,
          SUM(rt.cost_usd) as total_cost
        FROM benchmark_runs br
        LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE rt.cost_usd IS NOT NULL
        GROUP BY br.agent
        ORDER BY total_cost DESC
      `);

      if (breakdownResult[0]) {
        const breakdown = breakdownResult[0].values.map((row) => ({
          name: row[0] as string,
          value: row[1] as number,
        }));
        setCostBreakdown(breakdown);
      }

      // Query token usage with robust null handling and completed runs only
      const tokenResult = db.exec(`
        SELECT
          br.agent,
          br.model,
          AVG(COALESCE(rt.tokens_in, 0)) as avg_tokens_in,
          AVG(COALESCE(rt.tokens_out, 0)) as avg_tokens_out,
          AVG(COALESCE(rt.tokens_in, 0) + COALESCE(rt.tokens_out, 0)) as avg_total_tokens,
          SUM(CASE WHEN rt.tokens_in IS NOT NULL OR rt.tokens_out IS NOT NULL THEN 1 ELSE 0 END) as runs_with_telemetry,
          COUNT(*) as total_runs
        FROM benchmark_runs br
        LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE br.status = 'completed'
        GROUP BY br.agent, br.model
        ORDER BY avg_total_tokens DESC
        LIMIT 15
      `);

      if (tokenResult[0]) {
        const tokens = tokenResult[0].values.map((row) => {
          const agent = row[0] as string;
          const model = (row[1] as string) || '';
          const name = model ? `${agent} [${model}]` : agent;
          return {
            agent,
            model,
            avgTokensIn: (row[2] as number) || 0,
            avgTokensOut: (row[3] as number) || 0,
            avgTotalTokens: (row[4] as number) || 0,
            runsWithTelemetry: (row[5] as number) || 0,
            totalRuns: (row[6] as number) || 0,
            name,
            medianTokensIn: 0,
            medianTokensOut: 0,
            medianTotalTokens: 0,
          } as TokenUsage;
        });
        // Build medians per agent/model
        const perRun = db.exec(`
          SELECT br.agent, br.model, rt.tokens_in, rt.tokens_out
          FROM benchmark_runs br
          LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
          WHERE br.status = 'completed' AND (rt.tokens_in IS NOT NULL OR rt.tokens_out IS NOT NULL)
        `);
        const group = new Map<string, { in: number[]; out: number[] }>();
        if (perRun[0]) {
          perRun[0].values.forEach((row) => {
            const ag = (row[0] as string) || '';
            const mo = (row[1] as string) || '';
            const key = `${ag}|||${mo}`;
            const tin = (row[2] as number) ?? 0;
            const tout = (row[3] as number) ?? 0;
            if (!group.has(key)) group.set(key, { in: [], out: [] });
            const g = group.get(key)!;
            g.in.push(isNaN(tin) ? 0 : tin);
            g.out.push(isNaN(tout) ? 0 : tout);
          });
        }
        const withMedians = tokens.map(t => {
          const key = `${t.agent}|||${t.model || ''}`;
          const g = group.get(key);
          if (!g) return t;
          const [, medIn] = computeQuantiles(g.in, [0.25, 0.5]);
          const [, medOut] = computeQuantiles(g.out, [0.25, 0.5]);
          const medInV = isNaN(medIn) ? 0 : medIn;
          const medOutV = isNaN(medOut) ? 0 : medOut;
          return { ...t, medianTokensIn: medInV, medianTokensOut: medOutV, medianTotalTokens: medInV + medOutV };
        });
        setTokenUsage(withMedians);

        // Build 14-day time series for top 5 agent/model by avg total tokens
        const top = withMedians.slice(0, 5);
        if (top.length > 0) {
          const perRunSeries = db.exec(`
            SELECT br.agent, br.model, date(br.started_at) as d,
                   COALESCE(rt.tokens_in,0) as ti, COALESCE(rt.tokens_out,0) as to
            FROM benchmark_runs br
            LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
            WHERE br.status = 'completed'
              AND (rt.tokens_in IS NOT NULL OR rt.tokens_out IS NOT NULL)
              AND br.started_at >= date('now', '-14 day')
            ORDER BY d ASC
          `);
          const names = new Set(top.map(t => t.name));
          const map = new Map<string, Map<string, number[]>>(); // date -> name -> totals[]
          if (perRunSeries[0]) {
            perRunSeries[0].values.forEach(row => {
              const agent = (row[0] as string) || '';
              const model = (row[1] as string) || '';
              const name = model ? `${agent} [${model}]` : agent;
              if (!names.has(name)) return;
              const date = row[2] as string;
              const total = ((row[3] as number) || 0) + ((row[4] as number) || 0);
              if (!map.has(date)) map.set(date, new Map());
              const dayMap = map.get(date)!;
              if (!dayMap.has(name)) dayMap.set(name, []);
              dayMap.get(name)!.push(total);
            });
          }
          const today = new Date();
          const series: Array<Record<string, any>> = [];
          for (let i = 13; i >= 0; i--) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const iso = d.toISOString().slice(0, 10);
            const dayMap = map.get(iso) || new Map();
            const entry: Record<string, any> = { date: iso };
            top.forEach(t => {
              const arr = dayMap.get(t.name) || [];
              if (arr.length === 0) {
                entry[t.name] = 0;
              } else if (tokenMetric === 'avg') {
                entry[t.name] = arr.reduce((a: number, b: number) => a + b, 0) / arr.length;
              } else {
                const [, med] = computeQuantiles(arr, [0.25, 0.5]);
                entry[t.name] = isNaN(med) ? 0 : med;
              }
            });
            series.push(entry);
          }
          setTokenSeries(series);
        } else {
          setTokenSeries([]);
        }
      }

      // Build 14-day cost trend with quantiles
      const perRunCosts = db.exec(`
        SELECT date(br.started_at) as d, rt.cost_usd
        FROM benchmark_runs br
        JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE rt.cost_usd IS NOT NULL AND br.started_at >= date('now', '-14 day')
        ORDER BY d ASC
      `);
      const map = new Map<string, number[]>();
      if (perRunCosts[0]) {
        perRunCosts[0].values.forEach((row) => {
          const d = row[0] as string;
          const c = (row[1] as number) ?? 0;
          if (!map.has(d)) map.set(d, []);
          map.get(d)!.push(c);
        });
      }
      const today = new Date();
      const items: { date: string; avg: number; p50: number; p95: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const arr = map.get(iso) ?? [];
        const avg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const [, q50, , q95] = computeQuantiles(arr, [0.25, 0.5, 0.75, 0.95]);
        items.push({ date: iso, avg, p50: isNaN(q50) ? 0 : q50, p95: isNaN(q95) ? 0 : q95 });
      }
      setCostTrend(items);

      // Build 14-day duration trend with quantiles (milliseconds)
      const perRunDur = db.exec(`
        SELECT date(br.started_at) as d, rt.duration_ms
        FROM benchmark_runs br
        JOIN run_telemetry rt ON br.run_id = rt.run_id
        WHERE rt.duration_ms IS NOT NULL AND br.started_at >= date('now', '-14 day')
        ORDER BY d ASC
      `);
      const dmap = new Map<string, number[]>();
      if (perRunDur[0]) {
        perRunDur[0].values.forEach((row) => {
          const d = row[0] as string;
          const v = (row[1] as number) ?? 0;
          if (!dmap.has(d)) dmap.set(d, []);
          dmap.get(d)!.push(v);
        });
      }
      const ditems: { date: string; avg: number; p50: number; p95: number }[] = [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().slice(0, 10);
        const arr = dmap.get(iso) ?? [];
        const davg = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
        const [, dp50, , dp95] = computeQuantiles(arr, [0.25, 0.5, 0.75, 0.95]);
        ditems.push({ date: iso, avg: davg, p50: isNaN(dp50) ? 0 : dp50, p95: isNaN(dp95) ? 0 : dp95 });
      }
      setDurationTrend(ditems);
    } catch (err) {
      console.error('Failed to fetch cost stats:', err);
    }
  }, [db]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading database...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-destructive">Error: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Cost & Efficiency Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Track spending and optimize for cost-efficiency
        </p>
      </div>

      {/* Cost Trends (Log Scale) */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Cost Trends (last 14 days)</h2>
          <div className="inline-flex rounded-md border">
            <button
              className={`px-3 py-1 text-sm ${costMetric === 'avg' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
              onClick={() => setCostMetric('avg')}
            >
              Average
            </button>
            <button
              className={`px-3 py-1 text-sm ${costMetric === 'median' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
              onClick={() => setCostMetric('median')}
            >
              Median
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {costMetric === 'avg' ? 'Average' : 'Median (p50)'} cost per run with p95 band. Y-axis uses log scale.
        </p>
        {costTrend.length > 0 ? (
          <ChartContainer
            config={{
              avg: { label: 'Avg', color: 'hsl(var(--chart-1))' },
              p50: { label: 'p50', color: 'hsl(var(--chart-2))' },
              p95: { label: 'p95', color: 'hsl(var(--chart-3))' },
            }}
            className="h-[320px]"
          >
            <LineChart data={costTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis scale="log" domain={[0.1, 'auto']} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {costMetric === 'median' ? (
                <Line type="monotone" dataKey="p50" stroke="var(--color-p50)" strokeWidth={2} dot={false} />
              ) : (
                <Line type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2} dot={false} />
              )}
              <Line type="monotone" dataKey="p95" stroke="var(--color-p95)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">No data available</div>
        )}
      </div>

      {/* Duration Trends */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Duration Trends (last 14 days)</h2>
          <div className="inline-flex rounded-md border">
            <button
              className={`px-3 py-1 text-sm ${durationMetric === 'avg' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
              onClick={() => setDurationMetric('avg')}
            >
              Average
            </button>
            <button
              className={`px-3 py-1 text-sm ${durationMetric === 'median' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
              onClick={() => setDurationMetric('median')}
            >
              Median
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {durationMetric === 'avg' ? 'Average' : 'Median (p50)'} duration per run with p95 band.
        </p>
        {durationTrend.length > 0 ? (
          <ChartContainer
            config={{
              avg: { label: 'Avg', color: 'hsl(var(--chart-1))' },
              p50: { label: 'p50', color: 'hsl(var(--chart-2))' },
              p95: { label: 'p95', color: 'hsl(var(--chart-3))' },
            }}
            className="h-[320px]"
          >
            <LineChart data={durationTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 'auto']} tickFormatter={(v) => `${Math.round((v as number)/1000)}s`} tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              {durationMetric === 'median' ? (
                <Line type="monotone" dataKey="p50" stroke="var(--color-p50)" strokeWidth={2} dot={false} />
              ) : (
                <Line type="monotone" dataKey="avg" stroke="var(--color-avg)" strokeWidth={2} dot={false} />
              )}
              <Line type="monotone" dataKey="p95" stroke="var(--color-p95)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ChartContainer>
        ) : (
          <div className="h-[320px] flex items-center justify-center text-muted-foreground">No data available</div>
        )}
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
        {costBreakdown.length > 0 ? (
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
                {costBreakdown.map((_, index) => (
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-semibold">Token Usage by Agent/Model</h2>
          <div className="inline-flex rounded-md border">
            <button
              className={`px-3 py-1 text-sm ${tokenMetric === 'avg' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
              onClick={() => setTokenMetric('avg')}
            >
              Average
            </button>
            <button
              className={`px-3 py-1 text-sm ${tokenMetric === 'median' ? 'bg-primary text-primary-foreground' : 'bg-transparent'}`}
              onClick={() => setTokenMetric('median')}
            >
              Median
            </button>
            <button
              className={`px-3 py-1 text-sm ${tokenView === 'bar' ? 'bg-muted' : 'bg-transparent'}`}
              onClick={() => setTokenView('bar')}
            >
              Bar
            </button>
            <button
              className={`px-3 py-1 text-sm ${tokenView === 'line' ? 'bg-muted' : 'bg-transparent'}`}
              onClick={() => setTokenView('line')}
            >
              Line
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Average input and output tokens per completed run (top 15). Labels combine agent and model.
        </p>
        {tokenUsage.length > 0 ? (
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
            {tokenView === 'bar' ? (
              <BarChart data={tokenUsage} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => tokenFormatter(v as number)} />
              <YAxis type="category" dataKey="name" width={220} />
              <ChartTooltip 
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const p = payload[0].payload as TokenUsage;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="text-sm font-medium mb-1">{p.name}</div>
                      <div className="text-xs text-muted-foreground mb-1">n = {p.runsWithTelemetry}/{p.totalRuns} runs with telemetry</div>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span>{tokenMetric === 'avg' ? 'Avg' : 'Median'} Tokens In</span>
                        <span className="font-semibold">{tokenFormatter(tokenMetric === 'avg' ? p.avgTokensIn : p.medianTokensIn)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span>{tokenMetric === 'avg' ? 'Avg' : 'Median'} Tokens Out</span>
                        <span className="font-semibold">{tokenFormatter(tokenMetric === 'avg' ? p.avgTokensOut : p.medianTokensOut)}</span>
                      </div>
                      <div className="flex items-center justify-between gap-4 text-sm">
                        <span>{tokenMetric === 'avg' ? 'Avg' : 'Median'} Total</span>
                        <span className="font-bold">{tokenFormatter(tokenMetric === 'avg' ? p.avgTotalTokens : p.medianTotalTokens)}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <ChartLegend content={<ChartLegendContent />} />
              {tokenMetric === 'avg' ? (
                <>
                  <Bar dataKey="avgTokensIn" stackId="a" fill="var(--color-avgTokensIn)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="avgTokensOut" stackId="a" fill="var(--color-avgTokensOut)" radius={[4, 4, 0, 0]} />
                </>
              ) : (
                <>
                  <Bar dataKey="medianTokensIn" stackId="a" fill="var(--color-avgTokensIn)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="medianTokensOut" stackId="a" fill="var(--color-avgTokensOut)" radius={[4, 4, 0, 0]} />
                </>
              )}
              </BarChart>
            ) : (
              <LineChart data={tokenSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={(v) => tokenFormatter(v as number)} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Legend />
                {tokenUsage.slice(0, 5).map((t, idx) => (
                  <Line key={t.name} type="monotone" dataKey={t.name} stroke={`hsl(var(--chart-${(idx % 5) + 1}))`} strokeWidth={2} dot={false} />
                ))}
              </LineChart>
            )}
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
          {costEfficiency.map((item, idx) => (
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
