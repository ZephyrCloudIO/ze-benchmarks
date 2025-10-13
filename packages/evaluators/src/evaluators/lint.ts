import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';

export class LintEvaluator implements Evaluator {
	meta = { name: 'LintEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const entry = ctx.commandLog?.find((command) => command.type === 'lint');
		if (!entry) {
			// No lint command configured is not a failure
			return { name: this.meta.name, score: 1, details: 'No lint command configured' };
		}

		const ok = entry.exitCode === 0;
		const details = ok
			? 'Lint passed'
			: `Lint failed: exit=${entry.exitCode}`;

		return { name: this.meta.name, score: ok ? 1 : 0, details };
	}
}

