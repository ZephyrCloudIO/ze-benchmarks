#!/usr/bin/env tsx

import { BenchmarkLogger } from '../packages/database/src/logger';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import chalk from 'chalk';

interface ClearOptions {
  target?: 'benchmarks' | 'dashboard' | 'all';
}

function clearBenchmarksDatabase() {
  console.log(chalk.blue('Clearing ze-benchmarks database...'));

  const dbPath = join(process.cwd(), 'benchmark-report', 'public', 'benchmarks.db');

  if (!existsSync(dbPath)) {
    console.log(chalk.yellow('⚠ Database does not exist, creating empty one...'));
    const logger = new BenchmarkLogger(dbPath);
    logger.close();
    console.log(chalk.green('✓ Created empty database'));
  } else {
    const logger = new BenchmarkLogger(dbPath);
    logger.clearDatabase();
    logger.close();
    console.log(chalk.green('✓ Cleared ze-benchmarks database'));
  }

  return dbPath;
}

function clearDashboardDatabase() {
  console.log(chalk.blue('Clearing specialist-dashboard database...'));

  // Get the path to the dashboard database
  const dashboardDbPath = join(process.cwd(), '..', 'specialist-dashboard', 'public', 'benchmarks.db');
  const dashboardDbDir = dirname(dashboardDbPath);

  // Ensure directory exists
  if (!existsSync(dashboardDbDir)) {
    mkdirSync(dashboardDbDir, { recursive: true });
  }

  if (!existsSync(dashboardDbPath)) {
    console.log(chalk.yellow('⚠ Dashboard database does not exist, creating empty one...'));
    const logger = new BenchmarkLogger(dashboardDbPath);
    logger.close();
    console.log(chalk.green('✓ Created empty dashboard database'));
  } else {
    const logger = new BenchmarkLogger(dashboardDbPath);
    logger.clearDatabase();
    logger.close();
    console.log(chalk.green('✓ Cleared specialist-dashboard database'));
  }
}

function syncDatabases() {
  console.log(chalk.blue('Syncing databases...'));

  const benchmarksDbPath = join(process.cwd(), 'benchmark-report', 'public', 'benchmarks.db');
  const dashboardDbPath = join(process.cwd(), '..', 'specialist-dashboard', 'public', 'benchmarks.db');
  const dashboardDbDir = dirname(dashboardDbPath);

  // Ensure benchmarks database exists
  if (!existsSync(benchmarksDbPath)) {
    console.log(chalk.yellow('⚠ Benchmarks database does not exist, creating it...'));
    const logger = new BenchmarkLogger(benchmarksDbPath);
    logger.close();
  }

  // Ensure dashboard directory exists
  if (!existsSync(dashboardDbDir)) {
    mkdirSync(dashboardDbDir, { recursive: true });
  }

  // Copy benchmarks database to dashboard
  copyFileSync(benchmarksDbPath, dashboardDbPath);
  console.log(chalk.green('✓ Synced databases'));
}

async function main() {
  const args = process.argv.slice(2);
  const target = (args[0] as ClearOptions['target']) || 'all';

  console.log(chalk.bold('\n🗑️  Database Clear Tool\n'));

  try {
    if (target === 'benchmarks') {
      const dbPath = clearBenchmarksDatabase();
      console.log(chalk.gray(`\nDatabase: ${dbPath}`));
    } else if (target === 'dashboard') {
      clearDashboardDatabase();
    } else if (target === 'all') {
      // Clear benchmarks database first
      const dbPath = clearBenchmarksDatabase();

      // Then sync it to dashboard (this will clear the dashboard too)
      syncDatabases();

      console.log(chalk.gray(`\nCleared both databases`));
    } else {
      console.error(chalk.red(`Invalid target: ${target}`));
      console.error(chalk.gray('Valid targets: benchmarks, dashboard, all'));
      process.exit(1);
    }

    console.log(chalk.green('\n✓ All done!\n'));
  } catch (error) {
    console.error(chalk.red('\n✖ Error:'), error);
    process.exit(1);
  }
}

main();
