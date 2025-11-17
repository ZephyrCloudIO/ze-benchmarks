#!/usr/bin/env tsx
/**
 * Export prompts from a batch run
 *
 * This script extracts all prompts sent during a batch run and outputs them as JSON.
 * Useful for reviewing what prompts were actually executed, debugging, or creating snapshots.
 *
 * Usage:
 *   pnpm export:prompts <batch-id> [output-file]
 *
 * Examples:
 *   pnpm export:prompts abc123
 *   pnpm export:prompts abc123 batch-prompts.json
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { writeFileSync } from 'node:fs';
import chalk from 'chalk';

interface EvaluationDetail {
  evaluatorName: string;
  score: number;
  maxScore: number;
  details: any;
}

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
  weightedScore: number | null;
  success: boolean;
  timestamp: string;
  workspaceDir?: string;
  durationMs?: number;
  toolCalls?: number;
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  evaluations: EvaluationDetail[];
}

function findDatabasePath(): string {
  // Check environment variable first
  if (process.env.BENCHMARK_DB_PATH) {
    return resolve(process.env.BENCHMARK_DB_PATH);
  }

  // Default location
  return resolve(__dirname, '../benchmark-report/public/benchmarks.db');
}

function parseArgs(): { batchId: string; outputFile?: string } {
  // Filter out '--' separator that pnpm adds
  const args = process.argv.slice(2).filter(arg => arg !== '--');

  if (args.length === 0) {
    console.error(chalk.red('❌ Error: Batch ID required'));
    console.log('\n' + chalk.bold('Usage:'));
    console.log(`  ${chalk.cyan('pnpm export:prompts')} <batch-id> [output-file]`);
    console.log('\n' + chalk.bold('Examples:'));
    console.log(`  ${chalk.gray('pnpm export:prompts abc123')}`);
    console.log(`  ${chalk.gray('pnpm export:prompts abc123 batch-prompts.json')}`);
    console.log('\n' + chalk.bold('Tips:'));
    console.log(`  • View recent batches: ${chalk.cyan('pnpm --filter ze-benchmarks bench --batches')}`);
    process.exit(1);
  }

  return {
    batchId: args[0],
    outputFile: args[1]
  };
}

async function main() {
  console.log(chalk.cyan.bold('\n📝 Exporting batch prompts\n'));

  try {
    const { batchId, outputFile } = parseArgs();
    const dbPath = findDatabasePath();

    console.log(chalk.blue(`Database: ${chalk.gray(dbPath)}`));
    console.log(chalk.blue(`Batch ID: ${chalk.gray(batchId)}\n`));

    // Open database
    const db = new Database(dbPath, { readonly: true });

    // Verify batch exists
    const batch = db.prepare(`
      SELECT * FROM batch_runs WHERE batchId = ?
    `).get(batchId);

    if (!batch) {
      console.error(chalk.red(`❌ Batch not found: ${batchId}`));
      process.exit(1);
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
        br.weighted_score,
        br.is_successful,
        br.started_at,
        rt.prompt_sent,
        rt.workspace_dir,
        rt.duration_ms,
        rt.tool_calls,
        rt.tokens_in,
        rt.tokens_out,
        rt.cost_usd
      FROM benchmark_runs br
      LEFT JOIN run_telemetry rt ON br.run_id = rt.run_id
      WHERE br.batchId = ?
      ORDER BY br.started_at ASC
    `).all(batchId) as any[];

    console.log(chalk.green(`✓ Retrieved ${runs.length} runs\n`));

    // Prepare statement to fetch evaluations for each run
    const getEvaluations = db.prepare(`
      SELECT
        evaluator_name,
        score,
        max_score,
        details
      FROM evaluation_results
      WHERE run_id = ?
      ORDER BY evaluator_name ASC
    `);

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

      // Fetch evaluations for this run
      const evaluationRows = getEvaluations.all(run.run_id) as any[];
      const evaluations: EvaluationDetail[] = evaluationRows.map(evalRow => {
        let details: any = null;
        if (evalRow.details) {
          // Try to parse as JSON, but accept plain strings too
          try {
            details = JSON.parse(evalRow.details);
          } catch (error) {
            // Not JSON - use the plain string value
            details = evalRow.details;
          }
        }

        return {
          evaluatorName: evalRow.evaluator_name,
          score: evalRow.score,
          maxScore: evalRow.max_score,
          details
        };
      });

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
        weightedScore: run.weighted_score,
        success: run.is_successful === 1,
        timestamp: run.started_at,
        workspaceDir: run.workspace_dir,
        durationMs: run.duration_ms,
        toolCalls: run.tool_calls,
        tokensIn: run.tokens_in,
        tokensOut: run.tokens_out,
        costUsd: run.cost_usd,
        evaluations
      };
    });

    db.close();

    // Calculate totals for batch summary
    const batchTotalTokensIn = promptData.reduce((sum, run) => sum + (run.tokensIn || 0), 0);
    const batchTotalTokensOut = promptData.reduce((sum, run) => sum + (run.tokensOut || 0), 0);
    const batchTotalCost = promptData.reduce((sum, run) => sum + (run.costUsd || 0), 0);
    const batchTotalDuration = promptData.reduce((sum, run) => sum + (run.durationMs || 0), 0);
    const batchTotalToolCalls = promptData.reduce((sum, run) => sum + (run.toolCalls || 0), 0);

    // Output
    const output = {
      batchId,
      exportedAt: new Date().toISOString(),
      totalRuns: promptData.length,
      summary: {
        durationMs: batchTotalDuration,
        toolCalls: batchTotalToolCalls,
        tokensIn: batchTotalTokensIn,
        tokensOut: batchTotalTokensOut,
        totalCost: batchTotalCost
      },
      runs: promptData
    };

    const jsonOutput = JSON.stringify(output, null, 2);

    if (outputFile) {
      writeFileSync(outputFile, jsonOutput);
      console.log(chalk.green(`✓ Exported to: ${chalk.cyan(resolve(outputFile))}`));
    } else {
      console.log(chalk.bold('\n📋 Prompt Data:\n'));
      console.log(jsonOutput);
    }

    console.log(chalk.bold.green('\n✨ Export complete!\n'));

    // Print summary
    console.log(chalk.bold('Summary:'));
    console.log(`  • Total runs: ${chalk.cyan(promptData.length)}`);
    console.log(`  • Runs with prompts: ${chalk.cyan(promptData.filter(p => p.messages.length > 0).length)}`);
    console.log(`  • Successful runs: ${chalk.cyan(promptData.filter(p => p.success).length)}`);
    console.log(`  • Runs with evaluations: ${chalk.cyan(promptData.filter(p => p.evaluations.length > 0).length)}`);

    // Calculate totals
    const totalTokensIn = promptData.reduce((sum, run) => sum + (run.tokensIn || 0), 0);
    const totalTokensOut = promptData.reduce((sum, run) => sum + (run.tokensOut || 0), 0);
    const totalCost = promptData.reduce((sum, run) => sum + (run.costUsd || 0), 0);
    const totalDuration = promptData.reduce((sum, run) => sum + (run.durationMs || 0), 0);
    const totalToolCalls = promptData.reduce((sum, run) => sum + (run.toolCalls || 0), 0);

    console.log(chalk.bold('\nPerformance:'));
    console.log(`  • Total duration: ${chalk.cyan((totalDuration / 1000 / 60).toFixed(2) + ' minutes')}`);
    console.log(`  • Average duration: ${chalk.cyan((totalDuration / promptData.length / 1000).toFixed(2) + ' seconds')}`);
    console.log(`  • Total tool calls: ${chalk.cyan(totalToolCalls.toLocaleString())}`);

    console.log(chalk.bold('\nToken usage:'));
    console.log(`  • Input tokens: ${chalk.cyan(totalTokensIn.toLocaleString())}`);
    console.log(`  • Output tokens: ${chalk.cyan(totalTokensOut.toLocaleString())}`);
    console.log(`  • Total cost: ${chalk.cyan('$' + totalCost.toFixed(4))}`);

    // Group by model
    const modelGroups = promptData.reduce((acc, run) => {
      const key = run.specialist ? `${run.model} (${run.specialist})` : run.model;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    console.log(chalk.bold('\nRuns by model:'));
    Object.entries(modelGroups).forEach(([model, count]) => {
      console.log(`  • ${chalk.gray(model)}: ${chalk.cyan(count)}`);
    });

    console.log();

  } catch (error) {
    console.error(chalk.red('\n❌ Export failed:'));
    console.error(error);
    process.exit(1);
  }
}

main();
