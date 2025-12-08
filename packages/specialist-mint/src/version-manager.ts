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
 * Compare two semantic version strings
 * @param v1 - First version
 * @param v2 - Second version
 * @returns -1 if v1 < v2, 0 if v1 === v2, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  return semver.compare(v1, v2);
}

/**
 * Check if a version satisfies a required version range
 * @param current - Current version
 * @param required - Required version or range
 * @returns true if compatible, false otherwise
 */
export function isCompatibleVersion(current: string, required: string): boolean {
  return semver.satisfies(current, required);
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

/**
 * Create initial version metadata for a template
 * @param version - Initial version
 * @param description - Description of initial version
 * @returns Initial version metadata
 */
export function createInitialVersionMetadata(
  version: string,
  description: string = 'Initial version'
): VersionMetadata {
  log.debug(`[version-manager] Creating initial version metadata for v${version}`);
  const now = new Date().toISOString();

  return {
    changelog: [
      {
        version,
        date: now,
        type: 'patch',
        changes: [
          {
            category: 'other',
            description,
            breaking: false
          }
        ],
        author: '@ze/specialist-mint'
      }
    ],
    breaking_changes: [],
    deprecated: false,
    created_at: now,
    updated_at: now
  };
}

/**
 * Extract breaking changes from version metadata
 * @param metadata - Version metadata
 * @returns Array of breaking changes
 */
export function getBreakingChanges(metadata: VersionMetadata): VersionChange[] {
  return metadata.changelog.filter(change =>
    change.changes.some(c => c.breaking === true)
  );
}

/**
 * Check if a version has breaking changes
 * @param metadata - Version metadata
 * @param version - Version to check
 * @returns true if version has breaking changes
 */
export function hasBreakingChanges(metadata: VersionMetadata, version: string): boolean {
  const versionEntry = metadata.changelog.find(c => c.version === version);
  return versionEntry?.changes.some(c => c.breaking === true) || false;
}
