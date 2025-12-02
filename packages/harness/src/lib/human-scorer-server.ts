import { spawn, ChildProcess } from 'node:child_process';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';
import { logger } from '@ze/logger';

/**
 * Check if human-scorer server is running on localhost:5173
 */
async function isServerRunning(port: number = 5173): Promise<boolean> {
	logger.execution.debug(`[HumanScorer] Checking if server is running on port ${port}...`);
	try {
		const response = await fetch(`http://localhost:${port}`, {
			method: 'HEAD',
			signal: AbortSignal.timeout(2000), // 2 second timeout
		});
		const isRunning = response.ok || response.status === 404; // Server is up (even if route not found)
		logger.execution.debug(`[HumanScorer] Server check result: ${isRunning ? 'RUNNING' : 'NOT RUNNING'} (status: ${response.status})`);
		return isRunning;
	} catch (error) {
		logger.execution.debug(`[HumanScorer] Server check failed: ${error instanceof Error ? error.message : String(error)}`);
		return false;
	}
}

/**
 * Start the human-scorer dev server
 * Returns the spawned process or null if failed
 */
function startServer(repoRoot: string, quiet: boolean = false): ChildProcess | null {
	const humanScorerPath = join(repoRoot, 'apps', 'human-scorer');

	logger.execution.info(chalk.blue('[HumanScorer] Starting dev server...'));
	logger.execution.debug(`[HumanScorer] Repository root: ${repoRoot}`);
	logger.execution.debug(`[HumanScorer] Human-scorer path: ${humanScorerPath}`);

	// Verify the directory exists
	if (!existsSync(humanScorerPath)) {
		logger.execution.error(chalk.red(`[HumanScorer] Directory not found: ${humanScorerPath}`));
		return null;
	}

	logger.execution.debug(`[HumanScorer] Directory exists, spawning process...`);

	try {
		// Start the dev server in the background
		const serverProcess = spawn('pnpm', ['dev'], {
			cwd: humanScorerPath,
			detached: false,
			stdio: 'ignore', // Run silently
			shell: true,
		});

		logger.execution.debug(`[HumanScorer] Process spawned with PID: ${serverProcess.pid}`);

		// Log process events
		serverProcess.on('error', (error) => {
			logger.execution.error(chalk.red(`[HumanScorer] Process error: ${error.message}`));
		});

		serverProcess.on('exit', (code, signal) => {
			logger.execution.debug(`[HumanScorer] Process exited with code ${code}, signal ${signal}`);
		});

		return serverProcess;
	} catch (error) {
		logger.execution.error(chalk.red(`[HumanScorer] Failed to spawn process: ${error instanceof Error ? error.message : String(error)}`));
		return null;
	}
}

/**
 * Wait for server to be ready (with timeout)
 */
async function waitForServer(port: number = 5173, timeoutMs: number = 30000): Promise<boolean> {
	const startTime = Date.now();
	let attempts = 0;

	while (Date.now() - startTime < timeoutMs) {
		attempts++;
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		logger.execution.debug(`[HumanScorer] Health check attempt ${attempts} (${elapsed}s elapsed)...`);

		if (await isServerRunning(port)) {
			logger.execution.debug(`[HumanScorer] Server responded successfully after ${attempts} attempts (${elapsed}s)`);
			return true;
		}

		// Wait 500ms before checking again
		await new Promise(resolve => setTimeout(resolve, 500));
	}

	const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
	logger.execution.debug(`[HumanScorer] Timeout reached after ${attempts} attempts (${elapsed}s)`);
	return false;
}

/**
 * Find repository root by searching upwards from current directory
 */
function findRepoRoot(): string {
	logger.execution.debug(`[HumanScorer] Finding repository root...`);
	logger.execution.debug(`[HumanScorer] Current working directory: ${process.cwd()}`);

	// Start from process.cwd() which should be the repo root when running the CLI
	let currentDir = process.cwd();

	// If we can find apps/human-scorer from here, we're good
	const humanScorerPath = join(currentDir, 'apps', 'human-scorer');
	logger.execution.debug(`[HumanScorer] Checking for: ${humanScorerPath}`);

	if (existsSync(humanScorerPath)) {
		logger.execution.debug(`[HumanScorer] Found! Using ${currentDir} as repo root`);
		return currentDir;
	}

	logger.execution.debug(`[HumanScorer] Not found at cwd, trying fallback path...`);

	// Otherwise, try going up from the harness package location
	// In development: packages/harness/src/lib -> go up 4 levels
	// In production: packages/harness/dist/lib -> go up 4 levels
	const fallbackRoot = join(currentDir, '..', '..', '..', '..');
	logger.execution.debug(`[HumanScorer] Using fallback: ${fallbackRoot}`);
	return fallbackRoot;
}

/**
 * Ensure human-scorer server is running
 * If not running, starts it and waits for it to be ready
 * Returns true if server is ready, false if failed
 */
export async function ensureHumanScorerServer(quiet: boolean = false): Promise<boolean> {
	const port = 5173;
	logger.execution.debug(`[HumanScorer] ensureHumanScorerServer called with quiet=${quiet}, port=${port}`);

	logger.execution.info(chalk.blue('\n[HumanScorer] Ensuring server is running...'));

	// Check if already running
	if (await isServerRunning(port)) {
		logger.execution.debug(`[HumanScorer] Server is already running on port ${port}`);
		logger.execution.success(chalk.green('[HumanScorer] ✓ Server is already running'));
		return true;
	}

	logger.execution.info('[HumanScorer] Server not running, attempting to start...');

	// Find repository root
	const repoRoot = findRepoRoot();

	// Start the server
	const serverProcess = startServer(repoRoot, quiet);
	if (!serverProcess) {
		logger.execution.error(chalk.red('[HumanScorer] ✗ Failed to start server process'));
		return false;
	}

	logger.execution.info(chalk.gray('[HumanScorer] Waiting for server to be ready...'));

	// Give the server a moment to start before checking
	logger.execution.debug('[HumanScorer] Initial 2-second delay...');
	await new Promise(resolve => setTimeout(resolve, 2000));

	// Wait for server to be ready (45 seconds timeout for first-time installs)
	logger.execution.debug('[HumanScorer] Starting server health checks (45s timeout)...');
	const isReady = await waitForServer(port, 45000);

	if (isReady) {
		logger.execution.debug(`[HumanScorer] Server is ready, returning success`);
		logger.execution.success(chalk.green(`[HumanScorer] ✓ Server is ready at http://localhost:${port}`));
		return true;
	} else {
		logger.execution.debug(`[HumanScorer] Server did not become ready in time, returning failure`);
		logger.execution.warn(chalk.yellow('[HumanScorer] ⚠️  Server did not become ready in time'));
		logger.execution.info(chalk.gray('[HumanScorer] Start manually: cd apps/human-scorer && pnpm dev'));
		return false;
	}
}
