import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execSync } from 'node:child_process';

export type ToolDefinition = {
	name: string;
	description: string;
	input_schema: {
		type: 'object';
		properties: Record<string, any>;
		required?: string[];
	};
};

export type ToolHandler = (input: any) => Promise<string> | string;

// Create readFile tool definition
export function createReadFileTool(): ToolDefinition {
	return {
		name: 'readFile',
		description: 'Read the contents of a file in the workspace. Use this to examine package.json files, configuration files, or any other files you need to understand before making changes.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Path to the file relative to workspace root (e.g., "package.json", "apps/app/package.json")'
				}
			},
			required: ['path']
		}
	};
}

// Create writeFile tool definition
export function createWriteFileTool(): ToolDefinition {
	return {
		name: 'writeFile',
		description: 'Write content to a file in the workspace. Use this to update package.json files or any other configuration files. The entire file content must be provided.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Path to the file relative to workspace root (e.g., "package.json", "apps/app/package.json")'
				},
				content: {
					type: 'string',
					description: 'The complete content to write to the file'
				}
			},
			required: ['path', 'content']
		}
	};
}

// Create runCommand tool definition
export function createRunCommandTool(): ToolDefinition {
	return {
		name: 'runCommand',
		description: 'Execute a shell command in the workspace directory. Use this to run package manager commands like "pnpm install", "pnpm outdated", "pnpm update", or validation commands like tests. Commands run with a 60-second timeout.',
		input_schema: {
			type: 'object',
			properties: {
				command: {
					type: 'string',
					description: 'The shell command to execute (e.g., "pnpm install", "pnpm outdated --recursive")'
				},
				description: {
					type: 'string',
					description: 'Optional description of why you are running this command'
				}
			},
			required: ['command']
		}
	};
}

// Create listFiles tool definition
export function createListFilesTool(): ToolDefinition {
	return {
		name: 'listFiles',
		description: 'List files and directories in a given path within the workspace. Use this to explore the workspace structure.',
		input_schema: {
			type: 'object',
			properties: {
				path: {
					type: 'string',
					description: 'Path relative to workspace root (use "." for root directory)'
				}
			},
			required: ['path']
		}
	};
}

// Create tool handlers for workspace operations
export function createWorkspaceToolHandlers(workspaceDir: string): Map<string, ToolHandler> {
	const handlers = new Map<string, ToolHandler>();

	// readFile handler
	handlers.set('readFile', async (input: { path: string }): Promise<string> => {
		const fullPath = join(workspaceDir, input.path);
		
		// Security: ensure path is within workspace
		const resolvedPath = join(workspaceDir, input.path);
		if (!resolvedPath.startsWith(workspaceDir)) {
			return `Error: Path '${input.path}' is outside workspace`;
		}

		// Security: block access to node_modules directories
		if (input.path.includes('node_modules') || input.path.includes('/node_modules/') || input.path.startsWith('node_modules/')) {
			return `Error: Access to node_modules is not allowed. Please focus on your project files.`;
		}

		if (!existsSync(fullPath)) {
			return `Error: File '${input.path}' does not exist`;
		}

		try {
			const content = readFileSync(fullPath, 'utf8');
			console.log(`[readFile] Read ${input.path} (${content.length} bytes)`);
			return content;
		} catch (error) {
			return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
		}
	});

	// writeFile handler
	handlers.set('writeFile', async (input: { path: string; content: string }): Promise<string> => {
		const fullPath = join(workspaceDir, input.path);
		
		// Security: ensure path is within workspace
		const resolvedPath = join(workspaceDir, input.path);
		if (!resolvedPath.startsWith(workspaceDir)) {
			return `Error: Path '${input.path}' is outside workspace`;
		}

		// Security: block access to node_modules directories
		if (input.path.includes('node_modules') || input.path.includes('/node_modules/') || input.path.startsWith('node_modules/')) {
			return `Error: Access to node_modules is not allowed. Please focus on your project files.`;
		}

		try {
			writeFileSync(fullPath, input.content, 'utf8');
			console.log(`[writeFile] Wrote ${input.path} (${input.content.length} bytes)`);
			return `Successfully wrote to ${input.path}`;
		} catch (error) {
			return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
		}
	});

	// runCommand handler
	handlers.set('runCommand', async (input: { command: string; description?: string }): Promise<string> => {
		console.log(`[runCommand] ${input.description || input.command}`);
		
		try {
			const output = execSync(input.command, {
				cwd: workspaceDir,
				encoding: 'utf8',
				timeout: 60000, // 60 second timeout
				maxBuffer: 10 * 1024 * 1024, // 10MB buffer
				stdio: 'pipe'
			});
			
			console.log(`[runCommand] Completed successfully`);
			return output || 'Command completed successfully (no output)';
		} catch (error: any) {
			const message = error.stderr || error.stdout || error.message || String(error);
			console.log(`[runCommand] Failed: ${message.slice(0, 200)}`);
			return `Command failed: ${message}`;
		}
	});

	// listFiles handler
	handlers.set('listFiles', async (input: { path: string }): Promise<string> => {
		const fullPath = join(workspaceDir, input.path);
		
		// Security: block access to node_modules directories
		if (input.path.includes('node_modules') || input.path.includes('/node_modules/') || input.path.startsWith('node_modules/')) {
			return `Error: Access to node_modules is not allowed. Please focus on your project files.`;
		}
		
		if (!existsSync(fullPath)) {
			return `Error: Path '${input.path}' does not exist`;
		}

		try {
			const stat = statSync(fullPath);
			if (!stat.isDirectory()) {
				return `Error: '${input.path}' is not a directory`;
			}

			const entries = readdirSync(fullPath);
			// Filter out node_modules directories from the listing
			const filteredEntries = entries.filter(entry => entry !== 'node_modules');
			const details = filteredEntries.map(entry => {
				const entryPath = join(fullPath, entry);
				const entryStat = statSync(entryPath);
				const type = entryStat.isDirectory() ? 'dir' : 'file';
				return `${type.padEnd(4)} ${entry}`;
			});

			console.log(`[listFiles] Listed ${input.path} (${details.length} entries, node_modules filtered)`);
			return details.join('\n');
		} catch (error) {
			return `Error listing directory: ${error instanceof Error ? error.message : String(error)}`;
		}
	});

	return handlers;
}

// Get all workspace tool definitions
export function getAllWorkspaceTools(): ToolDefinition[] {
	return [
		createReadFileTool(),
		createWriteFileTool(),
		createRunCommandTool(),
		createListFilesTool()
	];
}
