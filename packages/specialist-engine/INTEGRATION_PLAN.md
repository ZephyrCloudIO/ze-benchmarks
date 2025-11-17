# Specialist Engine - agency-prompt-creator Integration Plan

## Goal
Integrate all concepts and modules from agency-prompt-creator into specialist-engine in a modular way, maintaining the same architecture patterns and ensuring everything works exactly as before.

## Analysis: agency-prompt-creator Modules

### 1. **types.ts** - Type Definitions
**What it provides:**
- `TaskType` - Task type enum
- `Persona`, `Capabilities`, `Prompts`, `PromptConfig` - Template structure
- `SpecialistTemplate` - Main template interface
- `DocumentationEntry` - Documentation with enrichment support
- `PreferredModel` - Model preferences
- `ExtractedIntent` - Intent extraction results
- `DocumentationReference` - Doc references for LLM
- `SpecialistSelection` - Component selection results
- Context and result types

**How specialist-engine should use it:**
- Import types directly without duplication
- Extend where needed (Dependencies, LLMConfig)
- Use as the source of truth for shared types

### 2. **task-detection.ts** - Task Type Detection
**What it provides:**
- `detectTaskType(userPrompt)` - Detect task from user input
- `detectTaskTypesWithConfidence(userPrompt)` - Get all matches with scores
- `getTaskKeywords()` - Get keyword mappings

**How specialist-engine should use it:**
- Use for enrichment to detect relevant tasks
- Use for tier generation to understand task context
- Use in structurer to generate task-specific prompts

### 3. **keyword-extraction.ts** - Keyword Extraction
**What it provides:**
- `extractKeywords(userPrompt)` - Extract keywords from text
- `containsKeyword(text, keyword)` - Check keyword presence
- `countKeywordMatches(text, keywords)` - Count matches

**How specialist-engine should use it:**
- Use in extractor to identify key concepts
- Use in enricher to match documentation to keywords
- Use in validator to check template completeness

### 4. **doc-filter.ts** - Documentation Filtering
**What it provides:**
- `filterDocumentation(template, userPrompt, taskType)` - Filter relevant docs
- `hasEnrichedDocumentation(template)` - Check if template has enrichment

**How specialist-engine should use it:**
- Use in enricher to test filtering logic
- Use in generator to validate enriched templates
- Use as example for building enrichment logic

### 5. **intent-extraction.ts** - LLM Intent Extraction
**What it provides:**
- `buildIntentExtractionPrompt(userPrompt)` - Build LLM prompt
- `parseIntentResponse(response)` - Parse LLM response
- `INTENT_EXTRACTION_TOOL` - Tool definition

**How specialist-engine should use it:**
- Use same LLM patterns in extractor
- Use tool calling pattern for knowledge extraction
- Reuse prompt building patterns

### 6. **component-selection.ts** - LLM Component Selection
**What it provides:**
- `buildComponentSelectionPrompt(userPrompt, intent, template)` - Build LLM prompt
- `parseComponentSelectionResponse(response, template)` - Parse response
- `COMPONENT_SELECTION_TOOL` - Tool definition

**How specialist-engine should use it:**
- Reference for LLM-based selection patterns
- Use similar tool calling for enrichment
- Model prompt engineering approach

### 7. **llm-substitution.ts** - LLM Variable Substitution
**What it provides:**
- `substituteWithLLM(client, model, template, userPrompt, intent, context)` - LLM substitution
- `extractMustacheVariables(template)` - Find variables
- `buildSubstitutionPrompt(...)` - Build prompts
- `SUBSTITUTION_TOOL` - Tool definition

**How specialist-engine should use it:**
- Use in structurer to generate default prompts
- Use in generator to create tier prompts
- Follow same LLM calling patterns

### 8. **template-substitution.ts** - Mustache Substitution
**What it provides:**
- `substituteTemplate(template, context)` - Simple substitution
- `buildTemplateContext(template, userPrompt, taskType, context)` - Build context
- `validateTemplateString(template)` - Validate mustache syntax

**How specialist-engine should use it:**
- Use in structurer for generating prompts
- Use in generator for creating documentation
- Use for validating generated templates

### 9. **prompt-selection.ts** - Prompt Selection Logic
**What it provides:**
- `selectPrompt(prompts, model, taskType)` - Select best prompt
- `combinePromptParts(parts)` - Combine prompt sections

**How specialist-engine should use it:**
- Reference for tier generation logic
- Use in validator to check prompt structure
- Model selection fallback behavior

### 10. **loader.ts** - Template Loading & Inheritance
**What it provides:**
- `loadTemplate(path, options)` - Load with inheritance
- `loadTemplateFromString(content, options)` - Parse from string

**How specialist-engine should use it:**
- Use in structurer for base template loading
- Use in generator for template validation
- Reference inheritance resolution logic

### 11. **inheritance.ts** - Template Inheritance
**What it provides:**
- `mergeTemplates(parent, child)` - TSConfig-style merge
- `validateTemplate(template)` - Validation
- `detectCircularDependency(template, visited)` - Cycle detection

**How specialist-engine should use it:**
- Use in structurer for template extension
- Use in validator for inheritance checks
- Follow same merge rules

### 12. **create-prompt.ts** - Main API
**What it provides:**
- `createPrompt(template, options)` - High-level prompt creation
- `createPromptFromFile(path, options)` - Load and create

**How specialist-engine should use it:**
- Reference for API design patterns
- Use in examples to show integration
- Model error handling approach

## Implementation Plan

### Phase 1: Fix Types (Proper Import)
**Goal:** Import types correctly from agency-prompt-creator without duplication

**Steps:**
1. Change from `export type { ... }` to `import type { ... }` then re-export
2. Keep only specialist-engine-specific types
3. Extend agency-prompt-creator types where needed
4. Fix all compilation errors

**Files to modify:**
- `src/types/index.ts`

### Phase 2: Use agency-prompt-creator in Extractor
**Goal:** Use keyword extraction and intent patterns in extractor module

**Steps:**
1. Import `extractKeywords`, `containsKeyword` from agency-prompt-creator
2. Use keyword extraction in `analyzeWithLLM`
3. Follow intent-extraction patterns for LLM prompting
4. Use same error handling and parsing patterns

**Files to modify:**
- `src/modules/extractor.ts`

### Phase 3: Use agency-prompt-creator in Structurer
**Goal:** Use template-substitution and loader patterns

**Steps:**
1. Import `substituteTemplate`, `buildTemplateContext` from agency-prompt-creator
2. Use these for generating default prompts
3. Follow template inheritance patterns
4. Use validation functions

**Files to modify:**
- `src/modules/structurer.ts`

### Phase 4: Use agency-prompt-creator in Enricher
**Goal:** Use doc-filter, task-detection, and llm-substitution

**Steps:**
1. Import `filterDocumentation`, `detectTaskType` from agency-prompt-creator
2. Import `extractKeywords` for documentation matching
3. Use task detection for enrichment metadata
4. Follow LLM substitution patterns for tier generation

**Files to modify:**
- `src/modules/enricher.ts`

### Phase 5: Use agency-prompt-creator in Validator
**Goal:** Use validation utilities and template checking

**Steps:**
1. Import `validateTemplate`, `validateTemplateString` from agency-prompt-creator
2. Use inheritance validation patterns
3. Check prompt structure completeness
4. Validate mustache syntax

**Files to modify:**
- `src/modules/validator.ts`

### Phase 6: Use agency-prompt-creator in Generator
**Goal:** Use template-substitution and prompt-selection patterns

**Steps:**
1. Import `substituteTemplate` for documentation generation
2. Import `selectPrompt` patterns for tier prompt generation
3. Use template context building
4. Follow same file generation patterns

**Files to modify:**
- `src/modules/generator.ts`

### Phase 7: Update Examples
**Goal:** Show integration with agency-prompt-creator

**Steps:**
1. Update example to show how agency-prompt-creator is used internally
2. Add comments explaining the workflow
3. Demonstrate best practices

**Files to modify:**
- `examples/create-shadcn-specialist.ts`

### Phase 8: Update Documentation
**Goal:** Document the integration

**Steps:**
1. Update README with agency-prompt-creator dependency
2. Add section on shared types
3. Document how concepts flow between packages
4. Add API reference showing integrated functions

**Files to modify:**
- `README.md`
- `QUICKSTART.md`
- `ALIGNMENT_PLAN.md` (mark as complete)

## Implementation Details

### Phase 1 Details: Fix Types

```typescript
// src/types/index.ts

// Import types (not just re-export)
import type {
  TaskType,
  Persona,
  Capabilities,
  Prompts,
  PromptConfig,
  PreferredModel,
  DocumentationEntry as AgencyDocEntry,
  SpecialistTemplate as AgencyTemplate,
} from 'agency-prompt-creator';

// Re-export for package consumers
export type {
  TaskType,
  Persona,
  Capabilities,
  Prompts,
  PromptConfig,
  PreferredModel,
};

// Extend agency types with specialist-engine additions
export interface DocumentationEntry extends AgencyDocEntry {
  // Already compatible, just re-export or extend if needed
}

export interface SpecialistTemplate extends Omit<AgencyTemplate, 'preferred_models'> {
  // Add specialist-engine specific fields
  dependencies?: Dependencies;
  llm_config?: LLMConfig;
  preferred_models?: PreferredModel[];
}

// Specialist-engine specific types
export interface ExtractedKnowledge { ... }
export interface Dependencies { ... }
export interface LLMConfig { ... }
// etc.
```

### Phase 2 Details: Extractor Integration

```typescript
// src/modules/extractor.ts
import { OpenAI } from 'openai';
import { extractKeywords, containsKeyword } from 'agency-prompt-creator';
import type { ... } from '../types/index.js';

export async function extractFromUrl(
  url: string,
  config: ExtractionConfig
): Promise<Partial<ExtractedKnowledge>> {
  console.log(`[Extractor] Fetching documentation from: ${url}`);

  const response = await fetch(url);
  const html = await response.text();
  const text = extractTextFromHtml(html);

  // Use agency-prompt-creator for keyword extraction
  const keywords = extractKeywords(text);
  console.log(`[Extractor] Extracted ${keywords.keywords.length} keywords`);

  // Use LLM for structured extraction
  const knowledge = await analyzeWithLLM(text, url, config, keywords);

  return knowledge;
}

async function analyzeWithLLM(
  text: string,
  sourceUrl: string,
  config: ExtractionConfig,
  keywords: any
): Promise<Partial<ExtractedKnowledge>> {
  // Follow intent-extraction patterns from agency-prompt-creator
  const prompt = buildExtractionPrompt(text, keywords);

  // Use tool calling pattern
  const tool = {
    type: 'function',
    function: {
      name: 'extract_knowledge',
      description: 'Extract structured knowledge from documentation',
      parameters: {
        type: 'object',
        properties: {
          concepts: { type: 'array', items: { type: 'object' } },
          gotchas: { type: 'array', items: { type: 'object' } },
          // ...
        }
      }
    }
  };

  // Call LLM with tool
  // Parse response
  // Return structured knowledge
}
```

### Phase 3 Details: Structurer Integration

```typescript
// src/modules/structurer.ts
import {
  substituteTemplate,
  buildTemplateContext,
  mergeTemplates,
  validateTemplate
} from 'agency-prompt-creator';
import type { ... } from '../types/index.js';

export function structure(
  knowledge: ExtractedKnowledge,
  options: StructureOptions
): SpecialistTemplate {

  const template: SpecialistTemplate = {
    schema_version: '0.0.1',
    name: options.name,
    version: options.version,
    persona: buildPersona(knowledge),
    capabilities: buildCapabilities(knowledge),
    documentation: [],
    prompts: buildDefaultPrompts(knowledge)
  };

  // Use agency-prompt-creator validation
  const validation = validateTemplate(template);
  if (!validation.valid) {
    console.warn('[Structurer] Template validation warnings:', validation.errors);
  }

  return template;
}

function buildDefaultPrompts(knowledge: ExtractedKnowledge): Prompts {
  // Use template substitution from agency-prompt-creator
  const spawnerTemplate = `You are a specialist in {{domain}} using {{framework}}...`;

  const context = {
    domain: knowledge.domain,
    framework: knowledge.framework,
    concepts: knowledge.concepts.map(c => c.name).join(', ')
  };

  const spawnerPrompt = substituteTemplate(spawnerTemplate, context);

  return {
    default: {
      spawnerPrompt,
      taskPrompt: '...'
    }
  };
}
```

### Phase 4 Details: Enricher Integration

```typescript
// src/modules/enricher.ts
import {
  filterDocumentation,
  detectTaskType,
  extractKeywords,
  hasEnrichedDocumentation
} from 'agency-prompt-creator';
import type { ... } from '../types/index.js';

export async function enrichDocumentation(
  doc: DocumentationEntry,
  config: EnrichmentConfig
): Promise<DocumentationEntry> {

  const response = await fetch(doc.url);
  const text = extractTextFromHtml(await response.text());

  // Use agency-prompt-creator for keyword extraction
  const keywordData = extractKeywords(text);

  // Use task detection for relevance
  const taskTypes = ['project_setup', 'component_generation', 'migration'];
  const relevantTasks = taskTypes.filter(task => {
    // Check if doc is relevant for this task
    return keywordData.keywords.some(kw =>
      task.includes(kw.toLowerCase()) || kw.toLowerCase().includes(task)
    );
  });

  const enrichment = {
    summary: await generateSummary(text),
    key_concepts: keywordData.keywords.slice(0, 10),
    relevant_for_tasks: relevantTasks,
    relevant_tech_stack: extractTechStack(text),
    relevant_tags: keywordData.keywords.slice(0, 5),
    code_patterns: extractCodePatterns(text),
    last_enriched: new Date().toISOString(),
    enrichment_model: config.model
  };

  return { ...doc, enrichment };
}

export function generateTiers(
  template: SpecialistTemplate,
  baseTask: string,
  scenario: string
): TierSet {

  // Use task detection to understand task type
  const taskType = detectTaskType(baseTask);
  console.log(`[Enricher] Detected task type: ${taskType}`);

  // Use keyword extraction for tier generation
  const taskKeywords = extractKeywords(baseTask);

  return {
    tiers: {
      'L0': generateL0(baseTask, template, taskKeywords),
      'L1': generateL1(baseTask, template, taskKeywords),
      'L2': generateL2(baseTask, template, taskKeywords),
      'L3': generateL3(baseTask, template, taskKeywords),
      'Lx': generateLx(baseTask, template, taskKeywords)
    },
    baseTask,
    scenario
  };
}
```

### Phase 5 Details: Validator Integration

```typescript
// src/modules/validator.ts
import {
  validateTemplate,
  validateTemplateString,
  detectCircularDependency
} from 'agency-prompt-creator';
import type { ... } from '../types/index.js';

export function validate(template: SpecialistTemplate): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Use agency-prompt-creator template validation
  const agencyValidation = validateTemplate(template);
  if (!agencyValidation.valid) {
    agencyValidation.errors.forEach(err => {
      errors.push({
        type: 'error',
        category: 'structure',
        message: err,
        path: 'template'
      });
    });
  }

  // Validate mustache syntax in prompts
  if (template.prompts.default?.spawnerPrompt) {
    const mustacheValidation = validateTemplateString(
      template.prompts.default.spawnerPrompt
    );
    if (!mustacheValidation.valid) {
      warnings.push({
        type: 'warning',
        category: 'quality',
        message: `Invalid mustache syntax: ${mustacheValidation.error}`,
        path: 'prompts.default.spawnerPrompt'
      });
    }
  }

  // Check for circular dependencies if template has inheritance
  if ((template as any).from) {
    try {
      detectCircularDependency(template as any, new Set());
    } catch (err) {
      errors.push({
        type: 'error',
        category: 'structure',
        message: `Circular dependency detected: ${err}`,
        path: 'from'
      });
    }
  }

  return {
    isValid: errors.length === 0,
    hasErrors: errors.length > 0,
    hasWarnings: warnings.length > 0,
    errors,
    warnings,
    info: []
  };
}
```

### Phase 6 Details: Generator Integration

```typescript
// src/modules/generator.ts
import { substituteTemplate, selectPrompt } from 'agency-prompt-creator';
import type { ... } from '../types/index.js';

export function generate(
  template: SpecialistTemplate,
  tiers: TierSet | undefined,
  config: GeneratorConfig
): SpecialistPackage {

  // Create output directory
  mkdirSync(config.outputDir, { recursive: true });

  const files: string[] = [];

  // Generate main template
  const templatePath = join(config.outputDir, `${getTemplateName(template)}-template.json5`);
  writeFileSync(templatePath, JSON5.stringify(template, null, 2));
  files.push(templatePath);

  // Generate tier prompts with substitution
  if (tiers) {
    for (const [level, prompt] of Object.entries(tiers.tiers)) {
      const context = {
        name: template.name,
        version: template.version,
        scenario: tiers.scenario
      };

      // Use agency-prompt-creator substitution
      const content = substituteTemplate(prompt.content, context);

      const promptPath = join(
        config.outputDir,
        'prompts',
        tiers.scenario,
        `${level}-${getLevelName(level)}.md`
      );
      mkdirSync(dirname(promptPath), { recursive: true });
      writeFileSync(promptPath, content);
      files.push(promptPath);
    }
  }

  // Generate README with substitution
  if (config.includeDocs) {
    const readmeTemplate = getReadmeTemplate();
    const readme = substituteTemplate(readmeTemplate, {
      name: template.name,
      version: template.version,
      domain: (template.persona as any).domain || '',
      capabilities: template.capabilities.tags.join(', ')
    });

    const readmePath = join(config.outputDir, 'README.md');
    writeFileSync(readmePath, readme);
    files.push(readmePath);
  }

  return {
    path: config.outputDir,
    template,
    files,
    benchmarks: [],
    docs: config.includeDocs ? [join(config.outputDir, 'README.md')] : []
  };
}
```

## Testing Plan

### 1. Unit Tests
- Test type imports work correctly
- Test each module function independently
- Test integration with agency-prompt-creator functions

### 2. Integration Tests
- Test complete workflow from extraction to generation
- Test that generated templates are valid
- Test enrichment produces correct metadata

### 3. End-to-End Tests
- Run example script
- Generate a complete specialist
- Validate output structure
- Run benchmark with generated specialist

## Success Criteria

- [ ] All TypeScript compilation errors resolved
- [ ] All modules import from agency-prompt-creator where appropriate
- [ ] No type duplication (use agency-prompt-creator types)
- [ ] Example script runs successfully
- [ ] Generated specialist template is valid
- [ ] CLI commands work correctly
- [ ] Can run benchmark with generated specialist
- [ ] Documentation updated to reflect integration
- [ ] Code follows same patterns as agency-prompt-creator

## Benefits of Integration

1. **Type Safety**: Shared types ensure compatibility
2. **Code Reuse**: Don't reimplement existing functionality
3. **Consistency**: Same patterns across packages
4. **Maintainability**: Updates to agency-prompt-creator benefit specialist-engine
5. **Testability**: Tested functions from agency-prompt-creator
6. **Best Practices**: Follow proven patterns from agency-prompt-creator