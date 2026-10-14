/**
 * Template Resolution Utility
 *
 * Automatically resolves enriched template paths and handles template loading
 */

import { resolve, dirname, basename, join } from 'path';
import { existsSync, readdirSync } from 'fs';
import type { SpecialistTemplate, VersionMetadata } from './types.js';
import { loadJSON5 } from './utils.js';
import { logger } from '@ze/logger';

const log = logger.templateResolver;

/**
 * Validate template version and return warnings
 */
function validateTemplateVersion(template: SpecialistTemplate): string[] {
  const warnings: string[] = [];
  const metadata = template.version_metadata;

  if (!metadata) {
    warnings.push(
      `ℹ️  Template ${template.name} v${template.version} has no version metadata`
    );
    return warnings;
  }

  // Check deprecation
  if (metadata.deprecated) {
    warnings.push(
      `⚠️  Template ${template.name} v${template.version} is DEPRECATED` +
      (metadata.deprecated_reason ? `: ${metadata.deprecated_reason}` : '') +
      (metadata.replacement ? `\n   Use ${metadata.replacement} instead` : '')
    );
  }

  // Check breaking changes
  if (metadata.breaking_changes && metadata.breaking_changes.length > 0) {
    const recent = metadata.breaking_changes.slice(0, 3);
    warnings.push(
      `⚠️  Breaking changes in v${template.version}:\n` +
      recent.map(bc => `   - ${bc.description}`).join('\n')
    );
  }

  return warnings;
}

/**
 * Resolve template path, automatically using enriched version if available
 *
 * @param templatePath User-provided template path
 * @param options Options for template resolution
 * @returns Object with resolved path, whether it's enriched, and any warnings
 */
export async function resolveTemplatePath(
  templatePath: string,
  options: { autoEnrich?: boolean; validateVersion?: boolean } = {}
): Promise<{ path: string; isEnriched: boolean; warnings: string[] }> {
  const { autoEnrich = false, validateVersion = true } = options;
  const absolutePath = resolve(process.cwd(), templatePath);

  // First, check if the provided path is already an enriched template
  if (isEnrichedTemplatePath(absolutePath)) {
    // Validate enriched template if requested
    if (validateVersion) {
      const template: SpecialistTemplate = loadJSON5(absolutePath);
      const warnings = validateTemplateVersion(template);
      warnings.forEach(w => log.warn(`[Template Resolver] ${w}`));
      return { path: absolutePath, isEnriched: true, warnings };
    }
    return { path: absolutePath, isEnriched: true, warnings: [] };
  }

  // Load template to get version
  const template: SpecialistTemplate = loadJSON5(absolutePath);

  // Validate template if requested
  const warnings: string[] = [];
  if (validateVersion) {
    const templateWarnings = validateTemplateVersion(template);
    warnings.push(...templateWarnings);
    templateWarnings.forEach(w => log.warn(`[Template Resolver] ${w}`));
  }

  const enrichedPath = getEnrichedTemplatePath(absolutePath, template.version);

  // Check if enriched version exists
  if (existsSync(enrichedPath)) {
    return { path: enrichedPath, isEnriched: true, warnings };
  }

  // Enriched version doesn't exist
  if (autoEnrich) {
    log.info('[Template Resolver] Enriched template not found. Starting auto-enrichment...');

    try {
      // Dynamically import enrichTemplate to avoid circular dependency
      const { enrichTemplate } = await import('./enrich-template.js');

      // Enrich with default options
      const result = await enrichTemplate(absolutePath, {
        provider: 'openrouter',
        model: process.env.ENRICHMENT_MODEL || 'anthropic/claude-3.5-haiku'
      });

      log.info(`[Template Resolver] Auto-enrichment completed: ${result.enrichedTemplatePath}`);

      // Return the newly enriched template
      return { path: result.enrichedTemplatePath, isEnriched: true, warnings };
    } catch (error) {
      log.warn(`[Template Resolver] Auto-enrichment failed: ${error instanceof Error ? error.message : String(error)}`);
      log.warn('[Template Resolver] Falling back to non-enriched template');
    }
  }

  // Fall back to original template
  return { path: absolutePath, isEnriched: false, warnings };
}

/**
 * Get enriched template path for a given template path and version
 * Uses nested directory structure: enriched/{version}/{name}.enriched.{number}.json5
 */
export function getEnrichedTemplatePath(templatePath: string, version: string, specialistName?: string): string {
  const dir = dirname(templatePath);

  // If specialist name not provided, extract it from template path
  if (!specialistName) {
    const base = templatePath.endsWith('.jsonc')
      ? basename(templatePath, '.jsonc')
      : basename(templatePath, '.json5');
    specialistName = base.replace(/-template$/, '');
  }

  const enrichedDir = join(dir, 'enriched', version);

  // Check if enriched directory exists
  if (!existsSync(enrichedDir)) {
    // Return path to first enriched file (doesn't exist yet)
    return join(enrichedDir, `${specialistName}.enriched.001.json5`);
  }

  // Find highest numbered enriched file for this specialist
  const escapedName = specialistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);

  try {
    const files = readdirSync(enrichedDir);
    const enrichedFiles = files
      .filter(f => filePattern.test(f))
      .map(f => {
        const match = f.match(filePattern);
        return { file: f, number: match ? parseInt(match[1], 10) : 0 };
      })
      .filter(f => f.number > 0)
      .sort((a, b) => b.number - a.number); // Sort descending

    if (enrichedFiles.length > 0) {
      // Return the latest enriched file
      return join(enrichedDir, enrichedFiles[0].file);
    }
  } catch (error) {
    // Directory doesn't exist or can't be read
  }

  // Return path to first enriched file
  return join(enrichedDir, `${specialistName}.enriched.001.json5`);
}

/**
 * Check if a path is an enriched template
 * Supports both old flat pattern and new nested pattern
 */
export function isEnrichedTemplatePath(path: string): boolean {
  // New nested pattern: enriched/{version}/{name}.enriched.{number}.json5
  const hasEnrichedInPath = path.includes('/enriched/') || path.includes('\\enriched\\');
  const hasEnrichedExtension = /\.enriched\.\d+\.json5$/.test(path);

  // Old flat pattern (for backward compatibility): {name}-template.enriched-{version}.json5
  const hasOldPattern = path.includes('.enriched-') && (path.endsWith('.json5') || path.endsWith('.jsonc'));

  return (hasEnrichedInPath && hasEnrichedExtension) || hasOldPattern;
}

/**
 * Check if template needs enrichment
 *
 * @param templatePath Template path
 * @returns True if enrichment is needed
 */
export function needsEnrichment(templatePath: string): boolean {
  const absolutePath = resolve(process.cwd(), templatePath);

  // Already enriched?
  if (isEnrichedTemplatePath(absolutePath)) {
    return false;
  }

  // Load template to check version
  try {
    const template: SpecialistTemplate = loadJSON5(absolutePath);
    const enrichedPath = getEnrichedTemplatePath(absolutePath, template.version);

    // Check if enriched version exists
    return !existsSync(enrichedPath);
  } catch {
    return false;
  }
}
