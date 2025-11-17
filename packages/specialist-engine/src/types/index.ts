/**
 * Core types for the Specialist Engine
 *
 * This file contains specialist-engine-specific types.
 * Shared types are imported and re-exported from agency-prompt-creator.
 */

// ============================================================================
// Import shared types from agency-prompt-creator
// ============================================================================

import type {
  TaskType,
  Persona,
  Capabilities,
  Prompts,
  PromptConfig,
  PreferredModel,
  SpecialistTemplate as AgencyTemplate,
} from 'agency-prompt-creator';

// Re-export for consumers of this package
export type {
  TaskType,
  Persona,
  Capabilities,
  Prompts,
  PromptConfig,
  PreferredModel,
};

// ============================================================================
// Extracted Knowledge Types (specialist-engine specific)
// ============================================================================

export interface ExtractedKnowledge {
  domain: string;
  framework: string;
  version: string;

  // Core knowledge
  concepts: Concept[];
  procedures: Procedure[];
  configurations: Configuration[];

  // Gotchas and best practices
  gotchas: Gotcha[];
  bestPractices: BestPractice[];
  commonMistakes: Mistake[];

  // Metadata
  sources: Source[];
  extractedAt: Date;
  confidence: number;
}

export interface Concept {
  name: string;
  description: string;
  importance: 'critical' | 'high' | 'medium' | 'low';
  relatedConcepts: string[];
}

export interface Procedure {
  name: string;
  steps: string[];
  prerequisites: string[];
  outcomes: string[];
}

export interface Configuration {
  file: string;
  purpose: string;
  requiredFields: Record<string, any>;
  optionalFields?: Record<string, any>;
  examples: string[];
}

export interface Gotcha {
  title: string;
  description: string;
  impact: 'critical' | 'high' | 'medium' | 'low';
  solution: string;
  relatedTo: string[];
}

export interface BestPractice {
  title: string;
  description: string;
  category: string;
  reasoning: string;
  examples: string[];
}

export interface Mistake {
  title: string;
  description: string;
  frequency: 'very_common' | 'common' | 'occasional' | 'rare';
  symptoms: string[];
  correction: string;
}

export interface Source {
  type: 'documentation' | 'repository' | 'community' | 'code_analysis';
  url: string;
  relevance: number; // 0-1
  lastAccessed: Date;
}

// ============================================================================
// Template Types (extending agency-prompt-creator)
// ============================================================================

/**
 * DocumentationEntry - compatible with agency-prompt-creator's DocumentationEntry
 * Includes enrichment metadata for intelligent documentation filtering
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
 * SpecialistTemplate - extends agency-prompt-creator template
 * with specialist-engine specific fields matching shadcn-specialist-template.json5 format
 */
export interface SpecialistTemplate extends AgencyTemplate {
  // Additional specialist-engine specific fields
  dependencies?: Dependencies;
  llm_config?: LLMConfig;
  schema_version?: string;
  availability?: string;
  maintainers?: Array<{ name: string; email: string }>;
  displayName?: string;
  spawnable_sub_agent_specialists?: string[]; // Array of specialist names that can be spawned as sub-agents
}

export interface Dependencies {
  subscription?: {
    required: boolean;
    purpose: string;
  };
  available_tools?: string[];
  mcps?: Array<{
    name: string;
    version: string;
    permissions: string[];
    description: string;
    required: boolean;
  }>;
}

export interface LLMConfig {
  provider: 'openrouter' | 'anthropic';
  selection_model: string;
  extraction_model: string;
  timeout_ms: number;
  cache_ttl_ms: number;
  fallback_to_static?: boolean;
}

// ============================================================================
// Tier Types
// ============================================================================

export type TierLevel = 'L0' | 'L1' | 'L2' | 'L3' | 'Lx';

export interface TierPrompt {
  level: TierLevel;
  content: string;
  metadata: {
    includeContext: boolean | string;
    includeSteps: boolean | string;
    includeConstraints: boolean | string;
    includeExamples: boolean | string;
    includeValidation?: boolean;
    includePitfalls?: boolean;
  };
}

export interface TierSet {
  tiers: Record<TierLevel, TierPrompt>;
  baseTask: string;
  scenario: string;
}

// ============================================================================
// Enrichment Types
// ============================================================================

export interface EnrichmentConfig {
  tiers: TierLevel[];
  models: string[];
  optimizationLevel: 'basic' | 'standard' | 'comprehensive';
  enrichDocumentation?: boolean;
}

export interface EnrichmentResult {
  template: SpecialistTemplate;
  tiers: TierSet;
  modelSpecific: Record<string, any>;
  enrichedAt: Date;
}

// ============================================================================
// Extraction Config Types
// ============================================================================

export interface ExtractionConfig {
  domain: string;
  framework?: string;
  sources: {
    documentation?: string[];
    repositories?: string[];
    community?: string[];
  };
  depth: 'basic' | 'standard' | 'comprehensive';
  caching?: boolean;
  parallel?: boolean;
}

// ============================================================================
// Validation Types
// ============================================================================

export interface ValidationResult {
  isValid: boolean;
  hasErrors: boolean;
  hasWarnings: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  info: ValidationIssue[];
}

export interface ValidationIssue {
  type: 'error' | 'warning' | 'info';
  category: 'structure' | 'completeness' | 'consistency' | 'quality';
  message: string;
  path?: string;
  suggestion?: string;
}

// ============================================================================
// Generator Types
// ============================================================================

export interface GeneratorConfig {
  outputDir: string;
  includeBenchmarks: boolean;
  includeDocs: boolean;
  includeExamples: boolean;
  format?: 'json5' | 'yaml';
}

export interface SpecialistPackage {
  path: string;
  template: SpecialistTemplate;
  files: string[];
  benchmarks?: string[];
  docs?: string[];
}

// ============================================================================
// Snapshot Types
// ============================================================================

export interface SnapshotConfig {
  snapshotName: string;
  description: string;
  includeArtifacts: boolean;
}

export interface Snapshot extends SpecialistTemplate {
  snapshotId: string;
  snapshotVersion: string;
  createdAt: Date;
  benchmarkResults: BenchmarkResults;
  preferred_models: PreferredModel[];
}

export interface BenchmarkResults {
  batchId: string;
  totalRuns: number;
  successRate: number;
  avgWeightedScore: number;
  duration: number;
  tierPerformance: Record<string, TierPerformance>;
  modelPerformance: Record<string, ModelPerformance>;
}

export interface TierPerformance {
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  avgWeightedScore: number;
}

export interface ModelPerformance {
  totalRuns: number;
  successfulRuns: number;
  avgScore: number;
  avgWeightedScore: number;
  avgDuration: number;
}

// ============================================================================
// Engine Config Types
// ============================================================================

export interface EngineConfig {
  extraction: {
    depth: 'basic' | 'standard' | 'comprehensive';
    sources: string[];
    caching: boolean;
    parallel: boolean;
  };
  structuring: {
    baseTemplate?: string;
    inheritanceDepth: number;
    includeExamples: boolean;
  };
  enrichment: {
    tiers: TierLevel[];
    models: string[];
    optimizationLevel: 'basic' | 'standard' | 'comprehensive';
  };
  validation: {
    strictMode: boolean;
    warnOnMissing: boolean;
    dryRun: boolean;
  };
  output: {
    directory: string;
    format: 'json5' | 'yaml';
    includeDocs: boolean;
    includeBenchmarks: boolean;
  };
}