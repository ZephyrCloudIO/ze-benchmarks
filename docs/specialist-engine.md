# Specialist Engine

A modular, engine-based system for systematically creating benchmark templates, enrichments, and specialists that flow through the complete benchmark workflow.

## Overview

The Specialist Engine automates the creation of high-quality benchmark templates and specialists by breaking down the process into composable, modular components that follow the established workflow.

```
Input → Extraction → Structuring → Enrichment → Validation → Output
   ↓         ↓            ↓            ↓            ↓          ↓
 Docs   Knowledge     Template      Tiers      Testing   Specialist
        Base          Structure    Prompts    Validation  Template
```

## Design Philosophy

### 1. **Modularity**
Each stage of specialist creation is a separate, composable module that can be:
- Used independently
- Chained together
- Tested in isolation
- Extended or replaced

### 2. **Flow Alignment**
The engine mirrors the benchmark workflow:
```
Template Creation → Enrichment → Execution → Evaluation → Snapshot
```

### 3. **Knowledge Extraction**
Systematically extract domain knowledge from:
- Official documentation
- Repository analysis
- Best practices
- Known failure patterns

### 4. **Progressive Refinement**
Start with base templates and progressively refine through:
- Tier-based enrichment
- Model-specific optimization
- Benchmark-driven improvement
- Snapshot versioning

---

## Engine Architecture

### Core Modules

```
┌─────────────────────────────────────────────────────────────┐
│                    SPECIALIST ENGINE                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Extractor   │→ │  Structurer  │→ │   Enricher   │     │
│  │   Module     │  │    Module    │  │    Module    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         ↓                 ↓                  ↓              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Validator   │  │  Generator   │  │   Snapshot   │     │
│  │   Module     │  │    Module    │  │    Module    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Module 1: Extractor

**Purpose**: Extract domain knowledge from various sources into structured knowledge bases.

### Input Sources

#### 1. Documentation Extraction
```typescript
interface DocumentationExtractor {
  // Extract from URLs
  extractFromUrl(url: string, options?: ExtractOptions): Promise<Knowledge>;

  // Extract from multiple pages
  extractFromSite(baseUrl: string, crawlDepth: number): Promise<Knowledge[]>;

  // Extract specific sections
  extractSections(url: string, selectors: string[]): Promise<KnowledgeSection[]>;
}
```

**Example**:
```typescript
const extractor = new DocumentationExtractor();

// Extract shadcn documentation
const knowledge = await extractor.extractFromSite(
  'https://ui.shadcn.com/docs',
  depth: 2,
  sections: ['installation', 'cli', 'theming', 'components']
);
```

#### 2. Repository Analysis
```typescript
interface RepositoryAnalyzer {
  // Analyze repository structure
  analyzeStructure(repoUrl: string): Promise<RepoStructure>;

  // Extract patterns and conventions
  extractPatterns(repoUrl: string): Promise<Pattern[]>;

  // Identify configuration patterns
  analyzeConfigs(repoUrl: string): Promise<ConfigPattern[]>;

  // Extract common gotchas from issues/PRs
  extractGotchas(repoUrl: string): Promise<Gotcha[]>;
}
```

**Example**:
```typescript
const analyzer = new RepositoryAnalyzer();

// Analyze shadcn repository
const repoKnowledge = await analyzer.analyze('https://github.com/shadcn-ui/ui', {
  focusAreas: ['cli', 'components', 'config'],
  extractIssues: true,
  extractPRs: true,
  depth: 'comprehensive'
});
```

#### 3. Best Practices Mining
```typescript
interface BestPracticesMiner {
  // Mine from documentation
  mineFromDocs(docs: Knowledge[]): Promise<BestPractice[]>;

  // Mine from code examples
  mineFromCode(repoUrl: string): Promise<BestPractice[]>;

  // Mine from community (Stack Overflow, GitHub Discussions)
  mineFromCommunity(sources: string[]): Promise<BestPractice[]>;
}
```

#### 4. Failure Pattern Detection
```typescript
interface FailurePatternDetector {
  // Detect from generic LLM attempts
  detectFromAttempts(attempts: BenchmarkRun[]): Promise<FailurePattern[]>;

  // Detect from issues
  detectFromIssues(repoUrl: string): Promise<FailurePattern[]>;

  // Categorize common mistakes
  categorizeFailures(patterns: FailurePattern[]): Promise<FailureCategory[]>;
}
```

### Output Format

```typescript
interface ExtractedKnowledge {
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
```

---

## Module 2: Structurer

**Purpose**: Transform extracted knowledge into specialist template structure.

### Structure Builder

```typescript
interface TemplateStructurer {
  // Create base template structure
  createBaseStructure(knowledge: ExtractedKnowledge): SpecialistTemplate;

  // Populate persona section
  buildPersona(knowledge: ExtractedKnowledge): Persona;

  // Build capabilities
  buildCapabilities(knowledge: ExtractedKnowledge): Capabilities;

  // Structure documentation references
  buildDocumentation(knowledge: ExtractedKnowledge): Documentation[];
}
```

### Template Sections

#### 1. Persona Builder
```typescript
interface PersonaBuilder {
  // Derive purpose from knowledge
  derivePurpose(knowledge: ExtractedKnowledge): string;

  // Extract core values
  extractValues(knowledge: ExtractedKnowledge): string[];

  // Identify key attributes
  identifyAttributes(knowledge: ExtractedKnowledge): string[];

  // Build tech stack list
  buildTechStack(knowledge: ExtractedKnowledge): string[];
}
```

**Example Output**:
```json5
{
  persona: {
    purpose: "Expert shadcn/ui specialist for Vite projects with Tailwind CSS v4",
    values: [
      "Component transparency",
      "Code ownership over abstraction",
      "Performance-first approach",
      "Accessibility by default"
    ],
    attributes: [
      "Expert in shadcn/ui architecture",
      "Deep knowledge of Tailwind CSS v4",
      "Vite configuration mastery"
    ],
    tech_stack: [
      "shadcn/ui",
      "Tailwind CSS v4",
      "Vite 7",
      "React 19",
      "Radix UI"
    ]
  }
}
```

#### 2. Capabilities Builder
```typescript
interface CapabilitiesBuilder {
  // Generate capability tags
  generateTags(knowledge: ExtractedKnowledge): string[];

  // Build descriptions
  buildDescriptions(knowledge: ExtractedKnowledge): Record<string, string>;

  // Extract considerations (gotchas)
  extractConsiderations(knowledge: ExtractedKnowledge): string[];
}
```

#### 3. Documentation Builder
```typescript
interface DocumentationBuilder {
  // Organize documentation links
  organizeDocs(knowledge: ExtractedKnowledge): Documentation[];

  // Create reference documentation
  createReferenceDocs(knowledge: ExtractedKnowledge): string;

  // Link to source code
  linkToSources(knowledge: ExtractedKnowledge): Source[];
}
```

---

## Module 3: Enricher

**Purpose**: Create tier-based enrichments and model-specific prompts.

### What is Enrichment?

**Enrichment** is the process of enhancing a base template with additional context, documentation metadata, and specialized information that helps AI agents perform tasks more accurately. It transforms a generic template into a specialist knowledge base.

### Types of Enrichment

#### 1. Documentation Enrichment

Enhances documentation entries with extracted metadata using LLM analysis:

```typescript
// Base documentation (before enrichment)
{
  type: 'official',
  url: 'https://ui.shadcn.com/docs/installation/vite.md',
  description: 'Vite installation guide'
}

// Enriched documentation (after enrichment)
{
  type: 'official',
  url: 'https://ui.shadcn.com/docs/installation/vite.md',
  description: 'Vite installation guide',
  enrichment: {
    // LLM-generated summary (1-2 sentences)
    summary: 'Comprehensive guide for setting up Vite project with React and TypeScript, focusing on integrating shadcn/ui and configuring the development environment.',

    // Key concepts extracted from documentation
    key_concepts: [
      'Vite project initialization with React and TypeScript',
      'Tailwind CSS integration',
      'TypeScript path configuration',
      'shadcn/ui component installation'
    ],

    // Task types this documentation is relevant for
    relevant_for_tasks: [
      'project_setup',
      'component_add',
      'troubleshoot'
    ],

    // Tech stack mentioned in documentation
    relevant_tech_stack: [
      'TypeScript',
      'Node.js',
      'npm',
      'Vite',
      'React',
      'Tailwind CSS'
    ],

    // Capability tags this doc supports
    relevant_tags: [
      'vite-setup',
      'tailwindcss-v4',
      'path-aliases',
      'component-installation'
    ],

    // Actual code patterns/commands from documentation
    code_patterns: [
      'npm create vite@latest',
      'npx shadcn@latest init',
      'npx shadcn@latest add button'
    ],

    // Enrichment metadata
    last_enriched: '2025-11-13T15:58:39.955Z',
    enrichment_model: 'anthropic/claude-3.5-haiku'
  }
}
```

**Purpose**:
- Enables intelligent documentation filtering based on task type
- Provides quick summaries for LLM decision-making
- Links documentation to relevant capabilities and tech stack
- Extracts reusable code patterns

#### 2. Tier-Based Enrichment

Creates difficulty-graded prompts that provide different levels of guidance:

**Progression**: L0 → L1 → L2 → L3 → Lx

Each tier provides different amounts of context and guidance for the same task.

#### 3. Model-Specific Enrichment

Optimizes prompts for specific LLM architectures and behaviors:

```typescript
// Claude optimization
{
  spawnerPrompt: `I'm a shadcn/ui specialist who follows these principles:

1. ALWAYS follow official documentation exactly
2. Use Tailwind CSS v4 syntax (@import "tailwindcss")
3. Configure path aliases in BOTH tsconfig files
...`
}

// GPT optimization
{
  spawnerPrompt: `Task: Set up shadcn/ui with Vite

Context: You are setting up a new project

Steps:
1. Create Vite project with React template
2. Install Tailwind CSS v4
...`
}
```

### Enrichment Process

```
Raw Template → Documentation Analysis → Metadata Extraction → Enhanced Template
      ↓                    ↓                     ↓                    ↓
  Base docs       LLM reads each doc      Extract patterns     Enriched template
  URLs only       Generates summary       Tag relationships    with metadata
                  Identifies concepts     Link tech stack      stored in
                                                               enriched/*.json5
```

### Example: Complete Enrichment Flow

**Input: Base Template**
```json5
{
  name: 'shadcn-specialist',
  version: '0.0.9',
  documentation: [
    {
      url: 'https://ui.shadcn.com/docs/installation/vite.md',
      description: 'Vite installation guide'
    }
  ]
}
```

**Step 1: Web Fetch** - Retrieve documentation content

**Step 2: LLM Analysis** - Analyze with claude-3.5-haiku:
```
Analyze this documentation and extract:
- 1-2 sentence summary
- Key concepts (3-6 items)
- Relevant tasks this helps with
- Tech stack mentioned
- Code patterns/commands
- Relevant capability tags
```

**Step 3: Structure Metadata** - Format into enrichment structure

**Output: Enriched Template**
```json5
{
  name: 'shadcn-specialist',
  version: '0.0.9',
  documentation: [
    {
      url: 'https://ui.shadcn.com/docs/installation/vite.md',
      description: 'Vite installation guide',
      enrichment: {
        summary: 'Comprehensive guide for setting up...',
        key_concepts: ['Vite project initialization', ...],
        relevant_for_tasks: ['project_setup', 'component_add'],
        relevant_tech_stack: ['Vite', 'React', 'TypeScript'],
        relevant_tags: ['vite-setup', 'tailwindcss-v4'],
        code_patterns: ['npm create vite@latest', ...],
        last_enriched: '2025-11-13T15:58:39.955Z',
        enrichment_model: 'anthropic/claude-3.5-haiku'
      }
    }
  ]
}
```

### Benefits of Enrichment

#### 1. **Intelligent Documentation Filtering**
- LLM can quickly scan summaries instead of reading full docs
- Task-based filtering: only show docs relevant to current task
- Tech-stack filtering: only show docs for technologies in use

#### 2. **Faster Context Building**
- Pre-extracted key concepts reduce processing time
- Code patterns provide immediate examples
- Tags enable semantic search

#### 3. **Better Prompt Quality**
- More targeted documentation reduces noise
- Key concepts help LLM understand what's important
- Code patterns provide concrete examples

#### 4. **Consistency**
- Same enrichment model ensures consistent extraction
- Versioned enrichments track changes over time
- Metadata is reusable across prompts

### Enrichment vs Raw Templates

| Aspect | Raw Template | Enriched Template |
|--------|-------------|-------------------|
| **Documentation** | URL + description only | URL + summary + metadata |
| **Filtering** | Manual/static | Automatic/intelligent |
| **Context** | Agent reads full docs | Agent scans summaries |
| **Code Examples** | Scattered in docs | Extracted and listed |
| **Task Relevance** | Unknown | Explicitly tagged |
| **Tech Stack Links** | Implicit | Explicit |
| **Decision Speed** | Slow (read all docs) | Fast (scan metadata) |
| **Maintenance** | Update URLs manually | Re-enrich on changes |

### Storage Structure

```
specialists/
  └── shadcn-specialist/
      ├── shadcn-specialist-template.json5  # Base template
      └── enriched/
          ├── 0.0.9/
          │   ├── enriched-001.json5  # First enrichment
          │   ├── enriched-002.json5  # Updated enrichment
          │   └── enriched-003.json5  # Latest enrichment
          └── 0.0.8/
              └── enriched-001.json5
```

**Versioning**:
- Each template version has its own enrichment directory
- Multiple enrichments per version (001, 002, 003...)
- System automatically uses highest numbered enrichment
- Can rollback to previous enrichments if needed

### Tier Generation

```typescript
interface TierEnricher {
  // Generate all tiers from knowledge
  generateAllTiers(
    knowledge: ExtractedKnowledge,
    template: SpecialistTemplate
  ): TierSet;

  // Generate specific tier
  generateTier(
    level: TierLevel,
    knowledge: ExtractedKnowledge,
    template: SpecialistTemplate
  ): TierPrompt;
}
```

### Tier Levels

#### L0 - Minimal Context
```typescript
interface L0Generator {
  // Generate minimal prompt
  generate(task: Task, template: SpecialistTemplate): string;

  // Strategy: Bare minimum to understand task
  strategy: {
    includeContext: false;
    includeSteps: false;
    includeConstraints: false;
    includeExamples: false;
  };
}
```

**Example**:
```markdown
Generate a new shadcn project with a button component.
```

#### L1 - Basic Context
```typescript
interface L1Generator {
  // Generate basic prompt
  generate(task: Task, template: SpecialistTemplate): string;

  // Strategy: Standard user request
  strategy: {
    includeContext: 'basic';
    includeSteps: false;
    includeConstraints: 'essential';
    includeExamples: false;
  };
}
```

**Example**:
```markdown
Generate a new shadcn/ui project using Vite and React. Include the button component and ensure the project builds successfully.

Requirements:
- Use Vite as the build tool
- Configure Tailwind CSS properly
- Add shadcn/ui button component
- Verify the project builds and runs
```

#### L2 - Directed Guidance
```typescript
interface L2Generator {
  // Generate directed prompt
  generate(task: Task, template: SpecialistTemplate): string;

  // Strategy: Step-by-step guidance
  strategy: {
    includeContext: 'detailed';
    includeSteps: true;
    includeConstraints: 'comprehensive';
    includeExamples: 'inline';
  };
}
```

**Example**:
```markdown
Generate a new shadcn/ui project with detailed setup:

1. Create Vite project with React template
2. Install Tailwind CSS v4 with @tailwindcss/vite plugin
3. Configure Tailwind CSS:
   - Replace src/index.css with @import "tailwindcss"
   - Ensure Tailwind v4 syntax (NOT v3 directives)
4. Configure TypeScript path aliases:
   - Update tsconfig.json with @/* path alias
   - Update tsconfig.app.json with @/* path alias
   - Install @types/node for path resolution
5. Configure Vite:
   - Add tailwindcss plugin
   - Add path alias resolver
6. Initialize shadcn/ui:
   - Use: pnpm dlx shadcn@latest init
   - Select a base color
7. Add button component:
   - Use: pnpm dlx shadcn@latest add button
8. Verify build:
   - Run: pnpm build
   - Ensure no errors

Constraints:
- Must use Tailwind CSS v4 syntax (@import, NOT @tailwind)
- Path aliases must be in BOTH tsconfig files
- Must use official shadcn CLI
```

#### L3 - Migration/Specialized
```typescript
interface L3Generator {
  // Generate migration-specific prompt
  generate(task: Task, template: SpecialistTemplate): string;

  // Strategy: Specialized knowledge with migration focus
  strategy: {
    includeContext: 'specialized';
    includeSteps: 'detailed';
    includeConstraints: 'comprehensive';
    includeExamples: 'detailed';
    includeValidation: true;
  };
}
```

#### Lx - Adversarial
```typescript
interface LxGenerator {
  // Generate adversarial prompt
  generate(task: Task, template: SpecialistTemplate): string;

  // Strategy: Edge cases and challenges
  strategy: {
    includeContext: 'adversarial';
    includeSteps: 'detailed';
    includeConstraints: 'strict';
    includeExamples: 'edge-cases';
    includePitfalls: true;
  };
}
```

### Model-Specific Optimization

```typescript
interface ModelOptimizer {
  // Optimize prompt for specific model
  optimizeForModel(
    basePrompt: string,
    model: string,
    template: SpecialistTemplate
  ): string;

  // Model-specific strategies
  strategies: {
    'claude-sonnet-4.5': ClaudeStrategy;
    'gpt-4o': GPTStrategy;
    'gemini-pro': GeminiStrategy;
  };
}
```

**Example Strategies**:

```typescript
// Claude prefers structured, principle-based prompts
class ClaudeStrategy {
  optimize(prompt: string): string {
    return `
I'm a ${specialist} who follows these principles:

1. ${principle1}
2. ${principle2}
3. ${principle3}

${structured_steps}

${verification_steps}
    `.trim();
  }
}

// GPT prefers task-oriented, clear instruction prompts
class GPTStrategy {
  optimize(prompt: string): string {
    return `
Task: ${task}

Context: ${context}

Steps:
1. ${step1}
2. ${step2}

Expected Output: ${output}
    `.trim();
  }
}
```

---

## Module 4: Validator

**Purpose**: Validate templates and detect potential issues before benchmarking.

### Validation Pipeline

```typescript
interface TemplateValidator {
  // Validate complete template
  validate(template: SpecialistTemplate): ValidationResult;

  // Individual validators
  validators: {
    structure: StructureValidator;
    completeness: CompletenessValidator;
    consistency: ConsistencyValidator;
    quality: QualityValidator;
  };
}
```

### Validation Checks

#### 1. Structure Validation
```typescript
interface StructureValidator {
  // Check required fields
  checkRequiredFields(template: SpecialistTemplate): ValidationIssue[];

  // Validate schema compliance
  validateSchema(template: SpecialistTemplate): ValidationIssue[];

  // Check inheritance resolution
  validateInheritance(template: SpecialistTemplate): ValidationIssue[];
}
```

#### 2. Completeness Validation
```typescript
interface CompletenessValidator {
  // Check all tiers present
  checkTierCoverage(template: SpecialistTemplate): ValidationIssue[];

  // Check documentation links
  checkDocumentation(template: SpecialistTemplate): ValidationIssue[];

  // Check gotchas documented
  checkConsiderations(template: SpecialistTemplate): ValidationIssue[];
}
```

#### 3. Consistency Validation
```typescript
interface ConsistencyValidator {
  // Check version consistency
  checkVersions(template: SpecialistTemplate): ValidationIssue[];

  // Check tech stack alignment
  checkTechStack(template: SpecialistTemplate): ValidationIssue[];

  // Check prompt consistency
  checkPrompts(template: SpecialistTemplate): ValidationIssue[];
}
```

#### 4. Quality Validation
```typescript
interface QualityValidator {
  // Check prompt quality
  checkPromptQuality(prompts: Prompts): ValidationIssue[];

  // Check specificity
  checkSpecificity(template: SpecialistTemplate): ValidationIssue[];

  // Check actionability
  checkActionability(template: SpecialistTemplate): ValidationIssue[];
}
```

### Dry-Run Testing

```typescript
interface DryRunTester {
  // Test template without full benchmark
  dryRun(template: SpecialistTemplate): Promise<DryRunResult>;

  // Simulate prompt generation
  simulatePromptGeneration(template: SpecialistTemplate): SimulationResult;

  // Validate variable substitution
  validateSubstitution(template: SpecialistTemplate): SubstitutionResult;
}
```

---

## Module 5: Generator

**Purpose**: Generate complete specialist packages with all necessary files.

### Package Generator

```typescript
interface SpecialistGenerator {
  // Generate complete specialist package
  generate(
    knowledge: ExtractedKnowledge,
    config: GeneratorConfig
  ): Promise<SpecialistPackage>;

  // Generate individual components
  generateTemplate(knowledge: ExtractedKnowledge): SpecialistTemplate;
  generateTiers(template: SpecialistTemplate): TierSet;
  generateBenchmarks(template: SpecialistTemplate): BenchmarkSuite;
  generateDocs(template: SpecialistTemplate): Documentation;
}
```

### Output Structure

```
specialists/
  └── shadcn-vite-specialist/
      ├── shadcn-vite-specialist.json5    # Main template
      ├── reference-docs.md               # Extracted knowledge
      ├── prompts/
      │   ├── L0-minimal.md
      │   ├── L1-basic.md
      │   ├── L2-directed.md
      │   ├── L3-migration.md
      │   └── Lx-adversarial.md
      ├── benchmarks/
      │   ├── vite-setup/
      │   │   ├── scenario.yaml
      │   │   └── repo-fixture/
      │   └── component-generation/
      │       ├── scenario.yaml
      │       └── repo-fixture/
      └── docs/
          ├── README.md
          ├── TEMPLATE_GUIDE.md
          └── USAGE.md
```

---

## Module 6: Snapshot Manager

**Purpose**: Manage snapshot lifecycle and versioning.

### Snapshot Creation

```typescript
interface SnapshotManager {
  // Create snapshot from batch results
  createSnapshot(
    template: SpecialistTemplate,
    batchResults: BatchResults,
    config: SnapshotConfig
  ): Promise<Snapshot>;

  // Update template with results
  updateTemplate(
    template: SpecialistTemplate,
    results: BenchmarkResults
  ): SpecialistTemplate;

  // Version management
  versionSnapshot(snapshot: Snapshot): SnapshotVersion;
}
```

### Snapshot Structure

```typescript
interface Snapshot extends SpecialistTemplate {
  // Snapshot metadata
  snapshotId: string;
  snapshotVersion: string;
  createdAt: Date;

  // Performance data
  benchmarkResults: {
    batchId: string;
    totalRuns: number;
    successRate: number;
    avgWeightedScore: number;

    // Per-tier breakdown
    tierPerformance: {
      [tier: string]: TierPerformance;
    };

    // Per-model breakdown
    modelPerformance: {
      [model: string]: ModelPerformance;
    };
  };

  // Updated weights
  preferred_models: PreferredModel[];
}
```

---

## Complete Workflow Example

### Step 1: Extract Knowledge

```typescript
import { SpecialistEngine } from 'specialist-engine';

const engine = new SpecialistEngine();

// Configure extraction
const extractionConfig = {
  domain: 'shadcn-ui',
  framework: 'vite',
  sources: {
    documentation: ['https://ui.shadcn.com/docs'],
    repositories: ['https://github.com/shadcn-ui/ui'],
    community: ['https://github.com/shadcn-ui/ui/discussions']
  },
  depth: 'comprehensive'
};

// Extract knowledge
const knowledge = await engine.extract(extractionConfig);

console.log(`Extracted ${knowledge.concepts.length} concepts`);
console.log(`Found ${knowledge.gotchas.length} gotchas`);
console.log(`Identified ${knowledge.bestPractices.length} best practices`);
```

### Step 2: Structure Template

```typescript
// Structure the template
const template = await engine.structure(knowledge, {
  name: '@zephyr/shadcn-vite-specialist',
  version: '1.0.0',
  baseTemplate: '@figma-research/base',
  includeModelOptimizations: true
});

console.log(`Created template: ${template.name}`);
console.log(`Capabilities: ${template.capabilities.tags.join(', ')}`);
```

### Step 3: Generate Enrichments

```typescript
// Generate tier-based enrichments
const enrichments = await engine.enrich(template, {
  tiers: ['L0', 'L1', 'L2', 'L3', 'Lx'],
  models: ['claude-sonnet-4.5', 'gpt-4o'],
  optimizationLevel: 'comprehensive'
});

console.log(`Generated ${enrichments.tiers.length} tier prompts`);
console.log(`Generated ${enrichments.modelSpecific.length} model optimizations`);
```

### Step 4: Validate

```typescript
// Validate template
const validation = await engine.validate(template);

if (validation.hasErrors) {
  console.error('Validation errors:', validation.errors);
} else {
  console.log('✓ Template valid');
}

// Dry run
const dryRun = await engine.dryRun(template);
console.log('Dry run result:', dryRun.status);
```

### Step 5: Generate Package

```typescript
// Generate complete specialist package
const package = await engine.generate(template, {
  outputDir: './specialists/shadcn-vite-specialist',
  includeBenchmarks: true,
  includeDocs: true,
  includeExamples: true
});

console.log(`Generated specialist package at: ${package.path}`);
```

### Step 6: Execute Benchmarks

```typescript
// Execute benchmarks (using existing harness)
const results = await runBenchmarks({
  suite: 'shadcn-vite-specialist',
  scenarios: ['vite-setup', 'component-generation'],
  tiers: ['L1', 'L2', 'L3'],
  agents: ['anthropic'],
  models: ['claude-sonnet-4.5']
});
```

### Step 7: Create Snapshot

```typescript
// Create snapshot from results
const snapshot = await engine.createSnapshot(template, results, {
  snapshotName: 'shadcn-vite-baseline-v1',
  description: 'Initial baseline with claude-sonnet-4.5',
  includeArtifacts: true
});

console.log(`Created snapshot: ${snapshot.snapshotId}`);
console.log(`Success rate: ${snapshot.benchmarkResults.successRate * 100}%`);
console.log(`Avg score: ${snapshot.benchmarkResults.avgWeightedScore}`);
```

---

## Configuration

### Engine Configuration

```typescript
interface EngineConfig {
  // Extraction settings
  extraction: {
    depth: 'basic' | 'standard' | 'comprehensive';
    sources: string[];
    caching: boolean;
    parallel: boolean;
  };

  // Structuring settings
  structuring: {
    baseTemplate?: string;
    inheritanceDepth: number;
    includeExamples: boolean;
  };

  // Enrichment settings
  enrichment: {
    tiers: TierLevel[];
    models: string[];
    optimizationLevel: 'basic' | 'standard' | 'comprehensive';
  };

  // Validation settings
  validation: {
    strictMode: boolean;
    warnOnMissing: boolean;
    dryRun: boolean;
  };

  // Output settings
  output: {
    directory: string;
    format: 'json5' | 'yaml';
    includeDocs: boolean;
    includeBenchmarks: boolean;
  };
}
```

---

## CLI Interface

```bash
# Extract knowledge
specialist-engine extract \
  --domain shadcn-ui \
  --framework vite \
  --docs https://ui.shadcn.com/docs \
  --repo https://github.com/shadcn-ui/ui \
  --output knowledge.json

# Structure template
specialist-engine structure \
  --knowledge knowledge.json \
  --name @zephyr/shadcn-vite-specialist \
  --base @figma-research/base \
  --output template.json5

# Generate enrichments
specialist-engine enrich \
  --template template.json5 \
  --tiers L0,L1,L2,L3,Lx \
  --models claude-sonnet-4.5,gpt-4o \
  --output prompts/

# Validate
specialist-engine validate \
  --template template.json5 \
  --dry-run

# Generate complete package
specialist-engine generate \
  --template template.json5 \
  --output ./specialists/shadcn-vite-specialist \
  --include-benchmarks \
  --include-docs

# Create snapshot from batch
specialist-engine snapshot \
  --template template.json5 \
  --batch-id batch-xxx \
  --name shadcn-vite-baseline-v1 \
  --output ./snapshots/
```

---

## Integration with Existing System

### With agency-prompt-creator

```typescript
// Load specialist template
const template = await loadTemplate('@zephyr/shadcn-vite-specialist');

// Create enriched prompt
const enrichedPrompt = createPrompt(template, {
  userPrompt: 'Create a button component',
  model: 'claude-sonnet-4.5',
  taskType: 'component_generation'
});

// Use with agent
await agent.run(enrichedPrompt.prompt);
```

### With Benchmark Harness

```typescript
// Use generated benchmarks
await executeBenchmark(
  'shadcn-vite-specialist',
  'vite-setup',
  'L2',
  'anthropic',
  'claude-sonnet-4.5'
);
```

---

## Benefits

### 1. **Systematic Creation**
- No manual template writing
- Consistent structure
- Comprehensive coverage

### 2. **Knowledge Extraction**
- Automated documentation mining
- Repository pattern detection
- Failure pattern learning

### 3. **Quality Assurance**
- Validation before benchmarking
- Dry-run testing
- Consistency checks

### 4. **Maintainability**
- Version tracking
- Update workflows
- Snapshot management

### 5. **Scalability**
- Generate multiple specialists
- Parallel processing
- Batch operations

---

## Future Enhancements

- [ ] AI-assisted knowledge extraction
- [ ] Automatic tier calibration based on results
- [ ] Multi-domain specialist composition
- [ ] Real-time documentation monitoring
- [ ] Community contribution integration
- [ ] Automated specialist discovery
- [ ] Cross-specialist knowledge sharing
- [ ] Performance prediction models
- [ ] Adaptive enrichment optimization
- [ ] Multi-language support

---

## Conclusion

The Specialist Engine provides a systematic, modular approach to creating high-quality benchmark templates and specialists. By breaking down the process into composable modules and aligning with the benchmark workflow, it ensures consistency, quality, and maintainability while scaling the creation of specialists across different domains.
