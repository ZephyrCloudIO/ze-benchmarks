/**
 * Template Resolution Utility
 *
 * Automatically resolves enriched template paths and handles template loading
 */

import { resolve, dirname, basename } from 'path';
import { existsSync } from 'fs';
import type { SpecialistTemplate } from './types.js';
import { loadJSON5 } from './utils.js';

/**
 * Resolve template path, automatically using enriched version if available
 *
 * @param templatePath User-provided template path
 * @param autoEnrich If true, trigger enrichment if enriched version doesn't exist
 * @returns Object with resolved path and whether it's enriched
 */
export function resolveTemplatePath(
  templatePath: string,
  autoEnrich: boolean = false
): { path: string; isEnriched: boolean } {
  const absolutePath = resolve(process.cwd(), templatePath);

  // First, check if the provided path is already an enriched template
  if (isEnrichedTemplatePath(absolutePath)) {
    return { path: absolutePath, isEnriched: true };
  }

  // Load template to get version
  const template: SpecialistTemplate = loadJSON5(absolutePath);
  const enrichedPath = getEnrichedTemplatePath(absolutePath, template.version);

  // Check if enriched version exists
  if (existsSync(enrichedPath)) {
    return { path: enrichedPath, isEnriched: true };
  }

  // Enriched version doesn't exist
  if (autoEnrich) {
    console.warn('[Template Resolver] Enriched template not found. Auto-enrichment not yet implemented.');
    // TODO: Trigger enrichment here
    // await enrichTemplate(absolutePath);
    // return { path: enrichedPath, isEnriched: true };
  }

  // Fall back to original template
  return { path: absolutePath, isEnriched: false };
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
