#!/usr/bin/env tsx
/**
 * Migration Script: Add Version Metadata to Existing Templates
 *
 * This script adds version_metadata to all specialist templates that don't have it yet.
 * It preserves existing version numbers and creates an initial changelog entry.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-template-versions.ts
 *   pnpm tsx scripts/migrate-template-versions.ts --dry-run
 */

import { resolve, join } from 'path';
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import JSON5 from 'json5';
import chalk from 'chalk';

interface SpecialistTemplate {
  schema_version: string;
  name: string;
  version: string;
  version_metadata?: {
    changelog: Array<{
      version: string;
      date: string;
      type: 'major' | 'minor' | 'patch';
      changes: Array<{
        category: string;
        description: string;
        breaking?: boolean;
      }>;
      author?: string;
    }>;
    created_at: string;
    updated_at: string;
  };
  [key: string]: any;
}

const DRY_RUN = process.argv.includes('--dry-run');

function findTemplateFiles(dir: string): string[] {
  const templates: string[] = [];

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        // Skip enriched directories
        if (entry === 'enriched') {
          continue;
        }
        // Recursively search subdirectories
        templates.push(...findTemplateFiles(fullPath));
      } else if (stat.isFile()) {
        // Check if it's a template file (ends with -template.json5 or -template.jsonc)
        if (
          (entry.endsWith('-template.json5') || entry.endsWith('-template.jsonc')) &&
          !entry.includes('.enriched.')
        ) {
          templates.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(chalk.red(`Error reading directory ${dir}:`), error);
  }

  return templates;
}

function loadTemplate(filePath: string): SpecialistTemplate | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON5.parse(content) as SpecialistTemplate;
  } catch (error) {
    console.error(chalk.red(`Failed to load template ${filePath}:`), error);
    return null;
  }
}

function saveTemplate(filePath: string, template: SpecialistTemplate): boolean {
  try {
    // Use JSON5.stringify with nice formatting
    const content = JSON5.stringify(template, null, 2);
    writeFileSync(filePath, content, 'utf-8');
    return true;
  } catch (error) {
    console.error(chalk.red(`Failed to save template ${filePath}:`), error);
    return false;
  }
}

function migrateTemplate(filePath: string): boolean {
  const template = loadTemplate(filePath);
  if (!template) {
    return false;
  }

  // Check if already has version metadata
  if (template.version_metadata) {
    console.log(chalk.gray(`   ⏭️  Already migrated, skipping: ${template.name}`));
    return true;
  }

  const now = new Date().toISOString();

  // Create initial version metadata
  const migratedTemplate: SpecialistTemplate = {
    ...template,
    version_metadata: {
      changelog: [
        {
          version: template.version,
          date: now,
          type: 'patch',
          changes: [
            {
              category: 'other',
              description: 'Initial version with version tracking',
              breaking: false
            }
          ],
          author: 'Migration script'
        }
      ],
      created_at: now,
      updated_at: now
    }
  };

  if (DRY_RUN) {
    console.log(chalk.yellow(`   📝 Would migrate: ${template.name} v${template.version}`));
    return true;
  }

  const success = saveTemplate(filePath, migratedTemplate);
  if (success) {
    console.log(chalk.green(`   ✓ Migrated: ${template.name} v${template.version}`));
  }

  return success;
}

async function main() {
  console.log(chalk.blue.bold('\n📦 Template Version Metadata Migration\n'));

  if (DRY_RUN) {
    console.log(chalk.yellow('🔍 DRY RUN MODE - No changes will be made\n'));
  }

  // Find all template files in the templates directory
  const templatesDir = resolve(process.cwd(), 'templates');
  console.log(chalk.gray(`Searching for templates in: ${templatesDir}\n`));

  const templateFiles = findTemplateFiles(templatesDir);

  if (templateFiles.length === 0) {
    console.log(chalk.yellow('⚠️  No template files found'));
    return;
  }

  console.log(chalk.blue(`Found ${templateFiles.length} template file(s)\n`));

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of templateFiles) {
    const relativePath = filePath.replace(process.cwd() + '/', '');
    console.log(chalk.gray(`Processing: ${relativePath}`));

    const result = migrateTemplate(filePath);
    if (result) {
      // Check if it was actually migrated or skipped
      const template = loadTemplate(filePath);
      if (template?.version_metadata) {
        migrated++;
      } else {
        skipped++;
      }
    } else {
      failed++;
    }
  }

  // Summary
  console.log(chalk.blue.bold('\n📊 Migration Summary:\n'));
  console.log(chalk.green(`   ✓ Migrated: ${migrated}`));
  console.log(chalk.gray(`   ⏭️  Skipped (already migrated): ${skipped}`));
  if (failed > 0) {
    console.log(chalk.red(`   ✗ Failed: ${failed}`));
  }
  console.log(chalk.gray(`   📄 Total processed: ${templateFiles.length}\n`));

  if (DRY_RUN) {
    console.log(chalk.yellow('🔍 This was a dry run. Run without --dry-run to apply changes.\n'));
  } else {
    console.log(chalk.green('✅ Migration complete!\n'));
  }
}

// Run migration
main().catch(error => {
  console.error(chalk.red('\n❌ Migration failed:'), error);
  process.exit(1);
});
