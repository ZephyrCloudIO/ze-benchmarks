# Specialist Snapshot Minting Process

## Overview

The **minting process** combines a specialist template with benchmark results to create a versioned snapshot. This document explains how minting works, the data flow, and the complete architecture.

## Table of Contents

- [Quick Start](#quick-start)
- [Architecture Overview](#architecture-overview)
- [Detailed Process Flow](#detailed-process-flow)
- [Data Structures](#data-structures)
- [Worker API Integration](#worker-api-integration)
- [Complete Workflow](#complete-workflow)
- [File Locations](#file-locations)

---

## Quick Start

### Basic Usage

```bash
# Mint a snapshot from a template and batch ID
pnpm mint:snapshot <template-path> --output <output-dir> --batch-id <batch-id>
```

### Example

```bash
pnpm mint:snapshot \
  ./templates/shadcn-specialist.json5 \
  --output ./snapshots \
  --batch-id abc123-def456-789
```

### Options

- `<template-path>`: Path to specialist template JSON5 file (relative to cwd)
- `--output <path>`: Output directory for snapshots (relative to cwd)
- `--batch-id <id>`: Batch ID from ze-benchmarks (contains all runs)
- `--worker-url <url>`: Optional Worker API URL (defaults to env var or http://localhost:8787)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MINTING PROCESS                         │
└─────────────────────────────────────────────────────────────────┘

INPUT                      PROCESS                      OUTPUT
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│              │          │              │          │              │
│  Specialist  │──────────▶│    Mint     │──────────▶│  Snapshot    │
│  Template    │          │   Engine    │          │   File       │
│  (.json5)    │          │              │          │  (.json5)    │
│              │          │              │          │              │
└──────────────┘          └──────┬───────┘          └──────────────┘
                                 │
                                 │ Fetches via HTTP
                                 ▼
                          ┌──────────────┐
                          │              │
                          │  Worker API  │
                          │              │
                          │ Batch Runs   │
                          │ + Metrics    │
                          │              │
                          └──────────────┘
```

### Key Components

1. **CLI Interface** (`packages/specialist-mint/src/cli.ts`)
   - Command parsing and validation
   - Entry point for minting operations

2. **Mint Engine** (`packages/specialist-mint/src/mint.ts`)
   - Core minting logic
   - Template + benchmark combination
   - Comparison calculations

3. **Benchmark Loader** (`packages/specialist-mint/src/benchmark-loader.ts`)
   - Fetches data from Worker API
   - Maps Worker format to mint format
   - Handles batch loading

4. **Worker API** (`@ze/worker-client`)
   - HTTP API for benchmark data
   - Provides batch details, run statistics, evaluations

---

## Detailed Process Flow

### Step 1: Load & Validate Template

**Location:** `packages/specialist-mint/src/mint.ts:28`

```typescript
// Resolve template path (checks for enriched version)
const { path: resolvedPath, isEnriched } = resolveTemplatePath(templatePath);
const template: SpecialistTemplate = loadJSON5(resolvedPath);

// Validate against schema
const validation = validateTemplateSchema(template);
if (!validation.valid) {
  throw new Error(`Validation failed: ${validation.errors}`);
}
```

**What Happens:**
- Checks for enriched template (`.enriched.json5` suffix) and prefers it
- Loads JSON5 file with template definition
- Validates structure against `template.schema.json5`
- Template contains: persona, capabilities, documentation, prompts, etc.

**Template Structure:**
```json5
{
  schema_version: "3.0.0",
  name: "@scope/specialist-name",
  version: "0.0.1",
  persona: { purpose, values, attributes, tech_stack },
  capabilities: { tags, descriptions },
  documentation: [ /* docs with optional enrichment */ ],
  prompts: { default, model_specific, prompt_strategy }
}
```

---

### Step 2: Load Benchmark Results

**Location:** `packages/specialist-mint/src/benchmark-loader.ts:20`

#### Batch Mode (Recommended)

```typescript
const runs = await loadBenchmarkBatch(batchId, workerUrl);
```

**Process:**
1. Initialize `WorkerClient` with API URL and optional key
2. Health check: `client.healthCheck()`
3. Fetch batch: `client.getBatchDetails(batchId)`
4. Filter for completed runs only
5. Fetch detailed info for each run: `client.getRunDetails(runId)` (parallel)
6. Map Worker API format to mint format

**Data Source:**
- Worker API endpoint (default: `http://localhost:8787`)
- Environment variables:
  - `ZE_BENCHMARKS_WORKER_URL` - API base URL
  - `ZE_BENCHMARKS_API_KEY` - Optional API key

**What Gets Loaded:**
- Run metadata (ID, date, model, suite, scenario, tier)
- Scores (overall score + per-evaluator scores)
- Telemetry (duration, token usage)
- Evaluations (per-evaluator details)
- Specialist flag (baseline vs specialist run)

#### Legacy Mode (Deprecated)

Fetches single most recent successful run instead of batch.

---

### Step 3: Create Snapshot

**Location:** `packages/specialist-mint/src/mint.ts:68`

```typescript
const snapshot: SpecialistSnapshot = {
  ...template,
  benchmarks: createBenchmarksSection(template, benchmarkRuns, batchId),
  snapshot_metadata: {
    created_at: new Date().toISOString(),
    minted_by: '@ze/specialist-mint CLI',
    template_version: template.version
  }
};
```

**Benchmarks Section Creation:**

1. **Test Suites** - Extract unique suite/scenario combinations
   ```typescript
   test_suites: [{
     name: "scenario-name",
     path: "suite/scenario",
     type: "functional",
     description: "Benchmark from suite"
   }]
   ```

2. **Scoring Methodology**
   ```typescript
   scoring: {
     methodology: "weighted_average",
     update_frequency: "per_experiment",
     comparison_targets: ["control", "generic"]
   }
   ```

3. **Runs** - All benchmark runs with full details
   ```typescript
   runs: [
     {
       run_id: "...",
       batch_id: "...",
       model: "anthropic/claude-3.5-sonnet",
       specialist_enabled: false,
       overall_score: 0.95,
       evaluations: { /* per-evaluator results */ },
       telemetry: { /* duration, tokens */ }
     }
   ]
   ```

4. **Comparison** - Calculate improvement metrics

---

### Step 4: Calculate Comparison Metrics

**Location:** `packages/specialist-mint/src/mint.ts:200`

```typescript
function calculateComparison(template, runs): BenchmarkComparison {
  const baselineRuns = runs.filter(r => r.specialist_enabled === false);
  const specialistRuns = runs.filter(r => r.specialist_enabled === true);

  // Calculate averages
  const baseline_avg_score = avg(baselineRuns.map(r => r.overall_score));
  const specialist_avg_score = avg(specialistRuns.map(r => r.overall_score));

  // Calculate improvement
  const improvement = specialist_avg_score - baseline_avg_score;
  const improvement_pct = (improvement / baseline_avg_score) * 100;

  // Per-model comparisons
  const models_compared = calculatePerModelComparisons(baselineRuns, specialistRuns);

  return { baseline_avg_score, specialist_avg_score, improvement, improvement_pct, models_compared };
}
```

**Comparison Structure:**
```typescript
{
  baseline_avg_score: 0.85,
  specialist_avg_score: 0.92,
  improvement: 0.07,
  improvement_pct: 8.2,
  models_compared: [
    {
      model: "claude-3.5-sonnet",
      baseline_score: 0.90,
      specialist_score: 0.95,
      improvement: 0.05,
      improvement_pct: 5.6
    }
  ]
}
```

---

### Step 5: Validate Snapshot

**Location:** `packages/specialist-mint/src/mint.ts:83`

```typescript
const validation = validateSnapshotSchema(snapshot);
if (!validation.valid) {
  throw new Error(`Snapshot validation failed: ${validation.errors}`);
}
```

Validates against `snapshot.schema.json5` to ensure:
- All required fields present
- Correct data types
- Valid enum values
- Proper nesting structure

---

### Step 6: Determine Output Path

**Location:** `packages/specialist-mint/src/mint.ts:92`

**Directory Structure:**
```
{output-dir}/
└── {specialist-name}/      # e.g., "shadcn-specialist"
    └── {version}/          # e.g., "0.0.1"
        ├── snapshot-001.json5
        ├── snapshot-002.json5
        └── snapshot-003.json5
```

**Auto-Increment Logic:**
- Scans directory for existing snapshots
- Finds highest snapshot ID (e.g., `002`)
- Increments by 1 (e.g., `003`)
- Creates new snapshot file

**Example Path:**
```
./snapshots/shadcn-specialist/0.0.1/snapshot-001.json5
```

---

### Step 7: Write to Disk

**Location:** `packages/specialist-mint/src/mint.ts:114`

```typescript
writeJSON5(outputPath, snapshot);
```

Writes the complete snapshot as a JSON5 file with:
- Human-readable formatting
- Comments preserved (if any)
- Proper indentation

---

## Data Structures

### BenchmarkRun

**Location:** `packages/specialist-mint/src/types.ts:90`

```typescript
interface BenchmarkRun {
  run_id: string;                    // Unique run identifier
  run_date: string;                  // ISO timestamp
  batch_id?: string;                 // Batch identifier
  model: string;                     // Model name (e.g., "claude-3.5-sonnet")
  specialist_enabled?: boolean;      // Baseline vs specialist run
  suite: string;                     // Benchmark suite name
  scenario: string;                  // Scenario name
  tier: string;                      // Difficulty tier (L0, L1, L2)
  agent: string;                     // Agent adapter used
  overall_score: number;             // Normalized 0-1 score

  evaluations?: Record<string, {
    score: number;                   // Normalized 0-1 score
    passed: boolean;                 // Did it pass threshold?
    error?: string;                  // Error details if failed
  }>;

  telemetry?: {
    duration_ms?: number;            // Run duration in milliseconds
    token_usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
}
```

### SpecialistSnapshot

**Location:** `packages/specialist-mint/src/types.ts:135`

```typescript
interface SpecialistSnapshot extends SpecialistTemplate {
  benchmarks: {
    test_suites: Array<{
      name: string;
      path: string;
      type: 'functional' | 'accuracy' | 'performance';
      description?: string;
    }>;

    scoring: {
      methodology: 'weighted_average' | 'simple_average' | 'max_score' | 'min_score' | 'custom';
      update_frequency?: string;
      comparison_targets?: string[];
    };

    runs?: BenchmarkRun[];
    comparison?: BenchmarkComparison;
  };

  snapshot_metadata?: {
    created_at: string;              // ISO timestamp
    minted_by?: string;              // Tool/user that created snapshot
    template_version: string;        // Template version at mint time
    notes?: string;
  };
}
```

### BenchmarkComparison

**Location:** `packages/specialist-mint/src/types.ts:124`

```typescript
interface BenchmarkComparison {
  baseline_avg_score?: number;       // Average score for baseline runs
  specialist_avg_score?: number;     // Average score for specialist runs
  improvement?: number;              // Absolute improvement
  improvement_pct?: number;          // Percentage improvement

  models_compared?: Array<{
    model: string;
    baseline_score: number;
    specialist_score?: number;
    improvement?: number;
    improvement_pct?: number;
  }>;
}
```

---

## Worker API Integration

### WorkerClient

**Package:** `@ze/worker-client`
**Usage Location:** `packages/specialist-mint/src/benchmark-loader.ts`

### API Methods Used

#### 1. Health Check
```typescript
const isHealthy = await client.healthCheck();
```

Verifies Worker API connectivity before fetching data.

#### 2. Get Batch Details
```typescript
const batch: BatchStatistics = await client.getBatchDetails(batchId);
```

Returns:
- Batch metadata (ID, created date, total runs)
- Array of all runs in the batch
- Aggregate statistics

#### 3. Get Run Details
```typescript
const run: DetailedRunStatistics = await client.getRunDetails(runId);
```

Returns complete details for a single run:
- Run metadata (ID, dates, model, suite, scenario)
- Total score and success status
- Array of evaluation results
- Telemetry (duration, tokens, cost)

### Data Mapping

**Worker API Format → Mint Format**

```typescript
function mapWorkerRunToMintRun(workerRun: DetailedRunStatistics): BenchmarkRun {
  // Map evaluations
  const evaluations = {};
  for (const eval of workerRun.evaluations) {
    const normalizedScore = eval.score / eval.maxScore;
    evaluations[eval.evaluatorName] = {
      score: normalizedScore,
      passed: eval.score >= eval.maxScore,
      error: eval.details
    };
  }

  // Map telemetry
  const telemetry = {
    duration_ms: workerRun.telemetry.durationMs,
    token_usage: {
      prompt_tokens: workerRun.telemetry.tokensIn,
      completion_tokens: workerRun.telemetry.tokensOut,
      total_tokens: workerRun.telemetry.tokensIn + workerRun.telemetry.tokensOut
    }
  };

  return {
    run_id: workerRun.runId,
    run_date: workerRun.completedAt || workerRun.startedAt,
    batch_id: workerRun.batchId,
    model: workerRun.model,
    specialist_enabled: workerRun.specialistEnabled,
    overall_score: workerRun.totalScore,
    evaluations,
    telemetry
  };
}
```

---

## Complete Workflow

### Full Pipeline (workflow-iterate.ts)

This script orchestrates the entire testing workflow:

```bash
pnpm workflow:iterate \
  --template <template-path> \
  --suite <suite-name> \
  --scenario <scenario-name> \
  --tier <L0|L1|L2> \
  --output <snapshot-dir>
```

**Steps:**

#### 1. Run Benchmarks
```bash
pnpm bench:run shadcn-generate-vite shadcn-generate-vite --tier L0
```

**What Happens:**
- Reads `models.json5` for vanilla and specialist models
- Runs benchmarks for all models (10 concurrent)
- Generates unique batch ID
- Stores results in database via Worker API
- Returns batch ID in output

**Script:** `scripts/run-all-models.ts`

#### 2. Mint Snapshot
```bash
pnpm mint:snapshot template.json5 --output ./snapshots --batch-id <batch-id>
```

**What Happens:**
- Loads template (enriched if available)
- Fetches all runs from batch via Worker API
- Creates snapshot with benchmark data
- Calculates comparison metrics
- Writes snapshot file

**Script:** `packages/specialist-mint/src/mint.ts`

#### 3. Export Prompts (Optional)
```bash
pnpm export:prompts <batch-id> prompts.json
```

**What Happens:**
- Fetches all runs from batch
- Extracts prompts sent to models
- Exports to JSON with metadata

**Script:** `scripts/export-batch-prompts.ts`

#### 4. Validate Prompts (Optional)
```bash
pnpm validate:prompts --prompts-file prompts.json template.json5
```

**What Happens:**
- Checks if prompts contain template content
- Validates purpose, values, attributes, spawner prompts
- Reports pass/fail per run

**Script:** `scripts/validate-prompts.ts`

---

## File Locations

### Core Minting Files

```
packages/specialist-mint/
├── src/
│   ├── cli.ts                      # CLI entry point
│   ├── mint.ts                     # Main minting engine
│   ├── benchmark-loader.ts         # Worker API integration
│   ├── types.ts                    # TypeScript interfaces
│   ├── utils.ts                    # Helper functions
│   ├── template-resolver.ts        # Template path resolution
│   └── schemas/
│       ├── template.schema.json5   # Template validation schema
│       └── snapshot.schema.json5   # Snapshot validation schema
└── README.md                       # Package documentation
```

### Related Scripts

```
scripts/
├── run-all-models.ts              # Batch benchmark execution
├── compare-batches.ts             # Compare multiple batches
├── export-batch-prompts.ts        # Export prompts from batch
├── validate-prompts.ts            # Validate prompt content
├── clear-database.ts              # Database management
└── workflow-iterate.ts            # Complete workflow orchestration
```

### Configuration

```
package.json                        # Root package with scripts
models.json5                        # Model configuration for benchmarks
.env                               # Environment variables
  ├── ZE_BENCHMARKS_WORKER_URL     # Worker API URL
  └── ZE_BENCHMARKS_API_KEY        # Optional API key
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ZE_BENCHMARKS_WORKER_URL` | Worker API base URL | `http://localhost:8787` |
| `ZE_BENCHMARKS_API_KEY` | Optional API authentication key | (none) |
| `ENRICHMENT_MODEL` | Model for template enrichment | `anthropic/claude-3.5-haiku` |

---

## Key Characteristics

### 1. Batch-Oriented
- Works with entire batches of benchmark runs
- Single batch ID represents complete benchmark session
- All models tested together for fair comparison

### 2. API-Driven
- Fetches data from Worker API (HTTP)
- No direct database access
- Decoupled from storage implementation

### 3. Schema-Validated
- Templates validated on input
- Snapshots validated on output
- Ensures data integrity throughout

### 4. Versioned
- Multiple snapshots per template version
- Auto-incremented snapshot IDs
- Organized directory structure

### 5. Comparison-Aware
- Automatically calculates improvement metrics
- Separates baseline vs specialist runs
- Per-model and aggregate comparisons

### 6. Enrichment-Aware
- Prefers enriched templates when available
- Enrichment adds LLM-generated metadata
- Helps with documentation discoverability

---

## Common Issues & Solutions

### Issue: Worker API Not Accessible

**Error:** `⚠️  Worker API is not accessible`

**Solution:**
```bash
# Start the worker locally
cd apps/worker
pnpm dev

# Or set correct URL
export ZE_BENCHMARKS_WORKER_URL=https://your-worker.com
```

### Issue: No Runs Found for Batch

**Error:** `⚠️  No runs found for batch: {batch-id}`

**Solution:**
- Verify batch ID is correct
- Check if benchmarks completed successfully
- View batches: `pnpm bench --batches`

### Issue: Template Validation Failed

**Error:** `Template validation failed: ...`

**Solution:**
- Check template follows schema: `packages/specialist-mint/src/schemas/template.schema.json5`
- Ensure all required fields present
- Validate JSON5 syntax

### Issue: Snapshot Validation Failed

**Error:** `Snapshot validation failed: ...`

**Solution:**
- Usually indicates data issue in benchmark results
- Check run data in Worker API
- Verify evaluations are properly formatted

---

## Related Documentation

- [Adding Benchmarks](./ADDING-BENCHMARKS.md)
- [Adding Evaluators](./ADDING-EVALUATORS.md)
- [Specialist Template Interface](./SPECIALIST_TEMPLATE_INTERFACE.md)
- [Worker API Documentation](../apps/worker/README.md)
- [Specialist Mint Package](../packages/specialist-mint/README.md)

---

## Appendix: Complete Example

### 1. Create Template

`templates/my-specialist.json5`:
```json5
{
  schema_version: "3.0.0",
  name: "@myorg/my-specialist",
  version: "0.0.1",
  persona: {
    purpose: "Expert in ...",
    values: ["accuracy", "efficiency"],
    attributes: ["detail-oriented", "thorough"],
    tech_stack: ["react", "typescript"]
  },
  capabilities: {
    tags: ["frontend", "react"],
    descriptions: {
      frontend: "Build modern web interfaces"
    }
  },
  prompts: {
    default: {
      spawnerPrompt: "You are a specialist in ..."
    },
    prompt_strategy: {
      fallback: "default",
      model_detection: "auto"
    }
  }
}
```

### 2. Run Benchmarks

```bash
pnpm bench:run my-suite my-scenario --tier L0
# Output: Batch ID: abc123-def456-789
```

### 3. Mint Snapshot

```bash
pnpm mint:snapshot \
  ./templates/my-specialist.json5 \
  --output ./snapshots \
  --batch-id abc123-def456-789
```

### 4. Output

`snapshots/my-specialist/0.0.1/snapshot-001.json5`:
```json5
{
  // ... all template fields ...

  benchmarks: {
    test_suites: [{
      name: "my-scenario",
      path: "my-suite/my-scenario",
      type: "functional"
    }],

    scoring: {
      methodology: "weighted_average"
    },

    runs: [
      {
        run_id: "run-001",
        model: "claude-3.5-sonnet",
        specialist_enabled: false,
        overall_score: 0.85
      },
      {
        run_id: "run-002",
        model: "claude-3.5-sonnet",
        specialist_enabled: true,
        overall_score: 0.92
      }
    ],

    comparison: {
      baseline_avg_score: 0.85,
      specialist_avg_score: 0.92,
      improvement: 0.07,
      improvement_pct: 8.2
    }
  },

  snapshot_metadata: {
    created_at: "2025-12-01T10:00:00Z",
    minted_by: "@ze/specialist-mint CLI",
    template_version: "0.0.1"
  }
}
```

---

**Last Updated:** 2025-12-01
**Version:** 1.0.0