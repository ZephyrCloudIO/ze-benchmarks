/**
 * Template loader with inheritance resolution
 * Supports three formats for the 'from' attribute:
 * 1. Scoped package: @scope/name → /personas/@scope/name.json5
 * 2. Relative path: ./base.json5, ../common/base.json5
 * 3. Absolute path: /absolute/path/to/base.json5
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname, isAbsolute } from 'node:path';
import type { SpecialistTemplate, LoadTemplateOptions } from './types.js';
import {
  mergeTemplates,
  validateTemplate,
  detectCircularDependency,
} from './inheritance.js';

/**
 * Load a template with inheritance resolution
 * Recursively loads parent templates and merges them
 *
 * @param templatePath Path to the template file (or scoped package name)
 * @param options Loading options
 * @returns Fully resolved template with inheritance applied
 */
export async function loadTemplate(
  templatePath: string,
  options: LoadTemplateOptions = {}
): Promise<SpecialistTemplate> {
  const { baseDir = process.cwd(), cache = new Map() } = options;
  const inheritanceChain = new Set<string>();

  return loadTemplateRecursive(templatePath, baseDir, cache, inheritanceChain);
}

/**
 * Recursive template loader
 */
async function loadTemplateRecursive(
  templatePath: string,
  baseDir: string,
  cache: Map<string, SpecialistTemplate>,
  inheritanceChain: Set<string>
): Promise<SpecialistTemplate> {
  // Resolve the actual file path
  const resolvedPath = resolveTemplatePath(templatePath, baseDir);

  // Check for circular dependencies
  detectCircularDependency(resolvedPath, inheritanceChain);

  // Check cache
  if (cache.has(resolvedPath)) {
    return cache.get(resolvedPath)!;
  }

  // Add to inheritance chain
  inheritanceChain.add(resolvedPath);

  // Load the template file
  const template = await loadTemplateFile(resolvedPath);

  // Validate basic structure
  if (!validateTemplate(template)) {
    throw new Error(
      `Invalid template structure in ${resolvedPath}. ` +
        `Must have: name, version, persona, capabilities, prompts`
    );
  }

  // If no inheritance, return as-is
  if (!template.from) {
    cache.set(resolvedPath, template);
    inheritanceChain.delete(resolvedPath);
    return template;
  }

  // Load parent template
  const parentPath = template.from;
  const parentBaseDir = dirname(resolvedPath);
  const parent = await loadTemplateRecursive(
    parentPath,
    parentBaseDir,
    cache,
    inheritanceChain
  );

  // Merge parent and child
  const merged = mergeTemplates(parent, template);

  // Remove the 'from' attribute from merged result
  delete merged.from;

  // Cache and return
  cache.set(resolvedPath, merged);
  inheritanceChain.delete(resolvedPath);

  return merged;
}

/**
 * Resolve template path based on format:
 * - Scoped package: @scope/name → baseDir/personas/@scope/name.json5
 * - Relative path: ./base.json5 → baseDir/base.json5
 * - Absolute path: /path/to/base.json5 → /path/to/base.json5
 */
function resolveTemplatePath(templatePath: string, baseDir: string): string {
  // Absolute path - use as-is
  if (isAbsolute(templatePath)) {
    return templatePath;
  }

  // Scoped package reference
  if (templatePath.startsWith('@')) {
    return join(baseDir, 'personas', `${templatePath}.json5`);
  }

  // Relative path
  if (templatePath.startsWith('.')) {
    return resolve(baseDir, templatePath);
  }

  // Default: treat as relative
  return resolve(baseDir, templatePath);
}

/**
 * Load and parse a template file
 * Supports both JSON5 and JSON formats
 */
async function loadTemplateFile(filePath: string): Promise<any> {
  if (!existsSync(filePath)) {
    throw new Error(`Template file not found: ${filePath}`);
  }

  try {
    const content = readFileSync(filePath, 'utf-8');

    // Check if file has JSON5 features (comments, trailing commas)
    // If it starts with // or has trailing commas, use JSON5 directly
    const hasComments = content.trim().startsWith('//') || content.includes('//');
    const hasTrailingCommas = /,\s*[}\]\s]*$/.test(content);
    
    // Import JSON5 at the top level (it's a CommonJS module that works with require)
    let JSON5: any;
    try {
      JSON5 = require('json5');
    } catch (e) {
      // If require fails, try dynamic import
      const json5Module = await import('json5');
      JSON5 = json5Module.default || json5Module;
    }
    
    if (hasComments || hasTrailingCommas || filePath.endsWith('.json5')) {
      // Use JSON5 for .json5 files or files with comments
      try {
        return JSON5.parse(content);
      } catch (json5Error) {
        throw new Error(
          `Failed to parse JSON5 template file ${filePath}: ${
            json5Error instanceof Error ? json5Error.message : String(json5Error)
          }`
        );
      }
    }

    // Try JSON for standard JSON files
    try {
      return JSON.parse(content);
    } catch (jsonError) {
      // Fall back to JSON5 if JSON parsing fails
      try {
        return JSON5.parse(content);
      } catch (json5Error) {
        throw new Error(
          `Failed to parse template file ${filePath}: ${
            jsonError instanceof Error ? jsonError.message : String(jsonError)
          }`
        );
      }
    }
  } catch (error) {
    throw new Error(
      `Failed to parse template file ${filePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Load a template from a string (for testing)
 */
export function loadTemplateFromString(
  content: string
): SpecialistTemplate {
  try {
    const template = JSON.parse(content);
    if (!validateTemplate(template)) {
      throw new Error('Invalid template structure');
    }
    return template;
  } catch (error) {
    throw new Error(
      `Failed to parse template: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}
