#!/usr/bin/env tsx
/**
 * Validate specialist prompts contain expected template content
 *
 * This script validates that exported prompts from a batch run contain
 * the specialist-specific content from the template file.
 *
 * Usage:
 *   pnpm validate:prompts <batch-id> <template-path>
 *   pnpm validate:prompts --prompts-file <prompts-json> <template-path>
 *
 * Examples:
 *   pnpm validate:prompts abc123 starting_from_outcome/shadcn-specialist.json5
 *   pnpm validate:prompts --prompts-file batch-prompts.json starting_from_outcome/shadcn-specialist.json5
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import JSON5 from 'json5';

interface PromptData {
  runId: string;
  suite: string;
  scenario: string;
  agent: string;
  model: string;
  tier: string;
  specialist?: string;
  messages: any[];
  score: number | null;
  success: boolean;
  timestamp: string;
}

interface ExportedPrompts {
  batchId: string;
  exportedAt: string;
  totalRuns: number;
  runs: PromptData[];
}

interface SpecialistTemplate {
  name: string;
  displayName?: string;
  version: string;
  persona: {
    purpose: string;
    values: string[];
    attributes?: string[];
  };
  prompts?: {
    default?: {
      spawnerPrompt?: string;
    };
    model_specific?: Record<string, {
      spawnerPrompt?: string;
      [key: string]: any;
    }>;
  };
}

interface ValidationResult {
  runId: string;
  specialist?: string;
  model: string;
  passed: boolean;
  findings: {
    foundPurpose: boolean;
    foundValues: number;
    foundAttributes: number;
    foundSpawnerPrompt: boolean;
  };
  missingContent: string[];
}

function findDatabasePath(): string {
  // Check environment variable first
  if (process.env.BENCHMARK_DB_PATH) {
    return resolve(process.env.BENCHMARK_DB_PATH);
  }

  // Default location
  return resolve(__dirname, '../benchmark-report/public/benchmarks.db');
}

function parseArgs(): {
  batchId?: string;
  promptsFile?: string;
  templatePath: string;
} {
  // Filter out '--' separator that pnpm adds
  const args = process.argv.slice(2).filter(arg => arg !== '--');

  if (args.length === 0) {
    console.error(chalk.red('❌ Error: Arguments required'));
    console.log('\n' + chalk.bold('Usage:'));
    console.log(`  ${chalk.cyan('pnpm validate:prompts')} <batch-id> <template-path>`);
    console.log(`  ${chalk.cyan('pnpm validate:prompts')} --prompts-file <prompts-json> <template-path>`);
    console.log('\n' + chalk.bold('Examples:'));
    console.log(`  ${chalk.gray('pnpm validate:prompts abc123 starting_from_outcome/shadcn-specialist.json5')}`);
    console.log(`  ${chalk.gray('pnpm validate:prompts --prompts-file batch-prompts.json starting_from_outcome/shadcn-specialist.json5')}`);
    console.log('\n' + chalk.bold('Tips:'));
    console.log(`  • Export prompts first: ${chalk.cyan('pnpm export:prompts <batch-id> prompts.json')}`);
    console.log(`  • View recent batches: ${chalk.cyan('pnpm --filter ze-benchmarks bench --batches')}`);
    process.exit(1);
  }

  if (args[0] === '--prompts-file') {
    if (args.length < 3) {
      console.error(chalk.red('❌ Error: Template path required'));
      process.exit(1);
    }
    return {
      promptsFile: args[1],
      templatePath: args[2]
    };
  } else {
    if (args.length < 2) {
      console.error(chalk.red('❌ Error: Template path required'));
      process.exit(1);
    }
    return {
      batchId: args[0],
      templatePath: args[1]
    };
  }
}

function loadPromptsFromFile(filePath: string): ExportedPrompts {
  const absolutePath = resolve(filePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Prompts file not found: ${absolutePath}`);
  }

  const content = readFileSync(absolutePath, 'utf-8');
  return JSON.parse(content);
}

function loadPromptsFromDatabase(batchId: string): ExportedPrompts {
  const dbPath = findDatabasePath();
  console.log(chalk.blue(`Database: ${chalk.gray(dbPath)}`));

  // Open database
  const db = new Database(dbPath, { readonly: true });

  // Verify batch exists
  const batch = db.prepare(`
    SELECT * FROM batch_runs WHERE batchId = ?
  `).get(batchId);

  if (!batch) {
    db.close();
    throw new Error(`Batch not found: ${batchId}`);
  }

  console.log(chalk.green(`✓ Found batch: ${(batch as any).totalRuns} runs`));

  // Fetch all runs with prompts
  const runs = db.prepare(`
    SELECT
      br.run_id,
      br.suite,
      br.scenario,
      br.agent,
      br.model,
      br.tier,
      br.specialist_enabled,
      br.metadata,
      br.total_score,
      br.is_successful,
      br.started_at,
      rt.prompt_sent
    FROM benchmark_runs br
    LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
    WHERE br.batchId = ?
    ORDER BY br.started_at ASC
  `).all(batchId) as any[];

  db.close();

  // Parse prompts
  const promptData: PromptData[] = runs.map(run => {
    let messages: any[] = [];
    let metadata: any = {};
    let specialist: string | undefined = undefined;

    if (run.prompt_sent) {
      try {
        messages = JSON.parse(run.prompt_sent);
      } catch (error) {
        console.warn(chalk.yellow(`⚠ Failed to parse prompt for run ${run.run_id}`));
      }
    }

    // Parse metadata to extract specialist info
    if (run.metadata) {
      try {
        metadata = JSON.parse(run.metadata);
        specialist = metadata.specialist;
      } catch (error) {
        // Ignore metadata parse errors
      }
    }

    return {
      runId: run.run_id,
      suite: run.suite,
      scenario: run.scenario,
      agent: run.agent,
      model: run.model,
      tier: run.tier,
      specialist,
      messages,
      score: run.total_score,
      success: run.is_successful === 1,
      timestamp: run.started_at
    };
  });

  return {
    batchId,
    exportedAt: new Date().toISOString(),
    totalRuns: promptData.length,
    runs: promptData
  };
}

function loadTemplate(templatePath: string): SpecialistTemplate {
  const absolutePath = resolve(templatePath);
  if (!existsSync(absolutePath)) {
    throw new Error(`Template file not found: ${absolutePath}`);
  }

  const content = readFileSync(absolutePath, 'utf-8');

  // Support both JSON and JSON5
  if (templatePath.endsWith('.json5')) {
    return JSON5.parse(content);
  } else {
    return JSON.parse(content);
  }
}

function extractPromptContent(messages: any[]): string {
  // Combine all message content into a single string for searching
  return messages.map(msg => {
    if (typeof msg === 'string') return msg;
    if (msg.content) {
      if (typeof msg.content === 'string') return msg.content;
      if (Array.isArray(msg.content)) {
        return msg.content.map(c => {
          if (typeof c === 'string') return c;
          if (c.text) return c.text;
          return '';
        }).join(' ');
      }
    }
    if (msg.text) return msg.text;
    return '';
  }).join(' ');
}

function validatePrompt(
  promptData: PromptData,
  template: SpecialistTemplate
): ValidationResult {
  const promptContent = extractPromptContent(promptData.messages);
  const missingContent: string[] = [];

  // Check for purpose
  const foundPurpose = promptContent.includes(template.persona.purpose);
  if (!foundPurpose) {
    missingContent.push(`Purpose: "${template.persona.purpose.substring(0, 50)}..."`);
  }

  // Check for values
  let foundValuesCount = 0;
  for (const value of template.persona.values) {
    if (promptContent.includes(value)) {
      foundValuesCount++;
    } else {
      missingContent.push(`Value: "${value}"`);
    }
  }

  // Check for attributes
  let foundAttributesCount = 0;
  if (template.persona.attributes) {
    for (const attribute of template.persona.attributes) {
      if (promptContent.includes(attribute)) {
        foundAttributesCount++;
      }
      // Attributes are less critical, don't add to missing content
    }
  }

  // Check for spawner prompt
  let foundSpawnerPrompt = false;
  if (template.prompts) {
    // Check model-specific spawner prompt first
    const modelSpecificPrompts = template.prompts.model_specific || {};
    for (const [modelKey, prompts] of Object.entries(modelSpecificPrompts)) {
      if (prompts.spawnerPrompt) {
        // Check for substantial portions of the spawner prompt
        const spawnerLines = prompts.spawnerPrompt.split('\n').filter(l => l.trim().length > 20);
        let matchingLines = 0;
        for (const line of spawnerLines.slice(0, 5)) { // Check first 5 substantial lines
          if (promptContent.includes(line.trim())) {
            matchingLines++;
          }
        }
        if (matchingLines >= 2) { // At least 2 lines match
          foundSpawnerPrompt = true;
          break;
        }
      }
    }

    // Fall back to default spawner prompt
    if (!foundSpawnerPrompt && template.prompts.default?.spawnerPrompt) {
      if (promptContent.includes(template.prompts.default.spawnerPrompt)) {
        foundSpawnerPrompt = true;
      } else {
        missingContent.push(`Spawner prompt: "${template.prompts.default.spawnerPrompt.substring(0, 50)}..."`);
      }
    }
  }

  // Pass if we found purpose, most values (>50%), and spawner prompt
  const passed = foundPurpose &&
                 foundValuesCount > template.persona.values.length / 2 &&
                 foundSpawnerPrompt;

  return {
    runId: promptData.runId,
    specialist: promptData.specialist,
    model: promptData.model,
    passed,
    findings: {
      foundPurpose,
      foundValues: foundValuesCount,
      foundAttributes: foundAttributesCount,
      foundSpawnerPrompt
    },
    missingContent
  };
}

async function main() {
  console.log(chalk.cyan.bold('\n🔍 Validating specialist prompts\n'));

  try {
    const { batchId, promptsFile, templatePath } = parseArgs();

    // Load prompts
    let prompts: ExportedPrompts;
    if (promptsFile) {
      console.log(chalk.blue(`Prompts file: ${chalk.gray(resolve(promptsFile))}`));
      prompts = loadPromptsFromFile(promptsFile);
      console.log(chalk.green(`✓ Loaded ${prompts.totalRuns} runs from file\n`));
    } else if (batchId) {
      console.log(chalk.blue(`Batch ID: ${chalk.gray(batchId)}`));
      prompts = loadPromptsFromDatabase(batchId);
      console.log(chalk.green(`✓ Loaded ${prompts.totalRuns} runs from database\n`));
    } else {
      throw new Error('Either batchId or promptsFile must be provided');
    }

    // Load template
    console.log(chalk.blue(`Template: ${chalk.gray(resolve(templatePath))}`));
    const template = loadTemplate(templatePath);
    console.log(chalk.green(`✓ Loaded template: ${template.displayName || template.name} v${template.version}\n`));

    // Filter to specialist runs only
    const specialistRuns = prompts.runs.filter(r => r.specialist);

    if (specialistRuns.length === 0) {
      console.log(chalk.yellow('⚠ No specialist runs found in this batch'));
      console.log(chalk.gray('  Validation skipped - no specialist prompts to validate\n'));
      process.exit(0);
    }

    console.log(chalk.blue(`Validating ${specialistRuns.length} specialist runs...\n`));

    // Validate each run
    const results: ValidationResult[] = [];
    for (const run of specialistRuns) {
      const result = validatePrompt(run, template);
      results.push(result);
    }

    // Print results
    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    console.log(chalk.bold('Validation Results:\n'));

    // Print summary statistics
    console.log(chalk.bold('Overall:'));
    console.log(`  Total specialist runs: ${chalk.cyan(results.length)}`);
    console.log(`  Passed: ${chalk.green(passed)}`);
    console.log(`  Failed: ${failed > 0 ? chalk.red(failed) : chalk.gray(failed)}\n`);

    // Print detailed findings
    const totalValues = template.persona.values.length;
    const totalAttributes = template.persona.attributes?.length || 0;

    console.log(chalk.bold('Findings Summary:'));
    const avgFoundValues = results.reduce((sum, r) => sum + r.findings.foundValues, 0) / results.length;
    const avgFoundAttributes = results.reduce((sum, r) => sum + r.findings.foundAttributes, 0) / results.length;
    const purposeFound = results.filter(r => r.findings.foundPurpose).length;
    const spawnerFound = results.filter(r => r.findings.foundSpawnerPrompt).length;

    console.log(`  Purpose found: ${chalk.cyan(`${purposeFound}/${results.length}`)} runs`);
    console.log(`  Values found: ${chalk.cyan(`${avgFoundValues.toFixed(1)}/${totalValues}`)} avg per run`);
    if (totalAttributes > 0) {
      console.log(`  Attributes found: ${chalk.cyan(`${avgFoundAttributes.toFixed(1)}/${totalAttributes}`)} avg per run`);
    }
    console.log(`  Spawner prompt found: ${chalk.cyan(`${spawnerFound}/${results.length}`)} runs\n`);

    // Print failed runs details
    if (failed > 0) {
      console.log(chalk.bold.red('Failed Runs:\n'));
      for (const result of results.filter(r => !r.passed)) {
        console.log(chalk.red(`✗ Run ${result.runId} (${result.model})`));
        console.log(chalk.gray(`  Specialist: ${result.specialist || 'N/A'}`));
        console.log(chalk.gray('  Missing content:'));
        for (const missing of result.missingContent.slice(0, 3)) {
          console.log(chalk.gray(`    - ${missing}`));
        }
        if (result.missingContent.length > 3) {
          console.log(chalk.gray(`    ... and ${result.missingContent.length - 3} more`));
        }
        console.log();
      }
    }

    // Print success runs summary
    if (passed > 0) {
      console.log(chalk.bold.green('Passed Runs:\n'));
      for (const result of results.filter(r => r.passed)) {
        console.log(chalk.green(`✓ Run ${result.runId} (${result.model})`));
        console.log(chalk.gray(`  Specialist: ${result.specialist || 'N/A'}`));
        console.log(chalk.gray(`  Found: Purpose=${result.findings.foundPurpose}, Values=${result.findings.foundValues}/${totalValues}, Spawner=${result.findings.foundSpawnerPrompt}`));
      }
      console.log();
    }

    // Exit with appropriate code
    if (failed > 0) {
      console.log(chalk.bold.red(`\n❌ Validation failed: ${failed} run(s) missing expected template content\n`));
      process.exit(1);
    } else {
      console.log(chalk.bold.green('\n✨ All specialist prompts validated successfully!\n'));
      process.exit(0);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Validation failed:'));
    console.error(error);
    process.exit(1);
  }
}

main();
