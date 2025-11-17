import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';
import { findProjectDir } from '../utils/workspace.ts';

export class PackageManagerEvaluator implements Evaluator {
	meta = { name: 'PackageManagerEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		// Find the generated project directory (not 'control')
		const projectDir = findProjectDir(ctx.workspaceDir);
		if (!projectDir) {
			return {
				name: this.meta.name,
				score: 0,
				details: 'Generated project directory not found in workspace',
			};
		}

		const allowed = ctx.scenario.constraints?.managers_allowed || [];
		const usedPnpm = existsSync(join(projectDir, 'pnpm-lock.yaml'));
		const ok = allowed.length === 0 || (allowed.includes('pnpm') ? usedPnpm : true);
		return {
			name: this.meta.name,
			score: ok ? 1 : 0,
			details: ok ? 'Correct manager artifacts' : 'Lockfile mismatch',
		};
	}
}
