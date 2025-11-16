# Benchmark Execution Architecture

## Overview

The `zack-wip` branch introduces a complete restructuring of benchmark execution to support:
- **External Invocation**: Run benchmarks from anywhere, not just from within the repo
- **Configuration-Driven**: Use `benchmark.config.json` for flexible path configuration
- **Modular Architecture**: Clean separation of concerns (CLI, domain, execution, interactive, lib)
- **Project Root Detection**: Automatic discovery of ze-benchmarks root directory

## Key Changes from Main

### 1. Configuration File System

**New Files:**
- `benchmark.config.json` - Main configuration file
- `benchmark.config.schema.json` - JSON schema for validation

**benchmark.config.json:**
```json
{
  "$schema": "./benchmark.config.schema.json",
  "suitesDir": "./suites",
  "outputDir": "./results",
  "databasePath": "./benchmarks.db",
  "comment": "All paths are relative to the project root where this file is located."
}
```

**Benefits:**
- Customize suite locations
- Configure output directories
- Specify database path
- All paths relative to config file location

### 2. Project Root Detection

**Location:** `packages/harness/src/lib/project-root.ts`

**New Functions:**

```typescript
// Find project root by walking up from startDir
function findProjectRoot(markerFile: string, startDir?: string): string | null

// Find ze-benchmarks root specifically
function findZeBenchmarksRoot(startDir?: string): string | null
```

**Search Strategy:**
1. Look for `benchmark.config.json` (primary marker)
2. Fall back to `package.json` with `name: "ze-benchmarks"`
3. Walk up directory tree until found or reach filesystem root

**Benefits:**
- Run benchmarks from any subdirectory
- Invoke from external scripts
- Consistent path resolution

### 3. Config Loading System

**Location:** `packages/harness/src/lib/config.ts`

**Functions:**

```typescript
interface BenchmarkConfig {
  suitesDir: string;
  outputDir: string;
  databasePath: string;
}

// Load config with defaults and path resolution
function loadBenchmarkConfig(projectRoot?: string): BenchmarkConfig

// Get database path (env var > config > default)
function getDatabasePath(projectRoot?: string): string
```

**Resolution Priority:**
1. Environment variable (`BENCHMARK_DB_PATH`)
2. Config file value
3. Default value

**Path Handling:**
- All paths are resolved to absolute paths
- Relative paths in config are relative to project root
- Ensures consistency regardless of invocation location

### 4. Modular CLI Architecture

The CLI has been completely restructured into logical modules:

#### CLI Module (`packages/harness/src/cli/`)

**args.ts** - Argument parsing
```typescript
interface CLIArgs {
  command?: 'interactive' | 'run' | 'dev' | 'stats' | 'create' | 'clear';
  suite?: string;
  scenario?: string;
  tier?: string;
  agent?: string;
  model?: string;
  batch?: string;
  specialist?: string;
  quiet?: boolean;
  help?: boolean;
  skipWarmup?: boolean;
}

function parseArgs(argv: string[]): CLIArgs
function showHelp(): void
```

**environment.ts** - Environment validation
```typescript
function validateEnvironment(): void
```

Checks for required environment variables and provides helpful error messages.

#### Domain Module (`packages/harness/src/domain/`)

Business logic separated from infrastructure:

**agent.ts** - Agent creation and management
```typescript
function getAvailableAgents(): Promise<Array<{value: string, label: string}>>
function resolveSpecialistTemplatePath(specialistName: string, workspaceRoot: string): string
function createAgentAdapter(agentName: string, model?: string, specialistName?: string, workspaceRoot?: string): Promise<AgentAdapter>
```

**scenario.ts** - Scenario loading and management
```typescript
function loadScenario(suite: string, scenario: string): ScenarioConfig
function loadPrompt(suite: string, scenario: string, tier: string): string
function getScenarioDir(suite: string, scenario: string): string
function getAvailableTiers(suite: string, scenario: string): Array<{value: string, label: string}>
```

**scoring.ts** - Score calculation
```typescript
function computeWeightedTotals(scores: Record<string, number>, weights?: Record<string, number>): number
function calculateSuccess(totalScore: number): boolean
```

**warmup.ts** - Warmup execution
```typescript
function executeWarmup(adapter: AgentAdapter, prompt: string): Promise<void>
```

#### Execution Module (`packages/harness/src/execution/`)

**benchmark.ts** - Core benchmark runner

```typescript
async function executeBenchmark(
  suite: string,
  scenario: string,
  tier: string,
  agent: string,
  model?: string,
  batchId?: string,
  quiet?: boolean,
  specialist?: string,
  skipWarmup?: boolean
): Promise<void>
```

**Orchestrates:**
1. Setup - Load scenario and prompt
2. Warmup - Optional warmup phase
3. Workspace - Prepare test workspace
4. Agent - Execute AI agent
5. Validation - Run validation commands
6. Evaluation - Compute scores
7. Results - Display and save results

#### Interactive Module (`packages/harness/src/interactive/`)

New interactive menu system:

**menu.ts** - Main menu
```typescript
function showInteractiveMenu(): Promise<void>
```

**benchmark.ts** - Interactive benchmark execution
```typescript
function runInteractiveBenchmark(): Promise<void>
function executeMultipleBenchmarks(suites, scenarios, tiers, agents, models): Promise<void>
function executeWithConcurrency<T>(items, concurrency, executor): Promise<void>
```

**statistics.ts** - Stats viewing
```typescript
function runInteractiveSuiteStats(): Promise<void>
function runInteractiveScenarioStats(): Promise<void>
function runInteractiveRunStats(): Promise<void>
function runInteractiveEvaluators(): Promise<void>
```

**clear.ts** - Database clearing
```typescript
function runInteractiveClear(): Promise<void>
```

**suite-management.ts** - Suite/scenario creation
```typescript
function createNewSuite(): Promise<void>
function createNewScenario(): Promise<void>
```

#### Lib Module (`packages/harness/src/lib/`)

Shared utilities:

**config.ts** - Configuration loading (described above)

**constants.ts** - Shared constants
```typescript
const TABLE_WIDTH = 60;
const SCORE_THRESHOLDS = {
  EXCELLENT: 90,
  GOOD: 70,
  NEEDS_WORK: 60
};
```

**display.ts** - Display utilities
```typescript
function createTitle(text: string, width?: number): string
function formatStats(stats: any): string
function displayRunInfo(runInfo: any): void
function createProgress(): any
function updateProgress(progress: any, stage: number, message: string): void
function completeProgress(progress: any): void
function displayLLMJudgeScores(scores: any): void
```

**project-root.ts** - Project root detection (described above)

**workspace-utils.ts** - Workspace utilities
```typescript
function prepareWorkspaceFromFixture(fixturePath: string, workspaceDir: string): Promise<void>
function findWorkspaceRoot(startDir: string): string
```

### 5. External Invocation Support

The restructured architecture enables several invocation patterns:

#### Pattern 1: From Repo Root
```bash
cd /path/to/ze-benchmarks
pnpm run cli run shadcn-generate-vite basic L0 anthropic
```

#### Pattern 2: From Subdirectory
```bash
cd /path/to/ze-benchmarks/packages/harness
pnpm exec tsx src/cli.ts run shadcn-generate-vite basic L0 anthropic
```

#### Pattern 3: From External Script
```typescript
import { executeBenchmark } from '@ze/harness/execution/benchmark';

// Will automatically find ze-benchmarks root
await executeBenchmark(
  'shadcn-generate-vite',
  'basic',
  'L0',
  'anthropic',
  'claude-sonnet-4.5'
);
```

#### Pattern 4: Via Programmatic API
```typescript
import { loadBenchmarkConfig } from '@ze/harness/lib/config';
import { createAgentAdapter } from '@ze/harness/domain/agent';
import { executeBenchmark } from '@ze/harness/execution/benchmark';

const config = loadBenchmarkConfig();
const adapter = await createAgentAdapter('anthropic', 'claude-sonnet-4.5');

await executeBenchmark(
  'shadcn-generate-vite',
  'basic',
  'L0',
  'anthropic',
  'claude-sonnet-4.5'
);
```

### 6. Workspace Root Resolution

**Critical Change:** The workspace root is now resolved at CLI startup:

```typescript
// In cli.ts
const workspaceRoot = findWorkspaceRoot(process.cwd());
```

This is then passed through to:
- Agent creation (for specialist template resolution)
- Config loading (for relative path resolution)
- Scenario loading (for suite directory location)

### 7. Database Path Resolution

**Priority Order:**
1. `BENCHMARK_DB_PATH` environment variable (absolute path)
2. `databasePath` from `benchmark.config.json` (relative to config location)
3. Default: `./benchmarks.db` (relative to project root)

**Example:**
```bash
# Use custom database location
export BENCHMARK_DB_PATH=/data/benchmarks/my-benchmarks.db
pnpm run cli run shadcn-generate-vite basic L0 anthropic
```

### 8. Specialist Integration

Specialists are fully integrated into the execution flow:

**Scenario Config:**
```yaml
specialist: "@zephyr-cloud/shadcn-specialist"
```

**CLI Flag:**
```bash
pnpm run cli run shadcn-generate-vite basic L0 anthropic --specialist @zephyr-cloud/shadcn-specialist
```

**Resolution:**
1. Specialist name → template filename
2. Template path resolved relative to workspace root
3. Absolute path passed to SpecialistAdapter
4. Works regardless of invocation location

### 9. Environment Variable Discovery

**Location:** `packages/harness/src/cli.ts`

The CLI walks up to find workspace root and loads `.env` from there:

```typescript
function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;
  let lastWorkspaceRoot = startDir;

  while (currentDir !== resolve(currentDir, '..')) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      lastWorkspaceRoot = currentDir;
    }
    currentDir = resolve(currentDir, '..');
  }

  return lastWorkspaceRoot;
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const envPath = resolve(workspaceRoot, '.env');
config({ path: envPath });
```

This ensures environment variables are loaded consistently.

## Migration Benefits

### For Developers

1. **Cleaner Code**: Separation of concerns makes code easier to maintain
2. **Testability**: Each module can be tested independently
3. **Extensibility**: New features fit into clear module boundaries
4. **Reusability**: Modules can be imported and used programmatically

### For Users

1. **Flexibility**: Run benchmarks from anywhere
2. **Configuration**: Customize paths without code changes
3. **Integration**: Easy to integrate into CI/CD pipelines
4. **Consistency**: Same behavior regardless of invocation location

### For CI/CD

1. **External Scripts**: Invoke benchmarks from orchestration scripts
2. **Custom Workflows**: Build custom benchmark pipelines
3. **Parallel Execution**: Run multiple benchmarks concurrently
4. **Result Aggregation**: Collect results from multiple runs

## File Structure Changes

### New Files
- `benchmark.config.json` - Configuration
- `benchmark.config.schema.json` - Schema
- `packages/harness/src/cli/args.ts` - Argument parsing
- `packages/harness/src/cli/environment.ts` - Environment validation
- `packages/harness/src/domain/agent.ts` - Agent management
- `packages/harness/src/domain/scenario.ts` - Scenario loading
- `packages/harness/src/domain/scoring.ts` - Score calculation
- `packages/harness/src/domain/warmup.ts` - Warmup execution
- `packages/harness/src/execution/benchmark.ts` - Core runner
- `packages/harness/src/interactive/*.ts` - Interactive modules
- `packages/harness/src/lib/config.ts` - Config loading
- `packages/harness/src/lib/constants.ts` - Shared constants
- `packages/harness/src/lib/display.ts` - Display utilities
- `packages/harness/src/lib/project-root.ts` - Root detection

### Modified Files
- `packages/harness/src/cli.ts` - Now uses modular imports
- `packages/database/src/schema.ts` - Updated for specialist tracking
- `packages/database/src/logger.ts` - Enhanced logging

### Deleted Files
- `packages/harness/src/cli.ts.backup` - Old CLI backup (safe to delete)

## Key Architectural Principles

1. **Single Responsibility**: Each module has one clear purpose
2. **Dependency Injection**: Functions accept dependencies as parameters
3. **Path Resolution**: All paths resolved to absolute early
4. **Error Handling**: Clear error messages with troubleshooting hints
5. **Backward Compatibility**: Old invocation patterns still work

## Testing Strategy

The modular architecture enables comprehensive testing:

1. **Unit Tests**: Test each module in isolation
2. **Integration Tests**: Test module interactions
3. **E2E Tests**: Test full benchmark execution
4. **Path Resolution Tests**: Verify external invocation works

## Future Enhancements

The new architecture enables:

1. **Multi-repo Support**: Run benchmarks across multiple repos
2. **Remote Execution**: Execute benchmarks on remote machines
3. **Result Streaming**: Stream results to external systems
4. **Custom Evaluators**: Plugin system for custom evaluators
5. **Benchmark Composition**: Compose complex benchmark suites

## Summary

The `zack-wip` benchmark execution architecture provides:
- ✅ External invocation from anywhere
- ✅ Configuration-driven flexibility
- ✅ Clean modular design
- ✅ Comprehensive path resolution
- ✅ Full specialist integration
- ✅ Interactive and programmatic modes
- ✅ Enhanced testability and maintainability
