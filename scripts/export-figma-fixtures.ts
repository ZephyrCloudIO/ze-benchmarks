#!/usr/bin/env node

/**
 * Export Figma Fixtures Script
 *
 * Exports Figma files and nodes to JSON fixtures for deterministic benchmarking.
 *
 * Usage:
 *   node scripts/export-figma-fixtures.ts --file-key <key> [options]
 *
 * Options:
 *   --file-key       Figma file key from URL (required)
 *   --node-ids       Comma-separated node IDs to export (optional)
 *   --output-dir     Output directory for fixtures (default: ./fixtures/figma-files)
 *   --output-name    Custom filename (default: derived from file name)
 *   --token          Figma API token (or use FIGMA_TOKEN env var)
 *   --minimal        Strip unnecessary properties to reduce file size
 *   --api-response   Also save raw API response format
 *   --help           Show this help message
 *
 * Examples:
 *   # Export entire file
 *   node scripts/export-figma-fixtures.ts --file-key abc123 --minimal
 *
 *   # Export specific nodes
 *   node scripts/export-figma-fixtures.ts --file-key abc123 --node-ids 1:2,1:3
 *
 *   # Export with custom name
 *   node scripts/export-figma-fixtures.ts --file-key abc123 --output-name my-button
 */

import * as fs from 'fs';
import * as path from 'path';

interface FigmaNode {
  id: string;
  name: string;
  type: string;
  children?: FigmaNode[];
  [key: string]: any;
}

interface FigmaFile {
  document: FigmaNode;
  components: Record<string, any>;
  componentSets?: Record<string, any>;
  styles: Record<string, any>;
  name: string;
  lastModified: string;
  thumbnailUrl?: string;
  version: string;
  role?: string;
  [key: string]: any;
}

interface ExportOptions {
  fileKey: string;
  nodeIds?: string[];
  outputDir: string;
  outputName?: string;
  token: string;
  minimal: boolean;
  apiResponse: boolean;
}

// Properties to keep in minimal mode
const MINIMAL_NODE_PROPERTIES = new Set([
  'id',
  'name',
  'type',
  'children',
  'backgroundColor',
  'fills',
  'strokes',
  'cornerRadius',
  'characters',
  'style',
  'absoluteBoundingBox',
  'constraints',
  'paddingLeft',
  'paddingRight',
  'paddingTop',
  'paddingBottom',
  'itemSpacing',
  'layoutMode',
  'componentId',
  'componentProperties',
  'componentPropertyDefinitions',
  'visible',
  'opacity',
  'effects',
  'strokeWeight',
]);

const MINIMAL_FILE_PROPERTIES = new Set([
  'document',
  'components',
  'componentSets',
  'styles',
  'name',
  'lastModified',
  'thumbnailUrl',
  'version',
  'role',
  'schemaVersion',
]);

function parseArgs(): Partial<ExportOptions> {
  const args = process.argv.slice(2);
  const options: Partial<ExportOptions> = {
    outputDir: './fixtures/figma-files',
    minimal: false,
    apiResponse: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--file-key':
        options.fileKey = nextArg;
        i++;
        break;
      case '--node-ids':
        options.nodeIds = nextArg?.split(',').map(id => id.trim());
        i++;
        break;
      case '--output-dir':
        options.outputDir = nextArg;
        i++;
        break;
      case '--output-name':
        options.outputName = nextArg;
        i++;
        break;
      case '--token':
        options.token = nextArg;
        i++;
        break;
      case '--minimal':
        options.minimal = true;
        break;
      case '--api-response':
        options.apiResponse = true;
        break;
      case '--help':
        printHelp();
        process.exit(0);
      default:
        if (arg.startsWith('--')) {
          console.error(`Unknown option: ${arg}`);
          printHelp();
          process.exit(1);
        }
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
Export Figma Fixtures Script

Usage:
  node scripts/export-figma-fixtures.ts --file-key <key> [options]

Options:
  --file-key       Figma file key from URL (required)
  --node-ids       Comma-separated node IDs to export (optional)
  --output-dir     Output directory for fixtures (default: ./fixtures/figma-files)
  --output-name    Custom filename (default: derived from file name)
  --token          Figma API token (or use FIGMA_TOKEN env var)
  --minimal        Strip unnecessary properties to reduce file size
  --api-response   Also save raw API response format
  --help           Show this help message

Examples:
  # Export entire file with minimal properties
  node scripts/export-figma-fixtures.ts --file-key abc123 --minimal

  # Export specific nodes
  node scripts/export-figma-fixtures.ts --file-key abc123 --node-ids 1:2,1:3

  # Export with custom name
  node scripts/export-figma-fixtures.ts --file-key abc123 --output-name my-button

Environment Variables:
  FIGMA_TOKEN      Figma API token (alternative to --token flag)
`);
}

function validateOptions(options: Partial<ExportOptions>): options is ExportOptions {
  if (!options.fileKey) {
    console.error('Error: --file-key is required');
    printHelp();
    return false;
  }

  if (!options.token) {
    options.token = process.env.FIGMA_TOKEN;
    if (!options.token) {
      console.error('Error: Figma token required. Use --token flag or set FIGMA_TOKEN env var');
      return false;
    }
  }

  return true;
}

async function fetchFigmaFile(fileKey: string, token: string): Promise<FigmaFile> {
  const url = `https://api.figma.com/v1/files/${fileKey}`;
  console.log(`Fetching file: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Figma API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data;
}

async function fetchFigmaNodes(
  fileKey: string,
  nodeIds: string[],
  token: string
): Promise<any> {
  const url = `https://api.figma.com/v1/files/${fileKey}/nodes?ids=${nodeIds.join(',')}`;
  console.log(`Fetching nodes: ${url}`);

  const response = await fetch(url, {
    headers: {
      'X-Figma-Token': token,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Figma API error (${response.status}): ${error}`);
  }

  const data = await response.json();
  return data;
}

function stripNode(node: FigmaNode): FigmaNode {
  const stripped: any = {};

  for (const key of MINIMAL_NODE_PROPERTIES) {
    if (key in node) {
      if (key === 'children' && Array.isArray(node.children)) {
        stripped.children = node.children.map(child => stripNode(child));
      } else {
        stripped[key] = node[key];
      }
    }
  }

  return stripped;
}

function stripFile(file: FigmaFile): FigmaFile {
  const stripped: any = {};

  for (const key of MINIMAL_FILE_PROPERTIES) {
    if (key in file) {
      if (key === 'document') {
        stripped.document = stripNode(file.document);
      } else {
        stripped[key] = file[key];
      }
    }
  }

  return stripped;
}

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function generateFilename(file: FigmaFile, options: ExportOptions): string {
  if (options.outputName) {
    return `${options.outputName}.json`;
  }

  const baseName = sanitizeFilename(file.name);
  return `${baseName}.json`;
}

async function saveFixture(
  data: any,
  filepath: string,
  description: string
): Promise<void> {
  const dir = path.dirname(filepath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Saved ${description}: ${filepath}`);
}

async function exportFile(options: ExportOptions): Promise<void> {
  try {
    console.log('Starting export...\n');

    let data: any;
    let processedData: any;

    if (options.nodeIds && options.nodeIds.length > 0) {
      // Export specific nodes
      console.log(`Exporting ${options.nodeIds.length} node(s)...`);
      data = await fetchFigmaNodes(options.fileKey, options.nodeIds, options.token);
      processedData = options.minimal ? stripFile(data) : data;
    } else {
      // Export entire file
      console.log('Exporting entire file...');
      data = await fetchFigmaFile(options.fileKey, options.token);
      processedData = options.minimal ? stripFile(data) : data;
    }

    // Generate filename
    const filename = generateFilename(data, options);
    const filepath = path.join(options.outputDir, filename);

    // Save main fixture
    await saveFixture(processedData, filepath, 'fixture');

    // Save API response format if requested
    if (options.apiResponse) {
      const apiResponsePath = filepath.replace('.json', '-api-response.json');
      await saveFixture(
        {
          status: 200,
          err: null,
          ...data,
        },
        apiResponsePath,
        'API response'
      );
    }

    console.log('\n✓ Export complete!');
    console.log(`\nFile details:`);
    console.log(`  Name: ${data.name}`);
    console.log(`  Last modified: ${data.lastModified}`);
    console.log(`  Version: ${data.version}`);
    if (options.minimal) {
      const originalSize = JSON.stringify(data).length;
      const minimalSize = JSON.stringify(processedData).length;
      const reduction = ((1 - minimalSize / originalSize) * 100).toFixed(1);
      console.log(`  Size reduction: ${reduction}%`);
    }
  } catch (error) {
    console.error('\n✗ Export failed:');
    if (error instanceof Error) {
      console.error(`  ${error.message}`);
    } else {
      console.error(`  ${error}`);
    }
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (!validateOptions(options)) {
    process.exit(1);
  }

  await exportFile(options);
}

// Run if called directly
if (require.main === module) {
  main();
}

export { exportFile, ExportOptions };
