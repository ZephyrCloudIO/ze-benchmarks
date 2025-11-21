# Centralized Logging Guide

## Overview

This project uses a centralized logging system built on the [`debug`](https://www.npmjs.com/package/debug) package for contextualized, structured logging throughout the CLI harness and execution flow.

## Why Centralized Logging?

**Benefits:**
- ✅ **Contextualized logs** - Each log is tagged with its context (e.g., `ze:cli`, `ze:warmup`, `ze:benchmark`)
- ✅ **Filterable output** - Enable/disable specific log contexts via `DEBUG` environment variable
- ✅ **Consistent formatting** - Unified color scheme and formatting across all modules
- ✅ **Integration with @clack/prompts** - User-facing messages automatically integrate with CLI UI
- ✅ **Production-ready** - Easy to disable verbose logging in production
- ✅ **Better debugging** - Quickly filter logs to specific components during development

## Logger API

### Location
```typescript
import { logger } from './lib/logger.ts';
```

### Available Logger Contexts

| Context | Usage | Example |
|---------|-------|---------|
| `logger.cli` | Main CLI operations | `logger.cli.info('Starting benchmark')` |
| `logger.benchmark` | Benchmark execution | `logger.benchmark.success('Completed run')` |
| `logger.warmup` | Warmup phase | `logger.warmup.debug('Cleaning directory')` |
| `logger.agent` | Agent detection/management | `logger.agent.info('Detected OpenRouter')` |
| `logger.scenario` | Scenario loading | `logger.scenario.info('Loading scenario')` |
| `logger.interactive` | Interactive UI | `logger.interactive.info('User selected run')` |
| `logger.execution` | Execution flow | `logger.execution.debug('Starting tools')` |
| `logger.display` | Display/formatting | `logger.display.debug('Formatting stats')` |
| `logger.workspace` | Workspace utilities | `logger.workspace.info('Created suite')` |
| `logger.config` | Configuration | `logger.config.debug('Loaded config')` |
| `logger.stats` | Statistics | `logger.stats.info('Calculating averages')` |
| `logger.suite` | Suite management | `logger.suite.success('Suite created')` |
| `logger.history` | History browsing | `logger.history.info('Fetching runs')` |
| `logger.api` | API calls | `logger.api.debug('Calling OpenRouter')` |

### Log Levels

Each logger context has 6 methods:

```typescript
// Debug - Gray color, detailed troubleshooting info
logger.context.debug('Detailed debug information');

// Info - Blue color, general information
logger.context.info('General informational message');

// Warn - Yellow color, warnings
logger.context.warn('Warning message');

// Error - Red color, errors
logger.context.error('Error message');

// Success - Green color, success messages
logger.context.success('Operation completed successfully');

// Raw - Direct console output (for tables, formatted output)
logger.context.raw(formattedTable);

// Formatted - Pre-formatted messages with chalk colors
logger.context.formatted(chalk.blue('Already formatted message'));
```

## Usage Examples

### Before (console.log)
```typescript
console.log(chalk.blue('[Warmup] Starting warmup phase...'));
console.log(chalk.gray('[Warmup] Working directory: ' + workingDir));
console.log(chalk.green('[Warmup] ✓ Warmup completed'));
console.error(chalk.red('[Warmup] Failed to create control folder'));
```

### After (centralized logger)
```typescript
logger.warmup.info('Starting warmup phase...');
logger.warmup.debug(`Working directory: ${workingDir}`);
logger.warmup.success('✓ Warmup completed');
logger.warmup.error('Failed to create control folder');
```

### Creating Custom Loggers

For new modules or contexts:

```typescript
import { logger } from './lib/logger.ts';

// Create a custom logger with @clack/prompts integration
const myLogger = logger.create('my-module', true);

myLogger.info('This appears in both debug output and @clack/prompts');
myLogger.debug('This only appears in debug output');
```

## Controlling Log Output

### Enable All Logs (Default in CLI)
```bash
DEBUG=ze:* pnpm cli
```

### Enable Specific Contexts
```bash
# Only CLI logs
DEBUG=ze:cli pnpm cli

# Multiple contexts
DEBUG=ze:cli,ze:benchmark,ze:warmup pnpm cli

# Wildcard patterns
DEBUG=ze:*,ze:agent:* pnpm cli
```

### Disable All Debug Logs
```bash
DEBUG= pnpm cli
```

### In Code
```typescript
import { setDebugNamespace, isDebugEnabled } from './lib/logger.ts';

// Programmatically enable/disable
setDebugNamespace('ze:cli,ze:benchmark');

// Check if debug is enabled
if (isDebugEnabled('cli')) {
  // Do expensive logging operation
}
```

## Migration Guide

### Automated Migration

Use the migration script to automatically convert console.log calls:

```bash
# Dry run (see what would change)
tsx scripts/migrate-to-centralized-logging.ts --dry-run

# Apply changes
tsx scripts/migrate-to-centralized-logging.ts

# Process specific file
tsx scripts/migrate-to-centralized-logging.ts --file=packages/harness/src/cli.ts

# Verbose output
tsx scripts/migrate-to-centralized-logging.ts --verbose
```

### Manual Migration Steps

1. **Add the import**
   ```typescript
   import { logger } from './lib/logger.ts'; // or '../lib/logger.ts' or '../../lib/logger.ts'
   ```

2. **Choose the appropriate context**
   - Determine which logger context fits your module (cli, warmup, agent, etc.)
   - If none fit, create a custom logger: `logger.create('my-context')`

3. **Replace console.log calls**
   - Gray/debug messages → `.debug()`
   - Blue/info messages → `.info()`
   - Yellow/warnings → `.warn()`
   - Red/errors → `.error()`
   - Green/success → `.success()`

4. **Remove [Context] prefixes**
   ```typescript
   // Before
   console.log(chalk.blue('[Warmup] Starting...'));

   // After
   logger.warmup.info('Starting...');
   ```
   The context is automatically added by the debug namespace.

5. **Handle formatted output**
   For tables and complex formatted output, use `.raw()`:
   ```typescript
   logger.stats.raw(formatStats('Total Runs', 42));
   ```

### Common Patterns

#### Pattern 1: Conditional Logging
```typescript
// Before
if (!quiet) {
  console.log(chalk.blue('Message'));
}

// After
if (!quiet) {
  logger.context.info('Message');
}
```

#### Pattern 2: Error Handling
```typescript
// Before
try {
  // ...
} catch (err) {
  console.error(chalk.red('Error:'), err);
}

// After
try {
  // ...
} catch (err) {
  logger.context.error('Error:', err);
}
```

#### Pattern 3: Multi-line Output
```typescript
// Before
console.log(chalk.blue('Line 1'));
console.log(chalk.blue('Line 2'));
console.log(chalk.blue('Line 3'));

// After
logger.context.info('Line 1');
logger.context.info('Line 2');
logger.context.info('Line 3');
```

## Integration with @clack/prompts

Some logger contexts (cli, benchmark, interactive) automatically integrate with @clack/prompts:

```typescript
// These contexts show messages in both debug output AND @clack/prompts UI
logger.cli.info('message');        // → clackLog.info('message')
logger.cli.warn('warning');        // → clackLog.warning('warning')
logger.cli.error('error');         // → clackLog.error('error')
logger.cli.success('success');     // → clackLog.success('success')

// These contexts only show in debug output
logger.warmup.debug('details');    // → debug output only
```

## Best Practices

1. **Use appropriate log levels**
   - `debug()` - Implementation details, variable values, detailed flow
   - `info()` - High-level flow, operations starting/completing
   - `warn()` - Recoverable issues, deprecations
   - `error()` - Errors, failures
   - `success()` - Successful completions of major operations

2. **Choose the right context**
   - Use the most specific context available
   - Create new contexts for new major components
   - Don't overuse generic contexts like `cli`

3. **Keep messages concise**
   - Remove redundant prefixes like `[Context]` (added automatically)
   - Focus on the message, not the formatting
   - Use template literals for dynamic content

4. **Leverage DEBUG filtering**
   - Use focused contexts so users can filter logs
   - Test with different DEBUG values to ensure useful output
   - Document important DEBUG patterns in README

5. **Performance considerations**
   - Debug logging is lazy - string interpolation only happens when enabled
   - For expensive operations, check `isDebugEnabled()` first
   - Use `.raw()` for pre-formatted output to avoid double formatting

## Files Already Migrated

- ✅ `packages/harness/src/lib/logger.ts` - Logger implementation
- ✅ `packages/harness/src/cli.ts` - CLI entry point (partial)
- ✅ `packages/harness/src/domain/warmup.ts` - Warmup module (complete)

## Files Pending Migration

See migration script output for complete list. Key files:

- `packages/harness/src/domain/agent.ts` (37+ console.log)
- `packages/harness/src/execution/benchmark.ts` (83+ console.log)
- `packages/harness/src/interactive/benchmark.ts` (103+ console.log)
- `packages/harness/src/interactive/statistics.ts` (72+ console.log)
- `packages/agent-adapters/src/specialist.ts` (164+ console.log)
- And many more...

## Testing

To verify logging works correctly:

```bash
# Test with all logs enabled
DEBUG=ze:* pnpm cli

# Test with specific context
DEBUG=ze:warmup pnpm cli warmup <suite> <scenario>

# Test without debug logs
DEBUG= pnpm cli
```

## Troubleshooting

### Logs not appearing
- Check `DEBUG` environment variable is set: `DEBUG=ze:*`
- Verify logger import is correct
- Ensure you're using the right context name

### Too much output
- Use more specific DEBUG filter: `DEBUG=ze:cli,ze:benchmark`
- Lower log levels (use .info instead of .debug)
- Check for log spam in loops

### Colors not showing
- Ensure chalk is imported if using pre-formatted messages
- Use logger methods instead of manual chalk formatting
- Check terminal supports colors

## Resources

- [debug package documentation](https://www.npmjs.com/package/debug)
- [@clack/prompts documentation](https://www.npmjs.com/package/@clack/prompts)
- [Project logging patterns](/packages/harness/src/lib/logger.ts)
