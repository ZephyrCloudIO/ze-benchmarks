#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, existsSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

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

function prepareWorkspaceFromFixture(suite: string, scenario: string): string | null {
	const scenarioDir = getScenarioDir(suite, scenario);
	const candidates = ['repo', 'repo-fixture'];
	let fixtureDir: string | null = null;
	for (const name of candidates) {
		const dir = join(scenarioDir, name);
		if (existsSync(dir)) { fixtureDir = dir; break; }
	}
	if (!fixtureDir) {
		console.warn(`No raw fixture directory found (looked for ${candidates.join(', ')}) in ${scenarioDir}`);
		return null;
	}
	const root = findRepoRoot();
	const workspacesDir = join(root, 'results', 'workspaces');
	mkdirSync(workspacesDir, { recursive: true });
	const workspaceDir = mkdtempSync(join(workspacesDir, `${suite}-${scenario}-`));
	try {
		cpSync(fixtureDir, workspaceDir, { recursive: true });
		return workspaceDir;
	} catch (err) {
		console.error('Failed to copy fixture directory:', err);
		return null;
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
	return { cmd, suite, scenario, tier } as const;
}

async function run() {
	const { cmd, suite, scenario, tier } = parseArgs(process.argv);
	if (cmd !== 'run' || !suite || !scenario) {
		console.error('Usage: ze-bench run <suite> <scenario> [--tier L0|L1|L2|L3|Lx]');
		process.exit(1);
	}
	const scenarioCfg = loadScenario(suite, scenario);
	const workspaceDir = prepareWorkspaceFromFixture(suite, scenario);
	const result = {
		suite,
		scenario,
		agent: 'local-dev',
		scores: {
			install_success: 0,
			tests_nonregression: 0,
			manager_correctness: 0
		},
		totals: { weighted: 0, max: 10 },
		telemetry: { toolCalls: 0, tokens: { in: 0, out: 0 }, cost_usd: 0, workspaceDir }
	};
	// Minimal stub: just echo scenario metadata and tier
	console.log('Running scenario:', { suite, scenario, tier });
	console.log('Scenario title:', scenarioCfg.title);
	if (workspaceDir) console.log('Workspace prepared at:', workspaceDir);
	writeResult(result, suite, scenario);
}

run().catch((err) => {
	console.error(err);
	process.exit(1);
});
