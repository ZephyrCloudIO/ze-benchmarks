export type ScoreCard = Record<string, number>;

export interface ScenarioConfig {
	id: string;
	suite: string;
	title?: string;
	description?: string;
	constraints?: {
		blocklist?: { name: string; versions?: string[] }[];
		namespace_migrations?: { from: string; to: string }[];
		companion_versions?: { main: string; companions: { name: string; rule: string }[] }[];
		managers_allowed?: string[];
	};
	targets?: {
		required?: { name: string; to?: string }[];
		optional?: { name: string; to?: string }[];
	};
	validation?: { commands?: { install?: string; test?: string; lint?: string; typecheck?: string } };
	rubric_overrides?: { weights?: Record<string, number> };
	llm_judge?: {
		enabled?: boolean;
		model?: string;
		categories?: string[];
		temperature?: number;
		max_tokens?: number;
	};
}

export interface FileDiff {
	file: string;
	changeType: 'added' | 'modified' | 'deleted';
	textPatch?: string;
}

export interface DepChange {
	packagePath: string;
	section: string;
	name: string;
	from?: string;
	to?: string;
}

export interface ExecutedCommand {
	tool: string;
	raw: string;
	type?: string;
	exitCode?: number;
	stdout?: string;
	stderr?: string;
	durationMs?: number;
}

export interface EvaluationContext {
	scenario: ScenarioConfig;
	workspaceDir: string;
	agentResponse?: string;
	diffSummary?: FileDiff[];
	depsDelta?: DepChange[];
	commandLog?: ExecutedCommand[];
}

export interface EvaluatorResult {
	name: string;
	score: number;
	details?: string;
}

export interface Evaluator {
	meta: { name: string };
	evaluate(ctx: EvaluationContext): Promise<EvaluatorResult>;
}
