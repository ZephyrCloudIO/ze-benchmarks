/**
 * Template inheritance resolver following INHERITANCE.md TSConfig-style merge rules
 */

import type { SpecialistTemplate } from './types.js';

/**
 * Merge two templates following TSConfig-style rules:
 * - Primitives: child overrides parent
 * - Objects: deep merge (child keys override parent keys)
 * - Arrays: complete replacement (NO merging)
 *
 * @param parent Parent template
 * @param child Child template
 * @returns Merged template
 */
export function mergeTemplates(
  parent: SpecialistTemplate,
  child: Partial<SpecialistTemplate>
): SpecialistTemplate {
  const result: any = { ...parent };

  for (const key in child) {
    if (!Object.prototype.hasOwnProperty.call(child, key)) {
      continue;
    }

    const childValue = child[key];
    const parentValue = result[key];

    // Child value is undefined - skip
    if (childValue === undefined) {
      continue;
    }

    // Child value is null or primitive - child wins
    if (
      childValue === null ||
      typeof childValue !== 'object' ||
      parentValue === undefined
    ) {
      result[key] = childValue;
      continue;
    }

    // Child value is an array - complete replacement (key behavior!)
    if (Array.isArray(childValue)) {
      result[key] = [...childValue];
      continue;
    }

    // Parent value is an array but child is object - child wins
    if (Array.isArray(parentValue)) {
      result[key] = childValue;
      continue;
    }

    // Both are objects - deep merge
    if (typeof parentValue === 'object' && parentValue !== null) {
      result[key] = mergeObjects(parentValue, childValue);
      continue;
    }

    // Default - child wins
    result[key] = childValue;
  }

  return result as SpecialistTemplate;
}

/**
 * Deep merge two objects following TSConfig rules
 * Arrays are replaced, not merged
 */
function mergeObjects(parent: any, child: any): any {
  const result: any = { ...parent };

  for (const key in child) {
    if (!Object.prototype.hasOwnProperty.call(child, key)) {
      continue;
    }

    const childValue = child[key];
    const parentValue = result[key];

    // Child value is undefined - skip
    if (childValue === undefined) {
      continue;
    }

    // Child value is null or primitive - child wins
    if (
      childValue === null ||
      typeof childValue !== 'object' ||
      parentValue === undefined
    ) {
      result[key] = childValue;
      continue;
    }

    // Child value is an array - complete replacement
    if (Array.isArray(childValue)) {
      result[key] = [...childValue];
      continue;
    }

    // Parent value is an array but child is object - child wins
    if (Array.isArray(parentValue)) {
      result[key] = childValue;
      continue;
    }

    // Both are objects - recurse
    if (typeof parentValue === 'object' && parentValue !== null) {
      result[key] = mergeObjects(parentValue, childValue);
      continue;
    }

    // Default - child wins
    result[key] = childValue;
  }

  return result;
}

/**
 * Validate that a template has the minimum required fields
 */
export function validateTemplate(template: any): template is SpecialistTemplate {
  if (!template || typeof template !== 'object') {
    return false;
  }

  if (typeof template.name !== 'string' || !template.name) {
    return false;
  }

  if (typeof template.version !== 'string' || !template.version) {
    return false;
  }

  if (!template.persona || typeof template.persona !== 'object') {
    return false;
  }

  if (!template.capabilities || typeof template.capabilities !== 'object') {
    return false;
  }

  if (!template.prompts || typeof template.prompts !== 'object') {
    return false;
  }

  return true;
}

/**
 * Check for circular dependencies in template inheritance chain
 */
export function detectCircularDependency(
  templateName: string,
  chain: Set<string>
): void {
  if (chain.has(templateName)) {
    const chainArray = Array.from(chain);
    chainArray.push(templateName);
    throw new Error(
      `Circular dependency detected: ${chainArray.join(' → ')}`
    );
  }
}
