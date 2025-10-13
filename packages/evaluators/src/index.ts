import type { EvaluationContext, Evaluator, EvaluatorResult, ScoreCard } from './types.js';

import { DependencyTargetsEvaluator } from './evaluators/dependency-targets.js';
import { InstallEvaluator } from './evaluators/install.js';
import { IntegrityGuardEvaluator } from './evaluators/integrity-guard.js';
import { PackageManagerEvaluator } from './evaluators/package-manager.js';
import { TestEvaluator } from './evaluators/test.js';
import { CompanionAlignmentEvaluator } from './evaluators/companion-alignment.js';
import { NamespaceMigrationEvaluator } from './evaluators/namespace-migration.js';
import { BuildEvaluator } from './evaluators/build.js';
import { LintEvaluator } from './evaluators/lint.js';
import { TypecheckEvaluator } from './evaluators/typecheck.js';

export async function runEvaluators(
	ctx: EvaluationContext,
): Promise<{ results: EvaluatorResult[]; scoreCard: ScoreCard }> {
	const evaluators: Evaluator[] = [
		new InstallEvaluator(),
		new TestEvaluator(),
		new BuildEvaluator(),
		new LintEvaluator(),
		new TypecheckEvaluator(),
		new PackageManagerEvaluator(),
		new DependencyTargetsEvaluator(),
		new CompanionAlignmentEvaluator(),
		new NamespaceMigrationEvaluator(),
		new IntegrityGuardEvaluator(),
	];

	const results: EvaluatorResult[] = [];
	for (const evaluator of evaluators) {
		try {
			results.push(await evaluator.evaluate(ctx));
		} catch (error) {
			results.push({ name: evaluator.meta.name, score: 0, details: `error: ${String(error)}` });
		}
	}

	const scoreCard: ScoreCard = {
		install_success: results.find((result) => result.name === 'InstallEvaluator')?.score ?? 0,
		tests_nonregression: results.find((result) => result.name === 'TestEvaluator')?.score ?? 0,
		build_success: results.find((result) => result.name === 'BuildEvaluator')?.score ?? 0,
		lint_success: results.find((result) => result.name === 'LintEvaluator')?.score ?? 0,
		typecheck_success: results.find((result) => result.name === 'TypecheckEvaluator')?.score ?? 0,
		manager_correctness: results.find((result) => result.name === 'PackageManagerEvaluator')?.score ?? 0,
		dependency_targets: results.find((result) => result.name === 'DependencyTargetsEvaluator')?.score ?? 0,
		companion_alignment: results.find((result) => result.name === 'CompanionAlignmentEvaluator')?.score ?? 0,
		namespace_migrations: results.find((result) => result.name === 'NamespaceMigrationEvaluator')?.score ?? 0,
		integrity_guard: results.find((result) => result.name === 'IntegrityGuardEvaluator')?.score ?? 0,
	};

	return { results, scoreCard };
}

export * from './types.js';
export type { EvaluatorResult as Result } from './types.js';
export { DependencyTargetsEvaluator } from './evaluators/dependency-targets.js';
export { InstallEvaluator } from './evaluators/install.js';
export { IntegrityGuardEvaluator } from './evaluators/integrity-guard.js';
export { PackageManagerEvaluator } from './evaluators/package-manager.js';
export { TestEvaluator } from './evaluators/test.js';
export { CompanionAlignmentEvaluator } from './evaluators/companion-alignment.js';
export { NamespaceMigrationEvaluator } from './evaluators/namespace-migration.js';
export { BuildEvaluator } from './evaluators/build.js';
export { LintEvaluator } from './evaluators/lint.js';
export { TypecheckEvaluator } from './evaluators/typecheck.js';

