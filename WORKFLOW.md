# Zephyr Bench Complete Workflow Guide

This document provides a comprehensive overview of how the ze-benchmarks system works, from running benchmarks to creating specialist snapshots.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [The Benchmark Process](#the-benchmark-process)
3. [The Minting Process](#the-minting-process)
4. [The Enrichment Process](#the-enrichment-process)
5. [Complete Workflows](#complete-workflows)
6. [Data Flow Diagrams](#data-flow-diagrams)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     Ze-Benchmarks System                     │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐              │
│  │ Harness  │───▶│  Agent   │───▶│Evaluators│              │
│  │   CLI    │    │ Adapters │    │          │              │
│  └──────────┘    └──────────┘    └──────────┘              │
│       │                │                │                    │
│       │                │                │                    │
│       ▼                ▼                ▼                    │
│  ┌──────────────────────────────────────────┐              │
│  │        Cloudflare Worker + D1            │              │
│  │         (Benchmark Storage)              │              │
│  └──────────────────────────────────────────┘              │
│       │                                  │                  │
│       ▼                                  ▼                  │
│  ┌──────────┐                    ┌──────────┐              │
│  │   Web    │                    │Specialist│              │
│  │Dashboard │                    │   Mint   │              │
│  └──────────┘                    └──────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

1. **Harness CLI** - Orchestrates benchmark execution
2. **Agent Adapters** - Interface with different AI providers (Claude, OpenRouter, etc.)
3. **Evaluators** - Automated testing and scoring
4. **Worker + D1** - Data storage and API
5. **Web Dashboard** - Results visualization
6. **Specialist Mint** - Create versioned specialist snapshots

---

## The Benchmark Process

### What `pnpm bench` Does

When you run a benchmark, the harness orchestrates a multi-step process:

```bash
pnpm bench <suite> <scenario> --tier <tier> --agent <agent>
```

### Step-by-Step Execution

#### 1. **Initialization** (0-1s)
```
┌─────────────────────────────────────┐
│ Load Environment & Configuration    │
├─────────────────────────────────────┤
│ • Load .env variables               │
│ • Initialize Worker API client      │
│ • Create batch ID (if not provided)│
│ • Start benchmark logger            │
└─────────────────────────────────────┘
```

**What happens:**
- Reads environment variables (`ANTHROPIC_API_KEY`, `ZE_BENCHMARKS_WORKER_URL`, etc.)
- Creates a unique run ID: `run_<timestamp>_<random>`
- Creates or uses batch ID: `batch_<timestamp>` or custom ID
- Connects to Worker API at `http://localhost:8787` (local) or production URL

#### 2. **Scenario Loading** (1-2s)
```
┌─────────────────────────────────────┐
│ Load Scenario Configuration         │
├─────────────────────────────────────┤
│ • Read scenario.yaml                │
│ • Load prompt file (tier-specific)  │
│ • Parse oracle-answers.json         │
│ • Identify evaluators               │
└─────────────────────────────────────┘
```

**Files read:**
```
suites/<suite>/scenarios/<scenario>/
├── scenario.yaml          # Configuration
├── oracle-answers.json    # Expected results
├── repo-fixture/          # Code to test
└── prompts/
    ├── L0-minimal.md      # Tier prompts
    ├── L1-basic.md
    ├── L2-detailed.md
    └── L3-migration.md
```

**Example scenario.yaml:**
```yaml
name: "Update Dependencies"
description: "Update npm packages to latest versions"
evaluators:
  - name: build
    weight: 0.4
  - name: typecheck
    weight: 0.3
  - name: lint
    weight: 0.3
validation_commands:
  - "npm install"
  - "npm run build"
```

#### 3. **Warmup Phase** (10-30s, optional)
```
┌─────────────────────────────────────┐
│ Execute Warmup                       │
├─────────────────────────────────────┤
│ • Copy repo-fixture to warmup dir   │
│ • Run validation commands            │
│ • Verify baseline works              │
│ • Create "control" snapshot          │
└─────────────────────────────────────┘
```

**Purpose:** Ensure the baseline code works before running the agent.

**Skip with:** `--skip-warmup` (useful for parallel execution)

#### 4. **Workspace Preparation** (2-5s)
```
┌─────────────────────────────────────┐
│ Prepare Test Workspace               │
├─────────────────────────────────────┤
│ • Copy repo-fixture to temp dir     │
│ • Set workspace permissions          │
│ • Initialize workspace context       │
│ • Prepare diff artifacts             │
└─────────────────────────────────────┘
```

**Workspace location:**
```
results/workspaces/<suite>-<scenario>-<random>/
```

**What's included:**
- Complete copy of `repo-fixture/`
- All files and directories
- Git history (if present)
- Node modules excluded

#### 5. **Agent Execution** (30s-5min)
```
┌─────────────────────────────────────┐
│ Execute AI Agent                     │
├─────────────────────────────────────┤
│ • Initialize agent adapter           │
│ • Send prompt + workspace context    │
│ • Agent analyzes and modifies code   │
│ • Track tool calls and tokens        │
│ • Capture telemetry data             │
└─────────────────────────────────────┘
```

**Agent Adapters:**

| Agent | Provider | Model Selection |
|-------|----------|----------------|
| `anthropic` | Anthropic Claude | Auto: Claude 3.5 Sonnet |
| `openrouter` | OpenRouter | Interactive model search |
| `claude-code` | Claude Code CLI | Uses Claude Code settings |
| `echo` | Test agent | Echoes prompt back |

**What the agent receives:**
```typescript
{
  prompt: "Update all dependencies to latest...",
  workspaceDir: "/path/to/workspace",
  tools: [
    { name: "read_file", ... },
    { name: "write_file", ... },
    { name: "list_directory", ... },
    { name: "run_command", ... },
    { name: "ask_user", ... }
  ]
}
```

**Agent output:**
- Modified files in workspace
- Tool call history
- Token usage (input/output)
- Cost estimation
- Duration

#### 6. **Validation** (5-30s)
```
┌─────────────────────────────────────┐
│ Run Validation Commands              │
├─────────────────────────────────────┤
│ • Execute commands from scenario     │
│ • Capture stdout/stderr              │
│ • Record exit codes                  │
│ • Determine if changes work          │
└─────────────────────────────────────┘
```

**Example validation:**
```bash
npm install           # Install updated dependencies
npm run build         # Verify build succeeds
npm run typecheck     # Check TypeScript types
npm run lint          # Verify code quality
```

**Validation results:**
- ✅ Success: All commands exit 0
- ❌ Failure: Any command exits non-zero

#### 7. **Evaluation** (10-60s)
```
┌─────────────────────────────────────┐
│ Run Evaluators                       │
├─────────────────────────────────────┤
│ • Build evaluator                    │
│ • Typecheck evaluator                │
│ • Lint evaluator                     │
│ • Custom heuristic evaluators        │
│ • LLM Judge (optional)               │
└─────────────────────────────────────┘
```

**Evaluator Types:**

**A. Heuristic Evaluators** (Fast, ~1-5s each)
```typescript
class BuildEvaluator {
  async evaluate(workspace: string): Promise<Score> {
    // Run build command
    // Check if succeeds
    // Return score 0.0-1.0
  }
}
```

**B. Oracle-Based Evaluators** (Medium, ~5-15s each)
```typescript
class DependencyEvaluator {
  async evaluate(workspace: string, oracle: Oracle): Promise<Score> {
    // Read package.json
    // Compare with oracle-answers.json
    // Calculate percentage match
    // Return score 0.0-1.0
  }
}
```

**C. LLM Judge** (Slow, ~30-60s, optional)
```typescript
class LLMJudge {
  async evaluate(workspace: string, prompt: string): Promise<Score> {
    // Send workspace diff to LLM
    // Ask LLM to judge quality
    // Get reasoning and score
    // Return score 0.0-1.0
  }
}
```

**Scoring:**
```
Total Score = Σ (evaluator_score × evaluator_weight)
Weighted Score = Total Score / Σ weights
Success = Total Score >= threshold (e.g., 0.7)
```

#### 8. **Results Storage** (1-2s)
```
┌─────────────────────────────────────┐
│ Save to Worker API                   │
├─────────────────────────────────────┤
│ • Submit run data                    │
│ • Submit evaluations                 │
│ • Submit telemetry                   │
│ • Update batch statistics            │
└─────────────────────────────────────┘
```

**What gets stored:**
```typescript
{
  runId: "run_1234567890_abc",
  batchId: "batch_1234567890",
  suite: "update-deps",
  scenario: "nx-pnpm-monorepo",
  tier: "L1",
  agent: "anthropic",
  model: "claude-3-5-sonnet-20241022",
  status: "completed",
  totalScore: 0.85,
  weightedScore: 0.85,
  isSuccessful: true,
  specialistEnabled: false,
  evaluations: [
    { evaluatorName: "build", score: 1.0, maxScore: 1.0 },
    { evaluatorName: "typecheck", score: 0.8, maxScore: 1.0 },
    { evaluatorName: "lint", score: 0.75, maxScore: 1.0 }
  ],
  telemetry: {
    durationMs: 45000,
    toolCalls: 12,
    tokensIn: 15000,
    tokensOut: 2500,
    costUsd: 0.0234
  }
}
```

#### 9. **Display Results** (1s)
```
┌─────────────────────────────────────┐
│ Show Results to User                 │
├─────────────────────────────────────┤
│ • Display scores by evaluator        │
│ • Show success/failure               │
│ • Display telemetry summary          │
│ • Print batch ID                     │
└─────────────────────────────────────┘
```

**Console output:**
```
✓ Benchmark completed successfully!

Results:
  Run ID: run_1234567890_abc
  Batch ID: batch_1234567890

Scores:
  Build:     1.00 / 1.00 ✓
  Typecheck: 0.80 / 1.00 ⚠
  Lint:      0.75 / 1.00 ⚠

  Total:     0.85 / 1.00 ✓ PASS

Telemetry:
  Duration:  45.0s
  Tokens:    15,000 in / 2,500 out
  Cost:      $0.02
  Tool calls: 12
```

### Iterations Support

When using `--iterations N`, the benchmark runs N times:

```bash
pnpm bench suite scenario --iterations 3
```

**What happens:**
```
Iteration 1/3
├─ Run benchmark
├─ Store results with same batch ID
└─ Display results

Iteration 2/3
├─ Run benchmark
├─ Store results with same batch ID
└─ Display results

Iteration 3/3
├─ Run benchmark
├─ Store results with same batch ID
└─ Display results

[If --mint-template provided]
└─ Mint snapshot using all 3 runs
```

**Use cases:**
- Statistical confidence (run multiple times)
- Compare variance across runs
- Stress testing agent consistency

---

## The Minting Process

### What `mint:snapshot` Does

Minting creates a **specialist snapshot** by combining:
1. A specialist template (defines the specialist)
2. Benchmark results (proves performance)

```bash
pnpm mint:snapshot <template> --batch-id <id> --output <dir>
```

### Step-by-Step Execution

#### 1. **Template Loading** (1s)
```
┌─────────────────────────────────────┐
│ Load and Validate Template          │
├─────────────────────────────────────┤
│ • Read template.json5 file           │
│ • Check for enriched version         │
│ • Validate against template schema   │
│ • Extract metadata                   │
└─────────────────────────────────────┘
```

**Template structure:**
```json5
{
  name: "@org/my-specialist",
  version: "1.0.0",
  persona: {
    purpose: "Help users with shadcn/ui components",
    tech_stack: ["React", "TypeScript", "Tailwind CSS"],
    // ...
  },
  capabilities: {
    tags: ["ui", "components", "react"],
    // ...
  },
  preferred_models: ["anthropic/claude-3.5-sonnet"],
  documentation: [
    {
      source: "https://ui.shadcn.com/docs",
      type: "web",
      // ...
    }
  ]
}
```

**Template resolution:**
```
Given: templates/my-specialist.json5

Checks:
1. templates/my-specialist/enriched/0.0.1/enriched-001.json5 ✓ Use this!
2. templates/my-specialist/0.0.1/my-specialist.json5
3. templates/my-specialist.json5

Uses most enriched/recent version available.
```

#### 2. **Benchmark Loading** (1-3s)
```
┌─────────────────────────────────────┐
│ Fetch Benchmark Results              │
├─────────────────────────────────────┤
│ • Connect to Worker API              │
│ • Fetch batch details                │
│ • Get all runs in batch              │
│ • Load evaluations & telemetry       │
└─────────────────────────────────────┘
```

**API calls:**
```typescript
// 1. Get batch overview
GET /api/batches/{batchId}
→ { batchId, runs: [...], totalRuns, avgScore }

// 2. Get detailed run data
GET /api/runs/{runId}
→ { run, evaluations, telemetry }

// Repeat for all runs in batch
```

**Data transformation:**
```
Worker API Format (camelCase)     Mint Format (snake_case)
────────────────────────────     ────────────────────────
runId                        →   run_id
totalScore                   →   overall_score
specialistEnabled            →   specialist_enabled
tokensIn/tokensOut           →   token_usage.prompt_tokens
durationMs                   →   duration_ms
```

#### 3. **Snapshot Creation** (1s)
```
┌─────────────────────────────────────┐
│ Combine Template + Benchmarks       │
├─────────────────────────────────────┤
│ • Merge template with benchmark data │
│ • Calculate comparison metrics       │
│ • Create test_suites section         │
│ • Add snapshot metadata              │
└─────────────────────────────────────┘
```

**Snapshot structure:**
```json5
{
  // Everything from template
  name: "@org/my-specialist",
  version: "1.0.0",
  persona: { ... },

  // NEW: Benchmark results
  benchmarks: {
    test_suites: [
      {
        name: "nx-pnpm-monorepo",
        path: "update-deps/nx-pnpm-monorepo",
        type: "functional"
      }
    ],
    runs: [
      {
        run_id: "run_123_abc",
        suite: "update-deps",
        scenario: "nx-pnpm-monorepo",
        tier: "L1",
        agent: "anthropic",
        overall_score: 0.85,
        specialist_enabled: true,
        evaluations: { ... },
        telemetry: { ... }
      }
    ],
    comparison: {
      baseline_avg_score: 0.65,
      specialist_avg_score: 0.85,
      improvement: 0.20,
      improvement_pct: 30.77
    }
  },

  // NEW: Snapshot metadata
  snapshot_metadata: {
    created_at: "2025-01-18T12:00:00Z",
    minted_by: "@ze/specialist-mint CLI",
    template_version: "1.0.0"
  }
}
```

#### 4. **Comparison Calculation**
```
┌─────────────────────────────────────┐
│ Calculate Performance Improvements   │
├─────────────────────────────────────┤
│ • Separate baseline vs specialist    │
│ • Calculate average scores           │
│ • Compute improvement metrics        │
│ • Per-model comparisons              │
└─────────────────────────────────────┘
```

**Logic:**
```typescript
// Separate runs
const baselineRuns = runs.filter(r => !r.specialist_enabled);
const specialistRuns = runs.filter(r => r.specialist_enabled);

// Calculate averages
const baselineAvg = average(baselineRuns.map(r => r.overall_score));
const specialistAvg = average(specialistRuns.map(r => r.overall_score));

// Improvement
const improvement = specialistAvg - baselineAvg;
const improvementPct = (improvement / baselineAvg) * 100;
```

#### 5. **Schema Validation** (1s)
```
┌─────────────────────────────────────┐
│ Validate Snapshot Schema             │
├─────────────────────────────────────┤
│ • Load snapshot.schema.json5         │
│ • Validate against JSON Schema       │
│ • Check required fields              │
│ • Verify data types                  │
└─────────────────────────────────────┘
```

**Validation checks:**
- All required fields present
- Correct data types
- Valid enum values
- Array items valid
- Nested object structure correct

#### 6. **Output Path Determination** (1s)
```
┌─────────────────────────────────────┐
│ Determine Output Path                │
├─────────────────────────────────────┤
│ • Parse specialist name              │
│ • Create version directory           │
│ • Auto-increment snapshot ID         │
│ • Generate final path                │
└─────────────────────────────────────┘
```

**Path structure:**
```
{output}/
└── {name-without-scope}/
    └── {version}/
        ├── snapshot-001.json5  ← First snapshot
        ├── snapshot-002.json5  ← Second snapshot
        └── snapshot-003.json5  ← Third snapshot

Example:
snapshots/
└── my-specialist/
    └── 1.0.0/
        └── snapshot-001.json5
```

**Auto-increment logic:**
```typescript
// Find existing snapshots
const existing = glob('snapshot-*.json5');
// → ['snapshot-001.json5', 'snapshot-002.json5']

// Get max ID
const maxId = Math.max(...existing.map(extractId));
// → 2

// Next ID
const nextId = String(maxId + 1).padStart(3, '0');
// → '003'
```

#### 7. **Write to Disk** (1s)
```
┌─────────────────────────────────────┐
│ Write Snapshot File                  │
├─────────────────────────────────────┤
│ • Create directories if needed       │
│ • Format as JSON5                    │
│ • Write to file                      │
│ • Display success message            │
└─────────────────────────────────────┘
```

**Output:**
```
✓ Snapshot minted successfully!
   Snapshot ID: 003
   Output path: snapshots/my-specialist/1.0.0/snapshot-003.json5
   Template version: 1.0.0
```

---

## The Enrichment Process

### What `enrich:template` Does

Enrichment uses LLMs to automatically generate metadata for documentation links:

```bash
pnpm mint:enrich <template>
```

### Step-by-Step Execution

#### 1. **Template Loading** (1s)
```
┌─────────────────────────────────────┐
│ Load Original Template               │
├─────────────────────────────────────┤
│ • Read template.json5                │
│ • Validate structure                 │
│ • Extract documentation list         │
│ • Check if already enriched          │
└─────────────────────────────────────┘
```

#### 2. **Documentation Fetching** (Parallel, 2-10s)
```
┌─────────────────────────────────────┐
│ Fetch Documentation Content          │
├─────────────────────────────────────┤
│ • For each doc in template:          │
│   - Fetch from URL or file           │
│   - Extract text content             │
│   - Truncate if too long             │
│   - Store for enrichment             │
└─────────────────────────────────────┘
```

**Supported sources:**
- `https://` URLs → Fetch with HTTP client
- `file://` paths → Read from file system
- Local paths → Read relative to template

**Example:**
```json5
{
  documentation: [
    {
      source: "https://ui.shadcn.com/docs",
      type: "web"
    },
    {
      source: "file:///path/to/local/docs.md",
      type: "file"
    }
  ]
}
```

#### 3. **LLM Enrichment** (Parallel, 10-30s per doc)
```
┌─────────────────────────────────────┐
│ Generate Metadata with LLM           │
├─────────────────────────────────────┤
│ • For each document:                 │
│   - Build enrichment prompt          │
│   - Call LLM with document content   │
│   - Parse structured response        │
│   - Attach to documentation          │
└─────────────────────────────────────┘
```

**Enrichment prompt:**
```
Analyze this documentation and extract metadata:

DOCUMENTATION:
---
{document_content}
---

Provide a JSON response with:
{
  "summary": "Brief 1-2 sentence summary",
  "key_concepts": ["concept1", "concept2", ...],
  "use_cases": ["use_case1", ...],
  "relevance_to_specialist": "How this helps the specialist"
}
```

**LLM providers supported:**
- OpenRouter (default): `anthropic/claude-3.5-haiku`
- Anthropic Direct: `claude-3-5-haiku-20241022`

**Concurrency:** Up to 3 documents enriched simultaneously

#### 4. **Metadata Attachment** (1s)
```
┌─────────────────────────────────────┐
│ Attach Generated Metadata            │
├─────────────────────────────────────┤
│ • Merge metadata into each doc       │
│ • Preserve original structure        │
│ • Add enrichment timestamp           │
│ • Track which docs were enriched     │
└─────────────────────────────────────┘
```

**Before enrichment:**
```json5
{
  source: "https://ui.shadcn.com/docs",
  type: "web"
}
```

**After enrichment:**
```json5
{
  source: "https://ui.shadcn.com/docs",
  type: "web",
  enrichment: {
    summary: "shadcn/ui is a collection of re-usable components...",
    key_concepts: ["React components", "Tailwind CSS", "Radix UI"],
    use_cases: ["Building UIs", "Component libraries"],
    relevance_to_specialist: "Provides reference for component patterns",
    enriched_at: "2025-01-18T12:00:00Z",
    model_used: "anthropic/claude-3.5-haiku"
  }
}
```

#### 5. **Enriched Template Creation** (1s)
```
┌─────────────────────────────────────┐
│ Create Enriched Template File        │
├─────────────────────────────────────┤
│ • Determine output path              │
│ • Auto-increment enriched ID         │
│ • Write enriched template            │
│ • Display summary                    │
└─────────────────────────────────────┘
```

**Output path:**
```
{template-dir}/
└── enriched/
    └── {version}/
        ├── enriched-001.json5  ← First enrichment
        ├── enriched-002.json5  ← Second enrichment
        └── enriched-003.json5  ← Third enrichment

Example:
templates/my-specialist/
├── my-specialist.json5          ← Original
└── enriched/
    └── 1.0.0/
        └── enriched-001.json5   ← Enriched version
```

**Output:**
```
✅ Template enrichment completed!
   Enriched template: templates/my-specialist/enriched/1.0.0/enriched-001.json5
   Documents enriched: 3
   Documents skipped: 0
```

---

## Complete Workflows

### Workflow 1: Integrated (Benchmark + Mint)

**Single command workflow:**

```bash
# Terminal 1: Start Worker
pnpm worker:dev

# Terminal 2: Run everything
pnpm bench update-deps nx-pnpm-monorepo \
  --tier L1 \
  --agent anthropic \
  --iterations 3 \
  --mint-template templates/my-specialist.json5 \
  --mint-output ./snapshots
```

**Timeline:**
```
0:00  ┌─ Start benchmark execution
      │
0:05  ├─ Iteration 1/3
0:50  │  └─ Complete (score: 0.85)
      │
0:51  ├─ Iteration 2/3
1:35  │  └─ Complete (score: 0.87)
      │
1:36  ├─ Iteration 3/3
2:20  │  └─ Complete (score: 0.84)
      │
2:21  ├─ All iterations complete
      │  Batch ID: batch_1234567890
      │
2:22  ├─ Start minting snapshot
2:23  │  ├─ Load template
2:24  │  ├─ Fetch benchmark results from Worker
2:25  │  ├─ Create snapshot
2:26  │  └─ Write to disk
      │
2:27  └─ Complete!
         Snapshot: snapshots/my-specialist/1.0.0/snapshot-001.json5
```

### Workflow 2: Manual (Separate Steps)

**Multi-step workflow:**

```bash
# Terminal 1: Start Worker
pnpm worker:dev

# Terminal 2: Step 1 - Enrich template (optional)
pnpm mint:enrich templates/my-specialist.json5
# Output: templates/my-specialist/enriched/1.0.0/enriched-001.json5

# Step 2: Run benchmarks
pnpm bench update-deps nx-pnpm-monorepo \
  --tier L1 \
  --agent anthropic \
  --batch-id my_custom_batch \
  --iterations 3

# Step 3: View results
pnpm bench --batch-details my_custom_batch

# Step 4: Mint snapshot
pnpm mint:snapshot \
  templates/my-specialist/enriched/1.0.0/enriched-001.json5 \
  --batch-id my_custom_batch \
  --output ./snapshots
```

**Timeline:**
```
0:00  ┌─ Enrich template
      │  ├─ Fetch 3 documentation sources
      │  ├─ Call LLM for metadata (parallel)
      │  └─ Write enriched template
0:25  │  Complete!
      │
0:26  ├─ Run benchmarks (3 iterations)
2:30  │  Complete! Batch: my_custom_batch
      │
2:31  ├─ View batch details (optional)
      │  • 3 runs, all successful
      │  • Average score: 0.853
      │
2:32  ├─ Mint snapshot
2:35  │  Complete!
      │
2:36  └─ Done!
```

### Workflow 3: Comparison (Baseline vs Specialist)

**Testing if specialist improves performance:**

```bash
# Step 1: Run baseline (without specialist)
pnpm bench update-deps nx-pnpm-monorepo \
  --tier L1 \
  --agent anthropic \
  --batch-id comparison_batch \
  --iterations 3

# Step 2: Run with specialist
pnpm bench update-deps nx-pnpm-monorepo \
  --tier L1 \
  --specialist @org/my-specialist \
  --batch-id comparison_batch \
  --iterations 3

# Step 3: Mint snapshot (includes comparison)
pnpm mint:snapshot templates/my-specialist.json5 \
  --batch-id comparison_batch \
  --output ./snapshots
```

**Snapshot includes comparison:**
```json5
{
  benchmarks: {
    comparison: {
      baseline_avg_score: 0.65,    // 3 runs without specialist
      specialist_avg_score: 0.85,  // 3 runs with specialist
      improvement: 0.20,           // +20 points
      improvement_pct: 30.77,      // +30.77% improvement
      models_compared: [
        {
          model: "claude-3-5-sonnet-20241022",
          baseline_score: 0.65,
          specialist_score: 0.85,
          improvement: 0.20
        }
      ]
    }
  }
}
```

---

## Data Flow Diagrams

### Benchmark Flow

```
┌─────────┐
│  Start  │
└────┬────┘
     │
     ▼
┌─────────────────────┐
│ Parse CLI Arguments │
│ • suite, scenario   │
│ • tier, agent       │
│ • iterations, etc.  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Load Configuration  │
│ • .env variables    │
│ • scenario.yaml     │
│ • oracle-answers    │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Execute Warmup?     │◄─────────── Optional
│ • Verify baseline   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Iteration Loop      │
│ for i in 1..N       │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Prepare Workspace   │
│ • Copy repo-fixture │
│ • Set permissions   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Initialize Agent    │
│ • Load adapter      │
│ • Set up tools      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Execute Agent       │
│ • Send prompt       │
│ • Agent modifies    │
│ • Track telemetry   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Run Validation      │
│ • Execute commands  │
│ • Check exit codes  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Run Evaluators      │
│ • Build, Lint, etc. │
│ • Calculate scores  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Store Results       │
│ • POST to Worker    │
│ • Update batch      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Display Results     │
│ • Show scores       │
│ • Show telemetry    │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ More iterations?    │
└────┬────────────────┘
     │ No
     ▼
┌─────────────────────┐
│ Mint Snapshot?      │◄─────────── If --mint-template
└────┬────────────────┘
     │ Yes
     ▼
┌─────────────────────┐
│ Mint Snapshot       │
│ (see Mint Flow)     │
└────┬────────────────┘
     │
     ▼
┌─────────┐
│  Done!  │
└─────────┘
```

### Mint Flow

```
┌─────────┐
│  Start  │
└────┬────┘
     │
     ▼
┌─────────────────────┐
│ Load Template       │
│ • Find enriched ver │
│ • Validate schema   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Connect to Worker   │
│ • Health check      │
│ • Initialize client │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Fetch Batch Details │
│ GET /api/batches/   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Fetch Run Details   │
│ GET /api/runs/      │
│ (for each run)      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Transform Data      │
│ • Map camelCase     │
│ • Convert types     │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Create Snapshot     │
│ • Merge template    │
│ • Add benchmarks    │
│ • Calculate metrics │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Validate Snapshot   │
│ • Check schema      │
│ • Verify structure  │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Determine Path      │
│ • Auto-increment ID │
│ • Create dirs       │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Write to Disk       │
│ • Format JSON5      │
│ • Save file         │
└────┬────────────────┘
     │
     ▼
┌─────────┐
│  Done!  │
└─────────┘
```

### Enrichment Flow

```
┌─────────┐
│  Start  │
└────┬────┘
     │
     ▼
┌─────────────────────┐
│ Load Template       │
│ • Read JSON5        │
│ • Extract docs      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Initialize LLM      │
│ • OpenRouter client │
│ • Set model         │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ For each document   │
│ (parallel, max 3)   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Fetch Document      │
│ • HTTP or file      │
│ • Extract text      │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Build Prompt        │
│ • Add instructions  │
│ • Include content   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Call LLM            │
│ • Send prompt       │
│ • Wait for response │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Parse Response      │
│ • Extract JSON      │
│ • Validate format   │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ Attach Metadata     │
│ • Merge into doc    │
│ • Add timestamp     │
└────┬────────────────┘
     │
     ▼
┌─────────────────────┐
│ All docs done?      │
└────┬────────────────┘
     │ Yes
     ▼
┌─────────────────────┐
│ Create Enriched     │
│ • Increment ID      │
│ • Write file        │
└────┬────────────────┘
     │
     ▼
┌─────────┐
│  Done!  │
└─────────┘
```

---

## Summary

### Key Takeaways

1. **Benchmarking** evaluates AI agents on real coding tasks
2. **Minting** creates versioned snapshots with benchmark proof
3. **Enrichment** uses LLMs to generate documentation metadata
4. **Integration** allows one-command workflow from bench to snapshot
5. **Iterations** provide statistical confidence through repeated runs

### Performance Metrics

| Step | Duration | Parallelizable |
|------|----------|----------------|
| Template loading | 1s | No |
| Benchmark warmup | 10-30s | No |
| Workspace prep | 2-5s | No |
| Agent execution | 30s-5min | Per iteration |
| Validation | 5-30s | No |
| Evaluation | 10-60s | Per evaluator |
| Results storage | 1-2s | No |
| Minting | 5-10s | No |
| Enrichment | 10-30s | Per document |

### Cost Estimates

**Benchmark run:**
- Tokens: ~15,000 input + ~2,500 output
- Cost: ~$0.02 per run (Claude 3.5 Sonnet)

**Enrichment:**
- Tokens: ~5,000 input + ~500 output per doc
- Cost: ~$0.005 per doc (Claude 3.5 Haiku)

### Best Practices

1. **Use iterations** for important benchmarks (3-5 runs)
2. **Enrich templates** before minting for better metadata
3. **Run baseline + specialist** to prove improvement
4. **Use batch IDs** to group related runs
5. **Keep Worker running** during active development

---

**Last Updated:** January 18, 2025
**Version:** 2.0.0
