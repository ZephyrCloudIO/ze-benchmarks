import chalk from 'chalk';
import figlet from 'figlet';
import { spinner } from '@clack/prompts';
import { TABLE_WIDTH, SCORE_THRESHOLDS, TOTAL_STAGES, type ProgressState } from './constants.ts';
import { logger } from '@ze/logger';

// ============================================================================
// PROGRESS TRACKING
// ============================================================================

export function createProgress(): ProgressState {
  return {
    spinner: spinner(),
    currentStage: 0
  };
}

export function updateProgress(state: ProgressState, stage: number, description: string) {
  const percent = Math.round((stage / TOTAL_STAGES) * 100);
  const message = `[${stage}/${TOTAL_STAGES}] ${percent}% - ${description}`;

  if (state.currentStage === 0) {
    // First time - start the spinner
    state.spinner.start(message);
  } else {
    // Update existing spinner message
    state.spinner.message(message);
  }

  state.currentStage = stage;
}

export function completeProgress(state: ProgressState) {
  state.spinner.stop('Benchmark complete');
}

// ============================================================================
// DISPLAY FUNCTIONS
// ============================================================================

export function formatStats(label: string, value: string | number, color: 'green' | 'blue' | 'yellow' | 'red' = 'blue') {
  return `${chalk.gray(label)}: ${chalk[color](value)}`;
}

export function createTitle() {
  return figlet.textSync('ze-benchmarks', {
    font: 'ANSI Shadow',
    horizontalLayout: 'fitted',
    verticalLayout: 'default'
  });
}

// Heuristic Checks display function
export function displayHeuristicChecks(
  result: { scores?: Record<string, any>; evaluator_results?: Array<{ name: string; details?: string }> }
) {
  const heuristicScore = (result.scores as any)['heuristic_checks'];
  const evaluatorResults = (result as any).evaluator_results;

  let heuristicResult = null;
  if (evaluatorResults && Array.isArray(evaluatorResults)) {
    heuristicResult = evaluatorResults.find((r: any) => r.name === 'HeuristicChecksEvaluator');
  }

  if (!heuristicResult && !heuristicScore) return;

  const details = heuristicResult?.details || heuristicScore?.details;
  const score = heuristicResult?.score ?? heuristicScore ?? 0;

  if (!details) return;

  // Parse the details to extract check information
  const lines = details.split('\n');
  const checks: Array<{ status: string; name: string; weight: string; description?: string; error?: string }> = [];
  let passedCount = 0;
  let totalCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match lines like: ✓ build_succeeds (weight: 2.0) - Description
    // or: ✗ lint_passes (weight: 1.0) - Description
    const match = line.match(/^([✓✗])\s+(\S+)\s+\(weight:\s+([\d.]+)\)(?:\s+-\s+(.+))?$/);
    if (match) {
      const [, status, name, weight, description] = match;
      totalCount++;
      if (status === '✓') passedCount++;

      // Check if next line is an error
      let error = undefined;
      if (status === '✗' && i + 1 < lines.length && lines[i + 1].trim().startsWith('Error:')) {
        error = lines[i + 1].trim().replace(/^Error:\s*/, '');
      }

      checks.push({ status, name, weight, description, error });
    }
  }

  if (checks.length === 0) return;

  logger.display.raw(`\n${chalk.bold.underline('Heuristic Checks')}`);
  logger.display.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
  logger.display.raw(`│ ${chalk.bold('Check Name'.padEnd(35))} ${chalk.bold('Weight'.padEnd(8))} ${chalk.bold('Status'.padEnd(12))} │`);
  logger.display.raw(`├${'─'.repeat(TABLE_WIDTH)}┤`);

  // Display each check
  checks.forEach((check) => {
    const displayName = check.name.length > 35 ? check.name.substring(0, 32) + '...' : check.name;
    const isPassed = check.status === '✓';
    const statusText = isPassed ? 'Passed' : 'Failed';
    const statusColor = isPassed ? 'green' : 'red';
    const weightColor = isPassed ? 'blue' : 'gray';

    logger.display.raw(
      `│ ${chalk.cyan(displayName.padEnd(35))} ${chalk[weightColor](check.weight.padEnd(8))} ${chalk[statusColor](statusText.padEnd(12))} │`
    );

    // If there's a description, show it on the next line (indented)
    if (check.description && !check.error) {
      const desc = check.description.length > 54 ? check.description.substring(0, 51) + '...' : check.description;
      logger.display.raw(`│   ${chalk.gray(desc.padEnd(TABLE_WIDTH - 4))} │`);
    }

    // If there's an error, show it (indented)
    if (check.error) {
      const errorText = check.error.length > 54 ? check.error.substring(0, 51) + '...' : check.error;
      logger.display.raw(`│   ${chalk.red('Error: ' + errorText).padEnd(TABLE_WIDTH - 4 + 9)} │`);
    }
  });

  logger.display.raw(`├${'─'.repeat(TABLE_WIDTH)}┤`);

  // Summary line
  const scorePercent = (score * 100).toFixed(1);
  const scoreColor = score >= 0.9 ? 'green' : score >= 0.7 ? 'yellow' : 'red';
  const summaryText = `${passedCount}/${totalCount} checks passed`;
  const scoreText = `Score: ${scorePercent}%`;

  logger.display.raw(
    `│ ${chalk.bold(summaryText.padEnd(35))} ${chalk[scoreColor](scoreText.padEnd(20))} │`
  );
  logger.display.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);
}

// LLM Judge display function
export function displayLLMJudgeScores(
  result: { scores?: Record<string, any>; evaluator_results?: Array<{ name: string; details?: string }> },
  scenario?: { llm_judge?: { categories?: string[] } }
) {
  const llmJudgeScore = (result.scores as any)['LLMJudgeEvaluator'];
  const evaluatorResults = (result as any).evaluator_results;

  let llmJudgeResult = null;
  if (evaluatorResults && Array.isArray(evaluatorResults)) {
    llmJudgeResult = evaluatorResults.find((r: any) => r.name === 'LLMJudgeEvaluator');
  }

  if (!llmJudgeResult && !llmJudgeScore) return;

  const details = llmJudgeResult?.details || llmJudgeScore?.details;
  if (!details) return;

  try {
    const parsedDetails = JSON.parse(details);
    if (parsedDetails.scores && Array.isArray(parsedDetails.scores)) {
      logger.display.raw(`\n${chalk.bold.underline('LLM Judge Detailed Scores')}`);
      logger.display.raw(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
      logger.display.raw(`│ ${chalk.bold('Category'.padEnd(40))} ${chalk.bold('Score'.padEnd(8))} ${chalk.bold('Status'.padEnd(15))} │`);
      logger.display.raw(`├${'─'.repeat(TABLE_WIDTH)}┤`);

      // Get category names from scenario configuration
      const categoryNames = scenario?.llm_judge?.categories || [];

      // Build score map from LLM response
      const scoreMap = new Map();
      parsedDetails.scores.forEach((score: any) => {
        if (score.category && score.score !== undefined) {
          scoreMap.set(score.category, score);
        }
      });

      // Helper to slugify category text (same logic as in llm-judge.ts)
      const slugifyCategory = (categoryText: string): string => {
        const name = categoryText.split(':')[0].split('(')[0].trim();
        return name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');
      };

      // Display each category with its score
      categoryNames.forEach((categoryText) => {
        const categoryKey = slugifyCategory(categoryText);
        const score = scoreMap.get(categoryKey);

        // Extract just the category name (before the weight/description)
        const categoryName = categoryText.split(':')[0].split('(')[0].trim();
        const displayName = categoryName.length > 40 ? categoryName.substring(0, 37) + '...' : categoryName;

        if (score) {
          const percent = (score.score / 5) * 100;
          const color = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
          const status = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'Excellent' : percent >= SCORE_THRESHOLDS.GOOD ? 'Good' : 'Needs Work';
          const statusColor = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';

          logger.display.raw(`│ ${chalk.cyan(displayName.padEnd(40))} ${chalk[color]((score.score.toFixed(1)).padEnd(8))} ${chalk[statusColor](status.padEnd(15))} │`);
        } else {
          logger.display.raw(`│ ${chalk.red(displayName.padEnd(40))} ${chalk.red('N/A'.padEnd(8))} ${chalk.red('Missing'.padEnd(15))} │`);
        }
      });

      logger.display.raw(`└${'─'.repeat(TABLE_WIDTH)}┘`);

      if (parsedDetails.overall_assessment) {
        logger.display.raw(`\n${chalk.bold('LLM Judge Assessment:')}`);
        logger.display.debug(parsedDetails.overall_assessment);
      }

      if (parsedDetails.input_tokens) {
        logger.display.raw(`\n${chalk.bold('Token Usage:')}`);
        logger.display.info(`Input tokens: ${parsedDetails.input_tokens}`);
      }
    }
  } catch (error) {
    logger.display.raw(`\n${chalk.bold('LLM Judge Details:')}`);
    logger.display.debug(details);
  }
}

// Common display functions
export function displayRunInfo(run: { status: string; suite: string; scenario: string; tier: string; agent: string; model?: string; weightedScore?: number | null; runId: string; startedAt: string | number }, index: number) {
  const status = run.status === 'completed'
    ? chalk.green('✓')
    : run.status === 'failed'
    ? chalk.red('✗')
    : run.status === 'incomplete'
    ? chalk.yellow('◐')
    : chalk.blue('○');

  logger.display.raw(`\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)}`);
  logger.display.raw(`   ${formatStats('Agent', run.agent + (run.model ? ` (${run.model})` : ''))}`);
  logger.display.raw(`   ${formatStats('Score', run.weightedScore?.toFixed(4) || 'N/A', 'green')}`);
  logger.display.raw(`   ${chalk.gray(new Date(run.startedAt).toLocaleString())}`);
  logger.display.raw(`   ${chalk.dim(`ID: ${run.runId.substring(0, 8)}...`)}`);
}


export function displayModelPerformance(modelStats: Array<{ model: string; avgScore: number; runs: number }>) {
  if (modelStats.length === 0) return;

  logger.display.raw('\n' + chalk.underline('Model Performance'));
  modelStats.forEach((model, index) => {
    const rank = index + 1;
    const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
    const percent = model.avgScore > 1 ? model.avgScore.toFixed(1) : (model.avgScore * 100).toFixed(1);
    const color = model.avgScore >= 0.9 ? 'green' : model.avgScore >= 0.7 ? 'yellow' : 'red';

    logger.display.raw(`  ${rankDisplay} ${chalk.bold(model.model.padEnd(35))} ${chalk[color](percent + '%')} ${chalk.gray(`(${model.runs} runs)`)}`);
  });

  const bestModel = modelStats[0];
  const bestPercent = bestModel.avgScore > 1 ? bestModel.avgScore.toFixed(1) : (bestModel.avgScore * 100).toFixed(1);
  logger.display.raw(`\n  ${chalk.cyan('Top Model:')} ${chalk.bold(bestModel.model)} ${chalk.green(bestPercent + '%')} ${chalk.gray(`(${bestModel.runs} runs)`)}`);
}
