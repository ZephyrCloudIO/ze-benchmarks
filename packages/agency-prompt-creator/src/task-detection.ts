/**
 * Task type detection from user prompts
 * Supports both built-in patterns and template-defined custom patterns
 */

import type { TaskType, SpecialistTemplate } from './types.js';

/**
 * Built-in keyword patterns for common task types
 * These are used as fallback when templates don't define custom patterns
 */

// rewrite this to use an LLM to parse the template and generate 
// Task types and priority
// The LLM should be able to parse the template and generate the task types and priority



const BUILT_IN_PATTERNS: Record<string, RegExp[]> = {
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
 * Default priority order for built-in task types
 */
const DEFAULT_PRIORITY: string[] = [
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
 * 
 * @param pattern String pattern (from JSON5 template)
 * @returns RegExp for matching
 */
function patternToRegex(pattern: string): RegExp {
  // If it looks like a regex string (starts/ends with /), try to parse it
  // Example: "/\\bshadcn\\s+add\\b/i" -> /\bshadcn\s+add\b/i
  if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
    const lastSlash = pattern.lastIndexOf('/');
    const regexBody = pattern.slice(1, lastSlash);
    const flags = pattern.slice(lastSlash + 1) || 'i';
    
    try {
      return new RegExp(regexBody, flags);
    } catch (error) {
      // If regex parsing fails, fall back to simple string matching
      console.warn(`Invalid regex pattern: ${pattern}, treating as simple string`);
    }
  }

  // Otherwise, treat as a simple string pattern
  // Escape special regex chars except * and .
  // Example: "add.*component" -> /add.*component/i
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*'); // * becomes .*
  
  return new RegExp(escaped, 'i');
}

/**
 * Build task patterns from template configuration
 * Merges template patterns with built-in patterns
 */
function buildTaskPatterns(template?: SpecialistTemplate): Record<string, RegExp[]> {
  const patterns: Record<string, RegExp[]> = { ...BUILT_IN_PATTERNS };

  // Add template-defined patterns
  if (template?.task_detection?.patterns) {
    for (const [taskType, templatePatterns] of Object.entries(template.task_detection.patterns)) {
      if (Array.isArray(templatePatterns)) {
        patterns[taskType] = templatePatterns.map((p: string) => patternToRegex(p));
      }
    }
  }

  return patterns;
}

/**
 * Get priority order for task detection
 * Uses template priority if available, otherwise defaults
 */
function getTaskPriority(template?: SpecialistTemplate): string[] {
  if (template?.task_detection?.priority) {
    // Merge template priority with built-in types not in template priority
    const templatePriority = template.task_detection.priority;
    const remaining = DEFAULT_PRIORITY.filter(t => !templatePriority.includes(t));
    return [...templatePriority, ...remaining];
  }

  return DEFAULT_PRIORITY;
}

/**
 * Detect task type from user prompt using keyword matching
 * Supports both built-in and template-defined task types
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

/**
 * Detect multiple potential task types (confidence-based)
 * Returns array of task types sorted by confidence
 * Supports both built-in and template-defined task types
 */
export function detectTaskTypesWithConfidence(
  userPrompt: string,
  template?: SpecialistTemplate
): Array<{ taskType: TaskType; confidence: number }> {
  const normalizedPrompt = userPrompt.toLowerCase().trim();
  const patterns = buildTaskPatterns(template);
  const results: Array<{ taskType: TaskType; confidence: number }> = [];

  // Check all task types
  for (const [taskType, taskPatterns] of Object.entries(patterns)) {
    let matches = 0;

    for (const pattern of taskPatterns) {
      if (pattern.test(normalizedPrompt)) {
        matches++;
      }
    }

    if (matches > 0) {
      // Simple confidence: ratio of matched patterns to total patterns
      const confidence = matches / taskPatterns.length;
      results.push({ taskType, confidence });
    }
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}


// Example usage of detectTaskTypesWithConfidence:

// Suppose you want to see what task types are detected for a given prompt:
const userPrompt = "Could you help me migrate my project to Vite and add dark mode?";
const results = detectTaskTypesWithConfidence(userPrompt);

// Print the detection results for inspection
console.log("Task detection results for:", userPrompt);
for (const { taskType, confidence } of results) {
  console.log(`  - ${taskType}: ${(confidence * 100).toFixed(1)}%`);
}

// Output might look like:
// Task detection results for: Could you help me migrate my project to Vite and add dark mode?
//   - migration: 83.3%
//   - project_setup: 33.3%
//   - default: 10.0%
/*
  (Numbers above are illustrative; actual results depend on current built-in/template patterns.)
*/
