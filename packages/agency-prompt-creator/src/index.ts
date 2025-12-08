/**
 * agency-prompt-creator
 * Prompt transformation package with template inheritance and mustache substitution
 */

// Main API
export { createPrompt, createPromptFromFile } from './create-prompt';

// Template loading
export { loadTemplate, loadTemplateFromString } from './loader';

// Task detection
export {
  detectTaskType,
  getTaskKeywords,
} from './task-detection';

// Prompt selection
export { selectPrompt, combinePromptParts } from './prompt-selection';

// Template substitution
export {
  substituteTemplate,
  buildTemplateContext,
  validateTemplateString,
} from './template-substitution';

// Inheritance utilities
export {
  mergeTemplates,
  validateTemplate,
  detectCircularDependency,
} from './inheritance';

// Documentation filtering
export {
  filterDocumentation,
  hasEnrichedDocumentation,
  type FilteredDocumentation,
} from './doc-filter';

// Keyword extraction
export {
  extractKeywords,
  containsKeyword,
  countKeywordMatches,
  type ExtractedKeywords,
} from './keyword-extraction';

// Intent extraction (Step 3a)
export {
  buildIntentExtractionPrompt,
  parseIntentResponse,
  INTENT_EXTRACTION_TOOL,
} from './intent-extraction';

// Component selection (Step 3b)
export {
  buildComponentSelectionPrompt,
  parseComponentSelectionResponse,
  COMPONENT_SELECTION_TOOL,
} from './component-selection';

// LLM-based substitution (Step 3c)
export {
  buildSubstitutionPrompt,
  substituteWithLLM,
  parseSubstitutionResponse,
  extractMustacheVariables,
  SUBSTITUTION_TOOL,
} from './llm-substitution';

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
} from './types';
