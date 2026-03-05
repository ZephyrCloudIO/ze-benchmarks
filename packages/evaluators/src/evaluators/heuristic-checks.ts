import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globby } from 'globby';
import type { Evaluator, EvaluationContext, EvaluatorResult, ScenarioConfig } from '../types.ts';
import { logger } from '@ze/logger';

const log = logger.evaluators;

interface CheckResult {
	name: string;
	passed: boolean;
	weight: number;
	description?: string;
	error?: string;
}

function normalizeCommandForIsolatedWorkspace(cmd: string): string {
	// Bench fixtures live under this monorepo; pnpm would otherwise target the parent workspace.
	if (!/^\s*pnpm(\s|$)/.test(cmd) || cmd.includes('--ignore-workspace')) {
		return cmd;
	}
	return cmd.replace(/^\s*pnpm\b/, 'pnpm --ignore-workspace');
}

export function shouldEnableHeuristicChecks(scenario: ScenarioConfig): boolean {
	return scenario.heuristic_checks?.enabled === true;
}

export function createHeuristicChecksEvaluator(): Evaluator {
	return {
		meta: { name: 'HeuristicChecksEvaluator' },
		evaluate: async (ctx: EvaluationContext) => {
			return evaluateHeuristicChecks(ctx);
		}
	};
}

export async function evaluateHeuristicChecks(ctx: EvaluationContext): Promise<EvaluatorResult> {
	const { scenario, workspaceDir } = ctx;
	const checks = scenario.heuristic_checks;

	if (!checks?.enabled) {
		return {
			name: 'HeuristicChecksEvaluator',
			score: 0,
			details: 'Heuristic checks not enabled'
		};
	}

	const results: CheckResult[] = [];

	// Run command checks
	if (checks.commands && workspaceDir) {
		for (const check of checks.commands) {
			results.push(await runCommandCheck(check, workspaceDir));
		}
	}

	// Run file existence checks
	if (checks.files && workspaceDir) {
		for (const check of checks.files) {
			results.push(runFileCheck(check, workspaceDir));
		}
	}

	// Run pattern/content checks
	if (checks.patterns && workspaceDir) {
		for (const check of checks.patterns) {
			results.push(await runPatternCheck(check, workspaceDir));
		}
	}

	// Run structured data checks
	if (checks.structured && workspaceDir) {
		for (const check of checks.structured) {
			results.push(runStructuredCheck(check, workspaceDir));
		}
	}

	// Run script checks
	if (checks.scripts && workspaceDir) {
		for (const check of checks.scripts) {
			results.push(await runScriptCheck(check, workspaceDir, ctx));
		}
	}

	// Calculate weighted score
	const totalWeight = results.reduce((sum, r) => sum + r.weight, 0);
	const passedWeight = results.filter(r => r.passed).reduce((sum, r) => sum + r.weight, 0);
	const score = totalWeight > 0 ? passedWeight / totalWeight : 0;

	// Format details
	const passed = results.filter(r => r.passed).length;
	const total = results.length;
	const details = formatCheckDetails(results);

	log.debug(`Heuristic checks: ${passed}/${total} passed (score: ${score.toFixed(2)})`);

	return {
		name: 'HeuristicChecksEvaluator',
		score,
		details
	};
}

async function runCommandCheck(
	check: { name: string; command: string; weight?: number; description?: string },
	workspaceDir: string
): Promise<CheckResult> {
	const weight = check.weight ?? 1.0;
	const command = normalizeCommandForIsolatedWorkspace(check.command);

	log.debug(`Running command check: ${check.name} - ${command}`);

	try {
		const result = spawnSync(command, {
			cwd: workspaceDir,
			shell: true,
			encoding: 'utf8',
			timeout: 5 * 60 * 1000, // 5 minute timeout
		});

		const passed = result.status === 0;

		return {
			name: check.name,
			passed,
			weight,
			description: check.description,
			error: passed ? undefined : (result.stderr || result.stdout || 'Command failed')
		};
	} catch (error) {
		return {
			name: check.name,
			passed: false,
			weight,
			description: check.description,
			error: String(error)
		};
	}
}

function runFileCheck(
	check: { name: string; path: string; weight?: number; description?: string },
	workspaceDir: string
): CheckResult {
	const weight = check.weight ?? 1.0;
	const filePath = join(workspaceDir, check.path);

	log.debug(`Running file check: ${check.name} - ${check.path}`);

	const passed = existsSync(filePath);

	return {
		name: check.name,
		passed,
		weight,
		description: check.description,
		error: passed ? undefined : `File not found: ${check.path}`
	};
}

async function runPatternCheck(
	check: { name: string; file: string; pattern: string; weight?: number; description?: string },
	workspaceDir: string
): Promise<CheckResult> {
	const weight = check.weight ?? 1.0;

	log.debug(`Running pattern check: ${check.name} - ${check.file}`);

	try {
		// Support glob patterns in file path
		const files = await globby(check.file, { cwd: workspaceDir, absolute: true });

		if (files.length === 0) {
			return {
				name: check.name,
				passed: false,
				weight,
				description: check.description,
				error: `No files matched pattern: ${check.file}`
			};
		}

		const regex = new RegExp(check.pattern);
		let foundMatch = false;

		for (const file of files) {
			try {
				const content = readFileSync(file, 'utf8');
				if (regex.test(content)) {
					foundMatch = true;
					break;
				}
			} catch (err) {
				log.debug(`Failed to read file ${file}: ${err}`);
			}
		}

		return {
			name: check.name,
			passed: foundMatch,
			weight,
			description: check.description,
			error: foundMatch ? undefined : `Pattern not found in any matching files`
		};
	} catch (error) {
		return {
			name: check.name,
			passed: false,
			weight,
			description: check.description,
			error: String(error)
		};
	}
}

function runStructuredCheck(
	check: {
		name: string;
		file: string;
		json_path?: string;
		section_header?: string;
		exists?: boolean;
		weight?: number;
		description?: string;
	},
	workspaceDir: string
): CheckResult {
	const weight = check.weight ?? 1.0;
	const filePath = join(workspaceDir, check.file);

	log.debug(`Running structured check: ${check.name} - ${check.file}`);

	try {
		if (!existsSync(filePath)) {
			return {
				name: check.name,
				passed: false,
				weight,
				description: check.description,
				error: `File not found: ${check.file}`
			};
		}

		const content = readFileSync(filePath, 'utf8');

		// Check for JSON path (for JSON/YAML files)
		if (check.json_path) {
			try {
				const data = JSON.parse(content);
				const passed = evaluateJsonPath(data, check.json_path);
				return {
					name: check.name,
					passed,
					weight,
					description: check.description,
					error: passed ? undefined : `JSON path not found: ${check.json_path}`
				};
			} catch (error) {
				return {
					name: check.name,
					passed: false,
					weight,
					description: check.description,
					error: `Failed to parse JSON: ${error}`
				};
			}
		}

		// Check for section header (for Markdown files)
		if (check.section_header) {
			const passed = content.includes(check.section_header);
			return {
				name: check.name,
				passed,
				weight,
				description: check.description,
				error: passed ? undefined : `Section header not found: ${check.section_header}`
			};
		}

		// Default: just check if file exists
		return {
			name: check.name,
			passed: true,
			weight,
			description: check.description
		};
	} catch (error) {
		return {
			name: check.name,
			passed: false,
			weight,
			description: check.description,
			error: String(error)
		};
	}
}

async function runScriptCheck(
	check: { name: string; script: string; args?: string[]; weight?: number; description?: string },
	workspaceDir: string,
	ctx: EvaluationContext
): Promise<CheckResult> {
	const weight = check.weight ?? 1.0;

	log.debug(`Running script check: ${check.name} - ${check.script}`);

	try {
		// Resolve script path (relative to workspace or absolute)
		const scriptPath = check.script.startsWith('/')
			? check.script
			: join(workspaceDir, check.script);

		if (!existsSync(scriptPath)) {
			return {
				name: check.name,
				passed: false,
				weight,
				description: check.description,
				error: `Script not found: ${check.script}`
			};
		}

		// Interpolate arguments (support ${artifact.figma_file_id} syntax)
		const args = check.args?.map(arg => interpolateArg(arg, ctx)) ?? [];

		// Execute script
		const result = spawnSync(scriptPath, args, {
			cwd: workspaceDir,
			encoding: 'utf8',
			timeout: 5 * 60 * 1000, // 5 minute timeout
		});

		const passed = result.status === 0;

		return {
			name: check.name,
			passed,
			weight,
			description: check.description,
			error: passed ? undefined : (result.stderr || result.stdout || 'Script failed')
		};
	} catch (error) {
		return {
			name: check.name,
			passed: false,
			weight,
			description: check.description,
			error: String(error)
		};
	}
}

// Helper function to evaluate simple JSON paths (e.g., "$.paths./users.get")
function evaluateJsonPath(data: any, path: string): boolean {
	if (!path.startsWith('$.')) {
		return false;
	}

	const parts = path.slice(2).split('.');
	let current = data;

	for (const part of parts) {
		if (current === null || current === undefined) {
			return false;
		}
		current = current[part];
	}

	return current !== undefined && current !== null;
}

// Helper function to interpolate template variables in arguments
function interpolateArg(arg: string, ctx: EvaluationContext): string {
	return arg
		.replace(/\$\{artifact\.figma_file_id\}/g, ctx.scenario.artifact?.figma_file_id ?? '')
		.replace(/\$\{artifact\.figma_file_key\}/g, ctx.scenario.artifact?.figma_file_key ?? '')
		.replace(/\$\{scenario\.id\}/g, ctx.scenario.id ?? '')
		.replace(/\$\{scenario\.suite\}/g, ctx.scenario.suite ?? '');
}

// Helper function to format check details for display
function formatCheckDetails(results: CheckResult[]): string {
	const lines: string[] = [];
	const passed = results.filter(r => r.passed).length;
	const total = results.length;

	lines.push(`Passed: ${passed}/${total} checks`);
	lines.push('');

	for (const result of results) {
		const status = result.passed ? '✓' : '✗';
		const name = result.name;
		const desc = result.description ? ` - ${result.description}` : '';
		const weight = `(weight: ${result.weight.toFixed(1)})`;

		lines.push(`${status} ${name} ${weight}${desc}`);

		if (!result.passed && result.error) {
			lines.push(`  Error: ${result.error.split('\n')[0]}`); // First line only
		}
	}

	return lines.join('\n');
}
