/**
 * agency-prompt-creator
 * Prompt transformation package with template inheritance and mustache substitution
 */

// Main API
export { createPrompt, createPromptFromFile } from './create-prompt.js';

// Template loading
export { loadTemplate, loadTemplateFromString } from './loader.js';

// Task detection
export {
  detectTaskType,
  detectTaskTypesWithConfidence,
  getTaskKeywords,
} from './task-detection.js';

// Prompt selection
export { selectPrompt, combinePromptParts } from './prompt-selection.js';

// Template substitution
export {
  substituteTemplate,
  buildTemplateContext,
  validateTemplateString,
} from './template-substitution.js';

// Inheritance utilities
export {
  mergeTemplates,
  validateTemplate,
  detectCircularDependency,
} from './inheritance.js';

// Documentation filtering
export {
  filterDocumentation,
  hasEnrichedDocumentation,
  type FilteredDocumentation,
} from './doc-filter.js';

// Keyword extraction
export {
  extractKeywords,
  containsKeyword,
  countKeywordMatches,
  type ExtractedKeywords,
} from './keyword-extraction.js';

// Intent extraction (Step 3a)
export {
  buildIntentExtractionPrompt,
  parseIntentResponse,
  INTENT_EXTRACTION_TOOL,
} from './intent-extraction.js';

// Component selection (Step 3b)
export {
  buildComponentSelectionPrompt,
  parseComponentSelectionResponse,
  COMPONENT_SELECTION_TOOL,
} from './component-selection.js';

// LLM-based substitution (Step 3c)
export {
  buildSubstitutionPrompt,
  substituteWithLLM,
  parseSubstitutionResponse,
  extractMustacheVariables,
  SUBSTITUTION_TOOL,
} from './llm-substitution.js';

// Types
export type {
  TaskType,
  Persona,
  Capabilities,
  PromptConfig,
  Prompts,
  PreferredModel,
  SpecialistTemplate,
  TemplateContext,
  CreatePromptOptions,
  CreatePromptResult,
  LoadTemplateOptions,
  ExtractedIntent,
  DocumentationReference,
  SpecialistSelection,
} from './types.js';
