import { relative } from 'node:path';

import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';
import { getAllPackageJsonPaths, readJson } from '../utils/package-json.js';

export class NamespaceMigrationEvaluator implements Evaluator {
	meta = { name: 'NamespaceMigrationEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const migrations = ctx.scenario.constraints?.namespace_migrations || [];
		if (!migrations.length) {
			return { name: this.meta.name, score: 1, details: 'No namespace migrations defined' };
		}

		const pkgPaths = getAllPackageJsonPaths(ctx.workspaceDir);
		const issues: string[] = [];

		// Check 1: Ensure old packages are removed from package.json
		for (const pkgPath of pkgPaths) {
			const rel = relative(ctx.workspaceDir, pkgPath) || '.';
			const pkg = readJson(pkgPath);

			for (const migration of migrations) {
				const oldInDeps = pkg.dependencies?.[migration.from];
				const oldInDevDeps = pkg.devDependencies?.[migration.from];

				if (oldInDeps || oldInDevDeps) {
					issues.push(`${rel}: Still has old package '${migration.from}' (should migrate to '${migration.to}')`);
				}
			}
		}

		// Check 2: Verify new packages are present if old ones were used
		// Look at diff_summary to see if old package was present before
		if (ctx.depsDelta) {
			for (const change of ctx.depsDelta) {
				for (const migration of migrations) {
					// If the old package was removed, ensure the new one was added
					if (change.name === migration.from && !change.to) {
						// Old package was removed, check if new one exists
						const pkgPath = getAllPackageJsonPaths(ctx.workspaceDir).find((p) =>
							p.includes(change.packagePath)
						);
						if (pkgPath) {
							const pkg = readJson(pkgPath);
							const newInDeps = pkg.dependencies?.[migration.to];
							const newInDevDeps = pkg.devDependencies?.[migration.to];
							if (!newInDeps && !newInDevDeps) {
								issues.push(
									`${change.packagePath}: Removed '${migration.from}' but didn't add '${migration.to}'`
								);
							}
						}
					}
				}
			}
		}

		// Check 3: Look for old package references in code (from diffSummary)
		if (ctx.diffSummary) {
			for (const diff of ctx.diffSummary) {
				if (diff.changeType === 'deleted') continue;
				if (!diff.textPatch) continue;

				for (const migration of migrations) {
					// Look for import/require statements with old package name
					const importPattern = new RegExp(
						`(import|require)\\s*.*['"\`]${migration.from}['"\`]`,
						'g'
					);
					if (importPattern.test(diff.textPatch)) {
						issues.push(`${diff.file}: Still imports old package '${migration.from}'`);
					}
				}
			}
		}

		const score = issues.length === 0 ? 1 : Math.max(0, 1 - issues.length * 0.33);
		return {
			name: this.meta.name,
			score,
			details: issues.length ? issues.join('; ') : 'All namespace migrations completed',
		};
	}
}

