/**
 * Template Resolution Utility
 *
 * Automatically resolves enriched template paths and handles template loading
 */

import { resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
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
export function resolveTemplatePath(
  templatePath: string,
  options: { autoEnrich?: boolean; validateVersion?: boolean } = {}
): { path: string; isEnriched: boolean; warnings: string[] } {
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
    log.warn('[Template Resolver] Enriched template not found. Auto-enrichment not yet implemented.');
    // TODO: Trigger enrichment here
    // await enrichTemplate(absolutePath);
    // return { path: enrichedPath, isEnriched: true, warnings };
  }

  // Fall back to original template
  return { path: absolutePath, isEnriched: false, warnings };
}

/**
 * Get enriched template path for a given template path and version
 */
export function getEnrichedTemplatePath(templatePath: string, version: string): string {
  const dir = dirname(templatePath);
  // Support both .json5 and .jsonc extensions
  const base = templatePath.endsWith('.jsonc')
    ? basename(templatePath, '.jsonc')
    : basename(templatePath, '.json5');

  // Remove '-template' suffix if present
  const nameWithoutTemplate = base.endsWith('-template')
    ? base.slice(0, -'-template'.length)
    : base;

  // Use .json5 extension for enriched templates (maintains consistency)
  return resolve(dir, `${nameWithoutTemplate}-template.enriched-${version}.json5`);
}

/**
 * Check if a path is an enriched template
 */
export function isEnrichedTemplatePath(path: string): boolean {
  return path.includes('.enriched-') && (path.endsWith('.json5') || path.endsWith('.jsonc'));
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
