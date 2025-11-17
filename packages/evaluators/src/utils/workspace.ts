import * as fs from 'node:fs';
import * as path from 'node:path';
import chalk from 'chalk';

/**
 * Find the generated/modified project directory within the workspace.
 *
 * The workspace structure depends on the scenario type:
 *
 * **Generation scenarios** (e.g., shadcn-generate-vite):
 * - workspaceDir/
 *   - control/         (reference implementation, optional)
 *   - <project-name>/  (generated project - what we want to find)
 *
 * **Mutation scenarios** (e.g., dependency updates):
 * - workspaceDir/
 *   - control/         (reference implementation, optional)
 *   - <fixture files>  (copied from repo-fixture, modified in place)
 *
 * This function handles both cases:
 * 1. If there are subdirectories other than 'control', use the first non-control directory
 * 2. If there are no subdirectories (or only 'control'), assume mutation scenario and return workspaceDir
 *
 * @param workspaceDir - The workspace root directory
 * @returns The absolute path to the generated/modified project directory, or null if not found
 */
export function findProjectDir(workspaceDir: string): string | null {
	try {
		const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
		const dirs = entries.filter(e => e.isDirectory() && e.name !== 'control');

		// Case 1: Generation scenario - agent created a new directory
		if (dirs.length > 0) {
			if (dirs.length > 1) {
				console.warn(chalk.yellow(`[findProjectDir] Multiple non-control directories found, using first: ${dirs[0].name}`));
			}

			const projectDir = path.join(workspaceDir, dirs[0].name);
			console.log(chalk.blue(`[findProjectDir] Found project directory (generation): ${dirs[0].name}`));
			return projectDir;
		}

		// Case 2: Mutation scenario - files modified in place
		// Check if there's a package.json directly in workspaceDir
		const hasPackageJson = fs.existsSync(path.join(workspaceDir, 'package.json'));
		if (hasPackageJson) {
			console.log(chalk.blue(`[findProjectDir] Using workspace root (mutation scenario)`));
			return workspaceDir;
		}

		// No project found
		console.error(chalk.red(`[findProjectDir] No project directory found in ${workspaceDir}`));
		console.error(chalk.red(`[findProjectDir] Workspace contents: ${entries.map(e => e.name).join(', ')}`));
		return null;
	} catch (error) {
		console.error(chalk.red(`[findProjectDir] Error reading workspace: ${error}`));
		return null;
	}
}
