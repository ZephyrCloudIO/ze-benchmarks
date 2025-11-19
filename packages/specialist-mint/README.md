# agency-specialist-mint

CLI tool for minting specialist snapshots from templates and benchmark results.

## Overview

The `agency-specialist-mint` package combines specialist templates with benchmark results to create versioned snapshots. This is a core component of the Zephyr Agency specialist lifecycle.

## Installation

```bash
pnpm install
pnpm build
```

## Usage

### Command Line

The tool provides a CLI command for minting snapshots:

```bash
pnpm mint:snapshot <template-path> <benchmark-output-folder>
```

#### Arguments

- `<template-path>`: Path to the specialist template JSON5 file
- `<benchmark-output-folder>`: Path to the benchmark output folder or database file
  - Can be a path to `benchmarks.db` directly
  - Can be a directory containing `benchmarks.db`
  - Can be the root of ze-benchmarks project (will find `benchmark-report/public/benchmarks.db`)

#### Example

```bash
# Using a template and benchmark database
pnpm mint:snapshot \
  ../../starting_from_outcome/shadcn-specialist.json5 \
  ../../ze-benchmarks

# Or with direct database path
pnpm mint:snapshot \
  ../../starting_from_outcome/shadcn-specialist.json5 \
  ../../ze-benchmarks/benchmark-report/public/benchmarks.db
```

### Programmatic Usage

You can also use the package programmatically:

```typescript
import { mintSnapshot } from 'agency-specialist-mint';

const result = await mintSnapshot(
  './path/to/template.json5',
  './path/to/benchmark-output'
);

console.log(`Snapshot created: ${result.outputPath}`);
console.log(`Snapshot ID: ${result.snapshotId}`);
```

## What it Does

1. **Loads and validates template**: Reads the specialist template and validates it against the template schema
2. **Loads benchmark results**: Reads the most recent successful benchmark run from the database
3. **Creates snapshot**: Combines template and benchmark data into a snapshot structure
4. **Validates snapshot**: Ensures the final snapshot conforms to the snapshot schema
5. **Auto-increments snapshot ID**: Determines the next available snapshot ID (001, 002, 003, etc.)
6. **Writes to disk**: Saves the snapshot to `snapshots/<specialist-name>/<version>/snapshot-<id>.json5`

## Output Structure

Snapshots are saved in this directory structure:

```
agency-specialist-mint/
└── snapshots/
    └── <specialist-name>/        # e.g., "shadcn-specialist"
        └── <version>/             # e.g., "0.0.1"
            ├── snapshot-001.json5
            ├── snapshot-002.json5
            └── snapshot-003.json5
```

### Multiple Snapshots per Version

The same template version can have multiple snapshots. This is useful for:
- Tracking model performance evolution over time
- A/B testing different prompt variations
- Recording benchmark runs with different configurations

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
