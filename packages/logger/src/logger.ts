import debug from 'debug';
import chalk from 'chalk';
import { log as clackLog } from '@clack/prompts';

/**
 * Main namespace for all ze-benchmarks logging
 */
const NAMESPACE = 'ze';

/**
 * Logger interface providing contextualized logging methods
 */
export interface Logger {
  /** Debug-level logging (gray) - for detailed troubleshooting */
  debug: (...args: any[]) => void;
  /** Info-level logging (blue) - for general information */
  info: (...args: any[]) => void;
  /** Warning-level logging (yellow) - for warnings */
  warn: (...args: any[]) => void;
  /** Error-level logging (red) - for errors */
  error: (...args: any[]) => void;
  /** Success-level logging (green) - for success messages */
  success: (...args: any[]) => void;
  /** Raw console output - for special cases that need direct console access */
  raw: (...args: any[]) => void;
  /** Formatted output - preserves formatting from chalk or other libraries */
  formatted: (message: string) => void;
}

/**
 * Creates a contextualized logger instance
 *
 * @param context - The context/module name (e.g., 'cli', 'benchmark', 'warmup')
 * @param useClack - Whether to also output to @clack/prompts for user-facing messages
 * @returns A Logger instance with contextualized debug namespace
 */
export function createLogger(context: string, useClack: boolean = false): Logger {
  const namespace = `${NAMESPACE}:${context}`;
  const debugLogger = debug(namespace);

  const formatArgs = (args: any[]): string => {
    return args.map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
  };

  return {
    debug: (...args) => {
      const message = formatArgs(args);
      if (useClack) {
        // When using Clack, output directly to console for debug
        console.log(chalk.gray(message));
      } else {
        debugLogger(chalk.gray(message));
      }
    },
    info: (...args) => {
      const message = formatArgs(args);
      if (useClack) {
        clackLog.info(message);
      } else {
        debugLogger(chalk.blue(message));
      }
    },
    warn: (...args) => {
      const message = formatArgs(args);
      if (useClack) {
        clackLog.warning(message);
      } else {
        debugLogger(chalk.yellow(message));
      }
    },
    error: (...args) => {
      const message = formatArgs(args);
      if (useClack) {
        clackLog.error(message);
      } else {
        debugLogger(chalk.red(message));
      }
    },
    success: (...args) => {
      const message = formatArgs(args);
      if (useClack) {
        clackLog.success(message);
      } else {
        debugLogger(chalk.green(message));
      }
    },
    raw: (...args) => {
      // For cases where we need direct console output (e.g., stats tables)
      console.log(...args);
    },
    formatted: (message: string) => {
      // For pre-formatted messages (already contains chalk colors)
      if (useClack) {
        console.log(message);
      } else {
        debugLogger(message);
      }
    }
  };
}

/**
 * Pre-configured logger instances for common contexts
 *
 * Usage:
 * ```typescript
 * import { logger } from './lib/logger';
 *
 * logger.cli.info('Starting benchmark...');
 * logger.benchmark.debug('Execution details:', details);
 * logger.warmup.success('Warmup completed');
 * ```
 *
 * Enable all logs: DEBUG=ze:* pnpm cli
 * Enable specific context: DEBUG=ze:cli pnpm cli
 * Enable multiple contexts: DEBUG=ze:cli,ze:benchmark pnpm cli
 */
export const logger = {
  /** Create a custom logger for any context */
  create: createLogger,

  /** CLI-specific logging with clack integration */
  cli: createLogger('cli', true),

  /** Benchmark execution logging with clack integration */
  benchmark: createLogger('benchmark', true),

  /** Warmup phase logging */
  warmup: createLogger('warmup'),

  /** Agent detection and management logging */
  agent: createLogger('agent'),

  /** Scenario loading and management logging */
  scenario: createLogger('scenario'),

  /** Interactive menu and UI logging with clack integration */
  interactive: createLogger('interactive', true),

  /** Execution flow logging */
  execution: createLogger('execution'),

  /** Display and formatting logging */
  display: createLogger('display'),

  /** Workspace utilities logging */
  workspace: createLogger('workspace'),

  /** Configuration logging */
  config: createLogger('config'),

  /** Statistics and reporting logging */
  stats: createLogger('stats'),

  /** Suite management logging */
  suite: createLogger('suite'),

  /** History logging */
  history: createLogger('history'),

  /** OpenRouter API logging */
  api: createLogger('api'),

  // Agent Adapters
  /** OpenRouter adapter logging */
  openrouter: createLogger('openrouter'),

  /** Specialist adapter logging */
  specialist: createLogger('specialist'),

  /** Anthropic adapter logging */
  anthropic: createLogger('anthropic'),

  /** LLM prompt selector logging */
  llmPromptSelector: createLogger('llm-prompt-selector'),

  // Evaluators
  /** Evaluators logging */
  evaluators: createLogger('evaluators'),

  /** Config accuracy evaluator logging */
  configAccuracy: createLogger('config-accuracy'),

  /** Dependency proximity evaluator logging */
  dependencyProximity: createLogger('dependency-proximity'),

  /** LLM judge evaluator logging */
  llmJudge: createLogger('llm-judge'),

  /** Workspace utilities logging */
  workspaceUtils: createLogger('workspace-utils'),

  // Agency Prompt Creator
  /** Task detection logging */
  taskDetection: createLogger('task-detection'),

  /** Template loader logging */
  templateLoader: createLogger('template-loader'),

  /** Doc filter logging */
  docFilter: createLogger('doc-filter'),

  /** LLM substitution logging */
  llmSubstitution: createLogger('llm-substitution'),

  /** Schema analyzer logging */
  schemaAnalyzer: createLogger('schema-analyzer'),

  // Specialist Mint
  /** Schema validation logging */
  validateSchemas: createLogger('validate-schemas'),

  /** Benchmark loader logging */
  benchmarkLoader: createLogger('benchmark-loader'),

  /** Benchmark cache logging */
  benchmarkCache: createLogger('benchmark-cache'),

  /** Specialist mint CLI logging */
  specialistMintCli: createLogger('specialist-mint-cli'),

  /** Specialist mint logging */
  specialistMint: createLogger('specialist-mint'),

  /** LLM client logging */
  llmClient: createLogger('llm-client'),

  /** Template enrichment logging */
  enrichTemplate: createLogger('enrich-template'),

  /** Template resolver logging */
  templateResolver: createLogger('template-resolver'),

  // Harness Runtime
  /** Figma tools logging */
  figmaTools: createLogger('figma-tools'),

  /** MCP tools logging */
  mcpTools: createLogger('mcp-tools'),

  /** Diff tools logging */
  diff: createLogger('diff'),

  /** Ask user tool logging */
  askUserTool: createLogger('ask-user-tool'),

  /** Validation logging */
  validation: createLogger('validation'),

  // Harness Lib
  /** OpenRouter API logging */
  openrouterApi: createLogger('openrouter-api'),

  // Worker Client
  /** Worker client logging */
  workerClient: createLogger('worker-client')
};

/**
 * Debug logging is opt-in via DEBUG environment variable
 *
 * Examples:
 * - DEBUG=ze:* - Enable all ze-benchmarks logs
 * - DEBUG=ze:openrouter,ze:specialist - Enable only specific contexts
 * - (no DEBUG env) - Debug disabled (default)
 *
 * Note: Clack-based loggers (cli, benchmark, interactive) always output
 */

/**
 * Helper to enable/disable logging programmatically
 */
export const setDebugNamespace = (namespace: string) => {
  debug.enable(namespace);
};

/**
 * Helper to check if debug is enabled for a specific namespace
 */
export const isDebugEnabled = (context: string): boolean => {
  return debug.enabled(`${NAMESPACE}:${context}`);
};
