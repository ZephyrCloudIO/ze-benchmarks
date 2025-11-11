import { spawn } from 'node:child_process';

export type CommandKind = 'install' | 'test' | 'lint' | 'typecheck';
export interface CommandResult {
  tool: 'shell';
  type: CommandKind;
  raw: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  durationMs: number;
}

/**
 * Execute a single command asynchronously
 */
async function executeCommand(
  kind: CommandKind,
  cmd: string,
  workspaceDir: string
): Promise<CommandResult> {
  console.log(`Running validation command [${kind}]: ${cmd}`);
  const started = Date.now();
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    
    const proc = spawn(cmd, {
      cwd: workspaceDir,
      shell: true,
      env: process.env,
      stdio: 'pipe',
    });
    
    // Set timeout (10 minutes)
    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
      stderr += '\nCommand timed out after 10 minutes';
    }, 10 * 60 * 1000);
    
    // Collect stdout
    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Collect stderr
    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Handle completion
    proc.on('close', (code) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - started;
      const exitCode = code ?? -1;
      
      console.log(`[${kind}] exit=${exitCode} duration=${durationMs}ms`);
      
      resolve({
        tool: 'shell',
        type: kind,
        raw: cmd,
        exitCode,
        stdout,
        stderr,
        durationMs,
      });
    });
    
    // Handle error
    proc.on('error', (err) => {
      clearTimeout(timeout);
      const durationMs = Date.now() - started;
      
      console.warn(`Validation command failed to execute [${kind}]:`, err);
      
      resolve({
        tool: 'shell',
        type: kind,
        raw: cmd,
        exitCode: -1,
        stdout,
        stderr: stderr + '\n' + String(err),
        durationMs,
      });
    });
  });
}

/**
 * Run validation commands with async execution, parallel processing, and early termination.
 * 
 * Execution strategy:
 * 1. Run 'install' first (required, sequential)
 * 2. If install fails, terminate early and skip remaining commands
 * 3. Run 'test', 'lint', 'typecheck' in parallel (independent operations)
 * 
 * @param workspaceDir - Directory where commands should be executed
 * @param commands - Commands to execute for each validation type
 * @returns Array of command results in consistent order [install, test, lint, typecheck]
 */
export async function runValidationCommands(
  workspaceDir: string,
  commands?: Partial<Record<CommandKind, string>>
): Promise<CommandResult[]> {
  if (!workspaceDir || !commands) return [];
  
  const log: CommandResult[] = [];
  
  // Stage 1: Run install first (required, blocks other commands)
  const installCmd = commands.install;
  if (installCmd) {
    const installResult = await executeCommand('install', installCmd, workspaceDir);
    log.push(installResult);
    
    // Early termination: if install fails, skip remaining commands
    if (installResult.exitCode !== 0) {
      console.log(`[install] Failed with exit code ${installResult.exitCode}. Skipping remaining validation commands.`);
      return log;
    }
  }
  
  // Stage 2: Run test, lint, typecheck in parallel (independent operations)
  const parallelCommands: Array<{ kind: CommandKind; cmd: string }> = [];
  
  if (commands.test) {
    parallelCommands.push({ kind: 'test', cmd: commands.test });
  }
  if (commands.lint) {
    parallelCommands.push({ kind: 'lint', cmd: commands.lint });
  }
  if (commands.typecheck) {
    parallelCommands.push({ kind: 'typecheck', cmd: commands.typecheck });
  }
  
  if (parallelCommands.length > 0) {
    console.log(`Running ${parallelCommands.length} validation commands in parallel...`);
    
    // Execute all in parallel
    const parallelResults = await Promise.all(
      parallelCommands.map(({ kind, cmd }) => executeCommand(kind, cmd, workspaceDir))
    );
    
    // Add results in the expected order (test, lint, typecheck)
    log.push(...parallelResults);
  }
  
  return log;
}
