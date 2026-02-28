import chalk from 'chalk';
import { resolve, join } from 'path';
import type { SpecialistTemplate, SpecialistSnapshot, MintResult, BenchmarkRun, BenchmarkComparison, ModelComparison } from './types.js';
import {
  loadJSON5,
  writeJSON5,
  writeJSON,
  validateTemplateSchema,
  validateSnapshotSchema,
  getNextSnapshotId
} from './utils.js';
import { loadBenchmarkBatch } from './benchmark-loader.js';
import { resolveTemplatePath } from './template-resolver.js';
import { generateMetadata } from './metadata-generator.js';
import { logger } from '@ze/logger';

const log = logger.specialistMint;

/**
 * Main function to mint a snapshot from a template and benchmark batch results
 */
export async function mintSnapshot(
  templatePath: string,
  outputDir: string,
  options?: {
    // Option A: Fetch from Worker API using batch ID
    batchId?: string;
    workerUrl?: string;

    // Option B: Pass benchmark data directly (bypasses Worker API)
    benchmarkRuns?: BenchmarkRun[];

    skipBenchmarks?: boolean;
    autoEnrich?: boolean;
  }
): Promise<MintResult> {
  log.debug(chalk.blue('📋 Step 1: Loading and validating template...'));

  // Resolve template path (automatically use enriched version if available)
  const { path: resolvedTemplatePath, isEnriched } = await resolveTemplatePath(templatePath, {
    autoEnrich: options?.autoEnrich || false
  });
  const template: SpecialistTemplate = loadJSON5(resolvedTemplatePath);

  log.debug(chalk.gray(`   Template: ${template.name} v${template.version}`));
  if (isEnriched) {
    log.debug(chalk.green('   ✓ Using enriched template'));
  } else {
    log.debug(chalk.yellow('   ⚠️  Using non-enriched template (consider running enrichment)'));
  }

  // Validate template against schema
  const templateValidation = validateTemplateSchema(template);
  if (!templateValidation.valid) {
    throw new Error(`Template validation failed:\n${templateValidation.errors}`);
  }

  log.debug(chalk.green('   ✓ Template loaded and validated successfully'));

  // Load benchmark results (optional)
  log.debug(chalk.blue('\n📊 Step 2: Loading benchmark results...'));

  let benchmarkRuns: BenchmarkRun[] | null = null;

  if (options?.skipBenchmarks) {
    // Explicitly skip benchmarks
    log.debug(chalk.yellow('   ⚠️  Skipping benchmarks (--skip-benchmarks flag)'));
  } else if (options?.benchmarkRuns) {
    // Option B: Use directly provided benchmark data (bypasses Worker API)
    benchmarkRuns = options.benchmarkRuns;
    log.debug(chalk.green(`   ✓ Using ${benchmarkRuns.length} benchmark run(s) provided directly`));
  } else if (options?.batchId) {
    // Option A: Fetch from Worker API using batch ID
    log.debug(chalk.gray(`   Loading batch: ${options.batchId}`));
    benchmarkRuns = await loadBenchmarkBatch(options.batchId, options.workerUrl);
  } else {
    // No benchmark data provided and not explicitly skipping - inform user
    log.debug(chalk.yellow('   ⚠️  No benchmark data provided, continuing without benchmarks'));
    log.debug(chalk.gray('   Use --batch-id to fetch from Worker, pass benchmarkRuns directly, or use --skip-benchmarks'));
  }

  // Create snapshot by combining template and benchmark results
  log.debug(chalk.blue('\n🔧 Step 3: Creating snapshot...'));

  const snapshot: SpecialistSnapshot = {
    ...template,
    benchmarks: createBenchmarksSection(template, benchmarkRuns, options?.batchId),
    snapshot_metadata: {
      created_at: new Date().toISOString(),
      minted_by: '@ze/specialist-mint CLI',
      template_version: template.version
    }
  };

  log.debug(chalk.gray('   ✓ Snapshot structure created'));

  // Validate snapshot against schema
  log.debug(chalk.blue('\n✅ Step 4: Validating snapshot...'));
  const snapshotValidation = validateSnapshotSchema(snapshot);
  if (!snapshotValidation.valid) {
    throw new Error(`Snapshot validation failed:\n${snapshotValidation.errors}`);
  }

  log.debug(chalk.green('   ✓ Snapshot validated successfully'));

  // Determine output path with auto-incremented snapshot ID
  log.debug(chalk.blue('\n📁 Step 5: Determining output path...'));

  const resolvedOutputDir = resolve(outputDir);

  // Extract specialist name without scope
  const nameWithoutScope = template.name.includes('/')
    ? template.name.split('/')[1]
    : template.name;

  // Create snapshot directory structure: output/{name}/{version}/
  // Note: user's --output flag already specifies the base directory (e.g., ./snapshots)
  const snapshotDir = join(resolvedOutputDir, nameWithoutScope, template.version);
  const snapshotId = getNextSnapshotId(snapshotDir);
  const outputPath = join(snapshotDir, `snapshot-${snapshotId}.json5`);

  log.debug(chalk.gray(`   Snapshot directory: ${snapshotDir}`));
  log.debug(chalk.gray(`   Snapshot ID: ${snapshotId}`));
  log.debug(chalk.gray(`   Output path: ${outputPath}`));

  // No need to update snapshot ID in runs - it's in metadata

  // Write snapshot to file
  log.debug(chalk.blue('\n💾 Step 6: Writing snapshot to disk...'));
  writeJSON5(outputPath, snapshot);

  log.debug(chalk.green('   ✓ Snapshot written successfully'));

  // Generate and write metadata
  log.debug(chalk.blue('\n📊 Step 7: Generating metadata...'));

  const metadata = generateMetadata(snapshot, {
    snapshotId,
    snapshotPath: outputPath,
    templatePath: resolvedTemplatePath,
    isEnriched,
    batchId: options?.batchId,
    skipBenchmarks: options?.skipBenchmarks
  });

  const metadataPath = outputPath.replace(/\.json5$/, '.meta.json');
  writeJSON(metadataPath, metadata);

  log.debug(chalk.green('   ✓ Metadata written successfully'));
  log.debug(chalk.gray(`   Metadata path: ${metadataPath}`));

  return {
    snapshotId,
    outputPath,
    templateVersion: template.version,
    metadata
  };
}

/**
 * Create the benchmarks section for the snapshot
 */
function createBenchmarksSection(
  template: SpecialistTemplate,
  benchmarkRuns: BenchmarkRun[] | null,
  batchId?: string
): SpecialistSnapshot['benchmarks'] {
  const benchmarksSection: SpecialistSnapshot['benchmarks'] = {
    test_suites: [],
    scoring: {
      methodology: 'weighted_average' as const,
      update_frequency: 'per_experiment',
      comparison_targets: ['control', 'generic']
    }
  };

  // If we have benchmark runs, add them to the snapshot
  if (benchmarkRuns && benchmarkRuns.length > 0) {
    // Create test_suites from unique suite/scenario combinations
    const uniqueSuites = new Set<string>();
    benchmarkRuns.forEach(run => {
      const key = `${run.suite}/${run.scenario}`;
      if (!uniqueSuites.has(key)) {
        uniqueSuites.add(key);
        benchmarksSection.test_suites.push({
          name: run.scenario,
          path: key,
          type: 'functional',
          description: `Benchmark from ${run.suite} suite`
        });
      }
    });

    // Add all runs
    benchmarksSection.runs = benchmarkRuns;

    // Calculate comparison metrics if we have both baseline and specialist runs
    const comparison = calculateComparison(template, benchmarkRuns);
    if (comparison) {
      benchmarksSection.comparison = comparison;

      // Log comparison summary
      log.debug(chalk.blue('\n📈 Comparison Summary:'));
      if (comparison.baseline_avg_score !== undefined) {
        log.debug(chalk.gray(`   Baseline avg score: ${comparison.baseline_avg_score.toFixed(3)}`));
      }
      if (comparison.specialist_avg_score !== undefined) {
        log.debug(chalk.gray(`   Specialist avg score: ${comparison.specialist_avg_score.toFixed(3)}`));
      }
      if (comparison.improvement !== undefined) {
        const sign = comparison.improvement >= 0 ? '+' : '';
        log.debug(chalk.gray(`   Improvement: ${sign}${comparison.improvement.toFixed(3)} (${sign}${comparison.improvement_pct?.toFixed(1)}%)`));
      }
    }

    // Calculate aggregated scores
    const aggregatedScores = calculateAggregatedScores(benchmarkRuns);
    benchmarksSection.aggregated_scores = aggregatedScores;

    // Log benchmark summary
    log.debug(chalk.blue('\n📈 Benchmark Summary:'));
    log.debug(chalk.gray(`   Total runs: ${benchmarkRuns.length}`));
    log.debug(chalk.gray(`   Average score: ${aggregatedScores.avg_score.toFixed(3)}`));
    log.debug(chalk.gray(`   Min score: ${aggregatedScores.min_score.toFixed(3)}`));
    log.debug(chalk.gray(`   Max score: ${aggregatedScores.max_score.toFixed(3)}`));
    log.debug(chalk.gray(`   Std deviation: ${aggregatedScores.std_dev.toFixed(3)}`));
  } else {
    // No benchmark results available - create a placeholder test suite
    log.debug(chalk.yellow('   ⚠️  No benchmark results found'));
    log.debug(chalk.yellow('   Creating snapshot with placeholder test suite'));

    benchmarksSection.test_suites.push({
      name: 'placeholder',
      path: 'benchmarks/placeholder',
      type: 'functional',
      description: 'Placeholder test suite - no benchmark results available yet'
    });
  }

  return benchmarksSection;
}

/**
 * Calculate comparison metrics between baseline and specialist runs
 */
function calculateComparison(
  template: SpecialistTemplate,
  runs: BenchmarkRun[]
): BenchmarkComparison | null {
  // Separate baseline and specialist runs
  const baselineRuns = runs.filter(r => r.specialist_enabled === false);
  const specialistRuns = runs.filter(r => r.specialist_enabled === true);

  // If we don't have both types, we can't do a comparison
  if (baselineRuns.length === 0 && specialistRuns.length === 0) {
    return null;
  }

  const comparison: BenchmarkComparison = {};

  // Calculate averages
  if (baselineRuns.length > 0) {
    comparison.baseline_avg_score =
      baselineRuns.reduce((sum, r) => sum + r.overall_score, 0) / baselineRuns.length;
  }

  if (specialistRuns.length > 0) {
    comparison.specialist_avg_score =
      specialistRuns.reduce((sum, r) => sum + r.overall_score, 0) / specialistRuns.length;
  }

  // Calculate overall improvement if we have both
  if (comparison.baseline_avg_score !== undefined && comparison.specialist_avg_score !== undefined) {
    comparison.improvement = comparison.specialist_avg_score - comparison.baseline_avg_score;
    if (comparison.baseline_avg_score > 0) {
      comparison.improvement_pct = (comparison.improvement / comparison.baseline_avg_score) * 100;
    }
  }

  // Calculate per-model comparisons
  const modelMap = new Map<string, { baseline?: BenchmarkRun; specialist?: BenchmarkRun }>();

  baselineRuns.forEach(run => {
    if (!modelMap.has(run.model)) {
      modelMap.set(run.model, {});
    }
    modelMap.get(run.model)!.baseline = run;
  });

  specialistRuns.forEach(run => {
    if (!modelMap.has(run.model)) {
      modelMap.set(run.model, {});
    }
    modelMap.get(run.model)!.specialist = run;
  });

  comparison.models_compared = [];

  // Convert map entries to array to avoid downlevelIteration requirement
  Array.from(modelMap.entries()).forEach(([model, { baseline, specialist }]) => {
    const modelComparison: ModelComparison = {
      model,
      baseline_score: baseline?.overall_score || 0
    };

    if (specialist) {
      modelComparison.specialist_score = specialist.overall_score;
      modelComparison.improvement = specialist.overall_score - (baseline?.overall_score || 0);
      if (baseline && baseline.overall_score > 0) {
        modelComparison.improvement_pct = (modelComparison.improvement / baseline.overall_score) * 100;
      }
    }

    comparison.models_compared!.push(modelComparison);
  });

  return comparison;
}

/**
 * Calculate aggregated scores across all runs
 */
function calculateAggregatedScores(runs: BenchmarkRun[]) {
  const scores = runs.map(r => r.overall_score);

  return {
    total_runs: runs.length,
    avg_score: scores.reduce((sum, s) => sum + s, 0) / scores.length,
    min_score: Math.min(...scores),
    max_score: Math.max(...scores),
    std_dev: calculateStdDev(scores),
    by_suite: groupScoresBySuite(runs),
    by_model: groupScoresByModel(runs)
  };
}

/**
 * Calculate standard deviation of scores
 */
function calculateStdDev(scores: number[]): number {
  const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avg, 2), 0) / scores.length;
  return Math.sqrt(variance);
}

/**
 * Group scores by suite/scenario
 */
function groupScoresBySuite(runs: BenchmarkRun[]) {
  const grouped = new Map<string, number[]>();

  runs.forEach(run => {
    const key = `${run.suite}/${run.scenario}`;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(run.overall_score);
  });

  const result: Record<string, { avg: number; count: number }> = {};
  grouped.forEach((scores, key) => {
    result[key] = {
      avg: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      count: scores.length
    };
  });

  return result;
}

/**
 * Group scores by model
 */
function groupScoresByModel(runs: BenchmarkRun[]) {
  const grouped = new Map<string, number[]>();

  runs.forEach(run => {
    if (!grouped.has(run.model)) {
      grouped.set(run.model, []);
    }
    grouped.get(run.model)!.push(run.overall_score);
  });

  const result: Record<string, { avg: number; count: number }> = {};
  grouped.forEach((scores, model) => {
    result[model] = {
      avg: scores.reduce((sum, s) => sum + s, 0) / scores.length,
      count: scores.length
    };
  });

  return result;
}
