/**
 * Intent extraction using LLM tool calling
 * Step 3a: Extract structured intent from user prompt
 */

/**
 * Extracted intent from user prompt
 */
export interface ExtractedIntent {
  intent: string; // High-level description
  primaryGoal: string; // What user wants to achieve
  keywords: string[]; // Extracted keywords
  framework?: string; // Detected framework (vite, next, etc.)
  components?: string[]; // Detected components (button, form, etc.)
  packageManager?: string; // Detected PM (pnpm, npm, yarn)
  features?: string[]; // Requested features
}

/**
 * OpenAI tool schema for intent extraction
 */
export const INTENT_EXTRACTION_TOOL = {
  type: 'function' as const,
  function: {
    name: 'extract_intent',
    description: 'Extract structured intent from user prompt',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          description: 'High-level intent description (what the user wants to achieve)'
        },
        primaryGoal: {
          type: 'string',
          description: 'Primary goal of the user request'
        },
        keywords: {
          type: 'array',
          items: { type: 'string' },
          description: 'Technical keywords extracted from the prompt'
        },
        framework: {
          type: 'string',
          description: 'Detected framework (e.g., vite, next, remix, astro)'
        },
        components: {
          type: 'array',
          items: { type: 'string' },
          description: 'Detected UI components (e.g., button, form, modal, card)'
        },
        packageManager: {
          type: 'string',
          description: 'Detected package manager (pnpm, npm, yarn, bun)'
        },
        features: {
          type: 'array',
          items: { type: 'string' },
          description: 'Requested features (e.g., typescript, tailwind, dark mode)'
        }
      },
      required: ['intent', 'primaryGoal', 'keywords']
    }
  }
};

/**
 * Build prompt for LLM intent extraction
 *
 * @param userPrompt - Original user request
 * @returns Prompt string for LLM
 */
export function buildIntentExtractionPrompt(userPrompt: string): string {
  return `Analyze this user prompt and extract structured intent:

USER PROMPT:
"""
${userPrompt}
"""

Extract the following information:
1. **Intent**: High-level description of what the user wants to achieve
2. **Primary Goal**: The main objective of this request
3. **Keywords**: Technical terms, frameworks, components, tools mentioned
4. **Framework** (optional): Detected framework if mentioned (vite, next, remix, astro, etc.)
5. **Components** (optional): UI components if mentioned (button, form, modal, card, etc.)
6. **Package Manager** (optional): Detected package manager if mentioned (pnpm, npm, yarn, bun)
7. **Features** (optional): Requested features if mentioned (typescript, tailwind, dark mode, etc.)

Use the extract_intent tool to return structured data.`;
}

/**
 * Parse and validate intent extraction tool call response
 *
 * @param toolCall - Tool call response from LLM
 * @returns Validated ExtractedIntent object
 */
export function parseIntentResponse(toolCall: any): ExtractedIntent {
  const args = typeof toolCall === 'string' ? JSON.parse(toolCall) : toolCall;

  // Validate required fields
  if (!args.intent || typeof args.intent !== 'string') {
    throw new Error('Missing or invalid "intent" field in intent extraction response');
  }
  if (!args.primaryGoal || typeof args.primaryGoal !== 'string') {
    throw new Error('Missing or invalid "primaryGoal" field in intent extraction response');
  }
  if (!Array.isArray(args.keywords)) {
    throw new Error('Missing or invalid "keywords" field in intent extraction response');
  }

  // Build validated result
  const intent: ExtractedIntent = {
    intent: args.intent,
    primaryGoal: args.primaryGoal,
    keywords: args.keywords
  };

  // Add optional fields if present
  if (args.framework && typeof args.framework === 'string') {
    intent.framework = args.framework;
  }
  if (Array.isArray(args.components)) {
    intent.components = args.components;
  }
  if (args.packageManager && typeof args.packageManager === 'string') {
    intent.packageManager = args.packageManager;
  }
  if (Array.isArray(args.features)) {
    intent.features = args.features;
  }

  return intent;
}
