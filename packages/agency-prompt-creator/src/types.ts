/**
 * TypeScript types for specialist templates and prompts
 * Based on INHERITANCE.md specification
 */

/**
 * Task types that can be detected from user prompts
 * Built-in types are always available, but templates can define custom types
 */
export type TaskType =
  | 'project_setup'
  | 'component_generation'
  | 'migration'
  | 'bug_fix'
  | 'refactoring'
  | 'testing'
  | 'documentation'
  | 'default'
  | string; // Allow custom task types from templates

/**
 * Persona definition for a specialist
 */
export interface Persona {
  purpose: string;
  values?: string[];
  attributes?: string[];
  tech_stack?: string[];
  [key: string]: any;
}

/**
 * Capabilities definition for a specialist
 */
export interface Capabilities {
  tags: string[];
  descriptions?: Record<string, string>;
  [key: string]: any;
}

/**
 * Prompt configuration for a specific task or model
 */
export interface PromptConfig {
  spawnerPrompt?: string;
  systemPrompt?: string;
  contextPrompt?: string;
  [key: string]: any;
}

/**
 * Prompts structure with default and model-specific overrides
 */
export interface Prompts {
  default?: PromptConfig;
  model_specific?: Record<string, PromptConfig>;
  [taskType: string]: PromptConfig | Record<string, PromptConfig> | undefined;
}

/**
 * Model preference with optional weight and benchmarks
 */
export interface PreferredModel {
  model: string;
  weight?: number;
  benchmarks?: Record<string, number>;
}

/**
 * Documentation entry (with optional enrichment)
 */
export interface DocumentationEntry {
  type: 'official' | 'reference' | 'recipes' | 'examples' | 'control';
  url?: string;
  path?: string;
  description: string;
  enrichment?: {
    summary: string;
    key_concepts: string[];
    relevant_for_tasks: string[];
    relevant_tech_stack: string[];
    relevant_tags: string[];
    code_patterns: string[];
    last_enriched: string;
    enrichment_model: string;
  };
}

/**
 * Specialist template structure (before or after inheritance resolution)
 */
export interface SpecialistTemplate {
  // Inheritance
  from?: string;

  // Identity
  name: string;
  version: string;
  schema_version?: string;
  license?: string;

  // Specialist definition
  persona: Persona;
  capabilities: Capabilities;
  prompts: Prompts;
  preferred_models?: PreferredModel[];
  documentation?: DocumentationEntry[];

  // Metadata
  [key: string]: any;
}

/**
 * Filtered documentation for context
 */
export interface FilteredDocumentation {
  title: string;
  summary: string;
  key_concepts: string[];
  link?: string;
  code_patterns: string[];
  relevance_score: number;
}

/**
 * Context variables for mustache template substitution
 */
export interface TemplateContext {
  persona?: Persona;
  capabilities?: Capabilities;
  task_type?: TaskType;
  user_prompt?: string;
  documentation?: FilteredDocumentation[];
  [key: string]: any;
}

/**
 * Options for createPrompt function
 */
export interface CreatePromptOptions {
  /** User's prompt text */
  userPrompt: string;

  /** Model name for model-specific prompt selection */
  model?: string;

  /** Task type (auto-detected if not provided) */
  taskType?: TaskType;

  /** Additional context variables for template substitution */
  context?: TemplateContext;
}

/**
 * Result from createPrompt function
 */
export interface CreatePromptResult {
  /** Final processed prompt */
  prompt: string;

  /** Detected or specified task type */
  taskType: TaskType;

  /** Whether a model-specific prompt was used */
  usedModelSpecific: boolean;
}

/**
 * Options for loading templates with inheritance
 */
export interface LoadTemplateOptions {
  /** Base directory for resolving relative paths */
  baseDir?: string;

  /** Cache for loaded templates to prevent circular dependencies */
  cache?: Map<string, SpecialistTemplate>;
}

/**
 * Extracted intent from user prompt (Step 3a)
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
 * Documentation reference with enrichment details (Step 3b)
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
 * Result of component selection (Step 3b)
 */
export interface SpecialistSelection {
  spawnerPromptId: string; // e.g., "default.spawnerPrompt"
  taskPromptId: string; // e.g., "project_setup.default.systemPrompt"
  relevantTags: string[]; // From template capabilities
  relevantTechStack: string[]; // From template persona
  documentation: DocumentationReference[]; // Weighted docs
  reasoning: string; // Why these were selected
}
