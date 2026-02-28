# @ze/specialist-mint

CLI tool for minting specialist snapshots from templates and benchmark results.

## Overview

The `@ze/specialist-mint` package combines specialist templates with benchmark results to create versioned snapshots. This is a core component of the Zephyr Agency specialist lifecycle.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Command Line

The tool provides several CLI commands:

#### `mint:snapshot` - Create Snapshots

```bash
specialist-mint mint:snapshot <template-path> --output <path> [options]
```

**Arguments:**
- `<template-path>`: Path to the specialist template JSON5 file (relative to cwd)

**Required Options:**
- `--output <path>`: Output directory for the snapshot (relative to cwd)

**Optional Options:**
- `--batch-id <id>`: Batch ID from ze-benchmarks to load all runs from
- `--skip-benchmarks`: Skip loading benchmarks (create snapshot without benchmark data)
- `--worker-url <url>`: Worker API URL (defaults to `ZE_BENCHMARKS_WORKER_URL` env var or http://localhost:8787)
- `--auto-enrich`: Automatically enrich template if enriched version not found
- `--json`: Output metadata as JSON to stdout (for programmatic use)

**Examples:**

```bash
# Basic usage with benchmarks
specialist-mint mint:snapshot \
  ./templates/shadcn-specialist-template.json5 \
  --output ./snapshots \
  --batch-id batch-abc123

# Without benchmarks
specialist-mint mint:snapshot \
  ./templates/nextjs-specialist-template.json5 \
  --output ./snapshots \
  --skip-benchmarks

# With auto-enrichment
specialist-mint mint:snapshot \
  ./templates/react-specialist-template.json5 \
  --output ./snapshots \
  --batch-id batch-xyz789 \
  --auto-enrich

# JSON output for programmatic use
specialist-mint mint:snapshot \
  ./templates/vue-specialist-template.json5 \
  --output ./snapshots \
  --batch-id batch-def456 \
  --json > metadata.json
```

#### Other Commands

See the full command list with:
```bash
specialist-mint --help
```

### Programmatic Usage

You can also use the package programmatically:

```typescript
import { mintSnapshot } from '@ze/specialist-mint';

const result = await mintSnapshot(
  './path/to/template.json5',
  './path/to/output',
  {
    batchId: 'batch-abc123',
    skipBenchmarks: false,
    autoEnrich: false
  }
);

console.log(`Snapshot created: ${result.outputPath}`);
console.log(`Snapshot ID: ${result.snapshotId}`);
console.log(`Metadata:`, result.metadata);
```

The `mintSnapshot` function returns a `MintResult` object with:
- `snapshotId`: The auto-incremented snapshot ID (e.g., "001")
- `outputPath`: Full path to the created snapshot file
- `templateVersion`: Version from the template
- `metadata`: Full metadata object (see Metadata Output section below)

## Features

### JSON Metadata Output

Every snapshot generates a `.meta.json` file alongside the snapshot file. This metadata file contains:
- Snapshot ID and paths
- Template information (name, version, enrichment status)
- Benchmark information (included status, run count, models, comparison metrics)
- Timestamp and minting tool info

Example metadata structure:
```json
{
  "snapshot_id": "001",
  "snapshot_path": "/path/to/snapshots/shadcn-specialist/0.0.1/snapshot-001.json5",
  "template": {
    "name": "@zephyr/shadcn-specialist",
    "version": "0.0.1",
    "path": "/path/to/templates/shadcn-specialist-template.json5",
    "is_enriched": true
  },
  "benchmarks": {
    "included": true,
    "batch_id": "batch-abc123",
    "run_count": 10,
    "models": ["claude-sonnet-4", "claude-opus-4"],
    "comparison": {
      "baseline_avg": 0.750,
      "specialist_avg": 0.850,
      "improvement": 0.100,
      "improvement_pct": 13.33
    }
  },
  "output": {
    "directory": "/path/to/snapshots/shadcn-specialist/0.0.1",
    "snapshot_file": "/path/to/snapshots/shadcn-specialist/0.0.1/snapshot-001.json5",
    "metadata_file": "/path/to/snapshots/shadcn-specialist/0.0.1/snapshot-001.meta.json"
  },
  "timestamp": "2025-01-15T10:30:00.000Z",
  "minted_by": "@ze/specialist-mint CLI"
}
```

Use the `--json` flag to output this metadata to stdout for programmatic consumption.

### Optional Benchmarks

Benchmarks are now **optional**! You can create snapshots without benchmark data using:
- `--skip-benchmarks` flag: Explicitly skip benchmarks
- Omit `--batch-id`: Snapshot will be created without benchmarks (with a warning)

This is useful when:
- You want to version a template before benchmarking
- Benchmarks are not yet available
- You're iterating on template changes rapidly

### Auto-Enrichment

Use the `--auto-enrich` flag to automatically enrich templates during minting:
- If an enriched version doesn't exist, it will be created automatically
- Uses LLM to analyze documentation and add metadata
- Falls back to non-enriched template if enrichment fails
- Requires `OPENROUTER_API_KEY` or `ANTHROPIC_API_KEY` environment variable

### Enriched Template Path Resolution

**New in v2.1**: Template path resolution now uses a nested directory structure for enriched templates:
- **Old pattern (deprecated)**: `{name}-template.enriched-{version}.json5`
- **New pattern**: `enriched/{version}/{name}.enriched.{number}.json5`

Example:
```
templates/
├── shadcn-specialist-template.json5        # Base template
└── enriched/
    ├── 0.0.1/
    │   ├── shadcn-specialist.enriched.001.json5
    │   └── shadcn-specialist.enriched.002.json5
    └── 0.0.2/
        └── shadcn-specialist.enriched.001.json5
```

The tool automatically detects and loads the latest enriched version. Old enriched templates are still supported for backward compatibility.

## How it Works

1. **Loads and validates template**: Reads the specialist template and validates it against the template schema
2. **Auto-resolves enriched versions**: Automatically uses enriched template if available
3. **Loads benchmark results** (optional): Loads benchmark runs from Worker API via batch ID
4. **Creates snapshot**: Combines template and benchmark data into a snapshot structure
5. **Validates snapshot**: Ensures the final snapshot conforms to the snapshot schema
6. **Auto-increments snapshot ID**: Determines the next available snapshot ID (001, 002, 003, etc.)
7. **Writes files**: Saves both snapshot (.json5) and metadata (.meta.json) files

## Output Structure

Snapshots are saved in this directory structure:

```
<output-dir>/
└── <specialist-name>/        # e.g., "shadcn-specialist"
    └── <version>/             # e.g., "0.0.1"
        ├── snapshot-001.json5
        ├── snapshot-001.meta.json
        ├── snapshot-002.json5
        ├── snapshot-002.meta.json
        ├── snapshot-003.json5
        └── snapshot-003.meta.json
```

### Multiple Snapshots per Version

The same template version can have multiple snapshots. This is useful for:
- Tracking model performance evolution over time
- A/B testing different prompt variations
- Recording benchmark runs with different configurations

Each snapshot has two files:
- **`.json5` file**: The complete snapshot with template + benchmarks
- **`.meta.json` file**: Structured metadata for programmatic use

## Schema Validation

The tool validates data at two stages:

1. **Template validation**: Ensures the input template conforms to `template.schema.json5`
2. **Snapshot validation**: Ensures the output snapshot conforms to `snapshot.schema.json5`

If validation fails, the tool will:
- Display detailed error messages
- Exit with error code 1
- Not write any files

## Error Handling

The CLI provides clear error messages for common issues:

- Template file not found
- Template validation failed
- Benchmark database not found (continues with warning)
- Snapshot validation failed
- File system errors

## Development

### Building

```bash
pnpm build
```

### Testing Schema Validation

```bash
pnpm validate-schemas
```

This will validate example template and snapshot files against their respective schemas.

## Schema Files

- `src/schemas/template.schema.json5`: Schema for specialist templates (pre-minting)
- `src/schemas/snapshot.schema.json5`: Schema for specialist snapshots (post-minting)

## Related Documentation

- See `CLAUDE.md` for project conventions
- See `tasks.md` for implementation tasks
- See `questions1.md` for design decisions
- See `INHERITANCE.md` for template inheritance patterns
