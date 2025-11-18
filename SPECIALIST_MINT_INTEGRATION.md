# Specialist Mint Integration

This document describes the integration of `agency-specialist-mint` into the ze-benchmarks monorepo as `@ze/specialist-mint`.

## What Changed

### Package Migration
- **Old**: Standalone `agency-specialist-mint` repository
- **New**: Integrated as `packages/specialist-mint` in ze-benchmarks monorepo
- **Package name**: `@ze/specialist-mint` v2.0.0

### Architecture Changes

#### Before (v1.x)
```
agency-specialist-mint → better-sqlite3 → Local benchmarks.db file
```

#### After (v2.0)
```
@ze/specialist-mint → HTTP API → Cloudflare Worker → D1 Database
```

### Breaking Changes

1. **No more direct SQLite access**
   - Removed `better-sqlite3` dependency
   - Now uses `@ze/worker-client` for Worker API access

2. **CLI signature changed**
   ```bash
   # Old
   mint:snapshot <template> <benchmark-folder> --output <dir> --batch-id <id>

   # New
   mint:snapshot <template> --batch-id <id> --output <dir> [--worker-url <url>]
   ```

3. **Worker must be running**
   - Local development: `pnpm worker:dev` (http://localhost:8787)
   - Production: Set `ZE_BENCHMARKS_WORKER_URL` in .env

4. **Async API**
   - `loadBenchmarkBatch()` is now async
   - `loadBenchmarkResults()` is now async
   - `mintSnapshot()` was already async

### New Features

1. **Worker API Integration**
   - Seamless access to benchmark data via HTTP API
   - Works in all environments (local, staging, production)
   - Automatic retry and error handling

2. **Type Safety**
   - Automatic type mapping between Worker API and mint formats
   - Consistent camelCase ↔ snake_case conversion

3. **Better Error Messages**
   - Clear indication when Worker is down
   - Helpful suggestions for common issues

## Usage

### Prerequisites

```bash
# 1. Start the Worker (required)
cd apps/worker
pnpm dev

# 2. Set environment variables
ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
ZE_BENCHMARKS_API_KEY=dev-local-key
```

### Workflow

```bash
# Step 1: Run benchmarks
pnpm bench update-deps nx-pnpm-monorepo --batch anthropic
# Note the batch ID: batch_abc123

# Step 2: Mint snapshot with benchmark results
pnpm mint:snapshot \
  templates/my-specialist.json5 \
  --batch-id batch_abc123 \
  --output ./snapshots

# Step 3: View the snapshot
cat snapshots/my-specialist/0.0.1/snapshot-001.json5
```

### From Root Directory

```bash
# Build specialist-mint
pnpm build:mint

# Run minting
pnpm mint:snapshot <args>

# Run enrichment
pnpm mint:enrich <template>
```

## File Structure

```
packages/specialist-mint/
├── src/
│   ├── benchmark-loader.ts    # Worker API client (refactored)
│   ├── cli.ts                 # CLI commands (updated)
│   ├── mint.ts                # Minting logic (async)
│   ├── enrich-template.ts     # LLM enrichment
│   ├── types.ts               # Type definitions
│   └── utils.ts               # Utilities (SQLite removed)
├── package.json               # @ze/specialist-mint
├── .env.example               # Worker config
└── README.md                  # Detailed docs
```

## Environment Variables

### Required
```bash
ZE_BENCHMARKS_WORKER_URL=http://localhost:8787  # Worker API URL
ZE_BENCHMARKS_API_KEY=dev-local-key             # API key (local dev)
```

### Optional
```bash
ANTHROPIC_API_KEY=...      # For template enrichment
OPENROUTER_API_KEY=...     # For template enrichment
ENRICHMENT_MODEL=...       # Override default model
```

## Migration Guide

If you were using the old `agency-specialist-mint` package:

1. **Update imports**:
   ```typescript
   // Old
   import { mintSnapshot } from 'agency-specialist-mint';

   // New
   import { mintSnapshot } from '@ze/specialist-mint';
   ```

2. **Update CLI calls**:
   ```bash
   # Old
   agency-specialist-mint mint:snapshot template.json5 ../ze-benchmarks --output ./out --batch-id batch_123

   # New
   specialist-mint mint:snapshot template.json5 --batch-id batch_123 --output ./out
   ```

3. **Start Worker before minting**:
   ```bash
   cd apps/worker && pnpm dev
   ```

4. **Update environment variables**:
   ```bash
   # Remove (no longer needed)
   BENCHMARK_DB_PATH=...

   # Add
   ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
   ZE_BENCHMARKS_API_KEY=dev-local-key
   ```

## Benefits

1. **Unified Architecture**: Same Worker API for dashboard and minting
2. **Remote Access**: Can mint snapshots from any machine with Worker access
3. **No File Sync**: No need to sync SQLite database files
4. **Better Scaling**: Worker handles concurrent requests efficiently
5. **Consistent Data**: Single source of truth for benchmark results

## Troubleshooting

### "Worker API is not accessible"

**Cause**: Worker is not running or wrong URL

**Fix**:
```bash
# Start Worker
cd apps/worker && pnpm dev

# Verify it's running
curl http://localhost:8787/health
```

### "No runs found for batch"

**Cause**: Batch ID doesn't exist or has no completed runs

**Fix**:
```bash
# List available batches
pnpm batches

# Use correct batch ID from the list
```

### Build errors with better-sqlite3

**Cause**: Old node_modules with SQLite

**Fix**:
```bash
# Clean install
rm -rf node_modules pnpm-lock.yaml
pnpm install
```

## Further Reading

- `packages/specialist-mint/README.md` - Detailed usage guide
- `packages/specialist-mint/INTEGRATION_PLAN_V2.md` - Technical integration details
- `apps/worker/README.md` - Worker API documentation
- `packages/worker-client/README.md` - API client documentation
