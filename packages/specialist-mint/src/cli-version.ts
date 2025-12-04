/**
 * CLI commands for template version management
 */

import { Command } from 'commander';
import chalk from 'chalk';
import { resolve } from 'path';
import type { SpecialistTemplate } from './types.js';
import { loadJSON5, writeJSON5 } from './utils.js';
import { bumpVersion, updateVersionMetadata } from './version-manager.js';
import { logger } from '@ze/logger';

const log = logger.specialistMintCli;

/**
 * Create the bump:version command
 */
export function createVersionCommand(): Command {
  const command = new Command('bump:version');

  command
    .description('Manually bump template version')
    .argument('<template-path>', 'Path to template file')
    .option('--major', 'Bump major version (X.0.0)')
    .option('--minor', 'Bump minor version (0.X.0)')
    .option('--patch', 'Bump patch version (0.0.X)', true)
    .option('-m, --message <message>', 'Description of changes', 'Version bump')
    .option('--breaking', 'Mark as breaking change', false)
    .option('--migration-notes <notes>', 'Migration notes for breaking changes')
    .option('--author <author>', 'Author of the change')
    .action(async (templatePath: string, options: any) => {
      try {
        // Determine version bump type
        let bumpType: 'major' | 'minor' | 'patch' = 'patch';
        if (options.major) bumpType = 'major';
        else if (options.minor) bumpType = 'minor';

        log.info(chalk.blue('🔄 Bumping template version...'));

        // Load template
        const resolvedPath = resolve(process.cwd(), templatePath);
        const template: SpecialistTemplate = loadJSON5(resolvedPath);

        log.info(chalk.gray(`   Template: ${template.name} v${template.version}`));

        // Bump version
        const oldVersion = template.version;
        const newVersion = bumpVersion(oldVersion, bumpType);

        log.info(chalk.blue(`   ${oldVersion} → ${newVersion} (${bumpType})`));

        // Determine change category based on options
        let category: 'enrichment' | 'prompt' | 'documentation' | 'persona' | 'capabilities' | 'fix' | 'other' = 'other';
        const message = options.message.toLowerCase();
        if (message.includes('enrich')) category = 'enrichment';
        else if (message.includes('prompt')) category = 'prompt';
        else if (message.includes('doc')) category = 'documentation';
        else if (message.includes('persona')) category = 'persona';
        else if (message.includes('capabilit')) category = 'capabilities';
        else if (message.includes('fix')) category = 'fix';

        // Update template
        const updatedTemplate: SpecialistTemplate = {
          ...template,
          version: newVersion,
          version_metadata: updateVersionMetadata(template.version_metadata, {
            oldVersion,
            newVersion,
            type: bumpType,
            changes: [
              {
                category,
                description: options.message,
                breaking: options.breaking || false,
                migration_notes: options.migrationNotes
              }
            ],
            author: options.author
          })
        };

        // Save template
        writeJSON5(resolvedPath, updatedTemplate);

        log.info(chalk.green('✓ Template version bumped successfully'));

        // Show changelog entry
        log.info(chalk.blue('\n📝 Changelog entry:'));
        log.info(chalk.gray(`   Version: ${newVersion}`));
        log.info(chalk.gray(`   Type: ${bumpType}`));
        log.info(chalk.gray(`   Message: ${options.message}`));
        if (options.breaking) {
          log.info(chalk.yellow(`   ⚠️  Breaking change`));
          if (options.migrationNotes) {
            log.info(chalk.gray(`   Migration: ${options.migrationNotes}`));
          }
        }

      } catch (error) {
        log.error(chalk.red('✗ Failed to bump version'));
        log.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}

/**
 * Create the changelog command
 */
export function createChangelogCommand(): Command {
  const command = new Command('changelog');

  command
    .description('View template version history')
    .argument('<template-path>', 'Path to template file')
    .option('-n, --limit <number>', 'Limit number of entries', '10')
    .option('--breaking-only', 'Show only breaking changes', false)
    .action(async (templatePath: string, options: any) => {
      try {
        log.info(chalk.blue('📜 Template Changelog\n'));

        // Load template
        const resolvedPath = resolve(process.cwd(), templatePath);
        const template: SpecialistTemplate = loadJSON5(resolvedPath);

        log.info(chalk.bold(`Template: ${template.name}`));
        log.info(chalk.gray(`Current Version: ${template.version}\n`));

        // Check if version metadata exists
        if (!template.version_metadata || !template.version_metadata.changelog) {
          log.warn(chalk.yellow('⚠️  No version history available'));
          log.info(chalk.gray('   This template does not have version metadata.'));
          log.info(chalk.gray('   Version tracking will be added automatically on next enrichment.'));
          return;
        }

        const metadata = template.version_metadata;

        // Show deprecation status
        if (metadata.deprecated) {
          log.warn(chalk.yellow(`\n⚠️  DEPRECATED: ${metadata.deprecated_reason || 'No reason provided'}`));
          if (metadata.replacement) {
            log.info(chalk.gray(`   Replacement: ${metadata.replacement}`));
          }
          log.info('');
        }

        // Filter changelog
        let changelog = metadata.changelog;
        if (options.breakingOnly) {
          changelog = changelog.filter(entry =>
            entry.changes.some(c => c.breaking === true)
          );
        }

        // Limit entries
        const limit = parseInt(options.limit);
        const entries = changelog.slice(0, limit);

        // Display changelog
        log.info(chalk.bold('Version History:'));
        log.info('');

        for (const entry of entries) {
          const hasBreaking = entry.changes.some(c => c.breaking === true);
          const versionLabel = hasBreaking
            ? chalk.red(`v${entry.version} (BREAKING)`)
            : chalk.green(`v${entry.version}`);

          log.info(versionLabel);
          log.info(chalk.gray(`  Date: ${new Date(entry.date).toLocaleString()}`));
          log.info(chalk.gray(`  Type: ${entry.type}`));
          if (entry.author) {
            log.info(chalk.gray(`  Author: ${entry.author}`));
          }

          // Show changes
          log.info(chalk.gray('  Changes:'));
          for (const change of entry.changes) {
            const prefix = change.breaking ? chalk.red('    ⚠️ ') : '    • ';
            log.info(chalk.gray(`${prefix}[${change.category}] ${change.description}`));
            if (change.migration_notes) {
              log.info(chalk.gray(`      Migration: ${change.migration_notes}`));
            }
          }

          log.info('');
        }

        // Show summary
        if (changelog.length > entries.length) {
          log.info(chalk.gray(`... and ${changelog.length - entries.length} more entries`));
          log.info(chalk.gray(`Use --limit to show more entries\n`));
        }

        // Show breaking changes summary
        if (metadata.breaking_changes && metadata.breaking_changes.length > 0) {
          log.info(chalk.bold(chalk.yellow('Breaking Changes Summary:')));
          log.info('');

          for (const bc of metadata.breaking_changes) {
            log.info(chalk.yellow(`v${bc.version} - ${bc.description}`));
            log.info(chalk.gray(`  Date: ${new Date(bc.date).toLocaleString()}`));
            log.info(chalk.gray(`  Affected: ${bc.affected_areas.join(', ')}`));
            log.info(chalk.gray(`  Migration: ${bc.migration_guide}`));
            if (bc.deprecated_features && bc.deprecated_features.length > 0) {
              log.info(chalk.gray(`  Deprecated: ${bc.deprecated_features.join(', ')}`));
            }
            log.info('');
          }
        }

      } catch (error) {
        log.error(chalk.red('✗ Failed to show changelog'));
        log.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });

  return command;
}
