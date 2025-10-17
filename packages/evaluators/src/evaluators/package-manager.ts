import { existsSync } from 'node:fs';
import { join } from 'node:path';

import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';

export class PackageManagerEvaluator implements Evaluator {
	meta = { name: 'PackageManagerEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const allowed = ctx.scenario.constraints?.managers_allowed || [];
		const usedPnpm = existsSync(join(ctx.workspaceDir, 'pnpm-lock.yaml'));
		const ok = allowed.length === 0 || (allowed.includes('pnpm') ? usedPnpm : true);
		return {
			name: this.meta.name,
			score: ok ? 1 : 0,
			details: ok ? 'Correct manager artifacts' : 'Lockfile mismatch',
		};
	}
}
