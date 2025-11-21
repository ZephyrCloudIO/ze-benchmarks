/**
 * LLM-based template substitution
 * Step 3c: Replace mustache variables using LLM understanding
 */

import type { ExtractedIntent } from './intent-extraction.js';
import { logger } from '@ze/logger';

const log = logger.llmSubstitution;

/**
 * OpenAI tool schema for template variable substitution
 */
export const SUBSTITUTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'substitute_variables',
    description: 'Replace mustache variables in template with actual values based on context',
    parameters: {
      type: 'object',
      properties: {
        substitutions: {
          type: 'object',
          description: 'Mapping of variable names to their replacement values',
          additionalProperties: { type: 'string' }
        },
        filledTemplate: {
          type: 'string',
          description: 'Complete template with all variables replaced'
        }
      },
      required: ['substitutions', 'filledTemplate']
    }
  }
};

/**
 * Build prompt for LLM template substitution
 *
 * @param template - Template string with mustache variables ({{var}} or {var})
 * @param userPrompt - Original user request
 * @param intent - Extracted intent from Step 3a
 * @param context - Additional context (selection results, template data, etc.)
 * @returns Prompt string for LLM
 */
export function buildSubstitutionPrompt(
  template: string,
  userPrompt: string,
  intent: ExtractedIntent,
  context: Record<string, any>
): string {
  return `Fill in the mustache variables in this template based on the user prompt and available context.

TEMPLATE (with mustache variables):
"""
${template}
"""

USER PROMPT:
"""
${userPrompt}
"""

EXTRACTED INTENT:
${JSON.stringify(intent, null, 2)}

AVAILABLE CONTEXT:
${JSON.stringify(context, null, 2)}

INSTRUCTIONS:
1. **Identify all mustache variables** in the template:
   - Double curly braces: {{variable}}
   - Single curly braces: {variable}

2. **Match each variable to appropriate values** from:
   - User prompt (explicit mentions)
   - Extracted intent (framework, components, features, etc.)
   - Available context (specialist name, tech stack, tags, etc.)

3. **Use semantic matching**:
   - Variable names may not exactly match context keys
   - Example: {{name}} might map to context.specialistName or intent.framework
   - Example: {{framework}} should use intent.framework
   - Example: {{packageManager}} should use intent.packageManager
   - Example: {{techStack}} should be a comma-separated list from context

4. **Infer values when needed**:
   - If a value isn't explicitly available, infer it from the user's intent
   - Use reasonable defaults if no value can be determined
   - Example: If {{name}} isn't in context, use "Specialist" or infer from template type

5. **Fill ALL variables** to create a complete, ready-to-use prompt

Use the substitute_variables tool to return:
- **substitutions**: A mapping of each variable name to its replacement value
- **filledTemplate**: The complete template with all variables replaced`;
}

/**
 * Substitute template variables using LLM
 *
 * This function uses an LLM to intelligently fill in mustache variables in a template
 * based on user prompt, extracted intent, and available context. Unlike regex-based
 * substitution, this approach can handle semantic matching and value inference.
 *
 * @param llmClient - OpenAI-compatible client (OpenAI or OpenRouter)
 * @param model - Model to use for substitution
 * @param template - Template string with mustache variables
 * @param userPrompt - Original user request
 * @param intent - Extracted intent from Step 3a
 * @param context - Additional context for variable resolution
 * @returns Filled template with all variables replaced
 */
export async function substituteWithLLM(
  llmClient: any, // OpenAI client type
  model: string,
  template: string,
  userPrompt: string,
  intent: ExtractedIntent,
  context: Record<string, any>
): Promise<string> {
  const prompt = buildSubstitutionPrompt(template, userPrompt, intent, context);

  try {
    const response = await llmClient.chat.completions.create({
      model,
      messages: [{ role: 'user', content: prompt }],
      tools: [SUBSTITUTION_TOOL as any],
      tool_choice: { type: 'function', function: { name: 'substitute_variables' } } as any,
      temperature: 0.1
    });

    const toolCall = response.choices[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('No tool call in substitution response');
    }

    const result = JSON.parse(toolCall.function.arguments);

    // Validate result
    if (!result.filledTemplate || typeof result.filledTemplate !== 'string') {
      throw new Error('Invalid substitution result: missing or invalid filledTemplate');
    }

    return result.filledTemplate;
  } catch (error) {
    // If LLM substitution fails, fall back to returning template as-is
    // (or could fall back to regex substitution)
    if (error instanceof Error) {
      log.warn('[LLM Substitution] Failed:', error.message);
      log.warn('[LLM Substitution] Returning template as-is');
    }
    return template;
  }
}

/**
 * Parse substitution tool call response
 *
 * @param toolCall - Tool call response from LLM
 * @returns Object with substitutions map and filled template
 */
export function parseSubstitutionResponse(toolCall: any): {
  substitutions: Record<string, string>;
  filledTemplate: string;
} {
  const args = typeof toolCall === 'string' ? JSON.parse(toolCall) : toolCall;

  // Validate required fields
  if (!args.filledTemplate || typeof args.filledTemplate !== 'string') {
    throw new Error('Missing or invalid "filledTemplate" field in substitution response');
  }

  if (!args.substitutions || typeof args.substitutions !== 'object') {
    throw new Error('Missing or invalid "substitutions" field in substitution response');
  }

  return {
    substitutions: args.substitutions,
    filledTemplate: args.filledTemplate
  };
}

/**
 * Extract mustache variables from a template
 * Useful for debugging and validation
 *
 * @param template - Template string
 * @returns Array of variable names (without braces)
 */
export function extractMustacheVariables(template: string): string[] {
  const variables = new Set<string>();

  // Match {{variable}} and {variable}
  const doublePattern = /\{\{(\w+)\}\}/g;
  const singlePattern = /\{(\w+)\}/g;

  let match;

  while ((match = doublePattern.exec(template)) !== null) {
    variables.add(match[1]);
  }

  while ((match = singlePattern.exec(template)) !== null) {
    // Avoid matching JSON-like patterns
    const beforeBrace = template[match.index - 1];
    const afterBrace = template[match.index + match[0].length];

    // Only add if not part of a JSON structure
    if (beforeBrace !== '"' && afterBrace !== ':') {
      variables.add(match[1]);
    }
  }

  return Array.from(variables);
}
