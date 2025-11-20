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

import type { TaskType, SpecialistTemplate } from './types.js';
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
 * Task detection result from LLM analysis
 */
export interface TaskDetectionResult {
  taskTypes: Array<{
    name: string;
    description: string;
    patterns: string[];
    examples: string[];
  }>;
  priority: string[];
}

/**
 * OpenAI tool schema for task detection analysis
 */
export const TASK_DETECTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'analyze_template_tasks',
    description: 'Analyze a specialist template and extract task types, patterns, and priority order',
    parameters: {
      type: 'object',
      properties: {
        taskTypes: {
          type: 'array',
          description: 'List of task types found in the template',
          items: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Task type identifier (e.g., "component_add", "theme_setup")'
              },
              description: {
                type: 'string',
                description: 'Description of what this task type represents'
              },
              patterns: {
                type: 'array',
                items: { type: 'string' },
                description: 'Regex patterns or keywords that match this task type (e.g., ["add.*component", "install.*component"])'
              },
              examples: {
                type: 'array',
                items: { type: 'string' },
                description: 'Example user prompts that would match this task type'
              }
            },
            required: ['name', 'description', 'patterns']
          }
        },
        priority: {
          type: 'array',
          items: { type: 'string' },
          description: 'Priority order for checking task types (most specific first)'
        }
      },
      required: ['taskTypes', 'priority']
    }
  }
};

/**
 * Build prompt for LLM task detection analysis
 * Generates task types based on specialist capabilities, tools, and purpose
 *
 * @param template Specialist template to analyze
 * @returns Prompt string for LLM
 */
export function buildTaskDetectionPrompt(template: SpecialistTemplate): string {
  // Extract the key fields that define what tasks this specialist can handle
  const specialistContext = {
    name: template.name,
    purpose: template.persona?.purpose,
    attributes: template.persona?.attributes,
    tech_stack: template.persona?.tech_stack,
    capabilities: {
      tags: template.capabilities?.tags,
      descriptions: template.capabilities?.descriptions,
      considerations: template.capabilities?.considerations
    },
    dependencies: {
      available_tools: template.dependencies?.available_tools,
      subscription: template.dependencies?.subscription
    },
    // Include prompts structure to see what task types are already defined
    existingPrompts: template.prompts
  };

  return `Analyze this specialist template and generate task types, detection patterns, and priority order based on the specialist's capabilities, tools, and purpose.

SPECIALIST CONTEXT:
${JSON.stringify(specialistContext, null, 2)}

INSTRUCTIONS:

1. **Generate task types** based on:
   - **purpose**: What the specialist is designed to do (e.g., "project setup, component integration, troubleshooting")
   - **capabilities.tags**: Specific capabilities (e.g., "component-installation", "troubleshooting", "vite-setup")
   - **capabilities.descriptions**: What each capability means
   - **capabilities.considerations**: Important constraints or patterns
   - **tech_stack**: Technologies the specialist works with
   - **attributes**: Skills and knowledge areas
   - **available_tools**: Tools the specialist can use (file_system, terminal, code_analysis, etc.)
   - **existingPrompts**: Check if there are already task-specific prompts defined (like "component_add", "troubleshoot", "theme_setup")

2. **For each task type**, generate:
   - **name**: A clear, descriptive identifier (e.g., "component_add", "theme_setup", "troubleshoot", "project_setup")
   - **description**: What this task type represents based on the specialist's capabilities
   - **patterns**: Array of regex patterns or keywords that would match user prompts for this task
     - Generate patterns based on:
       * The task name and description
       * Related capabilities tags and descriptions
       * Common ways users would express this task
       * Synonyms and variations (e.g., "add", "install", "create" for component_add)
     - Use simple patterns like "add.*component" or full regex like "/\\badd\\s+component\\b/i"
     - Make patterns flexible but specific enough to avoid false matches
   - **examples**: 2-3 example user prompts that would match this task type

3. **Determine priority order**:
   - Order task types from most specific to least specific
   - More specific/actionable tasks should be checked first
   - Consider the specialist's domain and primary use cases
   - Example priority for shadcn specialist: ["component_add", "troubleshoot", "theme_setup", "project_setup"]
     * "component_add" is most specific (adding a single component)
     * "troubleshoot" is specific (debugging issues)
     * "theme_setup" is moderately specific (configuring theming)
     * "project_setup" is least specific (broad project initialization)

4. **Task type generation guidelines**:
   - Create task types that align with the specialist's core capabilities
   - If "existingPrompts" has task-specific keys (like "component_add", "troubleshoot"), include those as task types
   - Generate additional task types based on capabilities that don't have explicit prompts yet
   - Each task type should represent a distinct, actionable task the specialist can perform
   - Use clear, descriptive names that match the specialist's domain terminology

5. **Pattern generation best practices**:
   - Base patterns on the task name, capability descriptions, and considerations
   - Include domain-specific terminology from tech_stack and attributes
   - Consider how users naturally express these tasks
   - Balance specificity (avoid false matches) with flexibility (catch variations)
   - Prefer simple string patterns over complex regex when possible

Use the analyze_template_tasks tool to return your analysis.`;
}

/**
 * Parse and validate task detection tool call response
 *
 * @param toolCall Tool call response from LLM
 * @returns Validated TaskDetectionResult
 */
export function parseTaskDetectionResponse(toolCall: any): TaskDetectionResult {
  const args = typeof toolCall === 'string' ? JSON.parse(toolCall) : toolCall;

  // Validate structure
  if (!Array.isArray(args.taskTypes)) {
    throw new Error('Missing or invalid "taskTypes" field in task detection response');
  }
  if (!Array.isArray(args.priority)) {
    throw new Error('Missing or invalid "priority" field in task detection response');
  }

  // Validate each task type
  const validatedTaskTypes = args.taskTypes.map((taskType: any) => {
    if (!taskType.name || typeof taskType.name !== 'string') {
      throw new Error('Task type missing or invalid "name" field');
    }
    if (!taskType.description || typeof taskType.description !== 'string') {
      throw new Error(`Task type "${taskType.name}" missing or invalid "description" field`);
    }
    if (!Array.isArray(taskType.patterns)) {
      throw new Error(`Task type "${taskType.name}" missing or invalid "patterns" field`);
    }

    return {
      name: taskType.name,
      description: taskType.description,
      patterns: taskType.patterns.map((p: any) => String(p)),
      examples: Array.isArray(taskType.examples) ? taskType.examples.map((e: any) => String(e)) : []
    };
  });

  return {
    taskTypes: validatedTaskTypes,
    priority: args.priority.map((p: any) => String(p))
  };
}

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
 * Cache for LLM-generated task detection results
 * Key: template name + version (or hash of template structure)
 */
const taskDetectionCache = new Map<string, TaskDetectionResult & { patterns: Record<string, RegExp[]> }>();

/**
 * Analyze template using LLM to extract task types and patterns
 *
 * @param llmClient OpenAI-compatible client
 * @param model Model to use for analysis
 * @param template Specialist template to analyze
 * @returns Task detection result with patterns
 */
export async function analyzeTemplateWithLLM(
  llmClient: any,
  model: string,
  template: SpecialistTemplate
): Promise<{ patterns: Record<string, RegExp[]>; priority: string[] }> {
  // Create cache key from template identity
  const cacheKey = `${template.name}-${template.version}`;
  
  // Check cache
  if (taskDetectionCache.has(cacheKey)) {
    const cached = taskDetectionCache.get(cacheKey)!;
    return {
      patterns: cached.patterns,
      priority: cached.priority
    };
  }

  try {
    const prompt = buildTaskDetectionPrompt(template);
    
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      tools: [TASK_DETECTION_TOOL as any],
      tool_choice: { type: 'function', function: { name: 'analyze_template_tasks' } } as any,
      temperature: 0.1,
      max_tokens: 2000
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in task detection response');
    }

    const result = parseTaskDetectionResponse(JSON.parse(toolCall.function.arguments));

    // Convert patterns to RegExp
    const patterns: Record<string, RegExp[]> = {};
    for (const taskType of result.taskTypes) {
      patterns[taskType.name] = taskType.patterns.map(patternToRegex);
    }

    // Cache the result
    taskDetectionCache.set(cacheKey, {
      ...result,
      patterns
    });

    return {
      patterns,
      priority: result.priority
    };
  } catch (error) {
    log.warn('[Task Detection] LLM analysis failed:', error instanceof Error ? error.message : String(error));
    log.warn('[Task Detection] Falling back to template-defined patterns or default');
    throw error; // Let caller handle fallback
  }
}

/**
 * Build task patterns from template configuration
 * Uses LLM if available, otherwise falls back to template-defined patterns, then default patterns
 */
function buildTaskPatterns(
  template?: SpecialistTemplate,
  llmResult?: { patterns: Record<string, RegExp[]>; priority: string[] }
): Record<string, RegExp[]> {
  const patterns: Record<string, RegExp[]> = {};

  // Priority: LLM result > template task_detection > default patterns
  if (llmResult) {
    // Use LLM-generated patterns
    Object.assign(patterns, llmResult.patterns);
  } else if (template?.task_detection?.patterns) {
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
 * Uses LLM result if available, otherwise template priority, then default priority
 */
function getTaskPriority(
  template?: SpecialistTemplate,
  llmResult?: { patterns: Record<string, RegExp[]>; priority: string[] }
): string[] {
  if (llmResult?.priority) {
    return llmResult.priority;
  }

  if (template?.task_detection?.priority) {
    return template.task_detection.priority;
  }

  // Use default priority, or extract from patterns if custom patterns exist
  const patterns = buildTaskPatterns(template, llmResult);
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
 * Supports LLM-generated patterns and template-defined patterns
 *
 * @param userPrompt User's prompt text
 * @param template Optional template with custom task detection patterns
 * @param llmResult Optional LLM-analyzed task detection result
 * @returns Detected task type
 */
export function detectTaskType(
  userPrompt: string,
  template?: SpecialistTemplate,
  llmResult?: { patterns: Record<string, RegExp[]>; priority: string[] }
): TaskType {
  const normalizedPrompt = userPrompt.toLowerCase().trim();
  const patterns = buildTaskPatterns(template, llmResult);
  const priority = getTaskPriority(template, llmResult);

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
  template?: SpecialistTemplate,
  llmResult?: { patterns: Record<string, RegExp[]>; priority: string[] }
): string[] {
  const patterns = buildTaskPatterns(template, llmResult);
  const taskPatterns = patterns[taskType] || [];
  return taskPatterns.map((p) => p.source);
}

/**
 * Detect multiple potential task types (confidence-based)
 * Returns array of task types sorted by confidence
 */
export function detectTaskTypesWithConfidence(
  userPrompt: string,
  template?: SpecialistTemplate,
  llmResult?: { patterns: Record<string, RegExp[]>; priority: string[] }
): Array<{ taskType: TaskType; confidence: number }> {
  const normalizedPrompt = userPrompt.toLowerCase().trim();
  const patterns = buildTaskPatterns(template, llmResult);
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
      const confidence = matches / taskPatterns.length;
      results.push({ taskType, confidence });
    }
  }

  // Sort by confidence (highest first)
  results.sort((a, b) => b.confidence - a.confidence);

  return results;
}
