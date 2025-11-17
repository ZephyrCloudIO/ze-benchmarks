/**
 * Task type detection from user prompts
 * Uses keyword matching and pattern recognition
 */

import type { TaskType } from './types.js';

/**
 * Keyword patterns for each task type
 */
const TASK_PATTERNS: Record<TaskType, RegExp[]> = {
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
  default: [],
};

/**
 * Detect task type from user prompt using keyword matching
 *
 * @param userPrompt User's prompt text
 * @returns Detected task type
 */
export function detectTaskType(userPrompt: string): TaskType {
  const normalizedPrompt = userPrompt.toLowerCase().trim();

  // Check each task type in priority order
  const taskTypes: TaskType[] = [
    'project_setup',
    'component_generation',
    'migration',
    'bug_fix',
    'refactoring',
    'testing',
    'documentation',
  ];

  for (const taskType of taskTypes) {
    const patterns = TASK_PATTERNS[taskType];

    for (const pattern of patterns) {
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
export function getTaskKeywords(taskType: TaskType): string[] {
  const patterns = TASK_PATTERNS[taskType];
  return patterns.map((p) => p.source);
}

/**
 * Detect multiple potential task types (confidence-based)
 * Returns array of task types sorted by confidence
 */
export function detectTaskTypesWithConfidence(
  userPrompt: string
): Array<{ taskType: TaskType; confidence: number }> {
  const normalizedPrompt = userPrompt.toLowerCase().trim();
  const results: Array<{ taskType: TaskType; confidence: number }> = [];

  const taskTypes: TaskType[] = [
    'project_setup',
    'component_generation',
    'migration',
    'bug_fix',
    'refactoring',
    'testing',
    'documentation',
  ];

  for (const taskType of taskTypes) {
    const patterns = TASK_PATTERNS[taskType];
    let matches = 0;

    for (const pattern of patterns) {
      if (pattern.test(normalizedPrompt)) {
        matches++;
      }
    }

    if (matches > 0) {
      // Simple confidence: ratio of matched patterns to total patterns
      const confidence = matches / patterns.length;
      results.push({ taskType, confidence });
    }
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}
