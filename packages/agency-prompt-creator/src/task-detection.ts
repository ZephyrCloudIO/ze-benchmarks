/**
 * Task type detection from user prompts
 *
 * This module provides intelligent task type detection with three-tier fallback:
 * 1. **LLM-based detection** (preferred): Analyzes the specialist template using an LLM
 *    to generate task types, patterns, and priority dynamically based on the specialist's
 *    capabilities, tools, tech stack, and purpose.
 *
 * 2. **Template-defined patterns** (fallback): Uses patterns and priority defined in the
 *    template's `task_detection` field if LLM is unavailable or fails.
 *
 * 3. **Default patterns** (ultimate fallback): Uses hardcoded patterns for common task types
 *    (project_setup, component_generation, migration, bug_fix, refactoring, testing, documentation)
 *    if no template patterns are defined.
 *
 * ## Usage
 *
 * ```typescript
 * // Simple usage (uses default patterns)
 * const taskType = detectTaskType("Create a new React component");
 * // => "component_generation"
 *
 * // With template (uses template patterns or LLM if available)
 * const taskType = detectTaskType(userPrompt, template);
 *
 * // With LLM-generated patterns
 * const llmResult = await analyzeTemplateWithLLM(client, model, template);
 * const taskType = detectTaskType(userPrompt, template, llmResult);
 * ```
 */

import type { TaskType, SpecialistTemplate } from './types';
import { logger } from '@ze/logger';

const log = logger.taskDetection;

/**
 * Default task patterns (fallback when LLM is unavailable and template doesn't define patterns)
 */
const DEFAULT_TASK_PATTERNS: Record<string, RegExp[]> = {
  project_setup: [
    /\b(setup|scaffold|initialize|create).*(project|app|application|workspace)\b/i,
    /\bnew\s+(project|app|application|workspace)\b/i,
    /\bbootstrap\b/i,
    /\binitialize.*project\b/i,
    /\bset\s*up.*from\s*scratch\b/i,
  ],
  component_generation: [
    /\b(create|generate|add|build).*(component|button|form|modal|card|navbar|header|footer)\b/i,
    /\bnew\s+(ui|component|button|form|modal)\b/i,
    /\bgenerate.*component\b/i,
  ],
  migration: [
    /\bmigrate\b/i,
    /\bupgrade\s+(to|from)\b/i,
    /\b(move|switch|transition)\s+(to|from)\b/i,
    /\bconvert.*to\b/i,
    /\bporting\b/i,
  ],
  bug_fix: [
    /\b(fix|resolve|debug|repair)\b/i,
    /\b(bug|issue|error|problem)\b/i,
    /\bnot\s+working\b/i,
    /\bbroken\b/i,
  ],
  refactoring: [
    /\brefactor\b/i,
    /\brestructure\b/i,
    /\bclean\s*up\b/i,
    /\bimprove.*code\b/i,
    /\breorganize\b/i,
    /\boptimize\b/i,
  ],
  testing: [
    /\b(add|write|create)\s+(test|tests|unit\s*test)\b/i,
    /\btest\s+(coverage|suite)\b/i,
    /\bautomated\s+testing\b/i,
  ],
  documentation: [
    /\b(add|write|create|update)\s+(docs|documentation|readme)\b/i,
    /\bdocument\b/i,
    /\bcomment\b/i,
  ],
};

/**
 * Default priority order for task detection
 */
const DEFAULT_TASK_PRIORITY = [
  'project_setup',
  'component_generation',
  'migration',
  'bug_fix',
  'refactoring',
  'testing',
  'documentation',
];



/**
 * Convert string pattern to RegExp
 * Supports simple patterns like "add.*component" or full regex strings like "/add.*component/i"
 */
function patternToRegex(pattern: string): RegExp {
  // If it looks like a regex string (starts/ends with /), try to parse it
  if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
    const lastSlash = pattern.lastIndexOf('/');
    const regexBody = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1) || 'i';
    
    try {
      return new RegExp(regexBody, flags);
    } catch (error) {
      log.warn(`Invalid regex pattern: ${pattern}, treating as simple string`);
    }
  }

  // Otherwise, treat as a simple string pattern
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*');
  
  return new RegExp(escaped, 'i');
}


/**
 * Build task patterns from template configuration
 * Falls back to template-defined patterns, then default patterns
 */
function buildTaskPatterns(
  template?: SpecialistTemplate
): Record<string, RegExp[]> {
  const patterns: Record<string, RegExp[]> = {};

  // Priority: template task_detection > default patterns
  if (template?.task_detection?.patterns) {
    // Use template-defined patterns
    for (const [taskType, templatePatterns] of Object.entries(template.task_detection.patterns)) {
      if (Array.isArray(templatePatterns)) {
        patterns[taskType] = templatePatterns.map((p: string) => patternToRegex(p));
      }
    }
  } else {
    // Use default patterns as final fallback
    Object.assign(patterns, DEFAULT_TASK_PATTERNS);
  }

  return patterns;
}

/**
 * Get priority order for task detection
 * Uses template priority, then default priority
 */
function getTaskPriority(
  template?: SpecialistTemplate
): string[] {
  if (template?.task_detection?.priority) {
    return template.task_detection.priority;
  }

  // Use default priority, or extract from patterns if custom patterns exist
  const patterns = buildTaskPatterns(template);
  const patternKeys = Object.keys(patterns);

  // If patterns match default patterns, use default priority
  // Otherwise return pattern keys in arbitrary order
  const hasOnlyDefaultPatterns = patternKeys.every(key => DEFAULT_TASK_PATTERNS[key] !== undefined);
  if (hasOnlyDefaultPatterns) {
    return DEFAULT_TASK_PRIORITY.filter(key => patternKeys.includes(key));
  }

  return patternKeys;
}

/**
 * Detect task type from user prompt using keyword matching
 * Supports template-defined patterns and default patterns
 *
 * @param userPrompt User's prompt text
 * @param template Optional template with custom task detection patterns
 * @returns Detected task type
 */
export function detectTaskType(
  userPrompt: string,
  template?: SpecialistTemplate
): TaskType {
  const normalizedPrompt = userPrompt.toLowerCase().trim();
  const patterns = buildTaskPatterns(template);
  const priority = getTaskPriority(template);

  // Check task types in priority order
  for (const taskType of priority) {
    const taskPatterns = patterns[taskType];
    if (!taskPatterns) continue;

    for (const pattern of taskPatterns) {
      if (pattern.test(normalizedPrompt)) {
        return taskType;
      }
    }
  }

  // Check any remaining task types not in priority list
  for (const [taskType, taskPatterns] of Object.entries(patterns)) {
    if (priority.includes(taskType)) continue; // Already checked

    for (const pattern of taskPatterns) {
      if (pattern.test(normalizedPrompt)) {
        return taskType;
      }
    }
  }

  return 'default';
}

/**
 * Get task-specific keywords for a given task type
 * Useful for debugging or understanding detection logic
 */
export function getTaskKeywords(
  taskType: TaskType,
  template?: SpecialistTemplate
): string[] {
  const patterns = buildTaskPatterns(template);
  const taskPatterns = patterns[taskType] || [];
  return taskPatterns.map((p) => p.source);
}
