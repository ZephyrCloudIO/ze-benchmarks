#!/usr/bin/env tsx
/**
 * Compare benchmark results across multiple batches
 *
 * This script wraps the ze-benchmarks --compare-batches command
 * and provides additional output formatting for dashboard consumption.
 *
 * Usage:
 *   pnpm bench:compare <batch-id1> <batch-id2> [batch-id3...]
 *
 * Examples:
 *   pnpm bench:compare abc123 def456
 *   pnpm bench:compare abc123 def456 ghi789
 */

import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import chalk from 'chalk';

function parseArgs(): string[] {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.error(chalk.red('❌ Error: At least two batch IDs required'));
    console.log('\n' + chalk.bold('Usage:'));
    console.log(`  ${chalk.cyan('pnpm bench:compare')} <batch-id1> <batch-id2> [batch-id3...]`);
    console.log('\n' + chalk.bold('Examples:'));
    console.log(`  ${chalk.gray('pnpm bench:compare abc123 def456')}`);
    console.log(`  ${chalk.gray('pnpm bench:compare abc123 def456 ghi789')}`);
    console.log('\n' + chalk.bold('Tips:'));
    console.log(`  • View recent batches: ${chalk.cyan('pnpm --filter ze-benchmarks bench --batches')}`);
    console.log(`  • View batch details: ${chalk.cyan('pnpm --filter ze-benchmarks bench --batch-details <id>')}`);
    console.log(`  • View in dashboard: ${chalk.cyan('pnpm dashboard:dev')}`);
    process.exit(1);
  }

  return args;
}

async function main() {
  console.log(chalk.cyan.bold('\n📊 Comparing benchmark batches\n'));

  try {
    // Parse arguments
    const batchIds = parseArgs();

    console.log(chalk.blue(`Comparing ${batchIds.length} batches:`));
    batchIds.forEach((id, index) => {
      console.log(chalk.gray(`  ${index + 1}. ${id}`));
    });
    console.log();

    // Build and execute the command
    const cliPath = resolve(__dirname, '../packages/harness/src/cli.ts');
    const cmd = `tsx ${cliPath} --compare-batches ${batchIds.join(' ')}`;

    execSync(cmd, {
      cwd: resolve(__dirname, '..'),
      stdio: 'inherit'
    });

    console.log(chalk.bold.green('\n✨ Comparison complete!\n'));
    console.log(chalk.bold('Next steps:'));
    console.log(`  • View in dashboard: ${chalk.cyan('pnpm dashboard:dev')}`);
    console.log(`  • View batch details: ${chalk.cyan('pnpm --filter ze-benchmarks bench --batch-details <id>')}`);
    console.log();
  } catch (error) {
    const exitCode = (error as any).status || 1;
    if (exitCode !== 0) {
      console.error(chalk.red('\n❌ Comparison failed'));
      process.exit(exitCode);
    }
  }
}

main();
