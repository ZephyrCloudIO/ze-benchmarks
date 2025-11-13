import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';

export class TestEvaluator implements Evaluator {
	meta = { name: 'TestEvaluator' } as const;

	async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
		// Check if a test command was configured in the scenario
		const testCommandConfigured = ctx.scenario.validation?.commands?.test;

		const entry = (ctx.commandLog || []).find((command) => command.type === 'test');

		// If no test command is configured, pass with success
		if (!testCommandConfigured) {
			if (!entry) {
				return {
					name: this.meta.name,
					score: 1,
					details: 'No test script configured - skipping tests'
				};
			}
			// Agent ran tests even though none were required - still pass
			const ok = entry.exitCode === 0;
			return {
				name: this.meta.name,
				score: ok ? 1 : 0,
				details: ok ? 'Tests passed (optional)' : 'Tests failed (optional)'
			};
		}

		// Test command IS configured but wasn't run
		if (!entry) {
			return {
				name: this.meta.name,
				score: 0,
				details: 'Test command was configured but not executed'
			};
		}

		// Test command was run - check result
		const ok = entry.exitCode === 0;
		const details = ok ? 'Tests passed' : `Tests failed: exit=${entry.exitCode}`;
		return { name: this.meta.name, score: ok ? 1 : 0, details };
	}
}
