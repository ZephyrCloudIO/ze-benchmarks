#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { EchoAgent, ClaudeCodeAdapter, type AgentAdapter } from '../../agent-adapters/dist/index.js';
import { runValidationCommands } from './runtime/validation.js';
import { buildDiffArtifacts } from './runtime/diff.js';

function computeWeightedTotals(
	scores: Record<string, number>,
	scenarioCfg: { rubric_overrides?: { weights?: Record<string, number> } },
) {
	const baseWeights: Record<string, number> = {
		install_success: 1.5,
		tests_nonregression: 2.5,
		manager_correctness: 1,
		dependency_targets: 2,
		integrity_guard: 1.5,
	};

	const overrideWeights = scenarioCfg.rubric_overrides?.weights ?? {};

	let totalWeight = 0;
	let achieved = 0;

	for (const [metric, score] of Object.entries(scores || {})) {
		const weight = overrideWeights[metric] ?? baseWeights[metric] ?? 1;
		if (weight <= 0) continue;
		totalWeight += weight;
		achieved += (typeof score === 'number' ? score : 0) * weight;
	}

	const weighted = totalWeight > 0 ? (achieved / totalWeight) * 10 : 0;
	return { weighted: Number(weighted.toFixed(4)), max: 10 };
}

function findRepoRoot(): string {
	return resolve(fileURLToPath(import.meta.url), '../../../..');
}

function loadScenario(suite: string, scenario: string) {
	const root = findRepoRoot();
	const scenarioPath = join(root, 'suites', suite, 'scenarios', scenario, 'scenario.yaml');
	const yamlText = readFileSync(scenarioPath, 'utf8');
	return YAML.parse(yamlText);
}

function getScenarioDir(suite: string, scenario: string) {
	const root = findRepoRoot();
	return join(root, 'suites', suite, 'scenarios', scenario);
}

function prepareWorkspaceFromFixture(suite: string, scenario: string): { workspaceDir: string; fixtureDir: string } | undefined {
	const scenarioDir = getScenarioDir(suite, scenario);
	const candidates = ['repo', 'repo-fixture'];
	let fixtureDir: string | null = null;
	for (const name of candidates) {
		const dir = join(scenarioDir, name);
		if (existsSync(dir)) { fixtureDir = dir; break; }
	}
	if (!fixtureDir) {
		console.warn(`No raw fixture directory found (looked for ${candidates.join(', ')}) in ${scenarioDir}`);
		return;
	}
	const root = findRepoRoot();
	const workspacesDir = join(root, 'results', 'workspaces');
	mkdirSync(workspacesDir, { recursive: true });
	const workspaceDir = mkdtempSync(join(workspacesDir, `${suite}-${scenario}-`));
	try {
		cpSync(fixtureDir, workspaceDir, { recursive: true });
		return { workspaceDir, fixtureDir };
	} catch (err) {
		console.error('Failed to copy fixture directory:', err);
		return;
	}
}

function loadPrompt(suite: string, scenario: string, tier: string): string | null {
	const root = findRepoRoot();
	const promptDir = join(root, 'suites', suite, 'prompts', scenario);
	
	if (!existsSync(promptDir)) {
		console.warn(`Prompt directory not found: ${promptDir}`);
		return null;
	}
	
	// Look for files that start with the tier (e.g., L1-basic.md, L1.md)
	try {
		const files = readdirSync(promptDir);
		const promptFile = files.find((file: string) => file.startsWith(`${tier}-`) || file === `${tier}.md`);
		
		if (!promptFile) {
			console.warn(`No prompt file found for tier ${tier} in ${promptDir}`);
			return null;
		}
		
		const promptPath = join(promptDir, promptFile);
		return readFileSync(promptPath, 'utf8');
	} catch (err) {
		console.error('Failed to load prompt file:', err);
		return null;
	}
}

function createAgentAdapter(agentName: string, model?: string, maxTurns?: number): AgentAdapter {
	switch (agentName) {
		case 'claude-code':
			return new ClaudeCodeAdapter(model, maxTurns ?? 10);
		case 'echo':
		default:
			return new EchoAgent();
	}
}

function writeResult(out: unknown, suite: string, scenario: string) {
	const root = findRepoRoot();
	const resultsDir = join(root, 'results');
	mkdirSync(resultsDir, { recursive: true });
	const outPath = join(resultsDir, `summary.json`);
	writeFileSync(outPath, JSON.stringify(out, null, 2));
	console.log(`Wrote results to ${outPath}`);
}

function parseArgs(argv: string[]) {
	const [_node, _bin, cmd, suite, scenario, ...rest] = argv;
	const tierIndex = rest.indexOf('--tier');
	const tier = tierIndex !== -1 ? rest[tierIndex + 1] : 'L0';
	
	const agentIndex = rest.indexOf('--agent');
	const agent = agentIndex !== -1 ? rest[agentIndex + 1] : 'echo';
	
	const modelIndex = rest.indexOf('--model');
	const model = modelIndex !== -1 ? rest[modelIndex + 1] : undefined;

	const maxTurnsIndex = rest.indexOf('--max-turns');
	const rawMaxTurns = maxTurnsIndex !== -1 ? Number.parseInt(rest[maxTurnsIndex + 1] ?? '', 10) : undefined;
	const maxTurns = typeof rawMaxTurns === 'number' && Number.isFinite(rawMaxTurns) && rawMaxTurns > 0 ? rawMaxTurns : undefined;

	return { cmd, suite, scenario, tier, agent, model, maxTurns } as const;
}

async function run() {
	const { cmd, suite, scenario, tier, agent, model, maxTurns } = parseArgs(process.argv);
	if (cmd !== 'run' || !suite || !scenario) {
		console.error('Usage: ze-bench run <suite> <scenario> [--tier L0|L1|L2|L3|Lx] [--agent echo|claude-code] [--model <model>]');
		process.exit(1);
	}
	
	console.log('Running scenario:', { suite, scenario, tier, agent, model, maxTurns });
	
	const scenarioCfg = loadScenario(suite, scenario);
	const workspacePrep = prepareWorkspaceFromFixture(suite, scenario);
	const workspaceDir = workspacePrep?.workspaceDir;
	const fixtureDir = workspacePrep?.fixtureDir;
	
	// Initialize result structure
	const result = {
		suite,
		scenario,
		tier,
		agent,
		model: model || 'default',
		agent_response: '',
		scores: {
			install_success: 0,
			tests_nonregression: 0,
			manager_correctness: 0,
			dependency_targets: 0,
			integrity_guard: 0,
		},
		totals: { weighted: 0, max: 10 },
		telemetry: { 
			toolCalls: 0, 
			tokens: { in: 0, out: 0 }, 
			cost_usd: 0, 
			workspaceDir 
		}
	};

	console.log('Scenario title:', scenarioCfg.title);
	if (workspaceDir) console.log('Workspace prepared at:', workspaceDir);

	// Load prompt for the tier
	const promptContent = loadPrompt(suite, scenario, tier);
	
	if (promptContent && agent !== 'echo') {
		try {
			// Create agent adapter
			const agentAdapter = createAgentAdapter(agent, model, maxTurns);
			console.log(`Using agent: ${agentAdapter.name}`);
			
			// Build the request
			const request = {
				messages: [
					{
						role: 'system' as const,
						content: `You are working on a ${scenarioCfg.title}. The task is: ${scenarioCfg.description || 'Complete the development task.'}\n\nIMPORTANT: You are working in the directory: ${workspaceDir}\nThis is a prepared workspace with the files you need to modify.`
					},
					{
						role: 'user' as const,
						content: promptContent
					}
				],
				workspaceDir,
				maxTurns
			};

			// Execute agent request
			console.log('Sending request to agent...');
			const response = await agentAdapter.send(request);
			
			// Update result with agent response
			result.agent_response = response.content;
			result.telemetry.tokens.in = response.tokensIn || 0;
			result.telemetry.tokens.out = response.tokensOut || 0;
			result.telemetry.cost_usd = response.costUsd || 0;
			result.telemetry.toolCalls = response.toolCalls ?? 0;
			
			console.log('Agent response received');
			console.log('Tokens in:', result.telemetry.tokens.in);
			console.log('Tokens out:', result.telemetry.tokens.out);
			console.log('Cost (USD):', result.telemetry.cost_usd);
			console.log('Tool calls:', result.telemetry.toolCalls);
			
		} catch (error) {
			console.error('Agent execution failed:', error);
			result.agent_response = `Error: ${error instanceof Error ? error.message : String(error)}`;
		}
	} else if (!promptContent) {
		console.warn('No prompt loaded, skipping agent execution');
	} else {
		console.log('Using echo agent (no actual execution)');
	}

	// Execute validation commands defined by scenario (install/test/lint/typecheck)
	const commandLog = workspaceDir ? runValidationCommands(workspaceDir, scenarioCfg.validation?.commands) : [];
	const diffArtifacts = workspaceDir && fixtureDir ? buildDiffArtifacts(fixtureDir, workspaceDir) : { diffSummary: [], depsDelta: [] };


	// Run evaluators (deterministic baseline)
	try {
		if (workspaceDir) {
			// Dynamically import evaluators (built output)
			let runEvaluators: any;
			try {
				({ runEvaluators } = await import('ze-evaluator'));
			} catch (e1) {
				try {
					({ runEvaluators } = await import('../../evaluators/dist/index.js'));
					console.warn('Evaluators package not linked; using local dist fallback');
				} catch (e2) {
					console.warn('Evaluators not available (package or dist). Skipping evaluation');
				}
			}
			if (runEvaluators) {
				const ctx = {
					scenario: scenarioCfg,
					workspaceDir,
					agentResponse: result.agent_response,
					commandLog,
					diffSummary: diffArtifacts.diffSummary,
					depsDelta: diffArtifacts.depsDelta,
				};
				const { scoreCard, results: evaluatorResults } = await runEvaluators(ctx);
				result.scores = { ...result.scores, ...scoreCard };
				result.totals = computeWeightedTotals(result.scores, scenarioCfg);
				(result as any).evaluator_results = evaluatorResults;
				(result as any).diff_summary = diffArtifacts.diffSummary;
				(result as any).deps_delta = diffArtifacts.depsDelta;
			}
		}
	} catch (e) {
		console.warn('Evaluator run failed:', e);
	}

	writeResult(result, suite, scenario);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
