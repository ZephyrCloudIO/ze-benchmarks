import { relative } from 'node:path';

import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';
import { getAllPackageJsonPaths, readJson } from '../utils/package-json.js';

/**
 * Extract major version from a version string
 */
function getMajorVersion(version: string | undefined): number | null {
	if (!version) return null;
	const cleaned = version.trim().replace(/^[^0-9]*/, '');
	const match = cleaned.match(/^(\d+)/);
	return match ? parseInt(match[1], 10) : null;
}

export class CompanionAlignmentEvaluator implements Evaluator {
	meta = { name: 'CompanionAlignmentEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const companionRules = ctx.scenario.constraints?.companion_versions || [];
		if (!companionRules.length) {
			return { name: this.meta.name, score: 1, details: 'No companion version rules defined' };
		}

		const pkgPaths = getAllPackageJsonPaths(ctx.workspaceDir);
		let total = 0;
		let aligned = 0;
		const misalignments: string[] = [];

		for (const pkgPath of pkgPaths) {
			const rel = relative(ctx.workspaceDir, pkgPath) || '.';
			const pkg = readJson(pkgPath);

			for (const rule of companionRules) {
				// Check if this package has the main dependency
				const mainVersion =
					pkg.dependencies?.[rule.main] ??
					pkg.devDependencies?.[rule.main] ??
					pkg.peerDependencies?.[rule.main];

				if (!mainVersion) continue; // Main package not in this package.json

				const mainMajor = getMajorVersion(mainVersion);

				for (const companion of rule.companions) {
					total++;
					const companionVersion =
						pkg.dependencies?.[companion.name] ??
						pkg.devDependencies?.[companion.name] ??
						pkg.peerDependencies?.[companion.name];

					const companionMajor = getMajorVersion(companionVersion);

					// Apply the rule (currently only supports "major must match")
					if (companion.rule === 'major must match') {
						if (mainMajor !== null && companionMajor !== null && mainMajor === companionMajor) {
							aligned++;
						} else {
							misalignments.push(
								`${rel}: ${rule.main}@${mainVersion} vs ${companion.name}@${companionVersion ?? 'missing'} (major mismatch)`
							);
						}
					}
				}
			}
		}

		const score = total > 0 ? aligned / total : 1;
		return {
			name: this.meta.name,
			score,
			details: misalignments.length ? misalignments.join('; ') : 'All companions aligned',
		};
	}
}

