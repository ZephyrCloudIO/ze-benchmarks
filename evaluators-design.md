# Ze-Benchmarks Evaluators Design

## Overview

Evaluators are the core assessment engine of the ze-benchmarks framework. They automatically score agent performance across multiple dimensions, providing objective metrics for comparing different AI coding agents. This design implements the full scoring rubric from the PRD, including tier-specific bonuses, package manager validation, companion alignment checking, and efficiency tracking.

## Architecture

### Current Structure (October 2025)
```
packages/
├── evaluators/
│   ├── src/
│   │   ├── index.ts               # registry + runEvaluators
│   │   ├── types.ts               # shared evaluator types
│   │   ├── evaluators/
│   │   │   ├── install.ts
│   │   │   ├── test.ts
│   │   │   ├── package-manager.ts
│   │   │   ├── dependency-targets.ts
│   │   │   └── integrity-guard.ts
│   │   └── utils/
│   │       ├── package-json.ts
│   │       └── semver.ts
├── harness/
│   ├── src/
│   │   ├── cli.ts                 # orchestrates runs + scoring
│   │   ├── runtime/
│   │   │   ├── diff.ts            # builds diff/dependency artifacts
│   │   │   └── validation.ts      # runs install/test commands
│   │   └── types/
│   │       └── ze-evaluator.d.ts  # harness-side evaluator definitions
└── results/
    └── summary.json               # last run output (single artifact)
```

### Roadmap Structure (Planned)
```
packages/evaluators/
├── src/
│   ├── index.ts
│   ├── base/
│   │   ├── evaluator.ts
│   │   └── metrics.ts
│   ├── code/
│   │   ├── syntax.ts
│   │   ├── tests.ts
│   │   └── deps.ts
│   ├── process/
│   │   ├── commands.ts
│   │   └── workflow.ts
│   └── output/
│       ├── diff.ts
│       └── logs.ts
├── fixtures/
└── scripts/
```

## Core Concepts

### 1. Evaluator Interface

```typescript
type ScoreCard = Record<string, number>;

interface Evaluator {
  meta: { name: string };
  evaluate(context: EvaluationContext): Promise<EvaluatorResult>;
}

interface EvaluationContext {
  scenario: ScenarioConfig;
  workspaceDir: string;
  agentResponse?: string;
  diffSummary?: FileDiff[];
  depsDelta?: DepChange[];
  commandLog?: ExecutedCommand[];
}

interface EvaluationResult {
  name: string;
  score: number;        // 0-1 normalized score
  details?: string;     // Human-readable explanation
}
```

### 2. Evaluation Categories

The baseline implementation produces a deterministic score card with the following metrics:

| Metric key              | Source evaluator                  | What it measures                                              |
| ----------------------- | --------------------------------- | ------------------------------------------------------------- |
| `install_success`       | `InstallEvaluator`                | Exit status from the scenario's install command.              |
| `tests_nonregression`   | `TestEvaluator`                   | Exit status from the configured test command.                 |
| `manager_correctness`   | `PackageManagerEvaluator`         | Presence of the expected package-manager artifacts (e.g. pnpm). |
| `dependency_targets`    | `DependencyTargetsEvaluator`      | Adherence to required dependency ranges defined in the scenario. |
| `integrity_guard`       | `IntegrityGuardEvaluator`         | Safeguards against integrity regressions (e.g. skipped tests, relaxed lint). |

Each metric returns a normalized value in `[0, 1]` and is combined into a weighted total (see below). Additional categories such as build success, lint/type safety, semantic quality, or agent efficiency remain on the roadmap and are documented later in this file.

### 3. Scoring System

```typescript
weighted = clamp0to10(
  Σ(metricScore × metricWeight) / Σ(metricWeight) × 10
)

const baseWeights = {
  install_success: 1.5,
  tests_nonregression: 2.5,
  manager_correctness: 1.0,
  dependency_targets: 2.0,
  integrity_guard: 1.5,
};

// Scenario YAML may override any subset via rubric_overrides.weights
```

The harness calls `computeWeightedTotals`, which applies the base weights (or scenario overrides) and rescales the achieved fraction to a 0–10 score. Tier multipliers, confidence weighting, and failure-mode caps are **not** implemented yet; they remain part of the longer-term roadmap captured later in this document.

## Implementation Strategy

### Phase 1: Deterministic Baseline (✅ Shipped)
- `Evaluator` interface, shared types, and registry (`packages/evaluators/src/index.ts`).
- Diff and dependency delta capture (`packages/harness/src/runtime/diff.ts`).
- Command log capture for install/test/lint/typecheck (`runtime/validation.ts`).
- Implemented evaluators: `InstallEvaluator`, `TestEvaluator`, `PackageManagerEvaluator`, `DependencyTargetsEvaluator`, `IntegrityGuardEvaluator`.
- Weighted aggregation in the harness (`computeWeightedTotals`).

### Phase 2: Advanced Analysis (🚧 Planned)
- Additional deterministic checks: build/lint/typecheck evaluators, richer dependency insights.
- Companion alignment and namespace migration evaluators that consume diff artifacts.
- Enhanced diff/metrics tooling (JSON deltas, per-file stats) for downstream use.

### Phase 3: Intelligence Layer (🚧 Planned)
- Oracle comparisons and semantic verifiers for migration accuracy.
- Agent efficiency, strategy, and semantic-quality scoring (likely Mastra-backed).
- Confidence weighting, failure-mode caps, and tier multipliers.

## Integration Points

### 1. CLI Integration
```bash
npm install --legacy-peer-deps
npm -w packages/agent-adapters run build
npm -w packages/harness run build
node packages/harness/dist/cli.js run update-deps nx-pnpm-monorepo --tier L1 --agent echo
```

### 2. Result Structure
```json
{
  "suite": "update-deps",
  "scenario": "nx-pnpm-monorepo",
  "tier": "L1",
  "agent": "echo",
  "model": "default",
  "agent_response": "",
  "scores": {
    "install_success": 1,
    "tests_nonregression": 1,
    "manager_correctness": 1,
    "dependency_targets": 0.3333333333,
    "integrity_guard": 1
  },
  "totals": {
    "weighted": 8.0952,
    "max": 10
  },
  "telemetry": {
    "toolCalls": 0,
    "tokens": { "in": 0, "out": 0 },
    "cost_usd": 0,
    "workspaceDir": "results/workspaces/update-deps-nx-pnpm-monorepo-XXXXXX"
  },
  "evaluator_results": [
    { "name": "InstallEvaluator", "score": 1, "details": "Install succeeded" },
    { "name": "TestEvaluator", "score": 1, "details": "Tests passed (or none present)" }
  ],
  "diff_summary": [
    { "file": "pnpm-lock.yaml", "changeType": "added" }
  ],
  "deps_delta": []
}
```
The harness writes a single `results/summary.json` file per run; additional evaluator entries follow the same structure, and diff/dependency arrays may be large (often truncated when reporting).

### 3. Harness Integration
```typescript
const commandLog = runValidationCommands(workspaceDir, scenarioCfg.validation?.commands);
const diffArtifacts = buildDiffArtifacts(fixtureDir, workspaceDir);
const ctx = {
  scenario: scenarioCfg,
  workspaceDir,
  agentResponse: result.agent_response,
  commandLog,
  diffSummary: diffArtifacts.diffSummary,
  depsDelta: diffArtifacts.depsDelta,
};
const { scoreCard, results } = await runEvaluators(ctx);
result.scores = { ...result.scores, ...scoreCard };
result.totals = computeWeightedTotals(result.scores, scenarioCfg);
result.evaluator_results = results;
```

## Scenario-Specific Configuration

### Evaluator Overrides
```yaml
# suites/update-deps/scenarios/nx-pnpm-monorepo/scenario.yaml
rubric_overrides:
  weights:
    dependency_targets: 3
    integrity_guard: 2

targets:
  required:
    - name: nx
      to: "~20.0"
    - name: typescript
      to: ">=5.5 <6"

validation:
  commands:
    install: pnpm install --frozen-lockfile
    test: pnpm test
```
`rubric_overrides.weights` feeds directly into `computeWeightedTotals`, while `targets.required` powers the `DependencyTargetsEvaluator`. Additional configuration keys (e.g. agentic bundles, evaluator gating) remain aspirational and are tracked in the roadmap section.

### Oracle Answers
```json
// oracle-answers.json
{
  "expectedDependencies": {
    "@types/node": "^18.19.0",
    "@xterm/xterm": "^5.3.0"
  },
  "forbiddenDependencies": [
    "xterm"
  ],
  "requiredCommands": [
    "pnpm install",
    "pnpm test"
  ],
  "expectedFiles": [
    "package.json",
    "pnpm-lock.yaml"
  ]
}
```
The harness currently copies this file into the workspace but does not yet consume it in the evaluator pipeline; leveraging these oracle answers is part of the Phase 3 roadmap.

## Detailed Evaluator Specifications

### Implemented Baseline (2025)

#### InstallEvaluator
Ensures the install command recorded in the command log succeeded.

```typescript
class InstallEvaluator implements Evaluator {
  meta = { name: 'InstallEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    const entry = (ctx.commandLog || []).find((command) => command.type === 'install');
    if (!entry) {
      return { name: this.meta.name, score: 0, details: 'No install attempt recorded' };
    }
    const ok = entry.exitCode === 0;
    const details = ok ? 'Install succeeded' : `Install failed: exit=${entry.exitCode}`;
    return { name: this.meta.name, score: ok ? 1 : 0, details };
  }
}
```

#### TestEvaluator
Mirrors the install evaluator but for the scenario-provided test command.

```typescript
class TestEvaluator implements Evaluator {
  meta = { name: 'TestEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    const entry = (ctx.commandLog || []).find((command) => command.type === 'test');
    if (!entry) {
      return { name: this.meta.name, score: 0, details: 'No test run recorded' };
    }
    const ok = entry.exitCode === 0;
    const details = ok ? 'Tests passed (or none present)' : `Tests failed: exit=${entry.exitCode}`;
    return { name: this.meta.name, score: ok ? 1 : 0, details };
  }
}
```

#### PackageManagerEvaluator
Validates the presence of lockfiles that correspond to the allowed package manager list in the scenario constraints.

```typescript
import { existsSync } from 'node:fs';
import { join } from 'node:path';

class PackageManagerEvaluator implements Evaluator {
  meta = { name: 'PackageManagerEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    const allowed = ctx.scenario.constraints?.managers_allowed || [];
    const usedPnpm = existsSync(join(ctx.workspaceDir, 'pnpm-lock.yaml'));
    const ok = allowed.length === 0 || (allowed.includes('pnpm') ? usedPnpm : true);
    return {
      name: this.meta.name,
      score: ok ? 1 : 0,
      details: ok ? 'Correct manager artifacts' : 'Lockfile mismatch',
    };
  }
}
```

#### DependencyTargetsEvaluator
Checks dependency versions across the workspace against the `targets.required` block from the scenario.

```typescript
import { relative } from 'node:path';
import { getAllPackageJsonPaths, readJson } from '../utils/package-json.js';
import { versionSatisfies } from '../utils/semver.js';

class DependencyTargetsEvaluator implements Evaluator {
  meta = { name: 'DependencyTargetsEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    const targets = ctx.scenario.targets?.required || [];
    if (!targets.length) {
      return { name: this.meta.name, score: 1, details: 'No required targets' };
    }

    const pkgPaths = getAllPackageJsonPaths(ctx.workspaceDir);
    let total = 0;
    let ok = 0;
    const misses: string[] = [];

    for (const pkgPath of pkgPaths) {
      const rel = relative(ctx.workspaceDir, pkgPath) || '.';
      const pkg = readJson(pkgPath);

      for (const target of targets) {
        total++;
        const current = pkg.dependencies?.[target.name] ?? pkg.devDependencies?.[target.name];
        const pass = versionSatisfies(target.to, current);
        if (pass) {
          ok++;
        } else {
          misses.push(`${rel}:${target.name}@${current ?? 'missing'} !-> ${target.to}`);
        }
      }
    }

    const score = total ? ok / total : 1;
    return { name: this.meta.name, score, details: misses.join('; ') };
  }
}
```

#### IntegrityGuardEvaluator
Flags integrity regressions such as newly skipped tests or relaxed lint/type settings.

```typescript
class IntegrityGuardEvaluator implements Evaluator {
  meta = { name: 'IntegrityGuardEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    const findings: string[] = [];

    for (const diff of ctx.diffSummary || []) {
      if (
        diff.file.match(/\.eslintignore$/) &&
        diff.changeType === 'modified' &&
        /(^\+\s*\*|^\+\s*\*\*\/)/m.test(diff.textPatch || '')
      ) {
        findings.push('Widened .eslintignore');
      }

      if (
        diff.file.match(/tsconfig\.json$/) &&
        diff.textPatch?.match(/-\s*"skipLibCheck"\s*:\s*false[\s\S]*\+\s*"skipLibCheck"\s*:\s*true/)
      ) {
        findings.push('Relaxed tsconfig skipLibCheck');
      }

      if (diff.file.match(/\.(test|spec)\.[jt]sx?$/) && /\.skip\(/.test(diff.textPatch || '')) {
        findings.push('Introduced skipped tests');
      }
    }

    const score = Math.max(0, 1 - findings.length * 0.2);
    return { name: this.meta.name, score, details: findings.join('; ') || 'No integrity issues detected' };
  }
}
```

### Roadmap Evaluators
- **EfficiencyEvaluator**: Would score turn count, duration, and tier bonuses once telemetry wiring lands.
- **CompanionAlignmentEvaluator**: Pair companion packages (e.g., `@types/node` ↔ `node`).
- **NamespaceMigrationEvaluator**: Verify namespace migrations in both dependencies and code imports.
- **Diff/Security/Performance Evaluators**: Analyze diffs and external advisories for qualitative assessments.

## Testing Strategy

### Unit Tests
- Test each evaluator in isolation
- Mock workspace and agent responses
- Verify scoring logic

### Integration Tests
- End-to-end evaluation pipeline
- Real scenario execution
- Score consistency validation

### Validation Tests
- Compare against human expert scores
- Cross-validate different agents
- Measure evaluator reliability

> _Note_: The remainder of this document captures forward-looking plans that extend beyond the current deterministic baseline.

## Performance Considerations

### Execution Speed
- Run evaluators in parallel where possible
- Cache expensive operations (builds, installs)
- Timeout protection for long-running evaluations

### Resource Usage
- Sandbox evaluation environments
- Clean up temporary files
- Limit memory and CPU usage

### Scalability
- Support evaluation of multiple scenarios
- Batch processing capabilities
- Result aggregation and reporting

## Future Enhancements

### AI-Powered Evaluation
- Use LLMs for code quality assessment
- Semantic understanding of changes
- Natural language explanation generation

### Continuous Learning
- Learn from human feedback
- Adapt scoring based on outcomes
- Improve evaluator accuracy over time

### Advanced Metrics
- Code complexity analysis
- Maintainability scoring
- Technical debt assessment

## Hybrid Deterministic + Agentic (Mastra) Extension

### Rationale
Deterministic evaluators give repeatable, high-confidence signals (install/build/test pass, dependency rules, constraint adherence). Some success criteria in update scenarios (e.g. "upgrade strategy quality" and "semantic migration correctness") require semantic judgment. We introduce an optional agentic layer using Mastra AI to enrich scoring while preserving determinism for the baseline. Agentic evaluators do not re-check targets/constraints; they assess strategy and semantics only.

### Layers
1. Phase A (Deterministic Core – REQUIRED)
   - Runs: Install, Build, Test, Lint, PackageManager, DependencyTargets, NamespaceMigration, CompanionAlignment, Constraint checks.
   - Fail‑fast: If critical evaluators score < threshold (default 0.8) we skip agentic layer.
2. Phase B (Agentic Augmentation – OPTIONAL via `enable_agentic: true`)
   - Runs only if required set passes.
  - Mastra-backed evaluators: UpgradeStrategyEvaluator, SemanticCodeQualityEvaluator, MigrationSemanticEvaluator.
3. Phase C (Aggregation)
   - Confidence-weight fusion: deterministic results full weight; agentic weighted by (confidence * discountFactor).

### Mastra Integration Overview
Mastra (https://mastra.ai/) provides workflow orchestration + model abstraction. We consume it via a light wrapper so the harness remains provider-agnostic.

```typescript
// (Planned) packages/evaluators/src/agentic/mastraClient.ts
export interface MastraLLMClient {
  generateJSON(input: { prompt: string; schema: object; model?: string; temperature?: number }): Promise<any>;
}

// Adapter creation (dependency injected into evaluation context)
function createMastraClient(): MastraLLMClient | undefined {
  if (!process.env.MASTRA_API_KEY) return undefined;
  // Pseudo: use Mastra SDK
  // const client = new Mastra({ apiKey: process.env.MASTRA_API_KEY });
  return {
    async generateJSON({ prompt, schema, model = 'claude-3.5-sonnet', temperature = 0.1 }) {
      // pseudo-call to Mastra workflow
      return invokeMastraWorkflow({ prompt, schema, model, temperature });
    }
  };
}
```

### EvaluationContext Additions
```typescript
interface EvaluationContext {
  // ...existing
  llm?: MastraLLMClient;          // populated when agentic enabled
  diffSummary?: FileDiff[];       // produced once (git diff)
  telemetry?: { turnCount: number; responseTime: number; tier: string };
  commandLog?: ExecutedCommand[];
}
```

### Scenario Configuration Extensions
```yaml
evaluators:
  enable_agentic: true           # default: false
  bundle: dep-update             # optional preset (dep-update|migration|refactor)
  include:                       # explicit additions
    - UpgradeStrategyEvaluator
    - SemanticCodeQualityEvaluator
    - IntegrityGuardEvaluator
  exclude:                       # explicit removals
    - SecurityEvaluator
  gates:                         # declarative gating rules
    - requires:
        - InstallEvaluator
        - BuildEvaluator
        - TestEvaluator
      enable:
        - UpgradeStrategyEvaluator
        - SemanticCodeQualityEvaluator
        - MigrationSemanticEvaluator
  params:
    UpgradeStrategyEvaluator:
      maxMajorJump: 1
      model: claude-3.5-sonnet
      budgetUsd: 0.15
    SemanticCodeQualityEvaluator:
      model: claude-3.5-sonnet
      dimensions: [maintainability, readability, best_practices]
```

### Evaluator Metadata Extension
```typescript
interface EvaluatorMeta {
  name: string;
  category: Category;
  determinism: 'deterministic' | 'agentic';
  defaultWeight: number;
  requires?: string[];                 // hard dependency
  softRequires?: string[];             // ignored if missing, lowers confidence
  costEstimateUsd?: number;            // for agentic budgeting
  maxConcurrencyGroup?: string;        // to throttle similar LLM calls
}
```

### Selection + Gating Algorithm (Pseudo)
```typescript
function buildExecutionPlan(scenario: ScenarioConfig, registry: EvaluatorRegistry, ctx: EvaluationContext) {
  const settings = scenario.evaluators || {};
  let candidates = registry.list();
  if (!settings.enable_agentic) {
    candidates = candidates.filter(e => e.meta.determinism === 'deterministic');
  }
  if (settings.include?.length) {
    candidates = candidates.filter(e => settings.include!.includes(e.meta.name) || e.meta.determinism === 'deterministic');
  }
  if (settings.exclude?.length) {
    candidates = candidates.filter(e => !settings.exclude!.includes(e.meta.name));
  }
  // Build dependency graph; ensure ordering (topological sort)
  return topoSort(candidates);
}

async function executePlan(plan: Evaluator[], ctx: EvaluationContext, gates: GateConfig[]) {
  const results: Record<string, EvaluatorResult> = {};
  for (const ev of plan) {
    if (ev.meta.determinism === 'agentic' && !ctx.llm) {
      results[ev.meta.name] = skipped(ev, 'Agentic disabled');
      continue;
    }
    if (ev.meta.requires?.some(r => !passed(results[r]))) {
      results[ev.meta.name] = skipped(ev, 'Required evaluator failed');
      continue;
    }
    // Gate rules can dynamically enable
    if (isGateBlocked(ev, results, gates)) {
      results[ev.meta.name] = skipped(ev, 'Gate not satisfied');
      continue;
    }
    results[ev.meta.name] = await safeEval(ev, ctx);
  }
  return results;
}
```

### Agentic Evaluator Prompt Patterns
Prompts follow a structured JSON response contract to keep parsing deterministic.

1. Upgrade Strategy:
```
Evaluate dependency upgrade strategy.
SCENARIO TARGETS: <serialized targets>
DEPENDENCY CHANGES: <table old->new plus latest>
CONSTRAINTS: <constraints subset>
Return JSON {"strategyScore":0-1, "riskScore":0-1, "reasoning":"..."}
```
2. Semantic Code Quality:
```
Assess diff for maintainability, readability, best practices.
Return JSON {"maintainability":0-10, "readability":0-10, "bestPractices":0-10, "reasoning":"..."}
```
Note: We intentionally avoid an agentic "problem-solution" scorer because targets and constraints are validated deterministically. Agentic prompts focus on strategy and semantic quality.

### IntegrityGuardEvaluator (Deterministic)
Detects evasions that may superficially satisfy deterministics but violate intent.

Checks (examples):
- Tests: newly added `it.skip`/`describe.skip`, jest `--bail` misuse, reduced test suite counts
- Lint/TS: widened `.eslintignore`, disabled rules, `skipLibCheck` flips, downleveled tsconfig strictness
- Build: added `--force`/`--legacy-peer-deps` flags in PM commands
- CI: removed or commented workflow steps related to tests/lint/build

Scoring: subtract per finding with caps; produce actionable details.

Pseudo-implementation outline:
```typescript
class IntegrityGuardEvaluator implements Evaluator {
  meta = { name: 'IntegrityGuardEvaluator', category: 'process', determinism: 'deterministic', defaultWeight: 0.6 };
  async evaluate(ctx: EvaluationContext) {
    const findings: string[] = [];
    const diff = ctx.diffSummary || [];
    if (hasSkippedTests(diff)) findings.push('Introduced skipped tests');
    if (widenedEslintIgnore(diff)) findings.push('Widened .eslintignore');
    if (relaxedTsconfig(diff)) findings.push('Relaxed tsconfig checks');
    if (usedForceInstall(ctx.commandLog)) findings.push('Used force/legacy install flags');
    const score = Math.max(0, 1 - findings.length * 0.2);
    return { name: this.meta.name, score, confidence: 0.95, determinism: 'deterministic', details: findings.join('; ') || 'No integrity issues detected' };
  }
}
```

### Confidence & Cost Weighting
```typescript
const discountFactor = 0.85; // applied to agentic weight
weightedScore += result.score * result.confidence * (result.meta.determinism === 'agentic' ? discountFactor : 1) * categoryWeight;
```

### Budget Enforcement
```typescript
function enforceBudget(plan: Evaluator[], budgetUsd: number) {
  let running = 0;
  return plan.filter(ev => {
    const est = ev.meta.costEstimateUsd || 0;
    if (ev.meta.determinism === 'agentic') {
      if (running + est > budgetUsd) return false;
      running += est;
    }
    return true;
  });
}
```

### Implementation Phases (Extended)
| Phase | Deliverables | Notes |
|-------|--------------|-------|
| 1 | Base interfaces, deterministic evaluator set, diff capture | No Mastra dependency |
| 2 | Registry, selection, gating, CLI flags (`--evaluate`, `--evaluators`, `--agentic`) | Backwards compatible |
| 3 | Mastra client wrapper, agentic evaluator prototypes (upgrade strategy, semantic quality) | Feature flag via env |
| 4 | Confidence weighting, budget control, result schema v2 | Migrate summary JSON |
| 5 | Bundles + scenario schema validation + docs | DX polish |
| 6 | Regression suite; correlation calibration vs human labels | Adjust weights |

### CLI Additions
```
--evaluate                Run evaluators (deterministic only by default)
--agentic                 Enable agentic layer (requires MASTRA_API_KEY)
--evaluators a,b,c        Comma list include filter
--eval-report detailed    Produce extended JSON & markdown summary
--eval-budget 0.30        USD ceiling for agentic evaluators
```

### Result Schema Additions
```json
{
  "evaluation": {
    "method": "hybrid",
    "phases": {
      "deterministic": { "durationMs": 12000 },
      "agentic": { "durationMs": 45000, "llmCalls": 3, "costUsd": 0.11 }
    },
    "budget": { "limitUsd": 0.3, "usedUsd": 0.11, "remainingUsd": 0.19 },
    "deterministicScore": 0.91,
    "agenticScore": 0.78,
    "fusionScore": 0.84
  }
}
```

### Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| LLM nondeterminism | Low temperature, JSON schema coercion, retry w/ deterministic backoff |
| Cost creep | Budget filter + per-evaluator cost estimates |
| Latency | Parallelize agentic calls (respect grouping) + caching latest version lookups |
| Over-reliance on agentic | Confidence discount + deterministic gating |
| Scenario misconfiguration | JSON Schema validation + default safe fallback |

### Open Questions
1. Do we persist raw prompts/responses? (Suggestion: store if `EVAL_DEBUG=1`)
2. Do we allow cross-scenario caching of registry queries (npm latest)?
3. Should agentic evaluators produce suggested fixes? (Could be optional v2) 

### Next Steps (Actionable)
1. Implement base `EvaluatorMeta` + registry.
2. Port existing deterministic evaluator stubs into new structure.
3. Add diff + command capture to harness before agent execution finalizes.
4. Introduce `--evaluate` flag pipeline + JSON merge.
5. Add Mastra client adapter behind env guard.
6. Implement `UpgradeStrategyEvaluator` + `SemanticCodeQualityEvaluator` minimal versions.
7. Add confidence-weight fusion & result schema update.
8. Write calibration harness comparing human-labeled sample scenarios.
9. Document scenario schema extensions + examples.

## Design Finalization Addendum

This section locks in key design decisions to keep implementation consistent and focused.

### Evaluator Taxonomy
Alongside `determinism`, each evaluator declares a `verification` mode to guide orchestration and parallelism:
```typescript
type Verification = 'command' | 'file-analysis' | 'semantic' | 'registry-lookup';
interface EvaluatorMeta {
  verification: Verification; // e.g., command (runs shell), file-analysis (parses repo), semantic (LLM), registry-lookup (external IO)
  determinism: 'deterministic' | 'agentic';
  version: string;            // evaluator logic/prompt version
  compatibility?: string[];   // scenario schema versions supported
  // ...existing fields
}
```

Guidelines:
- `command` evaluators are serialized within a resource group (to avoid concurrent installs/builds), but can run in parallel with `file-analysis`.
- `semantic` evaluators are rate-limited and budgeted.
- `registry-lookup` shares a cached client with TTL to avoid redundant calls.

### Registry Intelligence (Design)
Provide a thin, cached abstraction for package registry access.
```typescript
interface RegistryClient {
  getLatestVersion(pkg: string): Promise<string>;
  getVersionHistory(pkg: string): Promise<{ version: string; date: string; }[]>;
  getDistTags(pkg: string): Promise<Record<string, string>>; // e.g., latest, next
  getAdvisories(pkg: string, version?: string): Promise<{ id: string; severity: 'low'|'moderate'|'high'|'critical'; }[]>;
}

interface RegistryCacheOptions { ttlMs: number; maxEntries: number; }
```
Policies:
- Ignore pre-release tags unless scenario opts in.
- Prefer stable `latest` unless constraints specify otherwise.
- Surface high/critical advisories as warnings.

### Confidence Calibration
Calibration will ensure scores correlate with human judgment.
- Keep agentic temperatures low (≤0.2) and enforce JSON schema.
- Use a labeled set of scenarios to calibrate per-evaluator confidence ranges.
- Maintain a mapping table: evaluator → expected confidence band (e.g., semantic quality: 0.6–0.8).
- Periodically re-check drift; version evaluators when prompts change.

### Error Handling & Graceful Degradation
- Build fails: mark functional category low; skip agentic layer; include actionable build logs excerpt.
- File unreadable: evaluator returns partial with `warnings`; do not crash pipeline.
- LLM unavailable: agentic evaluators return `skipped`; aggregate uses deterministic only.
- Large diffs: truncate to per-file cap (e.g., 2k lines/file) with elision markers.

### Performance & Concurrency Model
- Concurrency groups: `install/build` (1 at a time), `file-analysis` (N), `semantic` (M with rate limit), `registry-lookup` (K with cache).
- Avoid duplicate work: compute diff and command log once; share via context.
- Timeouts: per-evaluator ceiling with clear error messages.

### Evaluator Profiles
Scenarios can opt for a profile to control breadth/cost.
```yaml
evaluators:
  profile: balanced   # fast | balanced | thorough
```
Rules of thumb:
- fast: deterministic only; skip security/perf and all agentic.
- balanced: deterministic + 1–2 agentic (strategy, quality) with small budget.
- thorough: all selected evaluators; higher budget and longer timeouts.

### Result Schema Extensions
```json
{
  "evaluation": {
    "overall": { "score": 0.84, "confidence": 0.88, "reliability": "high" },
    "breakdown": {
      "deterministic": { "score": 0.91, "coverage": ["install","build","test","constraints"] },
      "agentic": { "score": 0.76, "coverage": ["strategy","semantic"], "costUsd": 0.12 }
    },
    "recommendations": [
      "Consider running Nx migration generator for @nrwl/js@18",
      "Tighten tsconfig noImplicitAny to restore prior strictness"
    ]
  }
}
```

### Baseline Comparison
Capture and expose before/after for evaluators that need it:
```typescript
interface BaselineData {
  packageJson: any;
  lockfileHash?: string;
  testSummary?: { passed: number; failed: number; skipped: number };
  buildSuccess?: boolean;
}
```
Deterministic evaluators can leverage baseline to detect regressions precisely.

### Versioning & Compatibility
Each evaluator carries a `version` and optional `compatibility` array. When prompts/logic change, bump `version` and include in results. Scenario schema versioning ensures safe application.

## Repository Diffing Without Git

We compute diffs by comparing the scenario baseline directory with the produced workspace directory—no Git required. This keeps evaluation deterministic and portable.

### Sources
- Baseline: `suites/<suite>/scenarios/<scenario>/(repo-fixture|repo)/` (prefer `repo-fixture`, auto-detect in that order)
- Candidate: `results/workspaces/<generated>/` (available as `telemetry.workspaceDir`)

### Ignore Defaults (configurable)
- `node_modules/**`, `**/.git/**`, `**/dist/**`, `**/.cache/**`, `**/coverage/**`, temporary files
- Scenario may extend/override via `evaluators.params.DirectoryDiff.ignores`

### Artifacts for Evaluators
- fileDiffs: compact per-file diffs and stats
- depsDelta: structured dependency changes across root and sub-packages
- migrationSignals: targeted findings for namespace/API migrations

```typescript
interface FileDiff {
  file: string;                     // relative path
  changeType: 'added'|'modified'|'deleted';
  isBinary: boolean;
  textPatch?: string;               // unified diff (capped)
  jsonDelta?: Record<string, any>;  // normalized key/value changes
  stats: { added: number; removed: number; sizeBefore?: number; sizeAfter?: number };
}

interface DepChange {
  packagePath: string;              // e.g., "." | "apps/app" | "libs/util"
  section: 'dependencies'|'devDependencies'|'peerDependencies';
  name: string;
  from?: string;                    // undefined means added
  to?: string;                      // undefined means removed
}

interface MigrationSignal {
  from: string;                     // e.g., "xterm"
  to: string;                       // e.g., "@xterm/xterm"
  occurrences: number;
  files: string[];                  // relative file paths
}
```

### Harness Pseudocode
```typescript
function buildDiffContext(scenario: ScenarioConfig, workspaceDir: string): {
  fileDiffs: FileDiff[];
  depsDelta: DepChange[];
  migrationSignals: MigrationSignal[];
} {
  const baselineDir = resolveBaselineDir(scenario); // repo-fixture or repo
  const pairs = enumeratePairs(baselineDir, workspaceDir, { ignore: DEFAULT_IGNORES });

  const fileDiffs: FileDiff[] = [];
  for (const p of pairs) {
    if (p.status === 'added') fileDiffs.push({ file: p.rel, changeType: 'added', ...summarizeFile(p.newPath) });
    else if (p.status === 'deleted') fileDiffs.push({ file: p.rel, changeType: 'deleted', ...summarizeFile(p.oldPath) });
    else if (p.status === 'modified') fileDiffs.push(diffFile(p.oldPath, p.newPath, p.rel));
  }

  const depsDelta = computeAllDepChanges(baselineDir, workspaceDir);
  const migrationSignals = scanNamespaceMigrations(fileDiffs, scenario.constraints?.namespace_migrations || []);

  return { fileDiffs, depsDelta, migrationSignals };
}
```

### Implementation Notes
- JSON/YAML: parse and emit key-wise deltas with stable key ordering to reduce noise.
- Text: produce unified patches with per-file and total caps; annotate truncation.
- Binary: no patch body—emit size/hash deltas.
- Lockfiles: do not inline; report hash-before/after and a summary (package counts) to avoid giant output.
- Monorepo: collect `package.json` under `apps/**` and `libs/**` for `depsDelta` with relative `packagePath`.
- Line endings/whitespace: normalize for diffing; optionally flag whitespace-only changes.

### Evaluator Wiring
- Compute diff once post-agent and attach to `EvaluationContext`:
  - `diffSummary?: FileDiff[]`
  - `depsDelta?: DepChange[]`
  - `migrationSignals?: MigrationSignal[]`
- Deterministic usage:
  - NamespaceMigrationEvaluator uses `migrationSignals` and `fileDiffs`.
  - IntegrityGuardEvaluator scans `fileDiffs` for test skips, widened ignores, tsconfig relaxations.
  - CompanionAlignmentEvaluator and targets read `depsDelta` and final package.json files.
- Agentic usage:
  - Provide small, relevant excerpts (capped patches and dependency tables) to prompts.

### Result Emission (Optional)
Emit compact stats into summary JSON for transparency without bloating files:
```json
{
  "evaluation": {
    "input": {
      "diffStats": { "added": 3, "modified": 7, "deleted": 0 },
      "depsDeltaCount": 5
    }
  }
}
```

This approach removes the need for Git while giving evaluators a precise, structured baseline vs output comparison that matches scenario intent.


## Success Metrics

### Evaluator Quality
- **Correlation with human judgment**: >0.85
- **Inter-evaluator reliability**: >0.90
- **False positive rate**: <10%
- **Evaluation time**: <2 minutes per scenario

### System Adoption
- **Agent differentiation**: Clear performance gaps between agents
- **Scenario coverage**: All scenario types supported
- **Developer feedback**: Positive developer experience

This design provides a comprehensive, extensible evaluation framework that can accurately assess AI coding agent performance while remaining maintainable and scalable.
