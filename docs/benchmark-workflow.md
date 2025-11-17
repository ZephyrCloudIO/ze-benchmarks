# Benchmark Workflow

This document describes the end-to-end workflow for creating, enriching, executing, and snapshotting benchmarks in the ZE Benchmarks system.

## Overview

```
Template → Enriched Template → Execute Benchmarks → Combine Results → Snapshot Version
```

## Workflow Stages

### 1. Template Creation

The initial benchmark template defines the base structure and requirements for a benchmark scenario.

**Components:**
- **Suite**: Top-level category (e.g., `shadcn-generate-vite`)
- **Scenario**: Specific task within the suite (e.g., `generate-landing-page`)
- **Scenario YAML**: Defines the benchmark configuration
  - Task description
  - Success criteria
  - Tiers (difficulty levels)
  - Evaluators
  - Workspace setup

**Example Template Structure:**
```
suites/
  └── my-suite/
      └── scenarios/
          └── my-scenario/
              ├── scenario.yaml
              ├── instructions.md
              └── workspace/
                  └── (initial files)
```

**Creating a New Template:**
```bash
pnpm bench --new-suite <suite-name>
pnpm bench --new-scenario <suite-name> <scenario-name>
```

---

### 2. Template Enrichment

Enrichment enhances the base template with additional context, constraints, and specialized instructions.

**Enrichment Types:**

#### Agent-Specific Enrichment
- Custom prompts per agent type
- Model-specific instructions
- Agent capability considerations

#### Tier-Based Enrichment
- **Tier 1 (Easy)**: Full context, detailed instructions, hints
- **Tier 2 (Medium)**: Moderate guidance, some hints
- **Tier 3 (Hard)**: Minimal guidance, agent must infer requirements

#### Specialist Enrichment
- Domain-specific knowledge injection
- Framework-specific best practices
- Security considerations
- Performance optimization guidelines

**Enrichment Process:**
1. Load base template from `scenario.yaml`
2. Apply tier-specific modifications
3. Inject specialist context (if specified)
4. Generate enriched prompt for agent
5. Prepare workspace with appropriate files

**Enrichment Example:**
```yaml
# scenario.yaml
tiers:
  tier1:
    description: "Guided implementation with examples"
    specialist: "react-developer"
    context: |
      You are building a React component with shadcn/ui.
      Reference examples are provided in /examples.

  tier3:
    description: "Minimal guidance - infer from requirements"
    specialist: null
    context: |
      Implement the feature described in requirements.md
```

---

### 3. Benchmark Execution

Execute benchmarks against AI agents with the enriched templates.

**Execution Modes:**

#### Single Benchmark
```bash
pnpm bench <suite> <scenario> <tier> <agent> --model <model>
```

#### Batch Execution
```bash
# Interactive mode - select multiple combinations
pnpm bench

# Multiple agents, tiers, scenarios
pnpm bench <suite> <scenario> tier1,tier2,tier3 anthropic,openrouter
```

#### Parallel Execution
- Automatically enabled for 3+ benchmarks
- Configurable concurrency (2-8 parallel runs)
- Smart concurrency scaling based on batch size

**Execution Flow:**
1. **Warmup Phase**: Initialize workspace and control state
2. **Agent Initialization**: Start agent with enriched prompt
3. **Task Execution**: Agent attempts to complete the benchmark
4. **Evaluation**: Run evaluators to score the result
5. **Logging**: Store results in database via worker API

**During Execution:**
- Real-time progress tracking
- Telemetry collection (tokens, tool calls, cost)
- Error handling and retry logic
- Timeout management

---

### 4. Results Combination

Aggregate and analyze results from multiple benchmark runs.

**Result Components:**

#### Run-Level Results
```typescript
{
  runId: string,
  batchId: string,
  suite: string,
  scenario: string,
  tier: string,
  agent: string,
  model?: string,
  totalScore: number,
  weightedScore: number,
  isSuccessful: boolean,
  evaluations: EvaluationResult[],
  telemetry: RunTelemetry
}
```

#### Batch-Level Aggregation
```typescript
{
  batchId: string,
  totalRuns: number,
  successfulRuns: number,
  avgWeightedScore: number,
  duration: number,
  suiteBreakdown: [...],
  agentBreakdown: [...],
  tierBreakdown: [...]
}
```

**Combination Methods:**

1. **Suite Statistics**: Performance across all scenarios in a suite
2. **Agent Performance**: Compare agents across benchmarks
3. **Tier Analysis**: Difficulty progression and success rates
4. **Model Comparison**: Compare different models for same agent
5. **Historical Trends**: Track performance over time

**Viewing Combined Results:**
```bash
# Batch summary
pnpm bench --batches

# Detailed batch analytics
pnpm bench --batch-details <batch-id>

# Compare multiple batches
pnpm bench --compare-batches <batch-id-1> <batch-id-2> <batch-id-3>
```

---

### 5. Snapshot Creation

Create immutable snapshots of benchmark results for comparison and regression testing.

**Snapshot Purpose:**
- **Version Comparison**: Compare agent versions (e.g., GPT-4 vs GPT-4 Turbo)
- **Regression Testing**: Ensure new changes don't degrade performance
- **Historical Archive**: Preserve results for long-term analysis
- **Reproducibility**: Document exact conditions and results

**Snapshot Components:**

#### 1. Metadata
```json
{
  "snapshotId": "snapshot-2024-01-15-gpt4-baseline",
  "createdAt": "2024-01-15T10:30:00Z",
  "description": "GPT-4 baseline across all benchmarks",
  "environment": {
    "agent": "openrouter",
    "model": "openai/gpt-4-turbo",
    "harness_version": "1.0.0"
  }
}
```

#### 2. Results Archive
- All run details
- Evaluation scores
- Telemetry data
- Workspace artifacts (optional)

#### 3. Summary Statistics
```json
{
  "totalRuns": 45,
  "successRate": 0.867,
  "avgWeightedScore": 8.42,
  "suiteBreakdown": [...],
  "tierBreakdown": [...]
}
```

**Creating Snapshots:**

```bash
# Create snapshot from batch
pnpm bench --create-snapshot <batch-id> --name "gpt4-baseline" --description "GPT-4 baseline results"

# Create snapshot from multiple batches
pnpm bench --create-snapshot <batch-id-1> <batch-id-2> --name "multi-agent-comparison"

# Compare snapshots
pnpm bench --compare-snapshots <snapshot-1> <snapshot-2>
```

**Snapshot Storage:**
```
snapshots/
  └── snapshot-2024-01-15-gpt4-baseline/
      ├── metadata.json
      ├── results.json
      ├── summary.json
      └── artifacts/
          └── (workspace snapshots)
```

**Snapshot Comparison:**
- Side-by-side score comparison
- Regression detection
- Performance delta calculation
- Statistical significance testing

---

## Complete Example

### End-to-End Workflow

```bash
# 1. Create Template
pnpm bench --new-suite "ui-generation"
pnpm bench --new-scenario "ui-generation" "create-dashboard"

# 2. Configure scenario.yaml with tiers and specialists
# Edit: suites/ui-generation/scenarios/create-dashboard/scenario.yaml

# 3. Execute Benchmarks
pnpm bench ui-generation create-dashboard tier1,tier2,tier3 anthropic,openrouter \
  --model "anthropic/claude-3.5-sonnet,openai/gpt-4-turbo"

# 4. View Combined Results
pnpm bench --batches
BATCH_ID=$(pnpm bench --batches | grep -oP 'batch-\d+-\w+' | head -1)

# 5. Create Snapshot
pnpm bench --create-snapshot $BATCH_ID \
  --name "ui-generation-baseline-2024-01" \
  --description "Initial baseline for UI generation benchmarks"

# 6. Compare with Previous Snapshot
pnpm bench --compare-snapshots \
  ui-generation-baseline-2024-01 \
  ui-generation-baseline-2023-12
```

---

## Best Practices

### Template Design
- Keep base templates generic and reusable
- Use tiers to provide appropriate difficulty levels
- Include clear success criteria
- Provide comprehensive test coverage

### Enrichment Strategy
- Use specialists for domain-specific knowledge
- Balance guidance vs. difficulty in tiers
- Include relevant examples in lower tiers
- Test enrichment prompts manually first

### Execution Planning
- Run warmup separately first to verify setup
- Use batch execution for consistent comparisons
- Monitor costs with parallel execution
- Set appropriate timeouts for complex tasks

### Results Management
- Create snapshots after significant runs
- Document environment and configuration
- Compare snapshots regularly for regressions
- Archive old results but keep summaries

### Snapshot Governance
- Use semantic naming: `<suite>-<agent>-<version>-<date>`
- Include detailed descriptions
- Tag snapshots with versions
- Clean up outdated snapshots periodically

---

## Troubleshooting

### Template Issues
- Verify `scenario.yaml` syntax with YAML validator
- Test workspace setup with `--warmup-only` flag
- Check evaluator dependencies are installed

### Enrichment Problems
- Review specialist definitions in config
- Validate tier-specific context is applied
- Test enriched prompts with single runs first

### Execution Failures
- Check worker is running: `pnpm --filter worker dev`
- Verify environment variables in `.env`
- Review agent API credentials
- Check timeout settings for long-running tasks

### Results Inconsistencies
- Ensure consistent environment across runs
- Use same model versions for comparisons
- Account for non-deterministic agent behavior
- Run multiple iterations for statistical validity

### Snapshot Errors
- Verify batch ID exists before snapshotting
- Check disk space for large snapshots
- Ensure proper permissions on snapshot directory

---

## API Reference

### Batch Management
```typescript
// Start a new batch
const batchId = await logger.startBatch();

// Complete a batch
await logger.completeBatch(batchId, {
  totalRuns: number,
  successfulRuns: number,
  avgScore: number,
  avgWeightedScore: number
});

// Get batch details
const batch = await logger.getBatchDetails(batchId);

// Get batch analytics
const analytics = await logger.getBatchAnalytics(batchId);
```

### Snapshot Management
```typescript
// Create snapshot
await createSnapshot({
  batchIds: string[],
  name: string,
  description: string,
  includeArtifacts: boolean
});

// Load snapshot
const snapshot = await loadSnapshot(snapshotId);

// Compare snapshots
const comparison = await compareSnapshots(snapshotId1, snapshotId2);
```

---

## Future Enhancements

- [ ] Automated snapshot creation on successful batches
- [ ] Snapshot versioning and tagging
- [ ] Web UI for snapshot comparison
- [ ] Automated regression detection
- [ ] Snapshot-based CI/CD integration
- [ ] Distributed execution across multiple workers
- [ ] Real-time streaming of benchmark results
- [ ] Machine learning for enrichment optimization