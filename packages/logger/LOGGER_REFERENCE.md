# @ze/logger

Centralized logging system for ze-benchmarks with context-based namespacing and debug control.

## Installation

```bash
# Already included as workspace dependency
import { logger } from '@ze/logger';
```

## Usage

```typescript
import { logger } from '@ze/logger';

// Use predefined logger contexts
logger.cli.info('Starting benchmark...');
logger.openrouter.debug('API request sent');
logger.specialist.error('Failed to load template');
logger.benchmark.success('Benchmark completed!');
```

## Available Methods

Each logger context provides these methods:

- `debug(...args)` - Debug-level logging (gray)
- `info(...args)` - Info-level logging (blue)
- `warn(...args)` - Warning-level logging (yellow)
- `error(...args)` - Error-level logging (red)
- `success(...args)` - Success-level logging (green)
- `raw(...args)` - Raw console output (no formatting)
- `formatted(message)` - Pre-formatted message output

## Available Contexts

### CLI & Interactive
- `logger.cli` - CLI operations (uses Clack)
- `logger.interactive` - Interactive menu and UI (uses Clack)

### Benchmark & Execution
- `logger.benchmark` - Benchmark execution (uses Clack)
- `logger.execution` - Execution flow
- `logger.warmup` - Warmup phase
- `logger.stats` - Statistics and reporting
- `logger.display` - Display and formatting

### Domain
- `logger.agent` - Agent detection and management
- `logger.scenario` - Scenario loading and management
- `logger.suite` - Suite management
- `logger.history` - History logging
- `logger.workspace` - Workspace utilities
- `logger.config` - Configuration

### Agent Adapters
- `logger.openrouter` - OpenRouter adapter
- `logger.specialist` - Specialist adapter
- `logger.anthropic` - Anthropic adapter
- `logger.llmPromptSelector` - LLM prompt selector
- `logger.api` - OpenRouter API
- `logger.openrouterApi` - OpenRouter API utilities

### Evaluators
- `logger.evaluators` - Evaluators system
- `logger.llmJudge` - LLM judge evaluator
- `logger.configAccuracy` - Config accuracy evaluator
- `logger.dependencyProximity` - Dependency proximity evaluator
- `logger.workspaceUtils` - Workspace utilities for evaluators

### Agency Prompt Creator
- `logger.taskDetection` - Task detection
- `logger.templateLoader` - Template loader
- `logger.docFilter` - Documentation filter
- `logger.llmSubstitution` - LLM substitution
- `logger.schemaAnalyzer` - Schema analyzer

### Specialist Mint
- `logger.specialistMint` - Specialist mint operations
- `logger.specialistMintCli` - Specialist mint CLI
- `logger.validateSchemas` - Schema validation
- `logger.benchmarkLoader` - Benchmark loader
- `logger.llmClient` - LLM client
- `logger.enrichTemplate` - Template enrichment
- `logger.templateResolver` - Template resolver

### Harness Runtime
- `logger.figmaTools` - Figma tools
- `logger.mcpTools` - MCP tools
- `logger.diff` - Diff tools
- `logger.askUserTool` - Ask user tool
- `logger.validation` - Validation

## Debug Control

### Default Behavior
- **Clack loggers** (cli, benchmark, interactive) - Always output
- **Debug loggers** (all others) - Silent by default, opt-in via DEBUG env

### Enable Debug Logging

```bash
# Enable all debug logs
DEBUG=ze:* pnpm cli

# Enable specific contexts
DEBUG=ze:openrouter,ze:specialist pnpm cli

# Enable all agent adapters
DEBUG=ze:openrouter,ze:specialist,ze:anthropic pnpm cli

# Enable pattern matching
DEBUG=ze:*mint* pnpm cli  # Matches specialist-mint, etc.
```

## Clack Integration

Loggers with Clack integration (`cli`, `benchmark`, `interactive`) automatically use Clack's formatted output for better UX. These loggers bypass the debug system and always output to provide user feedback.

## Creating Custom Contexts

⚠️ **Don't use `logger.create()`** - All contexts should be predefined in the centralized logger.

If you need a new context:
1. Add it to `/packages/logger/src/logger.ts`
2. Export it from the main `logger` object
3. Update this documentation

## Examples

```typescript
// CLI logging (always visible)
logger.cli.info('Starting benchmark...');
logger.cli.warn('No model specified');
logger.cli.error('Failed to load scenario');

// Debug logging (requires DEBUG=ze:*)
logger.openrouter.debug('Sending request to API');
logger.specialist.info('Loading template...');
logger.benchmark.success('All tests passed!');

// Raw output for tables/formatted content
logger.cli.raw(formatStatsTable(data));

// Pre-formatted messages (with chalk colors)
logger.cli.formatted(chalk.green('Success!'));
```

## Architecture

The logger uses the `debug` library for namespace-based filtering, combined with Clack for user-facing output and chalk for colors. This provides:

- ✅ Context-based organization
- ✅ Granular debug control
- ✅ Beautiful CLI output with Clack
- ✅ Colored console output
- ✅ Zero overhead when disabled
