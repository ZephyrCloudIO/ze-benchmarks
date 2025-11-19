/**
 * Component selection using LLM tool calling
 * Step 3b: Select spawner prompt, task prompt, and documentation
 */

import type { SpecialistTemplate, Prompts, DocumentationEntry } from './types.js';
import type { ExtractedIntent } from './intent-extraction.js';

/**
 * Documentation reference with enrichment details
 */
export interface DocumentationReference {
  title: string;
  url: string;
  summary: string;
  keyConcepts: string[];
  codePatterns: string[];
  relevanceScore: number;
}

/**
 * Result of component selection
 */
export interface SpecialistSelection {
  spawnerPromptId: string; // e.g., "default.spawnerPrompt"
  taskPromptId: string; // e.g., "project_setup.default.systemPrompt"
  relevantTags: string[]; // From template capabilities
  relevantTechStack: string[]; // From template persona
  documentation: DocumentationReference[]; // Weighted docs
  reasoning: string; // Why these were selected
}

/**
 * OpenAI tool schema for component selection
 */
export const COMPONENT_SELECTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'select_specialist_components',
    description: 'Select appropriate spawner prompt, task prompt, and documentation based on user intent',
    parameters: {
      type: 'object',
      properties: {
        spawnerPromptId: {
          type: 'string',
          description: 'ID of the selected spawner prompt (e.g., "default.spawnerPrompt")'
        },
        taskPromptId: {
          type: 'string',
          description: 'ID of the selected task prompt (e.g., "project_setup.default.systemPrompt")'
        },
        relevantTags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Capability tags relevant to this task'
        },
        relevantTechStack: {
          type: 'array',
          items: { type: 'string' },
          description: 'Tech stack items relevant to this task'
        },
        documentationUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'URLs of relevant documentation (ordered by relevance)'
        },
        reasoning: {
          type: 'string',
          description: 'Explanation of why these components were selected'
        }
      },
      required: ['spawnerPromptId', 'taskPromptId', 'reasoning']
    }
  }
};

/**
 * Build prompt for LLM component selection
 *
 * @param userPrompt - Original user request
 * @param intent - Extracted intent from Step 3a
 * @param template - Specialist template with prompts and documentation
 * @returns Prompt string for LLM
 */
export function buildComponentSelectionPrompt(
  userPrompt: string,
  intent: ExtractedIntent,
  template: SpecialistTemplate
): string {
  const availablePrompts = formatAvailablePrompts(template.prompts);
  const availableDocs = formatAvailableDocumentation(template.documentation || []);
  const capabilitiesTags = template.capabilities?.tags || [];
  const techStack = template.persona?.tech_stack || [];

  return `Given the user prompt and extracted intent, select the most appropriate specialist components.

USER PROMPT:
"""
${userPrompt}
"""

EXTRACTED INTENT:
${JSON.stringify(intent, null, 2)}

AVAILABLE PROMPTS:
${availablePrompts}

AVAILABLE DOCUMENTATION:
${availableDocs}

CAPABILITIES:
- Tags: ${capabilitiesTags.join(', ')}

TECH STACK:
- Items: ${techStack.join(', ')}

INSTRUCTIONS:
1. **spawnerPromptId**: Select the most appropriate general spawner prompt
   - Use "default.spawnerPrompt" for general cases
   - Use "general.model_specific.<model>.spawnerPrompt" if model-specific variants exist

2. **taskPromptId**: Select the most appropriate task-specific prompt
   - Identify task type from intent (project_setup, component_generation, migration, etc.)
   - Use "<task>.default.systemPrompt" for default prompts
   - Use "<task>.model_specific.<model>.systemPrompt" if model-specific variants exist

3. **relevantTags**: Select capability tags that are relevant to this task

4. **relevantTechStack**: Select tech stack items that are relevant to this task

5. **documentationUrls**: Select documentation URLs that are most relevant (order by relevance)
   - Prioritize documentation that matches the task type and intent
   - Include both official docs and examples if relevant

6. **reasoning**: Explain your selection in 2-3 sentences

Use the select_specialist_components tool to return your selection.`;
}

/**
 * Format available prompts for display in selection prompt
 */
function formatAvailablePrompts(prompts: Prompts): string {
  const lines: string[] = [];

  // Default prompts
  if (prompts.default) {
    lines.push('**Default Prompts:**');
    if (prompts.default.spawnerPrompt) {
      lines.push('  - default.spawnerPrompt');
    }
    if (prompts.default.systemPrompt) {
      lines.push('  - default.systemPrompt');
    }
    if (prompts.default.contextPrompt) {
      lines.push('  - default.contextPrompt');
    }
  }

  // Model-specific prompts
  if (prompts.model_specific) {
    lines.push('\n**Model-Specific Prompts:**');
    for (const [model, config] of Object.entries(prompts.model_specific)) {
      if (config.spawnerPrompt) {
        lines.push(`  - general.model_specific.${model}.spawnerPrompt`);
      }
      if (config.systemPrompt) {
        lines.push(`  - general.model_specific.${model}.systemPrompt`);
      }
    }
  }

  // Task-specific prompts
  const taskTypes = Object.keys(prompts).filter(
    key => key !== 'default' && key !== 'model_specific'
  );

  if (taskTypes.length > 0) {
    lines.push('\n**Task-Specific Prompts:**');
    for (const taskType of taskTypes) {
      const taskPrompts = prompts[taskType];
      if (typeof taskPrompts === 'object' && taskPrompts !== null) {
        if ('default' in taskPrompts && taskPrompts.default) {
          if (taskPrompts.default.systemPrompt) {
            lines.push(`  - ${taskType}.default.systemPrompt`);
          }
        }
        if ('model_specific' in taskPrompts && taskPrompts.model_specific) {
          for (const model of Object.keys(taskPrompts.model_specific)) {
            lines.push(`  - ${taskType}.model_specific.${model}.systemPrompt`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Format available documentation for display in selection prompt
 */
function formatAvailableDocumentation(docs: DocumentationEntry[]): string {
  if (docs.length === 0) {
    return '(No documentation available)';
  }

  const lines: string[] = [];

  for (const doc of docs) {
    const url = doc.url || doc.path || '(no URL)';
    const description = doc.description || '';
    const type = doc.type || 'reference';

    lines.push(`- **${url}** (${type})`);
    if (description) {
      lines.push(`  ${description}`);
    }
    if (doc.enrichment) {
      lines.push(`  Tags: ${doc.enrichment.relevant_tags?.join(', ') || 'none'}`);
      lines.push(`  Tasks: ${doc.enrichment.relevant_for_tasks?.join(', ') || 'none'}`);
    }
  }

  return lines.join('\n');
}

/**
 * Parse and validate component selection tool call response
 *
 * @param toolCall - Tool call response from LLM
 * @param template - Specialist template (for enriching documentation)
 * @returns Validated SpecialistSelection object
 */
export function parseComponentSelectionResponse(
  toolCall: any,
  template: SpecialistTemplate
): SpecialistSelection {
  const args = typeof toolCall === 'string' ? JSON.parse(toolCall) : toolCall;

  // Validate required fields
  if (!args.spawnerPromptId || typeof args.spawnerPromptId !== 'string') {
    throw new Error('Missing or invalid "spawnerPromptId" field in component selection response');
  }
  if (!args.taskPromptId || typeof args.taskPromptId !== 'string') {
    throw new Error('Missing or invalid "taskPromptId" field in component selection response');
  }
  if (!args.reasoning || typeof args.reasoning !== 'string') {
    throw new Error('Missing or invalid "reasoning" field in component selection response');
  }

  // Get documentation details from template
  const documentationUrls = args.documentationUrls || [];
  const documentation = enrichDocumentationReferences(
    documentationUrls,
    template.documentation || []
  );

  // Build validated result
  const selection: SpecialistSelection = {
    spawnerPromptId: args.spawnerPromptId,
    taskPromptId: args.taskPromptId,
    relevantTags: Array.isArray(args.relevantTags) ? args.relevantTags : [],
    relevantTechStack: Array.isArray(args.relevantTechStack) ? args.relevantTechStack : [],
    documentation,
    reasoning: args.reasoning
  };

  return selection;
}

/**
 * Enrich documentation references with details from template
 *
 * @param urls - Selected documentation URLs
 * @param templateDocs - Documentation entries from template
 * @returns Enriched documentation references
 */
function enrichDocumentationReferences(
  urls: string[],
  templateDocs: DocumentationEntry[]
): DocumentationReference[] {
  const references: DocumentationReference[] = [];

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const templateDoc = templateDocs.find(d => d.url === url || d.path === url);

    if (templateDoc && templateDoc.enrichment) {
      // Use enriched documentation
      references.push({
        title: extractTitleFromUrl(url),
        url: url,
        summary: templateDoc.enrichment.summary || templateDoc.description,
        keyConcepts: templateDoc.enrichment.key_concepts || [],
        codePatterns: templateDoc.enrichment.code_patterns || [],
        relevanceScore: 1.0 - (i * 0.1) // Decreasing score based on order
      });
    } else if (templateDoc) {
      // Use basic documentation
      references.push({
        title: extractTitleFromUrl(url),
        url: url,
        summary: templateDoc.description,
        keyConcepts: [],
        codePatterns: [],
        relevanceScore: 1.0 - (i * 0.1)
      });
    } else {
      // URL not found in template (shouldn't happen, but handle gracefully)
      references.push({
        title: extractTitleFromUrl(url),
        url: url,
        summary: '',
        keyConcepts: [],
        codePatterns: [],
        relevanceScore: 1.0 - (i * 0.1)
      });
    }
  }

  return references;
}

/**
 * Extract a title from a URL
 */
function extractTitleFromUrl(url: string): string {
  // Try to extract filename or last path segment
  const parts = url.split('/');
  const lastPart = parts[parts.length - 1] || parts[parts.length - 2] || 'Documentation';

  // Remove file extension and convert dashes/underscores to spaces
  return lastPart
    .replace(/\.(md|html|txt)$/, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
