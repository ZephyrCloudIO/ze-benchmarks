#!/usr/bin/env tsx
/**
 * Orchestration script for the complete testing workflow
 *
 * This script runs the entire workflow end-to-end:
 * 1. Run benchmarks
 * 2. Extract batch ID
 * 3. Mint snapshot
 * 4. Export prompts
 * 5. Validate prompts
 *
 * Usage:
 *   pnpm workflow:iterate --template <path> --suite <name> --scenario <name> [options]
 *
 * Examples:
 *   pnpm workflow:iterate \
 *     --template starting_from_outcome/shadcn-specialist.json5 \
 *     --suite shadcn-generate-vite \
 *     --scenario shadcn-generate-vite
 *
 *   pnpm workflow:iterate \
 *     --template starting_from_outcome/shadcn-specialist.json5 \
 *     --suite shadcn-generate-vite \
 *     --scenario shadcn-generate-vite \
 *     --tier L1 \
 *     --output ./custom-snapshots \
 *     --dry-run
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';

// ESM __dirname polyfill
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface WorkflowOptions {
  template: string;
  suite: string;
  scenario: string;
  tier: string;
  output: string;
  dryRun: boolean;
}

interface StepResult {
  success: boolean;
  output?: string;
  error?: string;
  batchId?: string;
  snapshotPath?: string;
  promptsFile?: string;
}

function parseArgs(): WorkflowOptions {
  let args = process.argv.slice(2);

  // Skip '--' if it's the first argument (pnpm passes it as separator)
  if (args[0] === '--') {
    args = args.slice(1);
  }

  const options: Partial<WorkflowOptions> = {
    tier: 'L0',
    output: './agency-specialist-mint/snapshots',
    dryRun: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template' && args[i + 1]) {
      options.template = args[i + 1];
      i++;
    } else if (args[i] === '--suite' && args[i + 1]) {
      options.suite = args[i + 1];
      i++;
    } else if (args[i] === '--scenario' && args[i + 1]) {
      options.scenario = args[i + 1];
      i++;
    } else if (args[i] === '--tier' && args[i + 1]) {
      options.tier = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      options.dryRun = true;
    }
  }

  // Validate required arguments
  if (!options.template || !options.suite || !options.scenario) {
    console.error(chalk.red('❌ Error: Missing required arguments'));
    console.log('\n' + chalk.bold('Usage:'));
    console.log(`  ${chalk.cyan('pnpm workflow:iterate')} --template <path> --suite <name> --scenario <name> [options]`);
    console.log('\n' + chalk.bold('Required:'));
    console.log(`  ${chalk.cyan('--template')} <path>       Path to specialist template`);
    console.log(`  ${chalk.cyan('--suite')} <name>          Benchmark suite name`);
    console.log(`  ${chalk.cyan('--scenario')} <name>       Scenario name`);
    console.log('\n' + chalk.bold('Optional:'));
    console.log(`  ${chalk.cyan('--tier')} <level>         Difficulty tier (default: L0)`);
    console.log(`  ${chalk.cyan('--output')} <path>        Snapshot output directory (default: ./agency-specialist-mint/snapshots)`);
    console.log(`  ${chalk.cyan('--dry-run')}              Print commands without executing`);
    console.log('\n' + chalk.bold('Examples:'));
    console.log(chalk.gray(`  pnpm workflow:iterate \\`));
    console.log(chalk.gray(`    --template starting_from_outcome/shadcn-specialist.json5 \\`));
    console.log(chalk.gray(`    --suite shadcn-generate-vite \\`));
    console.log(chalk.gray(`    --scenario shadcn-generate-vite`));
    process.exit(1);
  }

  return options as WorkflowOptions;
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
  stepName: string
): Promise<StepResult> {
  return new Promise((resolve) => {
    console.log(chalk.blue(`\n▶ ${stepName}`));
    console.log(chalk.gray(`  Command: ${command} ${args.join(' ')}`));
    console.log(chalk.gray(`  CWD: ${cwd}`));

    const child = spawn(command, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        const output = data.toString();
        stdout += output;
        process.stdout.write(chalk.gray(`  ${output}`));
      });
    }

    if (child.stderr) {
      child.stderr.on('data', (data) => {
        const output = data.toString();
        stderr += output;
        process.stderr.write(chalk.yellow(`  ${output}`));
      });
    }

    child.on('close', (code) => {
      if (code === 0) {
        console.log(chalk.green(`✓ ${stepName} completed`));
        resolve({ success: true, output: stdout });
      } else {
        console.error(chalk.red(`✗ ${stepName} failed with code ${code}`));
        resolve({ success: false, error: stderr || stdout, output: stdout });
      }
    });

    child.on('error', (error) => {
      console.error(chalk.red(`✗ ${stepName} error: ${error.message}`));
      resolve({ success: false, error: error.message });
    });
  });
}

function extractBatchId(output: string): string | null {
  // Look for "Batch ID: <uuid>" in the output
  const match = output.match(/Batch ID:\s*([a-f0-9-]+)/i);
  return match ? match[1] : null;
}

async function main() {
  console.log(chalk.cyan.bold('\n🔄 Workflow Iteration - Complete Testing Pipeline\n'));

  const options = parseArgs();

  // Resolve paths
  const workspaceRoot = resolve(__dirname, '../..');
  const templatePath = resolve(workspaceRoot, options.template);
  const outputPath = resolve(workspaceRoot, options.output);

  // Validate template exists
  if (!existsSync(templatePath)) {
    console.error(chalk.red(`❌ Template not found: ${templatePath}`));
    process.exit(1);
  }

  // Print configuration
  console.log(chalk.bold('Configuration:'));
  console.log(`  Template: ${chalk.cyan(templatePath)}`);
  console.log(`  Suite: ${chalk.cyan(options.suite)}`);
  console.log(`  Scenario: ${chalk.cyan(options.scenario)}`);
  console.log(`  Tier: ${chalk.cyan(options.tier)}`);
  console.log(`  Output: ${chalk.cyan(outputPath)}`);
  console.log(`  Dry run: ${chalk.cyan(options.dryRun ? 'yes' : 'no')}`);

  if (options.dryRun) {
    console.log(chalk.yellow('\n🔍 Dry run mode - showing commands that would be executed:\n'));

    const steps = [
      {
        name: 'Step 1: Run benchmarks',
        command: 'pnpm bench:run',
        args: [options.suite, options.scenario, '--tier', options.tier]
      },
      {
        name: 'Step 2: Mint snapshot',
        command: 'pnpm mint:snapshot',
        args: [templatePath, 'ze-benchmarks', '--output', outputPath, '--batch-id', '<extracted-batch-id>']
      },
      {
        name: 'Step 3: Export prompts',
        command: 'pnpm bench:export-prompts',
        args: ['<batch-id>', '/tmp/prompts-<batch-id>.json']
      },
      {
        name: 'Step 4: Validate prompts',
        command: 'pnpm validate:prompts',
        args: ['--prompts-file', '/tmp/prompts-<batch-id>.json', templatePath]
      }
    ];

    for (const step of steps) {
      console.log(chalk.blue(`${step.name}:`));
      console.log(chalk.gray(`  ${step.command} ${step.args.join(' ')}\n`));
    }

    console.log(chalk.yellow('💡 Remove --dry-run to execute the workflow'));
    return;
  }

  // Ensure output directory exists
  if (!existsSync(outputPath)) {
    console.log(chalk.blue(`\n📁 Creating output directory: ${outputPath}`));
    mkdirSync(outputPath, { recursive: true });
  }

  let batchId: string | null = null;
  let promptsFile: string | null = null;
  let snapshotPath: string | null = null;

  try {
    // Step 1: Run benchmarks
    console.log(chalk.cyan.bold('\n━━━ Step 1: Run Benchmarks ━━━'));
    const benchResult = await runCommand(
      'pnpm',
      ['bench:run', options.suite, options.scenario, '--tier', options.tier],
      workspaceRoot,
      'Running benchmarks'
    );

    if (!benchResult.success) {
      throw new Error(`Benchmark execution failed: ${benchResult.error}`);
    }

    // Extract batch ID from output
    if (benchResult.output) {
      batchId = extractBatchId(benchResult.output);
    }

    if (!batchId) {
      throw new Error('Failed to extract batch ID from benchmark output');
    }

    console.log(chalk.green(`\n✓ Batch ID extracted: ${chalk.bold(batchId)}`));

    // Step 2: Mint snapshot
    console.log(chalk.cyan.bold('\n━━━ Step 2: Mint Snapshot ━━━'));
    const mintResult = await runCommand(
      'pnpm',
      ['mint:snapshot', templatePath, 'ze-benchmarks', '--output', outputPath, '--batch-id', batchId],
      workspaceRoot,
      'Minting snapshot'
    );

    if (!mintResult.success) {
      throw new Error(`Snapshot minting failed: ${mintResult.error}`);
    }

    // Extract snapshot path from output (look for "Snapshot saved to: <path>")
    if (mintResult.output) {
      const match = mintResult.output.match(/Snapshot saved to:\s*(.+)/i);
      if (match) {
        snapshotPath = match[1].trim();
      }
    }

    // Step 3: Export prompts
    console.log(chalk.cyan.bold('\n━━━ Step 3: Export Prompts ━━━'));
    promptsFile = `/tmp/prompts-${batchId}.json`;
    const exportResult = await runCommand(
      'pnpm',
      ['bench:export-prompts', batchId, promptsFile],
      workspaceRoot,
      'Exporting prompts'
    );

    if (!exportResult.success) {
      throw new Error(`Prompt export failed: ${exportResult.error}`);
    }

    console.log(chalk.green(`\n✓ Prompts exported to: ${chalk.bold(promptsFile)}`));

    // Step 4: Validate prompts
    console.log(chalk.cyan.bold('\n━━━ Step 4: Validate Prompts ━━━'));
    const validateResult = await runCommand(
      'pnpm',
      ['validate:prompts', '--prompts-file', promptsFile, templatePath],
      workspaceRoot,
      'Validating prompts'
    );

    if (!validateResult.success) {
      console.warn(chalk.yellow(`\n⚠️  Prompt validation reported issues (see output above)`));
      console.warn(chalk.yellow('   This may indicate prompts need refinement'));
    }

    // Success summary
    console.log(chalk.green.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.log(chalk.green.bold('✨ Workflow completed successfully!'));
    console.log(chalk.green.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.log(chalk.bold('Summary:'));
    console.log(`  Batch ID: ${chalk.cyan(batchId)}`);
    if (snapshotPath) {
      console.log(`  Snapshot: ${chalk.cyan(snapshotPath)}`);
    }
    console.log(`  Prompts: ${chalk.cyan(promptsFile)}`);
    console.log(`  Validation: ${validateResult.success ? chalk.green('passed') : chalk.yellow('warnings')}`);

    console.log(chalk.bold('\n💡 Next steps:'));
    console.log(`  • View results: ${chalk.cyan('pnpm dashboard:dev')}`);
    console.log(`  • Compare batches: ${chalk.cyan('pnpm bench:compare')} ${batchId} <other-batch-id>`);
    console.log(`  • Review prompts: ${chalk.cyan(`cat ${promptsFile}`)}`);
    if (snapshotPath) {
      console.log(`  • Review snapshot: ${chalk.cyan(`cat ${snapshotPath}`)}`);
    }

  } catch (error) {
    console.error(chalk.red.bold('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
    console.error(chalk.red.bold('❌ Workflow failed'));
    console.error(chalk.red.bold('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n'));

    console.error(chalk.red('Error: '), error instanceof Error ? error.message : String(error));

    if (batchId) {
      console.log(chalk.yellow('\n📋 Partial results available:'));
      console.log(`  Batch ID: ${chalk.cyan(batchId)}`);
      if (promptsFile && existsSync(promptsFile)) {
        console.log(`  Prompts file: ${chalk.cyan(promptsFile)} ${chalk.gray('(kept for debugging)')}`);
      }
      console.log(`  View batch: ${chalk.cyan('pnpm dashboard:dev')}`);
    }

    process.exit(1);
  }
}

main();
