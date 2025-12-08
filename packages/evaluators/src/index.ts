import type { EvaluationContext, EvaluatorResult, ScoreCard } from './types.ts';
import chalk from 'chalk';
import { logger } from '@ze/logger';

const log = logger.evaluators;

import { createLLMJudgeEvaluator, shouldEnableLLMJudge } from './evaluators/llm-judge.ts';
import { createHeuristicChecksEvaluator, shouldEnableHeuristicChecks } from './evaluators/heuristic-checks.ts';

export async function runEvaluators(
	ctx: EvaluationContext,
	llmJudgeOnly?: boolean
): Promise<{ results: EvaluatorResult[]; scoreCard: ScoreCard }> {
	const results: EvaluatorResult[] = [];

	// Check if heuristic checks are enabled
	if (shouldEnableHeuristicChecks(ctx.scenario)) {
		const evaluator = createHeuristicChecksEvaluator();
		try {
			results.push(await evaluator.evaluate(ctx));
		} catch (error) {
			results.push({ name: evaluator.meta.name, score: 0, details: `error: ${String(error)}` });
		}
	} else {
		log.debug(chalk.yellow('[Evaluators] ⚠️  Heuristic checks not enabled in scenario'));
		log.debug(chalk.gray('[Evaluators]   Enable them by setting heuristic_checks.enabled: true in scenario.yaml'));
	}

	// Check if LLM judge is enabled
	if (shouldEnableLLMJudge(ctx.scenario)) {
		const evaluator = createLLMJudgeEvaluator();
		try {
			results.push(await evaluator.evaluate(ctx));
		} catch (error) {
			results.push({ name: evaluator.meta.name, score: 0, details: `error: ${String(error)}` });
		}
	} else {
		log.debug(chalk.yellow('[Evaluators] ⚠️  LLM judge is not enabled in scenario'));
		log.debug(chalk.gray('[Evaluators]   Enable it by setting llm_judge.enabled: true in scenario.yaml'));
	}

	// Build scoreCard with both heuristic checks and LLM judge scores
	const scoreCard: ScoreCard = {
		heuristic_checks: results.find((result) => result.name === 'HeuristicChecksEvaluator')?.score ?? 0,
		llm_judge: results.find((result) => result.name === 'LLMJudgeEvaluator')?.score ?? 0,
	};

	return { results, scoreCard };
}

// Export types
export * from './types.ts';
export type { EvaluatorResult as Result } from './types.ts';

// Export factory function, main evaluation function, and should-enable check
export {
	createLLMJudgeEvaluator,
	evaluateLLMJudge,
	shouldEnableLLMJudge
} from './evaluators/llm-judge.ts';

export {
	createHeuristicChecksEvaluator,
	evaluateHeuristicChecks,
	shouldEnableHeuristicChecks
} from './evaluators/heuristic-checks.ts';

