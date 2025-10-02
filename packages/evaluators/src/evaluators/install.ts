import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';

export class InstallEvaluator implements Evaluator {
	meta = { name: 'InstallEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const entry = (ctx.commandLog || []).find((command) => command.type === 'install');
		if (!entry) {
			return { name: this.meta.name, score: 0, details: 'No install attempt recorded' };
		}

		const ok = entry.exitCode === 0;
		const details = ok ? 'Install succeeded' : `Install failed: exit=${entry.exitCode}`;
		return { name: this.meta.name, score: ok ? 1 : 0, details };
	}
}
