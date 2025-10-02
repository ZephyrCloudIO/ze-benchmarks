import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.js';

export class TestEvaluator implements Evaluator {
	meta = { name: 'TestEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		const entry = (ctx.commandLog || []).find((command) => command.type === 'test');
		if (!entry) {
			return { name: this.meta.name, score: 0, details: 'No test run recorded' };
		}

		const ok = entry.exitCode === 0;
		const details = ok ? 'Tests passed (or none present)' : `Tests failed: exit=${entry.exitCode}`;
		return { name: this.meta.name, score: ok ? 1 : 0, details };
	}
}
