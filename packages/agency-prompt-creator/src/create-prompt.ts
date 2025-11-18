/**
 * Main createPrompt function
 * Orchestrates the entire prompt creation pipeline
 */

import type {
  SpecialistTemplate,
  CreatePromptOptions,
  CreatePromptResult,
  TemplateContext,
} from './types.js';
import { detectTaskType } from './task-detection.js';
import { selectPrompt, combinePromptParts } from './prompt-selection.js';
import {
  substituteTemplate,
  buildTemplateContext,
} from './template-substitution.js';

/**
 * Create a prompt from a specialist template and user input
 *
 * This is the main entry point for the package. It:
 * 1. Detects the task type from the user prompt (or uses provided type)
 * 2. Selects the appropriate prompt from the template (task-specific, model-specific)
 * 3. Combines prompt parts into a single string
 * 4. Performs mustache template substitution with context
 * 5. Returns the final prompt ready for the LLM
 *
 * @param template Specialist template (should be loaded with loadTemplate)
 * @param options Prompt creation options
 * @returns Processed prompt and metadata
 */
export function createPrompt(
  template: SpecialistTemplate,
  options: CreatePromptOptions
): CreatePromptResult {
  const { userPrompt, model, taskType: providedTaskType, context = {} } = options;

  // Step 1: Detect or use provided task type
  const taskType = providedTaskType || detectTaskType(userPrompt, template);

  // Step 2: Select appropriate prompt from template
  const { config, usedModelSpecific } = selectPrompt(
    template,
    taskType,
    model
  );

  // Step 3: Combine prompt parts
  const combinedPrompt = combinePromptParts(config);

  // Step 4: Build context for substitution
  const templateContext = buildTemplateContext(
    template,
    userPrompt,
    taskType,
    context
  );

  // Step 4.5: Append documentation section if enriched docs available
  const promptWithDocs = appendDocumentationSection(combinedPrompt, templateContext);

  // Step 5: Perform template substitution
  const finalPrompt = substituteTemplate(promptWithDocs, templateContext);

  return {
    prompt: finalPrompt,
    taskType,
    usedModelSpecific,
  };
}

/**
 * Create a prompt from a template file path
 * Convenience function that loads and processes in one call
 *
 * @param templatePath Path to template file
 * @param options Prompt creation options
 * @returns Processed prompt and metadata
 */
export async function createPromptFromFile(
  templatePath: string,
  options: CreatePromptOptions
): Promise<CreatePromptResult> {
  const { loadTemplate } = await import('./loader.js');
  const template = await loadTemplate(templatePath);
  return createPrompt(template, options);
}

/**
 * Append documentation section to prompt if enriched docs are available
 *
 * @param prompt Base prompt
 * @param context Template context with documentation
 * @returns Prompt with documentation section appended
 */
function appendDocumentationSection(
  prompt: string,
  context: TemplateContext
): string {
  // Only append if documentation is available in context
  if (!context.documentation || !Array.isArray(context.documentation) || context.documentation.length === 0) {
    return prompt;
  }

  // Documentation template section
  const docSection = `

## Relevant Documentation

The following documentation resources are most relevant to your task:

{{#documentation}}
### {{title}}

{{summary}}

**Key Concepts**: {{#key_concepts}}{{.}}{{^last}}, {{/last}}{{/key_concepts}}

{{#link}}**Reference**: {{link}}{{/link}}

{{#code_patterns}}
{{#code_patterns.0}}**Code Patterns**:
{{#code_patterns}}
- {{.}}
{{/code_patterns}}
{{/code_patterns.0}}
{{/code_patterns}}

---
{{/documentation}}`;

  return prompt + docSection;
}
