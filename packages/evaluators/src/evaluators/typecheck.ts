import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';

export class TypecheckEvaluator implements Evaluator {
	meta = { name: 'TypecheckEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const entry = ctx.commandLog?.find((command) => command.type === 'typecheck');
		if (!entry) {
			// No typecheck command configured is not a failure
			return { name: this.meta.name, score: 1, details: 'No typecheck command configured' };
		}

		const ok = entry.exitCode === 0;
		const details = ok
			? 'Typecheck passed'
			: `Typecheck failed: exit=${entry.exitCode}`;

		return { name: this.meta.name, score: ok ? 1 : 0, details };
	}
}

