/**
 * Metadata Generator for Minting Specialist Snapshots
 *
 * Generates structured metadata for programmatic consumption
 */

import { dirname, basename } from 'path';
import type { SpecialistSnapshot, SnapshotMetadata } from './types.js';

export interface MetadataGeneratorOptions {
  snapshotId: string;
  snapshotPath: string;
  templatePath: string;
  isEnriched: boolean;
  batchId?: string;
  skipBenchmarks?: boolean;
}

/**
 * Generate metadata for a minted snapshot
 *
 * @param snapshot - The specialist snapshot object
 * @param options - Options containing paths and metadata
 * @returns Structured metadata for programmatic use
 */
export function generateMetadata(
  snapshot: SpecialistSnapshot,
  options: MetadataGeneratorOptions
): SnapshotMetadata {
  const {
    snapshotId,
    snapshotPath,
    templatePath,
    isEnriched,
    batchId,
    skipBenchmarks = false
  } = options;

  const snapshotDir = dirname(snapshotPath);
  const snapshotFile = basename(snapshotPath);
  const metadataFile = snapshotFile.replace(/\.json5$/, '.meta.json');

  // Extract benchmark information
  const benchmarkInfo = extractBenchmarkInfo(snapshot, batchId, skipBenchmarks);

  const metadata: SnapshotMetadata = {
    snapshot_id: snapshotId,
    snapshot_path: snapshotPath,
    template: {
      name: snapshot.name,
      version: snapshot.version,
      path: templatePath,
      is_enriched: isEnriched
    },
    benchmarks: benchmarkInfo,
    output: {
      directory: snapshotDir,
      snapshot_file: snapshotPath,
      metadata_file: `${snapshotDir}/${metadataFile}`
    },
    timestamp: snapshot.snapshot_metadata?.created_at || new Date().toISOString(),
    minted_by: snapshot.snapshot_metadata?.minted_by || '@ze/specialist-mint CLI'
  };

  return metadata;
}

/**
 * Extract benchmark information from snapshot
 */
function extractBenchmarkInfo(
  snapshot: SpecialistSnapshot,
  batchId?: string,
  skipBenchmarks?: boolean
): SnapshotMetadata['benchmarks'] {
  // If benchmarks were explicitly skipped
  if (skipBenchmarks) {
    return {
      included: false
    };
  }

  const runs = snapshot.benchmarks?.runs || [];
  const comparison = snapshot.benchmarks?.comparison;

  // If no benchmark runs exist
  if (runs.length === 0) {
    return {
      included: false,
      batch_id: batchId
    };
  }

  // Extract unique models
  const models = Array.from(new Set(runs.map(run => run.model))).filter(Boolean);

  const benchmarkInfo: SnapshotMetadata['benchmarks'] = {
    included: true,
    batch_id: batchId,
    run_count: runs.length,
    models
  };

  // Add comparison metrics if available
  if (comparison) {
    const hasBaselineAvg = comparison.baseline_avg_score !== undefined;
    const hasSpecialistAvg = comparison.specialist_avg_score !== undefined;
    const hasImprovement = comparison.improvement !== undefined;
    const hasImprovementPct = comparison.improvement_pct !== undefined;

    if (hasBaselineAvg && hasSpecialistAvg && hasImprovement && hasImprovementPct) {
      benchmarkInfo.comparison = {
        baseline_avg: comparison.baseline_avg_score!,
        specialist_avg: comparison.specialist_avg_score!,
        improvement: comparison.improvement!,
        improvement_pct: comparison.improvement_pct!
      };
    }
  }

  return benchmarkInfo;
}
