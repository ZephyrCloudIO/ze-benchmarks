import type { EvaluationContext, Evaluator, EvaluatorResult, ScoreCard } from './types.ts';
import chalk from 'chalk';
import { logger } from '@ze/logger';

const log = logger.evaluators;

import { DependencyTargetsEvaluator } from './evaluators/dependency-targets.ts';
import { InstallEvaluator } from './evaluators/install.ts';
import { IntegrityGuardEvaluator } from './evaluators/integrity-guard.ts';
import { LLMJudgeEvaluator } from './evaluators/llm-judge.ts';
import { PackageManagerEvaluator } from './evaluators/package-manager.ts';
import { TestEvaluator } from './evaluators/test.ts';
import { FileStructureEvaluator } from './evaluators/file-structure.ts';
import { ConfigAccuracyEvaluator } from './evaluators/config-accuracy.ts';
import { DependencyProximityEvaluator } from './evaluators/dependency-proximity.ts';

export async function runEvaluators(
	ctx: EvaluationContext,
	llmJudgeOnly?: boolean,
): Promise<{ results: EvaluatorResult[]; scoreCard: ScoreCard }> {
	const evaluators: Evaluator[] = [];

	// If llmJudgeOnly is true, only run LLM judge
	if (llmJudgeOnly) {
		log.debug(chalk.blue('[Evaluators] LLM judge only mode: Skipping other evaluators'));
		if (shouldEnableLLMJudge(ctx.scenario)) {
			evaluators.push(new LLMJudgeEvaluator());
		} else {
			log.debug(chalk.yellow('[Evaluators] ⚠️  LLM judge only requested but LLM judge is not enabled in scenario'));
			log.debug(chalk.gray('[Evaluators]   Enable it by setting llm_judge.enabled: true in scenario.yaml'));
		}
	} else {
		// Run all evaluators
		evaluators.push(
			new InstallEvaluator(),
			new TestEvaluator(),
			new PackageManagerEvaluator(),
			new DependencyTargetsEvaluator(),
			new IntegrityGuardEvaluator(),
			new FileStructureEvaluator(),
			new ConfigAccuracyEvaluator(),
			new DependencyProximityEvaluator(),
		);

		// Add LLM judge if enabled
		if (shouldEnableLLMJudge(ctx.scenario)) {
			evaluators.push(new LLMJudgeEvaluator());
		}
	}

	const results: EvaluatorResult[] = [];
	for (const evaluator of evaluators) {
		try {
			results.push(await evaluator.evaluate(ctx));
		} catch (error) {
			results.push({ name: evaluator.meta.name, score: 0, details: `error: ${String(error)}` });
		}
	}

	// Build scoreCard - if llmJudgeOnly, only include LLM judge score
	const scoreCard: ScoreCard = llmJudgeOnly
		? {
				llm_judge: results.find((result) => result.name === 'LLMJudgeEvaluator')?.score ?? 0,
			}
		: {
				install_success: results.find((result) => result.name === 'InstallEvaluator')?.score ?? 0,
				tests_nonregression: results.find((result) => result.name === 'TestEvaluator')?.score ?? 0,
				manager_correctness: results.find((result) => result.name === 'PackageManagerEvaluator')?.score ?? 0,
				dependency_targets: results.find((result) => result.name === 'DependencyTargetsEvaluator')?.score ?? 0,
				integrity_guard: results.find((result) => result.name === 'IntegrityGuardEvaluator')?.score ?? 0,
				file_structure: results.find((result) => result.name === 'FileStructureEvaluator')?.score ?? 0,
				config_accuracy: results.find((result) => result.name === 'ConfigAccuracyEvaluator')?.score ?? 0,
				dependency_proximity: results.find((result) => result.name === 'DependencyProximityEvaluator')?.score ?? 0,
				llm_judge: results.find((result) => result.name === 'LLMJudgeEvaluator')?.score ?? 0,
			};

	return { results, scoreCard };
}

function shouldEnableLLMJudge(scenario: any): boolean {
	const hasApiKey = !!process.env.OPENROUTER_API_KEY;
	const isEnabled = scenario.llm_judge?.enabled;
	
	// Debug: Log environment variable check
	log.debug(`[env] LLM Judge check - OPENROUTER_API_KEY=${hasApiKey ? '***set***' : '(not set)'}, scenario.enabled=${isEnabled}`);
	
	return isEnabled && hasApiKey;
}

export * from './types.ts';
export type { EvaluatorResult as Result } from './types.ts';
export { DependencyTargetsEvaluator } from './evaluators/dependency-targets.ts';
export { InstallEvaluator } from './evaluators/install.ts';
export { IntegrityGuardEvaluator } from './evaluators/integrity-guard.ts';
export { LLMJudgeEvaluator } from './evaluators/llm-judge.ts';
export { PackageManagerEvaluator } from './evaluators/package-manager.ts';
export { TestEvaluator } from './evaluators/test.ts';
export { FileStructureEvaluator } from './evaluators/file-structure.ts';
export { ConfigAccuracyEvaluator } from './evaluators/config-accuracy.ts';
export { DependencyProximityEvaluator } from './evaluators/dependency-proximity.ts';

