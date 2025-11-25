export interface RoleDef {
  id: string;
  name: string;
  displayName: string;
  version: string;
  schemaVersion: string;
  license: string;
  availability: string;
  maintainers: string; // JSON
  persona: string; // JSON
  capabilities: string; // JSON
  dependencies: string; // JSON
  documentation: string; // JSON
  preferredModels: string; // JSON
  prompts: string; // JSON
  spawnableSubAgents: string; // JSON
  createdAt: number;
  updatedAt: number;
  evaluationCriteria?: EvaluationCriteria[];
}

export interface EvaluationCriteria {
  id?: number;
  roleDefId?: string;
  name: string;
  description?: string;
  score: number;
  category?: string;
  isCustom?: boolean;
  createdAt?: number;
}

export interface SuggestedCriteria {
  name: string;
  description: string;
  category: string;
  defaultScore: number;
}

export interface RoleDefFormData {
  name: string;
  displayName: string;
  purpose: string;
  values: string[];
  attributes: string[];
  techStack: string[];
  tags: string[];
  maintainerName: string;
  maintainerEmail: string;
}
