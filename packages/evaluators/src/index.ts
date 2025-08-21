export type ScoreCard = Record<string, number>;
export interface EvaluatorInput { logsDir: string }
export interface Evaluator { name: string; evaluate(input: EvaluatorInput): Promise<ScoreCard> }

export class NoopEvaluator implements Evaluator {
	name = 'noop';
	async evaluate(): Promise<ScoreCard> { return { install_success: 0, tests_nonregression: 0, manager_correctness: 0 }; }
}
