// Type definitions for specialist templates and snapshots

export interface DocumentationEnrichment {
  summary: string;
  key_concepts: string[];
  relevant_for_tasks: string[];
  relevant_tech_stack: string[];
  relevant_tags: string[];
  code_patterns: string[];
  last_enriched: string;
  enrichment_model: string;
}

export interface ChangeEntry {
  category: 'enrichment' | 'prompt' | 'documentation' | 'persona' | 'capabilities' | 'fix' | 'other';
  description: string;
  breaking?: boolean;
  migration_notes?: string;
}

export interface VersionChange {
  version: string;
  date: string;
  type: 'major' | 'minor' | 'patch';
  changes: ChangeEntry[];
  author?: string;
}

export interface BreakingChange {
  version: string;
  date: string;
  description: string;
  affected_areas: string[];
  migration_guide: string;
  deprecated_features?: string[];
}

export interface VersionMetadata {
  changelog: VersionChange[];
  breaking_changes?: BreakingChange[];
  deprecated?: boolean;
  deprecated_in?: string;
  deprecated_reason?: string;
  replacement?: string;
  created_at: string;
  updated_at: string;
  last_enriched_at?: string;
  min_schema_version?: string;
  compatible_with?: string[];
}

export interface SpecialistTemplate {
  schema_version: string;
  name: string;
  displayName?: string;
  version: string;
  version_metadata?: VersionMetadata;
  from?: string;
  license?: string;
  availability?: 'public' | 'private' | 'paid';
  maintainers?: Array<{ name: string; email?: string }>;
  persona: {
    purpose: string;
    values: string[];
    attributes: string[];
    tech_stack: string[];
  };
  capabilities: {
    tags: string[];
    descriptions: Record<string, string>;
    considerations?: string[];
  };
  dependencies?: {
    subscription?: {
      required: boolean;
      purpose?: string;
    };
    available_tools?: string[];
    mcps?: Array<{
      name: string;
      version: string;
      permissions?: Array<'read' | 'write' | 'execute'>;
      description?: string;
      required?: boolean;
    }>;
  };
  documentation?: Array<{
    type: 'official' | 'reference' | 'recipes' | 'examples' | 'control';
    url?: string;
    path?: string;
    description: string;
    enrichment?: DocumentationEnrichment;
  }>;
  preferred_models?: Array<{
    model: string;
    specialist_enabled?: boolean;
    weight?: number;
    benchmarks?: Record<string, number>;
  }>;
  prompts: {
    default: Record<string, string>;
    model_specific?: Record<string, Record<string, string>>;
    prompt_strategy: {
      fallback?: 'default' | 'error';
      model_detection?: 'auto' | 'manual';
      allow_override?: boolean;
      interpolation?: {
        style?: 'mustache' | 'handlebars';
        escape_html?: boolean;
      };
    };
  };
  'spawnable_sub-agent_specialists'?: Array<{
    name: string;
    version: string;
    license?: string;
    availability?: 'public' | 'private' | 'paid';
    purpose: string;
  }>;
  spawnable_sub_agent_specialists?: Array<{
    name: string;
    version: string;
    license?: string;
    availability?: 'public' | 'private' | 'paid';
    purpose: string;
  }>;
}

export interface BenchmarkRun {
  run_id: string;
  run_date: string;
  batch_id?: string;
  model: string;
  specialist_enabled?: boolean;
  suite: string;
  scenario: string;
  tier: string;
  agent: string;
  overall_score: number;
  evaluations?: Record<string, {
    score: number;
    passed: boolean;
    error?: string;
  }>;
  telemetry?: {
    duration_ms?: number;
    token_usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };
}

export interface ModelComparison {
  model: string;
  baseline_score: number;
  specialist_score?: number;
  improvement?: number;
  improvement_pct?: number;
}

export interface BenchmarkComparison {
  baseline_avg_score?: number;
  specialist_avg_score?: number;
  improvement?: number;
  improvement_pct?: number;
  models_compared?: ModelComparison[];
}

export interface SpecialistSnapshot extends SpecialistTemplate {
  benchmarks: {
    test_suites: Array<{
      name: string;
      path: string;
      type: 'functional' | 'accuracy' | 'performance';
      description?: string;
    }>;
    scoring: {
      methodology: 'weighted_average' | 'simple_average' | 'max_score' | 'min_score' | 'custom';
      update_frequency?: string;
      comparison_targets?: string[];
    };
    runs?: BenchmarkRun[];
    comparison?: BenchmarkComparison;
  };
  snapshot_metadata?: {
    created_at: string;
    minted_by?: string;
    template_version: string;
    notes?: string;
  };
}

export interface SnapshotMetadata {
  snapshot_id: string;
  snapshot_path: string;
  template: {
    name: string;
    version: string;
    path: string;
    is_enriched: boolean;
  };
  benchmarks: {
    included: boolean;
    batch_id?: string;
    run_count?: number;
    models?: string[];
    comparison?: {
      baseline_avg: number;
      specialist_avg: number;
      improvement: number;
      improvement_pct: number;
    };
  };
  output: {
    directory: string;
    snapshot_file: string;
    metadata_file: string;
  };
  timestamp: string;
  minted_by: string;
}

export interface MintResult {
  snapshotId: string;
  outputPath: string;
  templateVersion: string;
  metadata: SnapshotMetadata;
}
