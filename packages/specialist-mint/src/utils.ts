import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync, statSync } from 'fs';
import { join, dirname, resolve, isAbsolute } from 'path';
import JSON5 from 'json5';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { SpecialistTemplate, SpecialistSnapshot } from './types.js';
import { fileURLToPath } from 'url';

/**
 * Find the workspace root by looking for pnpm-workspace.yaml
 * Starts from current directory and walks up the tree
 */
export function findWorkspaceRoot(startDir: string = process.cwd()): string | null {
  let currentDir = startDir;

  while (true) {
    // Check for pnpm-workspace.yaml
    const workspaceFile = join(currentDir, 'pnpm-workspace.yaml');
    if (existsSync(workspaceFile)) {
      return currentDir;
    }

    // Check if we've reached the root
    const parentDir = dirname(currentDir);
    if (parentDir === currentDir) {
      return null; // Reached filesystem root without finding workspace
    }

    currentDir = parentDir;
  }
}

/**
 * Resolve a path that may be relative to workspace root or absolute
 * If path is absolute, return as-is
 * If path is relative and workspace root is found, resolve relative to workspace root
 * Otherwise resolve relative to CWD
 */
export function resolveWorkspacePath(inputPath: string): string {
  // If already absolute, return as-is
  if (isAbsolute(inputPath)) {
    return inputPath;
  }

  // Try to find workspace root
  const workspaceRoot = findWorkspaceRoot();

  if (workspaceRoot) {
    // Resolve relative to workspace root
    return resolve(workspaceRoot, inputPath);
  }

  // Fallback to CWD
  return resolve(inputPath);
}

// Initialize AJV with JSON Schema draft-07 support
const ajv = new Ajv({
  strict: false, // Allow JSON5 features
  allErrors: true,
  verbose: true,
});
addFormats(ajv);

// Load schemas using import.meta.url (works after compilation and in deployed scenarios)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const templateSchemaPath = join(__dirname, 'schemas', 'template.schema.json5');
const snapshotSchemaPath = join(__dirname, 'schemas', 'snapshot.schema.json5');

const templateSchemaContent = readFileSync(templateSchemaPath, 'utf-8');
const snapshotSchemaContent = readFileSync(snapshotSchemaPath, 'utf-8');

const templateSchema = JSON5.parse(templateSchemaContent);
const snapshotSchema = JSON5.parse(snapshotSchemaContent);

// Compile schemas
const validateTemplate = ajv.compile(templateSchema);
const validateSnapshot = ajv.compile(snapshotSchema);

/**
 * Load and parse a JSON5 file
 */
export function loadJSON5<T = any>(filePath: string): T {
  if (!existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = readFileSync(filePath, 'utf-8');
  try {
    return JSON5.parse(content);
  } catch (error) {
    throw new Error(`Failed to parse JSON5 file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Write a JSON5 file with proper formatting
 */
export function writeJSON5(filePath: string, data: any): void {
  const dirPath = dirname(filePath);

  // Create directory if it doesn't exist
  mkdirSync(dirPath, { recursive: true });

  // Write with JSON5 formatting (2 space indentation)
  const content = JSON5.stringify(data, null, 2);
  writeFileSync(filePath, content, 'utf-8');
}

/**
 * Validate a template against the template schema
 */
export function validateTemplateSchema(template: any): { valid: boolean; errors?: string } {
  const valid = validateTemplate(template);

  if (!valid) {
    const errors = validateTemplate.errors
      ?.map(err => `  - ${err.instancePath || '/'}: ${err.message}`)
      .join('\n') || 'Unknown validation error';
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Validate a snapshot against the snapshot schema
 */
export function validateSnapshotSchema(snapshot: any): { valid: boolean; errors?: string } {
  const valid = validateSnapshot(snapshot);

  if (!valid) {
    const errors = validateSnapshot.errors
      ?.map(err => `  - ${err.instancePath || '/'}: ${err.message}`)
      .join('\n') || 'Unknown validation error';
    return { valid: false, errors };
  }

  return { valid: true };
}

/**
 * Get the next snapshot ID for a given specialist version
 * Returns the next available snapshot ID (001, 002, 003, etc.)
 */
export function getNextSnapshotId(snapshotDir: string): string {
  if (!existsSync(snapshotDir)) {
    return '001';
  }

  const files = readdirSync(snapshotDir);
  const snapshotFiles = files.filter(f => f.startsWith('snapshot-') && f.endsWith('.json5'));

  if (snapshotFiles.length === 0) {
    return '001';
  }

  // Extract snapshot IDs and find the max
  const ids = snapshotFiles
    .map(f => {
      const match = f.match(/snapshot-(\d+)\.json5/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(id => !isNaN(id));

  const maxId = Math.max(...ids);
  const nextId = maxId + 1;

  // Pad with zeros to 3 digits
  return nextId.toString().padStart(3, '0');
}

// Note: getSnapshotDir and getSnapshotPath functions removed
// Output paths are now calculated in mint.ts using the user-provided outputDir parameter

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
 * Note: Database path resolution removed in v2.0
 * Now using Worker API to fetch benchmark results instead of direct SQLite access
 * See benchmark-loader.ts for the new Worker API implementation
 */
