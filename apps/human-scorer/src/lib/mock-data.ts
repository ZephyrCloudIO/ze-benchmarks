// Mock data for local development without worker API
import type { 
  BenchmarkRun, 
  EvaluationResult, 
  RunTelemetry, 
  RunDetails, 
  HumanScore 
} from './api-client';

/**
 * Generate realistic mock data for a given runId
 */
export function getMockData(runId: string): {
  runDetails: RunDetails;
  evaluations: EvaluationResult[];
  telemetry: RunTelemetry;
  humanScores: HumanScore[];
} {
  const now = new Date();
  const startedAt = new Date(now.getTime() - 120000).toISOString(); // 2 minutes ago
  const completedAt = new Date(now.getTime() - 30000).toISOString(); // 30 seconds ago

  // Generate mock run
  const run: BenchmarkRun = {
    id: 1,
    runId: runId,
    batchId: `batch-${Date.now()}`,
    suite: 'next.js',
    scenario: '001-server-component',
    tier: 'L0',
    agent: 'anthropic',
    model: 'claude-3-5-sonnet-20241022',
    status: 'completed',
    startedAt,
    completedAt,
    totalScore: 0.85,
    weightedScore: 8.5,
    isSuccessful: true,
    successMetric: 0.85,
    metadata: JSON.stringify({
      diffSummary: 'Added server component with proper data fetching',
      packageManager: 'pnpm'
    })
  };

  // Generate mock evaluations
  const evaluations: EvaluationResult[] = [
    {
      id: 1,
      runId: runId,
      evaluatorName: 'Correctness',
      score: 0.9,
      maxScore: 1.0,
      details: 'The implementation correctly uses server components and fetches data appropriately. All validation tests passed.',
      createdAt: completedAt
    },
    {
      id: 2,
      runId: runId,
      evaluatorName: 'Code Quality',
      score: 0.85,
      maxScore: 1.0,
      details: 'Code follows Next.js best practices. Proper use of async/await, error handling could be improved.',
      createdAt: completedAt
    },
    {
      id: 3,
      runId: runId,
      evaluatorName: 'Best Practices',
      score: 0.8,
      maxScore: 1.0,
      details: 'Good separation of concerns. Consider adding loading states and error boundaries.',
      createdAt: completedAt
    },
    {
      id: 4,
      runId: runId,
      evaluatorName: 'Performance',
      score: 0.75,
      maxScore: 1.0,
      details: 'Server component implementation is efficient. Could benefit from caching strategies.',
      createdAt: completedAt
    }
  ];

  // Generate mock telemetry
  const telemetry: RunTelemetry = {
    id: 1,
    runId: runId,
    toolCalls: 12,
    tokensIn: 4523,
    tokensOut: 1824,
    costUsd: 0.0234,
    durationMs: 45000,
    workspaceDir: '/tmp/benchmark-workspace-12345',
    promptSent: 'Implement a Next.js server component that fetches data from an API...'
  };

  // Generate mock human scores (0-2 scores for variety)
  const humanScores: HumanScore[] = [
    {
      id: 1,
      runId: runId,
      scorerName: 'Alice Developer',
      scorerEmail: 'alice@example.com',
      scores: [
        { category: 'Correctness', score: 4, confidence: 85, reasoning: 'Looks good overall' },
        { category: 'Code Quality', score: 4, confidence: 80, reasoning: 'Clean code structure' },
        { category: 'Best Practices', score: 3, confidence: 75, reasoning: 'Could use more error handling' }
      ],
      overallScore: 0.75,
      timeSpentSeconds: 180,
      notes: 'Good implementation, minor improvements needed',
      createdAt: new Date(now.getTime() - 60000).toISOString()
    }
  ];

  const runDetails: RunDetails = {
    run,
    evaluations,
    telemetry
  };

  return {
    runDetails,
    evaluations,
    telemetry,
    humanScores
  };
}

/**
 * Pretty print mock data to console with formatting
 */
export function logMockData(data: {
  runDetails: RunDetails;
  evaluations: EvaluationResult[];
  telemetry: RunTelemetry;
  humanScores: HumanScore[];
}): void {
  console.log('\n%c═══════════════════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  console.log('%c[MOCK DATA] Generated Mock Data for Development', 'color: #4CAF50; font-weight: bold');
  console.log('%c═══════════════════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  
  const { run, evaluations, telemetry } = data.runDetails;
  
  console.log('\n%c📊 Run Details:', 'color: #2196F3; font-weight: bold');
  console.log(`  Run ID: ${run.runId}`);
  console.log(`  Suite: ${run.suite} / Scenario: ${run.scenario} (${run.tier})`);
  console.log(`  Agent: ${run.agent}${run.model ? ` (${run.model})` : ''}`);
  console.log(`  Status: ${run.status}`);
  console.log(`  Weighted Score: ${run.weightedScore?.toFixed(2) || 'N/A'}/10`);
  console.log(`  Success: ${run.isSuccessful ? '✅' : '❌'}`);
  
  console.log('\n%c📈 Evaluations:', 'color: #FF9800; font-weight: bold');
  evaluations.forEach((evaluation, idx) => {
    const percentage = ((evaluation.score / evaluation.maxScore) * 100).toFixed(1);
    console.log(`  ${idx + 1}. ${evaluation.evaluatorName}: ${evaluation.score.toFixed(2)}/${evaluation.maxScore.toFixed(2)} (${percentage}%)`);
    if (evaluation.details) {
      console.log(`     ${evaluation.details.substring(0, 60)}...`);
    }
  });
  
  if (telemetry) {
    console.log('\n%c📡 Telemetry:', 'color: #9C27B0; font-weight: bold');
    console.log(`  Tool Calls: ${telemetry.toolCalls || 0}`);
    console.log(`  Tokens: ${telemetry.tokensIn || 0} in / ${telemetry.tokensOut || 0} out`);
    console.log(`  Cost: $${telemetry.costUsd?.toFixed(4) || '0.0000'}`);
    console.log(`  Duration: ${((telemetry.durationMs || 0) / 1000).toFixed(1)}s`);
  }
  
  if (data.humanScores.length > 0) {
    console.log('\n%c👤 Human Scores:', 'color: #E91E63; font-weight: bold');
    data.humanScores.forEach((score, idx) => {
      console.log(`  ${idx + 1}. ${score.scorerName}${score.scorerEmail ? ` (${score.scorerEmail})` : ''}`);
      console.log(`     Overall: ${(score.overallScore * 100).toFixed(1)}%`);
      console.log(`     Time: ${score.timeSpentSeconds}s`);
    });
  } else {
    console.log('\n%c👤 Human Scores: None yet', 'color: #9E9E9E; font-style: italic');
  }
  
  console.log('\n%c═══════════════════════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  console.log('%c[MOCK DATA] End of Mock Data', 'color: #4CAF50; font-weight: bold');
  console.log('%c═══════════════════════════════════════════════════════════\n', 'color: #4CAF50; font-weight: bold');
}

