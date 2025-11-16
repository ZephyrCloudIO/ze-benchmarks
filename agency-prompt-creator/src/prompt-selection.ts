/**
 * Prompt selection logic
 * Selects appropriate prompt from template based on:
 * 1. Task type
 * 2. Model-specific overrides (with flexible matching)
 * 3. Default fallback
 */

import type { SpecialistTemplate, TaskType, PromptConfig } from './types.js';

/**
 * Normalize model name for comparison
 * Strips provider prefix and normalizes format
 *
 * @param model Model name (e.g., "anthropic/claude-sonnet-4.5")
 * @returns Normalized model name (e.g., "claude-sonnet-4.5")
 */
function normalizeModelName(model: string): string {
  // Strip provider prefix (e.g., "anthropic/", "openai/")
  const withoutProvider = model.includes('/') ? model.split('/')[1] : model;

  // Normalize common variations
  return withoutProvider
    .toLowerCase()
    .trim();
}

/**
 * Find matching model-specific prompt with flexible matching
 * Tries multiple strategies:
 * 1. Exact match
 * 2. Normalized match (without provider prefix)
 * 3. Version prefix match (e.g., "claude-sonnet-4" matches "claude-sonnet-4.5")
 *
 * @param modelSpecific Model-specific prompts object
 * @param model Model name to match
 * @returns Matching prompt config if found, undefined otherwise
 */
function findModelSpecificPrompt(
  modelSpecific: Record<string, PromptConfig> | undefined,
  model: string
): PromptConfig | undefined {
  if (!modelSpecific || !model) {
    return undefined;
  }

  // Strategy 1: Exact match
  if (modelSpecific[model]) {
    return modelSpecific[model];
  }

  // Strategy 2: Normalized match (without provider prefix)
  const normalizedModel = normalizeModelName(model);

  for (const [key, config] of Object.entries(modelSpecific)) {
    if (normalizeModelName(key) === normalizedModel) {
      return config;
    }
  }

  // Strategy 3: Version prefix match
  // e.g., if user has "claude-sonnet-4", match "claude-sonnet-4.5"
  // or if user has "anthropic/claude-sonnet-4.5", match "claude-sonnet-4"
  for (const [key, config] of Object.entries(modelSpecific)) {
    const normalizedKey = normalizeModelName(key);

    // Check if one is a prefix of the other (for version matching)
    if (normalizedModel.startsWith(normalizedKey) || normalizedKey.startsWith(normalizedModel)) {
      return config;
    }
  }

  return undefined;
}

/**
 * Select the appropriate prompt from a specialist template
 * Priority order:
 * 1. Task-specific, model-specific prompt
 * 2. Task-specific, default prompt
 * 3. Default, model-specific prompt
 * 4. Default, default prompt
 *
 * @param template Specialist template
 * @param taskType Task type
 * @param model Model name (optional)
 * @returns Selected prompt config and metadata
 */
export function selectPrompt(
  template: SpecialistTemplate,
  taskType: TaskType,
  model?: string
): {
  config: PromptConfig;
  usedModelSpecific: boolean;
  usedTaskSpecific: boolean;
} {
  // Try task-specific prompts first
  if (taskType !== 'default' && template.prompts[taskType]) {
    const taskPrompts = template.prompts[taskType];

    // If it's a PromptConfig directly (not nested)
    if (isPromptConfig(taskPrompts)) {
      return {
        config: taskPrompts,
        usedModelSpecific: false,
        usedTaskSpecific: true,
      };
    }

    // If it has model-specific overrides, try flexible matching
    if (model) {
      const modelConfig = findModelSpecificPrompt(taskPrompts.model_specific, model);
      if (modelConfig) {
        return {
          config: modelConfig,
          usedModelSpecific: true,
          usedTaskSpecific: true,
        };
      }
    }

    // Task-specific default
    if (taskPrompts.default) {
      return {
        config: taskPrompts.default,
        usedModelSpecific: false,
        usedTaskSpecific: true,
      };
    }
  }

  // Fall back to default prompts
  const defaultPrompts = template.prompts.default;

  if (!defaultPrompts) {
    throw new Error(
      `No default prompts found in template ${template.name}`
    );
  }

  // Default with model-specific override (with flexible matching)
  if (model) {
    const modelConfig = findModelSpecificPrompt(template.prompts.model_specific, model);
    if (modelConfig) {
      return {
        config: modelConfig,
        usedModelSpecific: true,
        usedTaskSpecific: false,
      };
    }
  }

  // Default, default
  return {
    config: defaultPrompts,
    usedModelSpecific: false,
    usedTaskSpecific: false,
  };
}

/**
 * Type guard to check if an object is a PromptConfig
 */
function isPromptConfig(obj: any): obj is PromptConfig {
  return (
    obj &&
    typeof obj === 'object' &&
    !obj.default &&
    !obj.model_specific
  );
}

/**
 * Combine multiple prompt parts into a single prompt
 * Handles spawnerPrompt, systemPrompt, contextPrompt, etc.
 *
 * @param config Prompt configuration
 * @returns Combined prompt string
 */
export function combinePromptParts(config: PromptConfig): string {
  const parts: string[] = [];

  // Add spawner prompt (if present)
  if (config.spawnerPrompt) {
    parts.push(config.spawnerPrompt);
  }

  // Add system prompt (if present)
  if (config.systemPrompt) {
    parts.push(config.systemPrompt);
  }

  // Add context prompt (if present)
  if (config.contextPrompt) {
    parts.push(config.contextPrompt);
  }

  // Only combine the specific prompt types above (spawnerPrompt, systemPrompt, contextPrompt)
  // Do NOT add other string properties to prevent unintended concatenation

  // Join with double newlines for clear separation
  return parts.filter((p) => p.trim()).join('\n\n');
}
