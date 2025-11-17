import chalk from 'chalk';
import figlet from 'figlet';
import { spinner } from '@clack/prompts';
import { TABLE_WIDTH, SCORE_THRESHOLDS, TOTAL_STAGES, type ProgressState } from './constants.ts';

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
export function displayLLMJudgeScores(result: { scores?: Record<string, any>; evaluator_results?: Array<{ name: string; details?: string }> }) {
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
      console.log(`\n${chalk.bold.underline('LLM Judge Detailed Scores')}`);
      console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
      console.log(`│ ${chalk.bold('Category'.padEnd(20))} ${chalk.bold('Score'.padEnd(8))} ${chalk.bold('Weight'.padEnd(8))} ${chalk.bold('Status'.padEnd(15))} │`);
      console.log(`├${'─'.repeat(TABLE_WIDTH)}┤`);

      const weights: Record<string, number> = {
        'dependency_quality': 25,
        'safety_stability': 20,
        'best_practices': 15,
        'monorepo_coordination': 15,
        'technical_execution': 10,
        'communication_transparency': 10,
        'long_term_maintainability': 5
      };

      const expectedCategories = [
        'dependency_quality',
        'safety_stability',
        'best_practices',
        'monorepo_coordination',
        'technical_execution',
        'communication_transparency',
        'long_term_maintainability',
        'overall_integrity'
      ];

      const scoreMap = new Map();
      parsedDetails.scores.forEach((score: any) => {
        if (score.category && score.score !== undefined) {
          scoreMap.set(score.category, score);
        }
      });

      expectedCategories.forEach(category => {
        const score = scoreMap.get(category);
        const weight = weights[category] || 0;

        if (score) {
          const percent = (score.score / 5) * 100;
          const color = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
          const status = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'Excellent' : percent >= SCORE_THRESHOLDS.GOOD ? 'Good' : 'Needs Work';
          const statusColor = percent >= SCORE_THRESHOLDS.EXCELLENT ? 'green' : percent >= SCORE_THRESHOLDS.GOOD ? 'yellow' : 'red';
          const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());

          console.log(`│ ${chalk.cyan(categoryName.padEnd(20))} ${chalk[color]((score.score.toFixed(1)).padEnd(8))} ${chalk.gray((weight + '%').padEnd(8))} ${chalk[statusColor](status.padEnd(15))} │`);
        } else {
          const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
          console.log(`│ ${chalk.red(categoryName.padEnd(20))} ${chalk.red('N/A'.padEnd(8))} ${chalk.gray((weight + '%').padEnd(8))} ${chalk.red('Missing'.padEnd(15))} │`);
        }
      });

      console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);

      if (parsedDetails.overall_assessment) {
        console.log(`\n${chalk.bold('LLM Judge Assessment:')}`);
        console.log(chalk.gray(parsedDetails.overall_assessment));
      }

      if (parsedDetails.input_tokens) {
        console.log(`\n${chalk.bold('Token Usage:')}`);
        console.log(chalk.blue(`Input tokens: ${parsedDetails.input_tokens}`));
      }
    }
  } catch (error) {
    console.log(`\n${chalk.bold('LLM Judge Details:')}`);
    console.log(chalk.gray(details));
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

  console.log(`\n${chalk.bold(`${index + 1}.`)} ${status} ${chalk.cyan(run.suite)}/${chalk.cyan(run.scenario)} ${chalk.gray(`(${run.tier})`)}`);
  console.log(`   ${formatStats('Agent', run.agent + (run.model ? ` (${run.model})` : ''))}`);
  console.log(`   ${formatStats('Score', run.weightedScore?.toFixed(4) || 'N/A', 'green')}`);
  console.log(`   ${chalk.gray(new Date(run.startedAt).toLocaleString())}`);
  console.log(`   ${chalk.dim(`ID: ${run.runId.substring(0, 8)}...`)}`);
}


export function displayModelPerformance(modelStats: Array<{ model: string; avgScore: number; runs: number }>) {
  if (modelStats.length === 0) return;

  console.log('\n' + chalk.underline('Model Performance'));
  modelStats.forEach((model, index) => {
    const rank = index + 1;
    const rankDisplay = rank <= 3 ? `#${rank}` : `${rank}.`;
    const percent = model.avgScore > 1 ? model.avgScore.toFixed(1) : (model.avgScore * 100).toFixed(1);
    const color = model.avgScore >= 0.9 ? 'green' : model.avgScore >= 0.7 ? 'yellow' : 'red';

    console.log(`  ${rankDisplay} ${chalk.bold(model.model.padEnd(35))} ${chalk[color](percent + '%')} ${chalk.gray(`(${model.runs} runs)`)}`);
  });

  const bestModel = modelStats[0];
  const bestPercent = bestModel.avgScore > 1 ? bestModel.avgScore.toFixed(1) : (bestModel.avgScore * 100).toFixed(1);
  console.log(`\n  ${chalk.cyan('Top Model:')} ${chalk.bold(bestModel.model)} ${chalk.green(bestPercent + '%')} ${chalk.gray(`(${bestModel.runs} runs)`)}`);
}
