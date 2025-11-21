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
