# Plan: Mark Runs as "Incomplete" When Stopped Midway

## Problem
Currently, when runs stop halfway through (interrupted, crashed, or timed out), they remain in "running" status forever. This makes it hard to distinguish between:
- Actually running runs
- Runs that stopped partway through

## Solution
Add "incomplete" status to mark runs that were started but never completed or failed.

## Implementation Plan

### Phase 1: Core Infrastructure

#### 1.1 Update Type Definitions
**Files:**
- `packages/database/src/logger.ts` - BenchmarkRun interface
- `benchmark-report/src/lib/database.ts` - BenchmarkRun interface

**Changes:**
```typescript
status: 'running' | 'completed' | 'failed' | 'incomplete'
```

#### 1.2 Add markRunIncomplete() Method
**File:** `packages/database/src/logger.ts`

**New Method:**
```typescript
markRunIncomplete(reason?: string, stage?: string) {
  if (!this.currentRunId) throw new Error('No active run');
  
  this.db.prepare(`
    UPDATE benchmark_runs 
    SET status = 'incomplete', completed_at = CURRENT_TIMESTAMP, metadata = ?
    WHERE run_id = ?
  `).run(
    JSON.stringify({ 
      reason: reason || 'Run interrupted', 
      stage: stage || 'unknown',
      incomplete: true 
    }), 
    this.currentRunId
  );
  
  this.updateTimestamp();
}
```

Also add static method to mark any run by ID:
```typescript
static markRunIncompleteById(runId: string, reason?: string) {
  const logger = BenchmarkLogger.getInstance();
  logger.db.prepare(`
    UPDATE benchmark_runs 
    SET status = 'incomplete', completed_at = CURRENT_TIMESTAMP, metadata = ?
    WHERE run_id = ? AND status = 'running'
  `).run(
    JSON.stringify({ reason: reason || 'Run marked incomplete', incomplete: true }),
    runId
  );
  logger.updateTimestamp();
}
```

### Phase 2: Signal Handling

#### 2.1 Add Signal Handlers for Graceful Shutdown
**File:** `packages/harness/src/cli.ts`

**Changes:** Update existing signal handlers:
```typescript
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  
  // Mark current run as incomplete if active
  try {
    const logger = BenchmarkLogger.getInstance();
    if (logger.currentRunId) {
      logger.markRunIncomplete('Interrupted by user (SIGINT)', 'cleanup');
      console.log(chalk.yellow('⚠ Current run marked as incomplete'));
    }
  } catch (err) {
    // Logger might not be initialized, that's okay
  }
  
  stopDevServer();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down gracefully...');
  
  // Mark current run as incomplete if active
  try {
    const logger = BenchmarkLogger.getInstance();
    if (logger.currentRunId) {
      logger.markRunIncomplete('Interrupted by system (SIGTERM)', 'cleanup');
      console.log(chalk.yellow('⚠ Current run marked as incomplete'));
    }
  } catch (err) {
    // Logger might not be initialized, that's okay
  }
  
  stopDevServer();
  process.exit(0);
});
```

### Phase 3: Timeout Detection

#### 3.1 Mark Runs Incomplete Based on Timeout
**File:** `packages/database/src/logger.ts`

**New Method:**
```typescript
/**
 * Marks stale 'running' runs as 'incomplete' based on scenario timeout
 * Should be called periodically or at startup
 */
markStaleRunsIncomplete(timeoutMinutes: number = 60) {
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const cutoffTime = new Date(Date.now() - timeoutMs).toISOString();
  
  const result = this.db.prepare(`
    UPDATE benchmark_runs
    SET status = 'incomplete',
        completed_at = CURRENT_TIMESTAMP,
        metadata = json_object('reason', 'Run exceeded timeout threshold', 'incomplete', true, 'original_status', status)
    WHERE status = 'running'
      AND started_at < ?
  `).run(cutoffTime);
  
  this.updateTimestamp();
  return result.changes;
}
```

**File:** `packages/harness/src/cli.ts`

**Add to executeBenchmark():**
```typescript
// At the start of executeBenchmark, before running
const scenarioTimeout = scenarioCfg.timeout_minutes || 60;
const timeoutMs = scenarioTimeout * 60 * 1000;

// Set a timeout watchdog
const timeoutId = setTimeout(() => {
  if (logger.currentRunId === runId) {
    logger.markRunIncomplete(`Run exceeded timeout (${scenarioTimeout} minutes)`, 'timeout');
    if (!quiet) console.log(chalk.yellow(`⚠ Run timed out after ${scenarioTimeout} minutes`));
  }
}, timeoutMs);

// Clear timeout when run completes (in finally block)
finally {
  clearTimeout(timeoutId);
  // ... rest of cleanup
}
```

### Phase 4: Error Handling

#### 4.1 Update executeBenchmark() Catch Blocks
**File:** `packages/harness/src/cli.ts`

**Changes:** Update error handlers to mark as incomplete when appropriate:
```typescript
} catch (error) {
  // Only mark as incomplete if it's an unexpected error mid-execution
  // Already-started runs that error should be marked incomplete
  if (logger.currentRunId === runId) {
    // Check if this is a mid-execution error (not early failure)
    const errorType = error instanceof Error ? error.message : String(error);
    logger.markRunIncomplete(`Unexpected error: ${errorType}`, 'error');
  } else {
    // Early failure, use failRun as normal
    logger.failRun(error instanceof Error ? error.message : String(error), 'unknown');
  }
  // ... rest of error handling
}
```

### Phase 5: UI Updates

#### 5.1 Update Type Definitions
**File:** `benchmark-report/src/lib/database.ts`

**Change:**
```typescript
status: 'running' | 'completed' | 'failed' | 'incomplete';
```

#### 5.2 Update Status Display
**File:** `benchmark-report/src/routes/runs.index.tsx`

**Changes:**
- Add 'incomplete' to filter options
- Add styling for incomplete status (e.g., orange/yellow)
- Update status badges

```typescript
const statusColor = {
  completed: 'green',
  failed: 'red',
  running: 'blue',
  incomplete: 'orange' // or 'yellow'
};

const statusIcon = {
  completed: '✓',
  failed: '✗',
  running: '○',
  incomplete: '◐' // or '⚠'
};
```

#### 5.3 Update Filter Options
**File:** `benchmark-report/src/routes/runs.index.tsx`

**Change:**
```typescript
const [filter, setFilter] = useState<'all' | 'completed' | 'failed' | 'incomplete' | 'running'>('all');
```

### Phase 6: Utility Functions

#### 6.1 Add Cleanup Utility
**File:** `packages/database/src/logger.ts`

**New Static Method:**
```typescript
/**
 * Utility to clean up stale runs - should be called at startup or periodically
 */
static cleanupStaleRuns(defaultTimeoutMinutes: number = 120) {
  const logger = BenchmarkLogger.getInstance();
  return logger.markStaleRunsIncomplete(defaultTimeoutMinutes);
}
```

#### 6.2 Add CLI Command (Optional)
**File:** `packages/harness/src/cli.ts`

**Add command:**
```typescript
// In interactive menu or as CLI flag
async function cleanupIncompleteRuns() {
  const logger = BenchmarkLogger.getInstance();
  const count = BenchmarkLogger.cleanupStaleRuns(120); // 2 hour default
  console.log(chalk.yellow(`Marked ${count} stale runs as incomplete`));
}
```

## Testing Strategy

1. **Manual Interruption Test:**
   - Start a long-running benchmark
   - Press Ctrl+C (SIGINT)
   - Verify run is marked as 'incomplete' in database

2. **Timeout Test:**
   - Create a scenario with very short timeout
   - Start a benchmark that exceeds timeout
   - Verify run is marked as 'incomplete'

3. **Stale Run Cleanup Test:**
   - Manually set a run status to 'running' with old timestamp
   - Run cleanup utility
   - Verify run is marked as 'incomplete'

4. **UI Test:**
   - View runs page with incomplete runs
   - Verify incomplete runs show correct styling
   - Test filtering by incomplete status

## Migration Notes

- **Backward Compatible:** Existing queries will continue to work
- **No Schema Change Needed:** Status is already TEXT type
- **Optional Migration Script:** Could mark old 'running' runs as incomplete if desired

## Implementation Order

1. ✅ Phase 1: Core infrastructure (types + markRunIncomplete method)
2. ✅ Phase 2: Signal handlers
3. ✅ Phase 3: Timeout detection
4. ✅ Phase 4: Error handling updates
5. ✅ Phase 5: UI updates
6. ✅ Phase 6: Utility functions

## Success Criteria

- [ ] Runs interrupted with Ctrl+C are marked as 'incomplete'
- [ ] Runs that exceed timeout are marked as 'incomplete'
- [ ] UI displays incomplete runs with distinct styling
- [ ] Users can filter runs by incomplete status
- [ ] Stale runs can be cleaned up automatically
- [ ] All existing functionality continues to work

