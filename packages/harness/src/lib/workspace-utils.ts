import { existsSync, mkdirSync, mkdtempSync, cpSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { log } from '@clack/prompts';
import { findZeBenchmarksRoot, findProjectRoot } from './project-root.js';
import { logger } from '@ze/logger';

// ============================================================================
// WORKSPACE UTILITIES
// ============================================================================

// Find workspace root by looking for pnpm-workspace.yaml
// In case of nested workspaces, find the topmost one
export function findWorkspaceRoot(startDir: string): string {
  // Use the generic findProjectRoot to find pnpm-workspace.yaml
  const workspaceRoot = findProjectRoot('pnpm-workspace.yaml', startDir);
  return workspaceRoot || startDir; // Fallback to startDir if not found
}

export function findRepoRoot(): string {
	// Use project root detection instead of hardcoded traversal
	const root = findZeBenchmarksRoot();
	if (!root) {
		// Fallback: Look for package.json with name "ze-benchmarks"
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
	logger.workspace.debug('\x1b[90m[DEBUG] prepareWorkspaceFromFixture()\x1b[0m');
	logger.workspace.debug(`\x1b[90m  Suite: ${suite}, Scenario: ${scenario}\x1b[0m`);

	const scenarioDir = getScenarioDir(suite, scenario);
	logger.workspace.debug(`\x1b[90m  Scenario dir: ${scenarioDir}\x1b[0m`);

	const candidates = ['repo', 'repo-fixture'];
	logger.workspace.debug(`\x1b[90m  Looking for fixture directories: ${candidates.join(', ')}\x1b[0m`);

	let fixtureDir: string | null = null;
	for (const name of candidates) {
		const dir = join(scenarioDir, name);
		logger.workspace.debug(`\x1b[90m    Checking: ${dir} (exists: ${existsSync(dir)})\x1b[0m`);
		if (existsSync(dir)) {
			fixtureDir = dir;
			logger.workspace.debug(`\x1b[90m    ✓ Found fixture: ${dir}\x1b[0m`);
			break;
		}
	}

	if (!fixtureDir) {
		logger.workspace.error(`\x1b[31m[DEBUG] No fixture directory found (looked for ${candidates.join(', ')}) in ${scenarioDir}\x1b[0m`);
		logger.workspace.warn(`No debug fixture directory found (looked for ${candidates.join(', ')}) in ${scenarioDir}`);
		return;
	}

	const root = findRepoRoot();
	logger.workspace.debug(`\x1b[90m  Repo root: ${root}\x1b[0m`);

	const workspacesDir = join(root, 'results', 'workspaces');
	logger.workspace.debug(`\x1b[90m  Workspaces dir: ${workspacesDir}\x1b[0m`);

	mkdirSync(workspacesDir, { recursive: true });
	const workspaceDir = mkdtempSync(join(workspacesDir, `${suite}-${scenario}-`));
	logger.workspace.debug(`\x1b[90m  Created temp workspace: ${workspaceDir}\x1b[0m`);

	try {
		logger.workspace.debug(`\x1b[90m  Copying fixture files from ${fixtureDir} to ${workspaceDir}...\x1b[0m`);

		// Copy fixture directory while excluding README.md files
		cpSync(fixtureDir, workspaceDir, {
			recursive: true,
			filter: (src: string) => {
				// Exclude README.md files from being copied (check filename and path)
				const fileName = src.split(/[/\\]/).pop() || '';
				return fileName !== 'README.md';
			}
		});

		// Count files copied
		const fileCount = readdirSync(workspaceDir, { recursive: true }).length;
		logger.workspace.debug(`\x1b[90m  ✓ Copied ${fileCount} files/directories successfully\x1b[0m`);

		return { workspaceDir, fixtureDir };
	} catch (err) {
		logger.workspace.error(`\x1b[31m[DEBUG] Failed to copy fixture directory: ${err instanceof Error ? err.message : String(err)}\x1b[0m`);
		if (err instanceof Error && err.stack) {
			logger.workspace.error(`\x1b[90m${err.stack}\x1b[0m`);
		}
		logger.workspace.error('Failed to copy fixture directory:', String(err));
		return;
	}
}
