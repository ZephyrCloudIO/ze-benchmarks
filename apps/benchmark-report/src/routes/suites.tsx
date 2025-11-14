import { createFileRoute } from '@tanstack/react-router'
import { useDatabase } from '@/DatabaseProvider'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/suites')({
  component: SuitesPage,
})

interface SuiteStats {
  suite: string;
  totalRuns: number;
  successRate: number;
  avgScore: number;
  uniqueScenarios: number;
}

interface ScenarioStats {
  suite: string;
  scenario: string;
  tier: string;
  totalRuns: number;
  successRate: number;
  avgScore: number;
  minScore: number;
  maxScore: number;
}

function SuitesPage() {
  const { db, isLoading, error } = useDatabase();
  const [suiteStats, setSuiteStats] = useState<SuiteStats[]>([]);
  const [scenarioStats, setScenarioStats] = useState<ScenarioStats[]>([]);

  useEffect(() => {
    if (!db) return;

    try {
      // Query suite-level statistics
      const suiteResult = db.exec(`
        SELECT
          suite,
          COUNT(*) as total_runs,
          CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as success_rate,
          AVG(weighted_score) as avg_score,
          COUNT(DISTINCT scenario) as unique_scenarios
        FROM benchmark_runs
        WHERE weighted_score IS NOT NULL
        GROUP BY suite
        ORDER BY avg_score DESC
      `);

      if (suiteResult[0]) {
        const suites = suiteResult[0].values.map((row) => ({
          suite: row[0] as string,
          totalRuns: row[1] as number,
          successRate: row[2] as number,
          avgScore: row[3] as number,
          uniqueScenarios: row[4] as number,
        }));
        setSuiteStats(suites);
      }

      // Query scenario-level statistics
      const scenarioResult = db.exec(`
        SELECT
          suite,
          scenario,
          tier,
          COUNT(*) as total_runs,
          CAST(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) * 100 as success_rate,
          AVG(weighted_score) as avg_score,
          MIN(weighted_score) as min_score,
          MAX(weighted_score) as max_score
        FROM benchmark_runs
        WHERE weighted_score IS NOT NULL
        GROUP BY suite, scenario, tier
        ORDER BY suite, avg_score DESC
        LIMIT 50
      `);

      if (scenarioResult[0]) {
        const scenarios = scenarioResult[0].values.map((row) => ({
          suite: row[0] as string,
          scenario: row[1] as string,
          tier: row[2] as string,
          totalRuns: row[3] as number,
          successRate: row[4] as number,
          avgScore: row[5] as number,
          minScore: row[6] as number,
          maxScore: row[7] as number,
        }));
        setScenarioStats(scenarios);
      }
    } catch (err) {
      console.error('Failed to fetch suite stats:', err);
    }
  }, [db]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-64">Loading database...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-64 text-red-600">Error: {error.message}</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Suite & Scenario Analysis</h1>
        <p className="text-muted-foreground mt-2">
          Deep dive into specific test suites and scenarios
        </p>
      </div>

      {/* Suite Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {suiteStats.map((suite, idx) => (
          <div key={idx} className="rounded-lg border bg-card p-6 shadow-sm hover:shadow-md transition-shadow">
            <h3 className="text-lg font-semibold mb-4">{suite.suite}</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Avg Score</span>
                <span className="font-bold text-lg">{suite.avgScore.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Success Rate</span>
                <span className="font-semibold">{suite.successRate.toFixed(1)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Runs</span>
                <span className="font-semibold">{suite.totalRuns}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Scenarios</span>
                <span className="font-semibold">{suite.uniqueScenarios}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Scenario Comparison Table */}
      <div className="rounded-lg border bg-card p-6">
        <h2 className="text-2xl font-semibold mb-4">Scenario Performance</h2>
        <div className="space-y-2">
          {scenarioStats.map((scenario, idx) => (
            <div key={idx} className="flex items-center gap-4 p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
              <div className="flex-1">
                <div className="font-medium">{scenario.scenario}</div>
                <div className="text-sm text-muted-foreground flex gap-2">
                  <span>{scenario.suite}</span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                    {scenario.tier}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-bold">{scenario.avgScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">avg</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-sm">{scenario.minScore.toFixed(2)} - {scenario.maxScore.toFixed(2)}</div>
                <div className="text-xs text-muted-foreground">min - max</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{scenario.successRate.toFixed(1)}%</div>
                <div className="text-xs text-muted-foreground">success</div>
              </div>
              <div className="text-right">
                <div className="font-semibold">{scenario.totalRuns}</div>
                <div className="text-xs text-muted-foreground">runs</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
