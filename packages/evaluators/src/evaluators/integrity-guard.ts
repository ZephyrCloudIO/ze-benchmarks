import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';

export class IntegrityGuardEvaluator implements Evaluator {
	meta = { name: 'IntegrityGuardEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const findings: string[] = [];

		for (const diff of ctx.diffSummary || []) {
			if (
				diff.file.match(/\.eslintignore$/) &&
				diff.changeType === 'modified' &&
				/(^\+\s*\*|^\+\s*\*\*\/)/m.test(diff.textPatch || '')
			) {
				findings.push('Widened .eslintignore');
			}

			if (
				diff.file.match(/tsconfig\.json$/) &&
				diff.textPatch?.match(/-\s*"skipLibCheck"\s*:\s*false[\s\S]*\+\s*"skipLibCheck"\s*:\s*true/)
			) {
				findings.push('Relaxed tsconfig skipLibCheck');
			}

			if (diff.file.match(/\.(test|spec)\.[jt]sx?$/) && /\.skip\(/.test(diff.textPatch || '')) {
				findings.push('Introduced skipped tests');
			}
		}

		const score = Math.max(0, 1 - findings.length * 0.2);
		return { name: this.meta.name, score, details: findings.join('; ') || 'No integrity issues detected' };
	}
}
