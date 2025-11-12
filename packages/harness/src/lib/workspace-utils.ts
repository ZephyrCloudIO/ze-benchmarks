import { existsSync, mkdirSync, mkdtempSync, cpSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '@clack/prompts';

// ============================================================================
// WORKSPACE UTILITIES
// ============================================================================

// Find workspace root by looking for pnpm-workspace.yaml
// In case of nested workspaces, find the topmost one
export function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;
  let lastWorkspaceRoot = startDir;

  while (currentDir !== resolve(currentDir, '..')) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      lastWorkspaceRoot = currentDir;
    }
    currentDir = resolve(currentDir, '..');
  }

  return lastWorkspaceRoot;
}

export function findRepoRoot(): string {
	// Use project root detection instead of hardcoded traversal
	const { findZeBenchmarksRoot } = require('./project-root.js');
	const root = findZeBenchmarksRoot();
	if (!root) {
		// Fallback: Look for package.json with name "ze-benchmarks"
		const { findProjectRoot } = require('./project-root.js');
		const pkgRoot = findProjectRoot('package.json', fileURLToPath(import.meta.url));
		if (pkgRoot) {
			return pkgRoot;
		}
		// Last resort: old behavior
		return resolve(fileURLToPath(import.meta.url), '../../../../..');
	}
	return root;
}

export function prepareWorkspaceFromFixture(suite: string, scenario: string, getScenarioDir: (suite: string, scenario: string) => string): { workspaceDir: string; fixtureDir: string } | undefined {
	const scenarioDir = getScenarioDir(suite, scenario);
	const candidates = ['repo', 'repo-fixture'];
	let fixtureDir: string | null = null;
	for (const name of candidates) {
		const dir = join(scenarioDir, name);
		if (existsSync(dir)) { fixtureDir = dir; break; }
	}
	if (!fixtureDir) {
		log.warning(`No raw fixture directory found (looked for ${candidates.join(', ')}) in ${scenarioDir}`);
		return;
	}
	const root = findRepoRoot();
	const workspacesDir = join(root, 'results', 'workspaces');
	mkdirSync(workspacesDir, { recursive: true });
	const workspaceDir = mkdtempSync(join(workspacesDir, `${suite}-${scenario}-`));
	try {
		// Copy fixture directory while excluding README.md files
		cpSync(fixtureDir, workspaceDir, {
			recursive: true,
			filter: (src: string) => {
				// Exclude README.md files from being copied (check filename and path)
				const fileName = src.split(/[/\\]/).pop() || '';
				return fileName !== 'README.md';
			}
		});
		return { workspaceDir, fixtureDir };
	} catch (err) {
		console.error('Failed to copy fixture directory:', err);
		return;
	}
}
