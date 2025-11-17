/**
 * Mustache template substitution
 * Replaces {{variable}} placeholders with actual values
 */

import type { TemplateContext, TaskType } from './types.js';
import { filterDocumentation } from './doc-filter.js';

/**
 * Perform mustache-style template substitution
 * Supports:
 * - Simple variables: {{name}}
 * - Nested properties: {{persona.purpose}}
 * - Array access: {{capabilities.tags.0}}
 * - Sections: {{#documentation}}...{{/documentation}}
 * - Nested properties in sections: {{#documentation}}{{title}}{{/documentation}}
 *
 * @param template Template string with {{variable}} placeholders
 * @param context Context object with variable values
 * @returns Processed template with substitutions
 */
export function substituteTemplate(
  template: string,
  context: TemplateContext
): string {
  // First, process sections ({{#...}}...{{/...}})
  let result = template;

  // Match section blocks: {{#key}}content{{/key}}
  const sectionPattern = /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g;

  result = result.replace(sectionPattern, (match, key, content) => {
    const value = getNestedValue(context, key);

    // If value is falsy or empty array, remove section
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return '';
    }

    // If value is an array, repeat content for each item
    if (Array.isArray(value)) {
      return value.map(item => {
        // For each array item, substitute {{.}} with the item itself
        // and {{property}} with item.property
        return content.replace(/\{\{([^}]+)\}\}/g, (_: string, innerPath: string) => {
          const trimmedPath = innerPath.trim();

          // {{.}} refers to the current item
          if (trimmedPath === '.') {
            if (typeof item === 'object') {
              return JSON.stringify(item);
            }
            return String(item);
          }

          // Get nested value from item
          const itemValue = getNestedValue(item, trimmedPath);

          if (itemValue === undefined || itemValue === null) {
            return '';
          }

          if (Array.isArray(itemValue)) {
            return itemValue.join(', ');
          }

          if (typeof itemValue === 'object') {
            return JSON.stringify(itemValue, null, 2);
          }

          return String(itemValue);
        });
      }).join('');
    }

    // If value is truthy non-array, show content once with value as context
    if (typeof value === 'object') {
      return content.replace(/\{\{([^}]+)\}\}/g, (_: string, innerPath: string) => {
        const trimmedPath = innerPath.trim();
        const innerValue = getNestedValue(value, trimmedPath);

        if (innerValue === undefined || innerValue === null) {
          return '';
        }

        if (Array.isArray(innerValue)) {
          return innerValue.join(', ');
        }

        if (typeof innerValue === 'object') {
          return JSON.stringify(innerValue, null, 2);
        }

        return String(innerValue);
      });
    }

    return content;
  });

  // Then, process simple variables
  const pattern = /\{\{([^}#/]+)\}\}/g;

  return result.replace(pattern, (match, path) => {
    const trimmedPath = path.trim();

    // Get value from context using dot notation
    const value = getNestedValue(context, trimmedPath);

    // Handle different value types
    if (value === undefined || value === null) {
      return ''; // Empty string for missing values
    }

    if (Array.isArray(value)) {
      return value.join(', '); // Join arrays with commas
    }

    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2); // Pretty print objects
    }

    return String(value); // Convert to string
  });
}

/**
 * Get nested value from object using dot notation
 * Example: getNestedValue({a: {b: {c: 1}}}, 'a.b.c') => 1
 */
function getNestedValue(obj: any, path: string): any {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }

    // Handle array indices
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      const [, key, index] = arrayMatch;
      current = current[key];
      if (Array.isArray(current)) {
        current = current[parseInt(index, 10)];
      }
      continue;
    }

    current = current[part];
  }

  return current;
}

/**
 * Build template context from specialist template and user input
 * Creates a comprehensive context object for substitution
 */
export function buildTemplateContext(
  template: any,
  userPrompt: string,
  taskType: TaskType,
  additionalContext: TemplateContext = {}
): TemplateContext {
  // Filter and inject relevant documentation (with keyword-based filtering)
  const documentation = filterDocumentation(template, taskType, userPrompt, 5);

  return {
    // Specialist information
    name: template.name,
    version: template.version,
    persona: template.persona,
    capabilities: template.capabilities,

    // Task information
    task_type: taskType,
    user_prompt: userPrompt,

    // Documentation (filtered and ranked)
    documentation: documentation.length > 0 ? documentation : undefined,

    // Helper values
    tech_stack: template.persona?.tech_stack?.join(', ') || '',
    values: template.persona?.values?.join(', ') || '',
    tags: template.capabilities?.tags?.join(', ') || '',

    // Additional context
    ...additionalContext,
  };
}

/**
 * Validate template string for common mustache errors
 * Returns array of potential issues
 */
export function validateTemplateString(template: string): string[] {
  const issues: string[] = [];

  // Check for unclosed braces
  const openBraces = (template.match(/\{\{/g) || []).length;
  const closeBraces = (template.match(/\}\}/g) || []).length;

  if (openBraces !== closeBraces) {
    issues.push(
      `Mismatched braces: ${openBraces} opening, ${closeBraces} closing`
    );
  }

  // Check for single braces (common mistake)
  const singleBraces = template.match(/\{[^{]|[^}]\}/g);
  if (singleBraces && singleBraces.length > 0) {
    issues.push(
      `Found single braces which won't be substituted. Use {{variable}} instead of {variable}`
    );
  }

  // Check for spaces in variable names
  const variablesWithSpaces = template.match(/\{\{[^}]*\s+[^}]*\}\}/g);
  if (variablesWithSpaces && variablesWithSpaces.length > 0) {
    issues.push(
      `Variable names contain spaces: ${variablesWithSpaces.join(', ')}`
    );
  }

  return issues;
}
