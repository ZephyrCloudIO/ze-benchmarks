import { spawnSync } from 'node:child_process';

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

export function runValidationCommands(
  workspaceDir: string,
  commands?: Partial<Record<CommandKind, string>>
): CommandResult[] {
  if (!workspaceDir || !commands) return [];
  const order: CommandKind[] = ['install', 'test', 'lint', 'typecheck'];
  const log: CommandResult[] = [];
  for (const kind of order) {
    const cmd = commands[kind];
    if (!cmd) continue;
    console.log(`Running validation command [${kind}]: ${cmd}`);
    const started = Date.now();
    try {
      const proc = spawnSync(cmd, {
        cwd: workspaceDir,
        shell: true,
        encoding: 'utf8',
        env: process.env,
        stdio: 'pipe',
        timeout: 10 * 60 * 1000,
      });
      const durationMs = Date.now() - started;
      log.push({
        tool: 'shell',
        type: kind,
        raw: cmd,
        exitCode: typeof proc.status === 'number' ? proc.status : -1,
        stdout: (proc.stdout as unknown as string) || '',
        stderr: (proc.stderr as unknown as string) || '',
        durationMs,
      });
      console.log(`[${kind}] exit=${proc.status} duration=${durationMs}ms`);
    } catch (err) {
      const durationMs = Date.now() - started;
      log.push({ tool: 'shell', type: kind, raw: cmd, exitCode: -1, stdout: '', stderr: String(err), durationMs });
      console.warn(`Validation command failed to execute [${kind}]:`, err);
    }
  }
  return log;
}
