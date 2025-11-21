/**
 * LLM-powered prompt selection and variable extraction utilities
 *
 * This module provides utilities for using an LLM (anthropic/claude-3.5-haiku) to:
 * 1. Analyze user intent and select the best matching template prompt
 * 2. Extract mustache template variables via structured tool calling
 */

import type { PromptConfig, Prompts } from 'agency-prompt-creator';
import { logger } from '@ze/logger';

const log = logger.llmPromptSelector;

/**
 * Result from LLM prompt selection
 */
export interface PromptSelectionResult {
  selectedPromptId: string;
  confidence: 'High' | 'Medium' | 'Low';
  reasoning: string;
}

/**
 * Extracted template variables from user prompt
 */
export interface ExtractedVariables {
  framework?: string;
  packageManager?: string;
  componentName?: string;
  features?: string;
  issueType?: string;
  description?: string;
  themeType?: string;
  baseColor?: 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone';
  [key: string]: any;
}

/**
 * Tool definition for variable extraction
 */
export const VARIABLE_EXTRACTION_TOOL = {
  name: "extract_template_variables",
  description: "Extract variables from user prompt for template placeholders",
  input_schema: {
    type: "object",
    properties: {
      framework: {
        type: "string",
        enum: ["Vite", "Next.js", "Remix", "Astro", "SvelteKit"],
        description: "Framework mentioned or implied"
      },
      packageManager: {
        type: "string",
        enum: ["pnpm", "npm", "yarn", "bun"],
        description: "Package manager (default pnpm)"
      },
      componentName: {
        type: "string",
        description: "Component to add (if applicable)"
      },
      features: {
        type: "string",
        description: "Features to configure (comma-separated)"
      },
      issueType: {
        type: "string",
        description: "Issue type for troubleshooting"
      },
      description: {
        type: "string",
        description: "Detailed description from prompt"
      },
      themeType: {
        type: "string",
        description: "Theme configuration approach"
      },
      baseColor: {
        type: "string",
        enum: ["slate", "gray", "zinc", "neutral", "stone"],
        description: "Base color palette"
      }
    },
    required: []
  }
} as const;

/**
 * Build prompt for LLM-powered template selection
 *
 * @param userPrompt The user's original request
 * @param allPrompts All available prompts from the template
 * @param model The model being used (for model-specific prompts)
 * @returns Prompt for LLM to select best template
 */
export function buildPromptSelectionPrompt(
  userPrompt: string,
  allPrompts: Prompts,
  model?: string
): string {
  const promptOptions: Array<{ id: string; preview: string; useCase: string }> = [];

  // NEW STRUCTURE: Task-specific prompts are top-level entries
  // Each task has its own default and model_specific nested structure

  // Iterate through all top-level keys (excluding default, model_specific, prompt_strategy)
  Object.entries(allPrompts).forEach(([taskType, taskPrompts]) => {
    // Skip metadata keys
    if (taskType === 'prompt_strategy' || taskType === 'default' || taskType === 'model_specific') {
      return;
    }

    // taskPrompts should have structure: { default: {...}, model_specific: {...} }
    if (typeof taskPrompts === 'object' && taskPrompts !== null) {
      // Extract default prompt for this task
      if (taskPrompts.default) {
        Object.entries(taskPrompts.default).forEach(([key, value]) => {
          if (typeof value === 'string' && value.length > 0) {
            promptOptions.push({
              id: `${taskType}.default.${key}`,
              preview: value.substring(0, 100) + (value.length > 100 ? '...' : ''),
              useCase: getUseCaseDescription(taskType)
            });
          }
        });
      }

      // Extract model-specific prompts for this task if model is provided
      if (model && taskPrompts.model_specific) {
        const modelKey = Object.keys(taskPrompts.model_specific).find(k =>
          model.includes(k) || k.includes(model)
        );

        if (modelKey) {
          const modelPrompts = taskPrompts.model_specific[modelKey];
          Object.entries(modelPrompts).forEach(([key, value]) => {
            if (typeof value === 'string' && value.length > 0) {
              promptOptions.push({
                id: `${taskType}.model_specific.${modelKey}.${key}`,
                preview: value.substring(0, 100) + (value.length > 100 ? '...' : ''),
                useCase: getUseCaseDescription(taskType)
              });
            }
          });
        }
      }
    }
  });

  // Also add the general default and model_specific prompts (spawnerPrompt etc.)
  if (allPrompts.default) {
    Object.entries(allPrompts.default).forEach(([key, value]) => {
      if (typeof value === 'string' && value.length > 0) {
        promptOptions.push({
          id: `default.${key}`,
          preview: value.substring(0, 100) + (value.length > 100 ? '...' : ''),
          useCase: getUseCaseDescription(key)
        });
      }
    });
  }

  if (model && allPrompts.model_specific) {
    const modelKey = Object.keys(allPrompts.model_specific).find(k =>
      model.includes(k) || k.includes(model)
    );

    if (modelKey) {
      const modelPrompts = allPrompts.model_specific[modelKey];
      Object.entries(modelPrompts).forEach(([key, value]) => {
        if (typeof value === 'string' && value.length > 0) {
          promptOptions.push({
            id: `general.model_specific.${modelKey}.${key}`,
            preview: value.substring(0, 100) + (value.length > 100 ? '...' : ''),
            useCase: getUseCaseDescription(key)
          });
        }
      });
    }
  }

  const optionsText = promptOptions.map((opt, idx) =>
    `${idx + 1}. ID: ${opt.id}\n   Template: ${opt.preview}\n   Use Case: ${opt.useCase}`
  ).join('\n\n');

  return `You are a prompt classification expert. Select the BEST template that matches the user's intent.

User Request: "${userPrompt}"

Available Templates:
${optionsText}

Analyze the user's request and respond with JSON in this exact format:
{
  "selected_prompt_id": "<prompt_id>",
  "confidence": "<High|Medium|Low>",
  "reasoning": "<brief explanation>"
}

Select the template that best matches the user's intent. Consider:
- Primary action (setup, add component, troubleshoot, configure theme)
- Specificity (model-specific prompts are more detailed)
- Context provided in user request`;
}

/**
 * Get human-readable description of prompt use case
 */
function getUseCaseDescription(promptKey: string): string {
  const descriptions: Record<string, string> = {
    spawnerPrompt: 'Initial specialist introduction and capabilities',
    project_setup: 'Setting up a new project from scratch',
    component_add: 'Adding a component to existing project',
    troubleshoot: 'Debugging issues in existing project',
    theme_setup: 'Configuring theming and styling',
    systemPrompt: 'System-level instructions',
    contextPrompt: 'Additional context for requests'
  };

  return descriptions[promptKey] || 'General purpose prompt';
}

/**
 * Parse LLM response for prompt selection
 *
 * @param llmResponse Raw response from LLM
 * @returns Parsed selection result
 * @throws Error if response cannot be parsed
 */
export function parsePromptSelectionResponse(llmResponse: string): PromptSelectionResult {
  try {
    // Try to extract JSON from markdown code blocks if present
    const jsonMatch = llmResponse.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) ||
                     llmResponse.match(/(\{[\s\S]*\})/);

    if (!jsonMatch) {
      throw new Error('No JSON found in LLM response');
    }

    const parsed = JSON.parse(jsonMatch[1]);

    if (!parsed.selected_prompt_id || !parsed.confidence || !parsed.reasoning) {
      throw new Error('Missing required fields in parsed response');
    }

    // Validate confidence level
    if (!['High', 'Medium', 'Low'].includes(parsed.confidence)) {
      throw new Error(`Invalid confidence level: ${parsed.confidence}`);
    }

    return {
      selectedPromptId: parsed.selected_prompt_id,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse prompt selection response: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Build prompt for LLM-powered variable extraction
 *
 * @param userPrompt The user's original request
 * @param selectedTemplate The selected template content with mustache placeholders
 * @returns Prompt for LLM to extract variables
 */
export function buildVariableExtractionPrompt(
  userPrompt: string,
  selectedTemplate: string
): string {
  return `Extract variables from user request to fill template placeholders.

User Request: "${userPrompt}"

Template Preview: ${selectedTemplate.substring(0, 300)}${selectedTemplate.length > 300 ? '...' : ''}

Instructions:
- Extract ONLY explicitly mentioned or strongly implied variables
- Use defaults for common patterns (e.g., pnpm is recommended package manager)
- Leave undefined if not mentioned
- Be precise with names (e.g., "Vite" not "vite", exact component names)
- Extract description as a summary of the full request
- For features, list them comma-separated

Call the extract_template_variables tool with the extracted values.`;
}

/**
 * Parse tool call response from LLM
 *
 * @param toolCall Tool call object from LLM response
 * @returns Extracted variables
 * @throws Error if tool call is invalid
 */
export function parseToolCallResponse(toolCall: any): ExtractedVariables {
  try {
    if (!toolCall || typeof toolCall !== 'object') {
      throw new Error('Invalid tool call object');
    }

    // Handle different tool call formats (Claude vs OpenAI)
    const input = toolCall.input || toolCall.arguments || toolCall;

    if (typeof input === 'string') {
      return JSON.parse(input);
    }

    if (typeof input === 'object') {
      return input;
    }

    throw new Error('Tool call input is not an object or valid JSON string');
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse tool call response: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Validate extracted variables against schema
 * Ensures enum values are valid and applies defaults
 *
 * @param vars Extracted variables
 * @returns Validated and normalized variables
 */
export function validateExtractedVariables(vars: ExtractedVariables): ExtractedVariables {
  const validated: ExtractedVariables = { ...vars };

  // Validate framework enum
  if (validated.framework) {
    const validFrameworks = ['Vite', 'Next.js', 'Remix', 'Astro', 'SvelteKit'];
    if (!validFrameworks.includes(validated.framework)) {
      // Try to normalize common variations
      const normalized = normalizeFramework(validated.framework);
      if (validFrameworks.includes(normalized)) {
        validated.framework = normalized;
      } else {
        log.warn(`Invalid framework value: ${validated.framework}, using default: Vite`);
        validated.framework = 'Vite';
      }
    }
  }

  // Validate packageManager enum
  if (validated.packageManager) {
    const validManagers = ['pnpm', 'npm', 'yarn', 'bun'];
    if (!validManagers.includes(validated.packageManager.toLowerCase())) {
      log.warn(`Invalid packageManager value: ${validated.packageManager}, using default: pnpm`);
      validated.packageManager = 'pnpm';
    } else {
      validated.packageManager = validated.packageManager.toLowerCase();
    }
  }

  // Validate baseColor enum
  if (validated.baseColor) {
    const validColors = ['slate', 'gray', 'zinc', 'neutral', 'stone'];
    if (!validColors.includes(validated.baseColor.toLowerCase())) {
      log.warn(`Invalid baseColor value: ${validated.baseColor}, using default: slate`);
      validated.baseColor = 'slate';
    } else {
      validated.baseColor = validated.baseColor.toLowerCase() as any;
    }
  }

  return validated;
}

/**
 * Normalize framework name variations
 */
function normalizeFramework(framework: string): string {
  const normalized = framework.toLowerCase().trim();

  const mapping: Record<string, string> = {
    'vite': 'Vite',
    'nextjs': 'Next.js',
    'next.js': 'Next.js',
    'next': 'Next.js',
    'remix': 'Remix',
    'astro': 'Astro',
    'sveltekit': 'SvelteKit',
    'svelte kit': 'SvelteKit',
    'svelte': 'SvelteKit'
  };

  return mapping[normalized] || framework;
}

/**
 * Apply default values for missing variables
 *
 * @param vars Extracted variables
 * @param promptId The selected prompt ID to determine which defaults to apply
 * @returns Variables with defaults applied
 */
export function applyDefaults(vars: ExtractedVariables, promptId: string): ExtractedVariables {
  const withDefaults = { ...vars };

  // Apply default package manager if not specified
  if (!withDefaults.packageManager && promptId.includes('project_setup')) {
    withDefaults.packageManager = 'pnpm';
  }

  // Apply default framework if not specified and it's a setup task
  if (!withDefaults.framework && promptId.includes('project_setup')) {
    withDefaults.framework = 'Vite';
  }

  // Apply default theme type if configuring theme
  if (!withDefaults.themeType && promptId.includes('theme_setup')) {
    withDefaults.themeType = 'CSS variables';
  }

  // Apply default base color if configuring theme
  if (!withDefaults.baseColor && promptId.includes('theme_setup')) {
    withDefaults.baseColor = 'slate';
  }

  return withDefaults;
}

/**
 * Create cache key from prompt for caching LLM results
 *
 * @param prompt The user prompt
 * @returns Hash-like cache key
 */
export function createCacheKey(prompt: string): string {
  // Simple hash function for cache keys
  let hash = 0;
  for (let i = 0; i < prompt.length; i++) {
    const char = prompt.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `prompt_${Math.abs(hash).toString(36)}`;
}
