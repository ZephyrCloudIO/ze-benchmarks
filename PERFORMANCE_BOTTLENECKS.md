# Benchmark Performance Bottlenecks

This document identifies where speed bottlenecks occur when running benchmarks and provides optimization strategies.

## Benchmark Execution Flow

A single benchmark run goes through 6 stages:

```
Stage 1: Setup (fast) → Stage 2: Workspace (medium) → Stage 3: Agent (SLOW) 
→ Stage 4: Validation (SLOW) → Stage 5: Evaluation (medium) → Stage 6: Results (fast)
```

## Bottleneck Analysis

### 🔴 **CRITICAL BOTTLENECK #1: Agent API Calls (Stage 3)**

**Location**: `packages/harness/src/cli.ts:2315` - `await agentAdapter.send(request)`

**Why it's slow:**
- **Multi-turn conversations**: Agents can make 10-50 turns (iterations)
- **Sequential API calls**: Each turn waits for LLM response before next turn
- **Tool execution between turns**: Tools (readFile, writeFile, runCommand) execute synchronously
- **Network latency**: Round-trip time to LLM API (Anthropic, OpenRouter, etc.)
- **Token generation time**: LLM needs time to generate responses
- **No parallelization**: All tool calls within a turn are sequential

**Typical Time Breakdown:**
- **Per API call**: 2-10 seconds (network + generation)
- **Per tool call**: 0.1-5 seconds (file I/O, command execution)
- **Total agent time**: 30 seconds - 10+ minutes (depending on complexity)

**Example Flow:**
```
Turn 1: API call (3s) → Tool: readFile (0.1s) → Tool: runCommand (2s) → API call (4s)
Turn 2: API call (5s) → Tool: writeFile (0.1s) → API call (3s)
Turn 3: API call (2s) → Done
Total: ~19 seconds for 3 turns
```

**Optimization Opportunities:**
1. ✅ **Parallel tool execution** - Execute independent tools in parallel
2. ✅ **Streaming responses** - Start processing while LLM is still generating
3. ✅ **Caching** - Cache file reads and command outputs
4. ✅ **Batch tool calls** - Send multiple tool calls in one API request (if supported)
5. ⚠️ **Reduce max iterations** - Lower from 50 to 20-30 for faster failures

---

### 🔴 **CRITICAL BOTTLENECK #2: Validation Commands (Stage 4)**

**Location**: `packages/harness/src/runtime/validation.ts:14` - `runValidationCommands()`

**Why it's slow:**
- **Sequential execution**: Commands run one after another (install → test → lint → typecheck)
- **Blocking operations**: Uses `spawnSync` (synchronous, blocking)
- **Long-running commands**: 
  - `pnpm install`: 30 seconds - 5 minutes (depends on dependencies)
  - `pnpm test`: 10 seconds - 10+ minutes (depends on test suite)
  - `pnpm lint`: 5-30 seconds
  - `pnpm typecheck`: 10-60 seconds
- **No parallelization**: Can't run test/lint/typecheck in parallel
- **10-minute timeout per command**: Can wait up to 10 minutes per command

**Typical Time Breakdown:**
- **Install**: 30s - 5min (most variable)
- **Test**: 10s - 10min (depends on test suite size)
- **Lint**: 5-30s
- **Typecheck**: 10-60s
- **Total validation time**: 1-15+ minutes

**Current Implementation:**
```typescript
// Sequential execution - each waits for previous to finish
for (const kind of order) {  // ['install', 'test', 'lint', 'typecheck']
  const proc = spawnSync(cmd, { ... });  // BLOCKING
  // Wait for completion before next command
}
```

**Optimization Opportunities:**
1. ✅ **Parallel execution** - Run test/lint/typecheck in parallel (after install)
2. ✅ **Async execution** - Use `spawn` instead of `spawnSync` for non-blocking
3. ✅ **Skip unnecessary commands** - Skip lint/typecheck if test fails
4. ✅ **Caching** - Cache install results if dependencies haven't changed
5. ✅ **Early termination** - Stop on first failure (optional flag)

---

### 🟡 **MODERATE BOTTLENECK #3: Workspace Preparation (Stage 2)**

**Location**: `packages/harness/src/cli.ts:2169` - `prepareWorkspaceFromFixture()`

**Why it can be slow:**
- **File copying**: `cpSync` copies entire repo fixture to workspace
- **Large repositories**: Can have thousands of files (node_modules, etc.)
- **Synchronous operation**: Blocks until copy completes
- **Disk I/O**: Limited by disk speed

**Typical Time:**
- **Small repo** (< 100 files): < 1 second
- **Medium repo** (100-1000 files): 1-5 seconds
- **Large repo** (> 1000 files): 5-30 seconds

**Optimization Opportunities:**
1. ✅ **Async copying** - Use async file operations
2. ✅ **Selective copying** - Skip node_modules, .git, etc. (already done with filter)
3. ✅ **Hard links** - Use hard links instead of copying (faster)
4. ✅ **Parallel copying** - Copy multiple directories in parallel

---

### 🟡 **MODERATE BOTTLENECK #4: Tool Execution Within Agent Turns**

**Location**: `packages/harness/src/runtime/workspace-tools.ts` - Tool handlers

**Why it can be slow:**
- **Sequential execution**: Tools execute one after another
- **Command execution**: `runCommand` tool spawns shell commands synchronously
- **File I/O**: Multiple readFile/writeFile operations
- **No caching**: Same file might be read multiple times

**Typical Time per Tool:**
- **readFile**: 0.01-0.1 seconds
- **writeFile**: 0.01-0.1 seconds
- **runCommand**: 0.5-30 seconds (depends on command)
- **listFiles**: 0.1-1 second (for large directories)

**Optimization Opportunities:**
1. ✅ **Parallel tool execution** - Execute independent tools concurrently
2. ✅ **Caching** - Cache file reads and command outputs
3. ✅ **Async commands** - Use async spawn for non-blocking execution
4. ✅ **Batch operations** - Combine multiple file operations

---

### 🟢 **MINOR BOTTLENECK #5: Evaluator Execution (Stage 5)**

**Location**: `packages/harness/src/cli.ts:2383` - `runEvaluators()`

**Why it can be slow:**
- **Multiple evaluators**: Run sequentially
- **Some evaluators run commands**: PackageManagerEvaluator, DependencyTargetsEvaluator
- **File system operations**: Reading package.json files, parsing

**Typical Time:**
- **Most evaluators**: < 1 second
- **Command-based evaluators**: 1-5 seconds
- **Total evaluation time**: 1-10 seconds

**Optimization Opportunities:**
1. ✅ **Parallel evaluators** - Run independent evaluators in parallel
2. ✅ **Caching** - Cache evaluator results

---

### 🟢 **MINOR BOTTLENECK #6: Database Writes**

**Location**: `packages/database/src/logger.ts` - `BenchmarkLogger` methods

**Why it's usually fast:**
- **SQLite**: Very fast for writes
- **Direct writes**: No network overhead
- **Batch operations**: Multiple writes in single transaction

**Typical Time:**
- **Single write**: < 10ms
- **Batch writes**: < 50ms

**Not a significant bottleneck** - Database operations are fast.

---

## Overall Time Breakdown (Typical Benchmark)

| Stage | Time | % of Total | Bottleneck Level |
|-------|------|------------|------------------|
| **Stage 1: Setup** | 0.1-1s | < 1% | 🟢 None |
| **Stage 2: Workspace** | 1-30s | 1-5% | 🟡 Moderate |
| **Stage 3: Agent** | 30s-10min | **60-80%** | 🔴 **CRITICAL** |
| **Stage 4: Validation** | 1-15min | **15-30%** | 🔴 **CRITICAL** |
| **Stage 5: Evaluation** | 1-10s | 1-2% | 🟡 Moderate |
| **Stage 6: Results** | 0.1-1s | < 1% | 🟢 None |
| **Total** | **2-25 minutes** | 100% | |

---

## Parallel Execution

### Current State

**Multiple benchmarks** can run in parallel:
- Enabled when 3+ benchmarks are queued
- Concurrency: 2-8 benchmarks (based on total count)
- Each benchmark still runs its stages sequentially

**Within a single benchmark**, stages are **sequential**:
- Agent turns are sequential
- Validation commands are sequential
- Tool calls are sequential

### Optimization Potential

**If we parallelize within benchmarks:**
- **Agent tool calls**: Could save 20-40% of agent time
- **Validation commands**: Could save 50-70% of validation time (test/lint/typecheck in parallel)
- **Overall**: Could reduce total time by 30-50%

---

## Specific Bottleneck Examples

### Example 1: Simple Benchmark (Fast)
```
Setup: 0.5s
Workspace: 2s
Agent: 45s (3 turns, 5 tool calls)
Validation: 90s (install: 30s, test: 45s, lint: 10s, typecheck: 5s)
Evaluation: 2s
Results: 0.5s
Total: ~140 seconds (2.3 minutes)
```

**Bottlenecks:**
- Agent: 32% of time
- Validation: 64% of time

### Example 2: Complex Benchmark (Slow)
```
Setup: 1s
Workspace: 10s
Agent: 8min (20 turns, 50 tool calls)
Validation: 12min (install: 5min, test: 6min, lint: 30s, typecheck: 30s)
Evaluation: 5s
Results: 1s
Total: ~20 minutes
```

**Bottlenecks:**
- Agent: 40% of time
- Validation: 60% of time

---

## Optimization Recommendations

### Quick Wins (Easy to Implement)

1. **Parallel validation commands** (after install):
   ```typescript
   // Run test, lint, typecheck in parallel
   await Promise.all([
     runCommand('test'),
     runCommand('lint'),
     runCommand('typecheck')
   ]);
   ```
   **Expected savings**: 30-50% of validation time

2. **Early termination on validation failure**:
   ```typescript
   if (installFailed) return; // Skip test/lint/typecheck
   ```
   **Expected savings**: 5-10 minutes on failures

3. **Reduce max agent iterations**:
   ```typescript
   DEFAULT_MAX_ITERATIONS = 20; // Instead of 50
   ```
   **Expected savings**: Faster failure detection

### Medium Effort (Moderate Impact)

4. **Parallel tool execution** (within agent turns):
   ```typescript
   // Execute independent tools concurrently
   await Promise.all(toolCalls.map(executeTool));
   ```
   **Expected savings**: 20-40% of agent time

5. **Async validation commands**:
   ```typescript
   // Use spawn instead of spawnSync
   const proc = spawn(cmd, { ... });
   await new Promise((resolve) => proc.on('close', resolve));
   ```
   **Expected savings**: Better progress tracking, can cancel

6. **Caching file reads**:
   ```typescript
   const fileCache = new Map();
   if (fileCache.has(path)) return fileCache.get(path);
   ```
   **Expected savings**: 10-20% of tool execution time

### High Effort (High Impact)

7. **Streaming agent responses**:
   - Process tool calls as they arrive
   - Start executing tools while LLM is still generating
   **Expected savings**: 30-50% of agent time

8. **Smart caching**:
   - Cache install results if package.json unchanged
   - Cache test results if code unchanged
   **Expected savings**: 50-80% on repeated runs

9. **Distributed execution**:
   - Run validation on separate workers
   - Run multiple agent turns in parallel (if possible)
   **Expected savings**: 60-80% with proper parallelization

---

## Measurement & Profiling

To identify bottlenecks in your specific runs:

1. **Add timing logs**:
   ```typescript
   const start = Date.now();
   await agentAdapter.send(request);
   console.log(`Agent time: ${Date.now() - start}ms`);
   ```

2. **Profile with Node.js**:
   ```bash
   node --prof packages/harness/src/cli.ts bench ...
   node --prof-process isolate-*.log
   ```

3. **Use performance hooks**:
   ```typescript
   const { performance } = require('perf_hooks');
   performance.mark('agent-start');
   // ... agent execution
   performance.mark('agent-end');
   performance.measure('agent', 'agent-start', 'agent-end');
   ```

---

## Summary

**Primary Bottlenecks:**
1. 🔴 **Agent API calls** (60-80% of time) - Multi-turn conversations, sequential tool execution
2. 🔴 **Validation commands** (15-30% of time) - Sequential install/test/lint/typecheck

**Secondary Bottlenecks:**
3. 🟡 **Workspace preparation** (1-5% of time) - File copying
4. 🟡 **Tool execution** (within agent turns) - Sequential tool calls

**Quick Wins:**
- Parallel validation commands: **30-50% time savings**
- Early termination: **5-10 minutes on failures**
- Reduce max iterations: **Faster failure detection**

**Best Overall Optimization:**
- Parallel validation commands + parallel tool execution = **40-60% total time reduction**

