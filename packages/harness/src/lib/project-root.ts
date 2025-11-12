import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';

/**
 * Find the project root by walking up from startDir looking for a marker file
 *
 * @param markerFile - The file to look for (e.g., 'benchmark.config.json', 'package.json', 'pnpm-workspace.yaml')
 * @param startDir - The directory to start searching from (defaults to process.cwd())
 * @returns The project root directory, or null if not found
 */
export function findProjectRoot(markerFile: string, startDir: string = process.cwd()): string | null {
  let currentDir = resolve(startDir);

  // Walk up the directory tree
  while (true) {
    const markerPath = join(currentDir, markerFile);

    if (existsSync(markerPath)) {
      return currentDir;
    }

    // Check if we've reached the filesystem root
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null; // Reached root without finding marker
    }

    currentDir = parentDir;
  }
}

/**
 * Find the ze-benchmarks project root
 * Looks for benchmark.config.json first, then falls back to package.json with name "ze-benchmarks"
 */
export function findZeBenchmarksRoot(startDir: string = process.cwd()): string | null {
  // First try to find benchmark.config.json
  const configRoot = findProjectRoot('benchmark.config.json', startDir);
  if (configRoot) {
    return configRoot;
  }

  // Fallback: look for package.json and check if it's ze-benchmarks
  let currentDir = resolve(startDir);

  while (true) {
    const pkgPath = join(currentDir, 'package.json');

    if (existsSync(pkgPath)) {
      try {
        const pkgContent = readFileSync(pkgPath, 'utf-8');
        const pkg = JSON.parse(pkgContent);
        if (pkg.name === 'ze-benchmarks') {
          return currentDir;
        }
      } catch (error) {
        // Invalid package.json, continue searching
      }
    }

    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
}
