/**
 * TypeScript types for AI Specialist definitions
 * Matches the schema defined in snapshot.json5
 */

export interface Maintainer {
  name: string;
  email: string;
}

export interface Persona {
  purpose: string;
  values: string[];
  attributes: string[];
  tech_stack: string[];
}

export interface Capabilities {
  tags: string[];
  descriptions: Record<string, string>;
  considerations: string[];
}

export interface Subscription {
  required: boolean;
  purpose: string;
}

export interface MCP {
  name: string;
  version: string;
  permissions: ('read' | 'write' | 'execute')[];
  description: string;
}

export interface Dependencies {
  subscription: Subscription;
  available_tools: string[];
  mcps: MCP[];
}

export interface Documentation {
  type: string;
  url?: string;
  path?: string;
  description: string;
}

export interface PreferredModel {
  model: string;
  weight: number;
  benchmarks?: Record<string, number>;
}

export interface PromptTemplates {
  spawnerPrompt: string;
  [key: string]: string;
}

export interface PromptStrategy {
  fallback: string;
  model_detection: 'auto' | 'manual';
  allow_override: boolean;
  interpolation: {
    style: 'mustache' | 'simple';
    escape_html: boolean;
  };
}

export interface Prompts {
  default: PromptTemplates;
  model_specific?: Record<string, PromptTemplates>;
  prompt_strategy: PromptStrategy;
}

export interface SpawnableSubAgent {
  name: string;
  version: string;
  license: string;
  availability: 'public' | 'paid' | 'private';
  purpose: string;
}

export interface TestSuite {
  name: string;
  path: string;
  type: 'functional' | 'accuracy' | 'performance' | 'integration';
}

export interface Scoring {
  methodology: string;
  update_frequency: string;
}

export interface Benchmarks {
  test_suites: TestSuite[];
  scoring: Scoring;
}

export interface SpecialistDefinition {
  schema_version: string;
  name: string;
  displayName: string;
  version: string;
  from?: string;
  license: string;
  availability: 'public' | 'paid' | 'private';
  maintainers: Maintainer[];
  persona: Persona;
  capabilities: Capabilities;
  dependencies: Dependencies;
  documentation: Documentation[];
  preferred_models: PreferredModel[];
  prompts: Prompts;
  spawnable_sub-agent_specialists?: SpawnableSubAgent[];
  benchmarks: Benchmarks;
}

/**
 * Validate that a parsed object matches the SpecialistDefinition schema
 */
export function validateSpecialistDefinition(obj: any): obj is SpecialistDefinition {
  if (!obj || typeof obj !== 'object') return false;
  
  // Required top-level fields
  const required = ['schema_version', 'name', 'displayName', 'version', 'license', 
    'availability', 'maintainers', 'persona', 'capabilities', 'dependencies', 
    'documentation', 'preferred_models', 'prompts', 'benchmarks'];
  
  for (const field of required) {
    if (!(field in obj)) return false;
  }
  
  // Type checks
  if (typeof obj.name !== 'string' || typeof obj.displayName !== 'string') return false;
  if (!Array.isArray(obj.maintainers) || !Array.isArray(obj.preferred_models)) return false;
  if (!obj.persona || !obj.capabilities || !obj.prompts || !obj.benchmarks) return false;
  
  // Persona checks
  if (!Array.isArray(obj.persona.values) || !Array.isArray(obj.persona.attributes)) return false;
  
  // Preferred models should have model and weight
  for (const model of obj.preferred_models) {
    if (typeof model.model !== 'string' || typeof model.weight !== 'number') return false;
  }
  
  return true;
}

/**
 * Get the best model for a specialist given a benchmark type
 */
export function selectModelForBenchmark(
  specialist: SpecialistDefinition,
  benchmarkType?: string
): { model: string; weight: number } | null {
  if (!specialist.preferred_models || specialist.preferred_models.length === 0) {
    return null;
  }
  
  let bestModel: PreferredModel | null = null;
  let bestWeight = -1;
  
  for (const preferred of specialist.preferred_models) {
    let weight = preferred.weight;
    
    // If benchmark type specified and model has benchmark-specific weight, use it
    if (benchmarkType && preferred.benchmarks && preferred.benchmarks[benchmarkType]) {
      weight = preferred.benchmarks[benchmarkType];
    }
    
    if (weight > bestWeight) {
      bestWeight = weight;
      bestModel = preferred;
    }
  }
  
  if (!bestModel) return null;
  
  // Return the model string and the weight used (benchmark-specific if available)
  const finalWeight = benchmarkType && bestModel.benchmarks?.[benchmarkType] 
    ? bestModel.benchmarks[benchmarkType] 
    : bestModel.weight;
  
  return {
    model: bestModel.model,
    weight: finalWeight
  };
}

