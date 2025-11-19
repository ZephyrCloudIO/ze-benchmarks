# Plan: Fix Interactive Mode to Run Specialists

## Problem Statement

Currently, when running the interactive benchmark mode (`pnpm bench` with no arguments), the CLI only offers basic agents (echo, openrouter, anthropic, claude-code) but **does not offer specialists** as an option. This means users cannot run specialists through the interactive UI.

The user wants specialists to be the **primary way** to run benchmarks in interactive mode.

## Current Behavior

1. User runs `pnpm bench` (no arguments)
2. Interactive menu appears
3. User selects:
   - Suites
   - Scenarios
   - Tiers
   - **Agents** (echo, openrouter, anthropic, claude-code)
   - Models (if applicable)
4. Benchmarks run with selected agents
5. **Problem**: No specialists are available to select

## Desired Behavior

1. User runs `pnpm bench` (no arguments)
2. Interactive menu appears
3. User selects:
   - Suites
   - Scenarios
   - Tiers
   - **Execution Mode**: Choose between "Specialists" or "Direct Agents"
   - If "Specialists" selected:
     - Show available specialists from node_modules
     - User selects one or more specialists
     - Each specialist runs with its preferred model/agent
   - If "Direct Agents" selected:
     - Show agents (echo, openrouter, anthropic, claude-code)
     - User selects models if needed
4. Benchmarks run with selected execution mode
5. **Result**: Specialists are the primary recommended option

## Implementation Plan

### Phase 1: Add Specialist Discovery Function
**File**: `packages/harness/src/interactive/benchmark.ts`

**Add import at top** (around line 6):
```typescript
import JSON5 from 'json5';
```

**Add new function** after line 630:

```typescript
async function getAvailableSpecialists(): Promise<Array<{
  value: string,
  label: string,
  description?: string
}>> {
  const specialists: Array<{value: string, label: string, description?: string}> = [];

  // Load specialists from templates directory
  const root = findRepoRoot();
  const templatesPath = join(root, 'templates');

  if (!existsSync(templatesPath)) {
    return specialists;
  }

  // Read all JSON5 files in templates directory
  const files = readdirSync(templatesPath).filter(file =>
    file.endsWith('.json5') && file.includes('specialist')
  );

  for (const file of files) {
    const filePath = join(templatesPath, file);

    try {
      const content = readFileSync(filePath, 'utf8');
      const template = JSON5.parse(content);

      // Extract specialist info from template
      const name = template.name || file.replace('-template.json5', '');
      const displayName = template.displayName || name;
      const purpose = template.persona?.purpose || 'Specialist template';

      specialists.push({
        value: name,
        label: `${displayName} ${chalk.gray(`(${name})`)}`,
        description: purpose
      });
    } catch (e) {
      // Skip invalid JSON5 files
      console.log(chalk.yellow(`⚠️  Failed to parse ${file}: ${e instanceof Error ? e.message : String(e)}`));
    }
  }

  return specialists;
}
```

**Why**: We need to discover available specialists from the templates directory (JSON5 files) before we can offer them to the user.

### Phase 2: Add Execution Mode Selection
**File**: `packages/harness/src/interactive/benchmark.ts`

**Location**: After tier selection (around line 409), before agent selection (line 411)

**Add new interactive prompt**:

```typescript
// Select execution mode (Specialists vs Direct Agents)
const executionMode = await select({
  message: 'Choose execution mode:',
  options: [
    {
      value: 'specialist',
      label: 'Specialists (Recommended)',
      hint: 'Use pre-configured specialist templates for specific tasks'
    },
    {
      value: 'direct',
      label: 'Direct Agents',
      hint: 'Use base agents directly (openrouter, anthropic, etc.)'
    }
  ]
});

if (isCancel(executionMode)) {
  cancel('Operation cancelled.');
  return;
}
```

**Why**: We give users a clear choice between specialists and direct agents, making specialists the recommended option.

### Phase 3: Conditional Agent/Specialist Selection
**File**: `packages/harness/src/interactive/benchmark.ts`

**Location**: Replace the existing agent selection logic (lines 411-432)

**Replace with**:

```typescript
let agentsToUse: string[] = [];
let specialistsToUse: string[] = [];
let modelsToUse: (string | undefined)[] = [undefined];

if (executionMode === 'specialist') {
  // Specialist mode
  console.log('🔍 Loading available specialists...');
  const specialistOptions = await getAvailableSpecialists();

  if (specialistOptions.length === 0) {
    log.warning('No specialists found in templates directory');
    log.info('Add a specialist template to the templates/ directory first');
    return;
  }

  console.log(`✅ Found ${specialistOptions.length} specialist(s)`);

  const selectedSpecialists = await multiselect({
    message: 'Choose specialists:',
    options: [
      { value: '__ALL__', label: 'All specialists' },
      ...specialistOptions
    ],
    required: true
  });

  if (isCancel(selectedSpecialists)) {
    cancel('Operation cancelled.');
    return;
  }

  // Expand "All" selection
  specialistsToUse = selectedSpecialists.includes('__ALL__')
    ? specialistOptions.map(s => s.value)
    : selectedSpecialists;

  console.log(`🎯 Selected specialists: ${specialistsToUse.join(', ')}`);

} else {
  // Direct agent mode (existing code)
  console.log('Loading available agents...');
  const agentOptions = await getAvailableAgents();
  console.log(`✅ Loaded ${agentOptions.length} agent options`);

  const selectedAgents = await multiselect({
    message: 'Choose agents:',
    options: agentOptions,
    required: true
  });

  if (isCancel(selectedAgents)) {
    cancel('Operation cancelled.');
    return;
  }

  // Expand "All" selection
  agentsToUse = selectedAgents.includes('__ALL__')
    ? ['echo', 'openrouter', 'anthropic', 'claude-code']
    : selectedAgents;

  console.log(`🎯 Selected agents: ${agentsToUse.join(', ')}`);

  // ... existing model selection logic for direct agents ...
}
```

**Why**: We conditionally show either specialists or direct agents based on user's choice.

### Phase 4: Update Benchmark Execution
**File**: `packages/harness/src/interactive/benchmark.ts`

**Location**: Update the `executeMultipleBenchmarks` call (around line 619)

**Create combinations differently based on mode**:

```typescript
// Calculate total combinations based on execution mode
let totalCombinations: number;
if (executionMode === 'specialist') {
  totalCombinations = suitesToUse.length * scenariosToUse.length * tiersToUse.length * specialistsToUse.length;
} else {
  totalCombinations = suitesToUse.length * scenariosToUse.length * tiersToUse.length * agentsToUse.length * modelsToUse.length;
}

// Show summary
console.log(`\n${chalk.green('►')} Will run ${chalk.bold(totalCombinations.toString())} benchmark combination(s)`);
console.log(`   ${chalk.cyan('Suites:')} ${suitesToUse.join(', ')}`);
console.log(`   ${chalk.cyan('Scenarios:')} ${scenariosToUse.join(', ')}`);
console.log(`   ${chalk.cyan('Tiers:')} ${tiersToUse.join(', ')}`);
if (executionMode === 'specialist') {
  console.log(`   ${chalk.cyan('Specialists:')} ${specialistsToUse.join(', ')}`);
} else {
  console.log(`   ${chalk.cyan('Agents:')} ${agentsToUse.join(', ')}`);
  if (modelsToUse.length > 0 && modelsToUse[0]) {
    console.log(`   ${chalk.cyan('Models:')} ${modelsToUse.join(', ')}`);
  }
}

// Execute based on mode
if (executionMode === 'specialist') {
  await executeMultipleBenchmarksWithSpecialists(
    suitesToUse,
    scenariosToUse,
    tiersToUse,
    specialistsToUse
  );
} else {
  await executeMultipleBenchmarks(
    suitesToUse,
    scenariosToUse,
    tiersToUse,
    agentsToUse,
    modelsToUse
  );
}
```

**Why**: We need to handle execution differently for specialists vs direct agents.

### Phase 5: Create New Execution Function for Specialists
**File**: `packages/harness/src/interactive/benchmark.ts`

**Location**: Add new function before `runInteractiveBenchmark` (around line 49)

```typescript
export async function executeMultipleBenchmarksWithSpecialists(
  suites: string[],
  scenarios: string[],
  tiers: string[],
  specialists: string[]
) {
  // Initialize batch tracking
  const logger = BenchmarkLogger.getInstance();
  const batchId = await logger.startBatch();

  // Calculate total combinations
  const combinations: Array<{
    suite: string;
    scenario: string;
    tier: string;
    specialist: string;
  }> = [];

  for (const suite of suites) {
    for (const scenario of scenarios) {
      const availableTiers = getAvailableTiers(suite, scenario);
      const availableTierValues = availableTiers.map(t => t.value);
      const validTiers = tiers.filter(tier => availableTierValues.includes(tier));

      if (validTiers.length === 0) {
        console.log(chalk.yellow(`⚠ Skipping ${suite}/${scenario}: no valid tiers`));
        continue;
      }

      for (const tier of validTiers) {
        for (const specialist of specialists) {
          combinations.push({ suite, scenario, tier, specialist });
        }
      }
    }
  }

  // Smart concurrency
  const useParallel = combinations.length >= 3;
  let concurrency = combinations.length <= 5 ? 2 : combinations.length <= 15 ? 3 : 5;

  console.log(chalk.bold.underline(`\nRunning ${combinations.length} benchmark(s) with specialists:`));
  if (useParallel) {
    console.log(chalk.gray(`Parallel execution with concurrency: ${concurrency}`));
  }

  // Execute warmup once per unique suite/scenario
  const uniqueScenarios = new Set(combinations.map(c => `${c.suite}/${c.scenario}`));
  if (uniqueScenarios.size > 0) {
    console.log(chalk.blue('\n🔥 Running warmup phase for scenarios...'));
    for (const scenarioKey of uniqueScenarios) {
      const [suite, scenario] = scenarioKey.split('/');
      try {
        const scenarioCfg = loadScenario(suite, scenario);
        const warmupResult = await executeWarmup(suite, scenario, scenarioCfg, createAgentAdapter, true);
        if (!warmupResult.success) {
          console.log(chalk.yellow(`⚠️  Warmup for ${scenarioKey}: ${warmupResult.error || 'failed'}`));
        } else {
          console.log(chalk.green(`✓ Warmup completed for ${scenarioKey}`));
        }
      } catch (error) {
        console.log(chalk.yellow(`⚠️  Warmup error for ${scenarioKey}: ${error instanceof Error ? error.message : String(error)}`));
      }
    }
    console.log();
  }

  // Execute benchmarks
  if (useParallel) {
    await executeWithConcurrency(
      combinations,
      concurrency,
      async (combo, i) => {
        const { suite, scenario, tier, specialist } = combo;
        console.log(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${specialist}`)}`);
        await executeBenchmark(
          suite,
          scenario,
          tier,
          undefined,  // agent is undefined - specialist will auto-detect
          undefined,  // model is undefined - specialist has preferred model
          batchId,
          true,       // quiet mode
          specialist, // specialist parameter
          true        // skip warmup (already done)
        );
      }
    );
  } else {
    for (let i = 0; i < combinations.length; i++) {
      const { suite, scenario, tier, specialist } = combinations[i];
      console.log(`${chalk.bold.cyan(`[${i + 1}/${combinations.length}]`)} ${suite}/${scenario} ${chalk.gray(`(${tier}) ${specialist}`)}`);
      await executeBenchmark(
        suite,
        scenario,
        tier,
        undefined,  // agent is undefined - specialist will auto-detect
        undefined,  // model is undefined - specialist has preferred model
        batchId,
        true,       // quiet mode
        specialist, // specialist parameter
        true        // skip warmup (already done)
      );
    }
  }

  // Complete batch and show summary (reuse existing logic)
  const endTime = Date.now();
  const batchStats = await logger.getBatchDetails(batchId);

  let successfulRuns = 0;
  let totalScore = 0;
  let totalWeightedScore = 0;

  if (batchStats) {
    successfulRuns = await logger.getBatchSuccessfulRunsCount(batchId);
    const scoreStats = await logger.getBatchScoreStats(batchId);
    totalScore = scoreStats.avgScore || 0;
    totalWeightedScore = scoreStats.avgWeightedScore || 0;
  }

  await logger.completeBatch(batchId, {
    totalRuns: combinations.length,
    successfulRuns,
    avgScore: totalScore,
    avgWeightedScore: totalWeightedScore,
    metadata: {
      suites,
      scenarios,
      tiers,
      specialists,
      executionMode: 'specialist'
    }
  });

  // Show summary (reuse existing display logic)
  const analytics = await logger.getBatchAnalytics(batchId);

  console.log('\n' + chalk.bold.underline('Batch Summary'));
  console.log(`┌${'─'.repeat(TABLE_WIDTH)}┐`);
  console.log(`│ ${chalk.bold('Batch ID:')} ${chalk.dim(batchId.substring(0, 8))}...`);
  console.log(`│ ${chalk.bold('Mode:')} ${chalk.cyan('Specialists')}`);
  console.log(`│ ${chalk.bold('Total Runs:')} ${combinations.length}`);
  console.log(`│ ${chalk.bold('Completed:')} ${successfulRuns} (${combinations.length > 0 ? ((successfulRuns / combinations.length) * 100).toFixed(1) : 0}%)`);
  console.log(`│ ${chalk.bold('Avg Score:')} ${(totalWeightedScore / combinations.length).toFixed(4)} / 10.0`);
  console.log(`└${'─'.repeat(TABLE_WIDTH)}┘`);

  console.log('\n' + chalk.green('✓') + chalk.bold(` Completed all ${combinations.length} benchmark(s) with specialists!`));
}
```

**Why**: Specialists need their own execution flow because they don't require separate agent/model selection - the specialist configuration handles that.

## Summary of Changes

### Files Modified
1. **`packages/harness/src/interactive/benchmark.ts`**
   - Add JSON5 import
   - Add `getAvailableSpecialists()` function (loads from `templates/` directory)
   - Add execution mode selection prompt
   - Add conditional specialist/agent selection
   - Add `executeMultipleBenchmarksWithSpecialists()` function
   - Update combination calculation and execution logic

### Key Features
1. **Specialist Discovery**: Auto-load specialists from `templates/*.json5` files
2. **Execution Mode**: Clear choice between specialists (recommended) and direct agents
3. **Simplified Flow**: When using specialists, no need to select agents/models separately
4. **Backward Compatible**: Direct agent mode still works exactly as before
5. **Batch Support**: Specialists work with batch tracking and analytics

### User Experience Flow

#### Before (Current)
```
pnpm bench
→ Select suites
→ Select scenarios
→ Select tiers
→ Select agents (echo, openrouter, anthropic)
→ Select models (if needed)
→ Run with direct agents
```

#### After (Proposed)
```
pnpm bench
→ Select suites
→ Select scenarios
→ Select tiers
→ Select execution mode: "Specialists (Recommended)" or "Direct Agents"
→ If specialists:
  → Select specialists (@org/specialist-name)
  → Run with specialists (auto-detects agent/model)
→ If direct agents:
  → Select agents (echo, openrouter, anthropic)
  → Select models (if needed)
  → Run with direct agents
```

## Testing Plan

1. **Test specialist mode**:
   ```bash
   pnpm bench
   # Select: suites → scenarios → tiers → "Specialists" → select a specialist
   ```

2. **Test direct agent mode (backward compatibility)**:
   ```bash
   pnpm bench
   # Select: suites → scenarios → tiers → "Direct Agents" → openrouter → model
   ```

3. **Test with no specialists in templates directory**:
   - Should show warning and suggest adding a specialist template

4. **Test parallel execution**:
   - Select multiple scenarios + specialists → should run in parallel

## Benefits

1. ✅ **Specialists become primary** - Recommended option in interactive mode
2. ✅ **Simpler UX** - No need to select agent/model when using specialists
3. ✅ **Auto-discovery** - Automatically finds installed specialists
4. ✅ **Backward compatible** - Direct agent mode still works
5. ✅ **Clear intent** - Execution mode makes the difference obvious
6. ✅ **Scalable** - Easy to add more specialists as packages

## Next Steps

1. Get approval on this plan
2. Implement Phase 1-5 in order
3. Test thoroughly
4. Update documentation
5. Ship it! 🚀
