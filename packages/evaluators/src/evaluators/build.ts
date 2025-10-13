import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';

export class BuildEvaluator implements Evaluator {
	meta = { name: 'BuildEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const entry = ctx.commandLog?.find((command) => command.type === 'build');
		if (!entry) {
			// No build command configured is not a failure
			return { name: this.meta.name, score: 1, details: 'No build command configured' };
		}

		const ok = entry.exitCode === 0;
		const details = ok
			? 'Build succeeded'
			: `Build failed: exit=${entry.exitCode}`;

		return { name: this.meta.name, score: ok ? 1 : 0, details };
	}
}

