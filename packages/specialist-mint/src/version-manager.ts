import semver from 'semver';
import type { VersionMetadata, VersionChange, ChangeEntry } from './types.js';
import { logger } from '@ze/logger';

const log = logger.specialistMint;

/**
 * Bump a semantic version string to the next version
 * @param currentVersion - Current version (e.g., "0.0.1")
 * @param type - Type of version bump (major, minor, or patch)
 * @returns New version string (e.g., "0.0.2")
 */
export function bumpVersion(
  currentVersion: string,
  type: 'major' | 'minor' | 'patch'
): string {
  log.debug(`[version-manager] Bumping version: ${currentVersion} (${type})`);
  const newVersion = semver.inc(currentVersion, type);
  if (!newVersion) {
    log.error(`[version-manager] Invalid version: ${currentVersion}`);
    throw new Error(`Invalid version: ${currentVersion}`);
  }
  log.debug(`[version-manager] Version bumped: ${currentVersion} → ${newVersion}`);
  return newVersion;
}

/**
 * Update version metadata with a new changelog entry
 * @param currentMetadata - Current version metadata (or undefined for first version)
 * @param update - Version update information
 * @returns Updated version metadata
 */
export function updateVersionMetadata(
  currentMetadata: VersionMetadata | undefined,
  update: {
    oldVersion: string;
    newVersion: string;
    type: 'major' | 'minor' | 'patch';
    changes: ChangeEntry[];
    author?: string;
  }
): VersionMetadata {
  log.debug(`[version-manager] Updating version metadata: ${update.oldVersion} → ${update.newVersion}`);
  log.debug(`[version-manager] Changes: ${update.changes.length} item(s)`);

  const now = new Date().toISOString();

  // Create new changelog entry
  const newChangelogEntry: VersionChange = {
    version: update.newVersion,
    date: now,
    type: update.type,
    changes: update.changes,
    author: update.author || '@ze/specialist-mint'
  };

  // If no existing metadata, create initial metadata
  if (!currentMetadata) {
    log.debug('[version-manager] Creating initial version metadata');
    return {
      changelog: [newChangelogEntry],
      breaking_changes: [],
      deprecated: false,
      created_at: now,
      updated_at: now
    };
  }

  // Check if any changes are breaking
  const hasBreakingChanges = update.changes.some(c => c.breaking === true);
  if (hasBreakingChanges) {
    log.warn(`[version-manager] Breaking changes detected in ${update.newVersion}`);
  }

  // Update existing metadata
  const updatedMetadata = {
    ...currentMetadata,
    changelog: [newChangelogEntry, ...currentMetadata.changelog],
    updated_at: now,
    last_enriched_at: update.changes.some(c => c.category === 'enrichment')
      ? now
      : currentMetadata.last_enriched_at
  };

  log.debug(`[version-manager] Version metadata updated (changelog entries: ${updatedMetadata.changelog.length})`);
  return updatedMetadata;
}
