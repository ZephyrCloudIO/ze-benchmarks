import chalk from 'chalk';
import { resolve, join } from 'path';
import type { SpecialistTemplate, SpecialistSnapshot, MintResult, BenchmarkResults, BenchmarkRun, BenchmarkComparison, ModelComparison } from './types.js';
import {
  loadJSON5,
  writeJSON5,
  validateTemplateSchema,
  validateSnapshotSchema,
  getNextSnapshotId
} from './utils.js';
import { loadBenchmarkResults, loadBenchmarkBatch } from './benchmark-loader.js';
import { resolveTemplatePath } from './template-resolver.js';

/**
 * Main function to mint a snapshot from a template and benchmark batch results
 */
export async function mintSnapshot(
  templatePath: string,
  outputDir: string,
  options?: {
    batchId?: string;
    workerUrl?: string;
  }
): Promise<MintResult> {
  console.log(chalk.blue('📋 Step 1: Loading and validating template...'));

  // Resolve template path (automatically use enriched version if available)
  const { path: resolvedTemplatePath, isEnriched } = resolveTemplatePath(templatePath);
  const template: SpecialistTemplate = loadJSON5(resolvedTemplatePath);

  console.log(chalk.gray(`   Template: ${template.name} v${template.version}`));
  if (isEnriched) {
    console.log(chalk.green('   ✓ Using enriched template'));
  } else {
    console.log(chalk.yellow('   ⚠️  Using non-enriched template (consider running enrichment)'));
  }

  // Validate template against schema
  const templateValidation = validateTemplateSchema(template);
  if (!templateValidation.valid) {
    throw new Error(`Template validation failed:\n${templateValidation.errors}`);
  }

  console.log(chalk.green('   ✓ Template loaded and validated successfully'));

  // Load benchmark results (optional)
  console.log(chalk.blue('\n📊 Step 2: Loading benchmark results...'));

  let benchmarkRuns: BenchmarkRun[] | null = null;

  if (options?.batchId) {
    // Batch mode: load all runs from the batch via Worker API
    console.log(chalk.gray(`   Loading batch: ${options.batchId}`));
    benchmarkRuns = await loadBenchmarkBatch(options.batchId, options.workerUrl);
  } else {
    // Legacy mode: load single most recent result via Worker API
    console.log(chalk.gray('   Loading most recent result (legacy mode)'));
    const singleResult = await loadBenchmarkResults(options?.workerUrl);
    if (singleResult) {
      benchmarkRuns = [singleResult];
    }
  }

  // Create snapshot by combining template and benchmark results
  console.log(chalk.blue('\n🔧 Step 3: Creating snapshot...'));

  const snapshot: SpecialistSnapshot = {
    ...template,
    benchmarks: createBenchmarksSection(template, benchmarkRuns, options?.batchId),
    snapshot_metadata: {
      created_at: new Date().toISOString(),
      minted_by: '@ze/specialist-mint CLI',
      template_version: template.version
    }
  };

  console.log(chalk.gray('   ✓ Snapshot structure created'));

  // Validate snapshot against schema
  console.log(chalk.blue('\n✅ Step 4: Validating snapshot...'));
  const snapshotValidation = validateSnapshotSchema(snapshot);
  if (!snapshotValidation.valid) {
    throw new Error(`Snapshot validation failed:\n${snapshotValidation.errors}`);
  }

  console.log(chalk.green('   ✓ Snapshot validated successfully'));

  // Determine output path with auto-incremented snapshot ID
  console.log(chalk.blue('\n📁 Step 5: Determining output path...'));

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

  console.log(chalk.gray(`   Snapshot directory: ${snapshotDir}`));
  console.log(chalk.gray(`   Snapshot ID: ${snapshotId}`));
  console.log(chalk.gray(`   Output path: ${outputPath}`));

  // No need to update snapshot ID in runs - it's in metadata

  // Write snapshot to file
  console.log(chalk.blue('\n💾 Step 6: Writing snapshot to disk...'));
  writeJSON5(outputPath, snapshot);

  console.log(chalk.green('   ✓ Snapshot written successfully'));

  return {
    snapshotId,
    outputPath,
    templateVersion: template.version
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
      console.log(chalk.blue('\n📈 Comparison Summary:'));
      if (comparison.baseline_avg_score !== undefined) {
        console.log(chalk.gray(`   Baseline avg score: ${comparison.baseline_avg_score.toFixed(3)}`));
      }
      if (comparison.specialist_avg_score !== undefined) {
        console.log(chalk.gray(`   Specialist avg score: ${comparison.specialist_avg_score.toFixed(3)}`));
      }
      if (comparison.improvement !== undefined) {
        const sign = comparison.improvement >= 0 ? '+' : '';
        console.log(chalk.gray(`   Improvement: ${sign}${comparison.improvement.toFixed(3)} (${sign}${comparison.improvement_pct?.toFixed(1)}%)`));
      }
    }
  } else {
    // No benchmark results available - create a placeholder test suite
    console.log(chalk.yellow('   ⚠️  No benchmark results found'));
    console.log(chalk.yellow('   Creating snapshot with placeholder test suite'));

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
