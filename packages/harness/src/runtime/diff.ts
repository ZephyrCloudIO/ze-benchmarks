import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { globbySync } from 'globby';
import { logger } from '@ze/logger';

const log = logger.diff;

export interface FileDiff {
  file: string;
  changeType: 'added' | 'modified' | 'deleted';
  textPatch?: string;
}

export interface DepChange {
  packagePath: string;
  section: string;
  name: string;
  from?: string;
  to?: string;
}

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/.turbo/**',
  '**/dist/**',
  '**/.nx/**',
  '**/.pnpm-store/**',
];

function listFiles(dir: string): Set<string> {
  const files = globbySync('**/*', {
    cwd: dir,
    dot: true,
    onlyFiles: true,
    followSymbolicLinks: false,
    ignore: IGNORE_GLOBS,
  });
  return new Set(files);
}

function safeRead(path: string): string | undefined {
  try {
    return readFileSync(path, 'utf8');
  } catch (err) {
    log.warn('Failed to read file for diff:', path, err);
    return undefined;
  }
}

function safeJson(path: string): Record<string, any> | undefined {
  const text = safeRead(path);
  if (text === undefined) return undefined;
  try {
    return JSON.parse(text);
  } catch (err) {
    log.warn('Failed to parse JSON for diff:', path, err);
    return undefined;
  }
}

function pseudoPatch(relPath: string, before: string, after: string): string {
  const header = [`--- a/${relPath}`, `+++ b/${relPath}`];
  const body: string[] = ['@@'];
  if (before.length) {
    for (const line of before.split(/\r?\n/)) {
      body.push(`-${line}`);
    }
  }
  if (after.length) {
    for (const line of after.split(/\r?\n/)) {
      body.push(`+${line}`);
    }
  }
  return header.concat(body).join('\n');
}

function computeFileDiffs(baselineDir: string, workspaceDir: string): FileDiff[] {
  const baselineFiles = listFiles(baselineDir);
  const workspaceFiles = listFiles(workspaceDir);
  const allFiles = new Set<string>([...baselineFiles, ...workspaceFiles]);
  const diffs: FileDiff[] = [];

  for (const relPath of allFiles) {
    const baseExists = baselineFiles.has(relPath);
    const workExists = workspaceFiles.has(relPath);
    if (baseExists && !workExists) {
      diffs.push({ file: relPath, changeType: 'deleted' });
      continue;
    }
    if (!baseExists && workExists) {
      const newContent = safeRead(join(workspaceDir, relPath));
      const textPatch = newContent !== undefined ? pseudoPatch(relPath, '', newContent) : undefined;
      diffs.push({ file: relPath, changeType: 'added', textPatch });
      continue;
    }
    if (baseExists && workExists) {
      const baseContent = safeRead(join(baselineDir, relPath));
      const workContent = safeRead(join(workspaceDir, relPath));
      if (baseContent === undefined || workContent === undefined) continue;
      if (baseContent === workContent) continue;
      const textPatch = pseudoPatch(relPath, baseContent, workContent);
      diffs.push({ file: relPath, changeType: 'modified', textPatch });
    }
  }

  return diffs;
}

function diffDependencies(
  baselineDir: string,
  workspaceDir: string,
  diffSummary: FileDiff[],
): DepChange[] {
  const pkgPaths = new Set<string>();
  for (const entry of diffSummary) {
    if (entry.file.endsWith('package.json')) {
      pkgPaths.add(entry.file);
    }
  }
  const result: DepChange[] = [];
  const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
  for (const relPath of pkgPaths) {
    const baselinePath = join(baselineDir, relPath);
    const workspacePath = join(workspaceDir, relPath);
    const baseJson = existsSync(baselinePath) ? safeJson(baselinePath) : undefined;
    const workJson = existsSync(workspacePath) ? safeJson(workspacePath) : undefined;
    if (!baseJson && !workJson) continue;

    for (const section of sections) {
      const baseSection = (baseJson?.[section] ?? {}) as Record<string, string>;
      const workSection = (workJson?.[section] ?? {}) as Record<string, string>;
      const names = new Set<string>([...Object.keys(baseSection), ...Object.keys(workSection)]);
      for (const name of names) {
        const from = baseSection[name];
        const to = workSection[name];
        if (from === to) continue;
        result.push({
          packagePath: relPath,
          section,
          name,
          from,
          to,
        });
      }
    }
  }
  return result;
}

export function buildDiffArtifacts(baselineDir: string, workspaceDir: string): { diffSummary: FileDiff[]; depsDelta: DepChange[] } {
  const diffSummary = computeFileDiffs(baselineDir, workspaceDir);
  const depsDelta = diffDependencies(baselineDir, workspaceDir, diffSummary);
  return { diffSummary, depsDelta };
}
