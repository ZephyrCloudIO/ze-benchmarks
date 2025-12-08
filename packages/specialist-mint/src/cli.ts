#!/usr/bin/env node
import { Command } from 'commander';
import { mintSnapshot } from './mint.js';
import { enrichTemplate } from './enrich-template.js';
import { createVersionCommand, createChangelogCommand } from './cli-version.js';
import chalk from 'chalk';
import { logger } from '@ze/logger';

const log = logger.specialistMintCli;

const program = new Command();

program
  .name('specialist-mint')
  .description('CLI tool to mint specialist snapshots from templates and benchmark results')
  .version('2.0.0');

program
  .command('mint:snapshot')
  .description('Combine specialist template with benchmark results to create a snapshot')
  .argument('<template-path>', 'Path to the specialist template JSON5 file (relative to cwd)')
  .requiredOption('--output <path>', 'Output directory for the snapshot (relative to cwd)')
  .requiredOption('--batch-id <id>', 'Batch ID from ze-benchmarks to load all runs from')
  .option('--worker-url <url>', 'Worker API URL (defaults to ZE_BENCHMARKS_WORKER_URL env var or http://localhost:8787)')
  .action(async (templatePath: string, options: { output: string; batchId: string; workerUrl?: string }) => {
    try {
      log.debug(chalk.blue('\n🔨 Starting snapshot minting process...\n'));

      const result = await mintSnapshot(templatePath, options.output, {
        batchId: options.batchId,
        workerUrl: options.workerUrl
      });

      log.debug(chalk.green('\n✅ Snapshot minted successfully!'));
      log.debug(chalk.gray(`   Snapshot ID: ${result.snapshotId}`));
      log.debug(chalk.gray(`   Output path: ${result.outputPath}`));
      log.debug(chalk.gray(`   Template version: ${result.templateVersion}\n`));
    } catch (error) {
      log.error(chalk.red('\n❌ Error minting snapshot:'));
      log.error(chalk.red(`   ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  });

program
  .command('enrich:template')
  .description('Enrich a specialist template with LLM-generated documentation metadata')
  .argument('<template-path>', 'Path to the specialist template JSON5 file (relative to cwd)')
  .option('--provider <provider>', 'LLM provider (openrouter or anthropic)', 'openrouter')
  .option('--model <model>', 'Model to use for enrichment', process.env.ENRICHMENT_MODEL || 'anthropic/claude-3.5-haiku')
  .option('--force', 'Force re-enrichment even if already enriched', false)
  .option('--timeout <ms>', 'Timeout for each document enrichment in ms', '30000')
  .option('--concurrency <n>', 'Maximum number of documents to enrich concurrently', '3')
  .action(async (templatePath: string, options: {
    provider: 'openrouter' | 'anthropic';
    model: string;
    force: boolean;
    timeout: string;
    concurrency: string;
  }) => {
    try {
      log.debug(chalk.blue('\n🔍 Starting template enrichment process...\n'));

      const result = await enrichTemplate(templatePath, {
        provider: options.provider,
        model: options.model,
        force: options.force,
        timeoutMs: parseInt(options.timeout, 10),
        concurrency: parseInt(options.concurrency, 10)
      });

      log.debug(chalk.green('\n✅ Template enrichment completed!'));
      log.debug(chalk.gray(`   Enriched template: ${result.enrichedTemplatePath}`));
      log.debug(chalk.gray(`   Documents enriched: ${result.documentsEnriched}`));
      log.debug(chalk.gray(`   Documents skipped: ${result.documentsSkipped}`));

      if (result.errors.length > 0) {
        log.debug(chalk.yellow(`   Errors: ${result.errors.length}\n`));
        process.exit(1);
      } else {
        log.debug();
      }
    } catch (error) {
      log.error(chalk.red('\n❌ Error enriching template:'));
      log.error(chalk.red(`   ${error instanceof Error ? error.message : String(error)}\n`));
      process.exit(1);
    }
  });

// Version management commands
program.addCommand(createVersionCommand());
program.addCommand(createChangelogCommand());

program.parse();
