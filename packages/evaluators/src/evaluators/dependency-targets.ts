import { relative } from 'node:path';

import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';
import { getAllPackageJsonPaths, readJson } from '../utils/package-json.js';
import { versionSatisfies } from '../utils/semver.js';

export class DependencyTargetsEvaluator implements Evaluator {
	meta = { name: 'DependencyTargetsEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const targets = ctx.scenario.targets?.required || [];
		if (!targets.length) {
			return { name: this.meta.name, score: 1, details: 'No required targets' };
		}

		const pkgPaths = getAllPackageJsonPaths(ctx.workspaceDir);
		let total = 0;
		let ok = 0;
		const misses: string[] = [];

		for (const pkgPath of pkgPaths) {
			const rel = relative(ctx.workspaceDir, pkgPath) || '.';
			const pkg = readJson(pkgPath);

			for (const target of targets) {
				total++;
				const current = pkg.dependencies?.[target.name] ?? pkg.devDependencies?.[target.name];
				const pass = versionSatisfies(target.to, current);
				if (pass) {
					ok++;
				} else {
					misses.push(`${rel}:${target.name}@${current ?? 'missing'} !-> ${target.to}`);
				}
			}
		}

		const score = total ? ok / total : 1;
		return { name: this.meta.name, score, details: misses.join('; ') };
	}
}
