# Specialist Engine - Alignment Plan with agency-prompt-creator

## Goal
Ensure specialist-engine follows the same architecture patterns, conventions, and design principles as agency-prompt-creator.

## Architecture Analysis

### agency-prompt-creator Patterns
1. **Module Organization**
   - Single-purpose modules (one file per feature)
   - Function-based exports (not classes)
   - Clean separation of concerns
   - Centralized type definitions in `types.ts`

2. **File Structure**
   ```
   src/
     index.ts              # Main exports
     types.ts              # All type definitions
     create-prompt.ts      # Main API
     loader.ts             # Template loading
     task-detection.ts     # Task detection
     prompt-selection.ts   # Prompt selection
     template-substitution.ts  # Variable substitution
     inheritance.ts        # Template inheritance
     doc-filter.ts         # Documentation filtering
     keyword-extraction.ts # Keyword extraction
     intent-extraction.ts  # LLM intent extraction
     component-selection.ts # LLM component selection
     llm-substitution.ts   # LLM-based substitution
   ```

3. **API Design**
   - Simple function exports: `export function doThing(args)`
   - Type exports: `export type { TypeName }`
   - Tool/constant exports: `export { TOOL_DEFINITION }`
   - Clean index.ts that re-exports everything organized by category

4. **Type System**
   - Central `types.ts` file with all interfaces
   - Types exported individually: `export type { TypeA, TypeB }`
   - Reusable type definitions across modules

5. **Dependencies**
   - Minimal external dependencies
   - Uses OpenAI SDK for LLM calls (consistent)
   - JSON5 for parsing templates

### Current specialist-engine Issues

1. **Class-based Architecture**
   - Uses classes: `DocumentationExtractor`, `Enricher`, `SpecialistEngine`
   - Should use functions for consistency

2. **Type Duplication**
   - Defines `SpecialistTemplate` and other types that already exist in agency-prompt-creator
   - Should import shared types from agency-prompt-creator

3. **Module Organization**
   - Good: Separate modules for each concern
   - Issue: Uses classes instead of functions

4. **API Surface**
   - Good: Clean engine.ts orchestrator
   - Issue: Mix of class methods and functions

## Alignment Plan

### Phase 1: Type Consolidation ✅

1. **Import shared types from agency-prompt-creator**
   ```typescript
   import type {
     SpecialistTemplate,
     TaskType,
     Persona,
     Capabilities,
     // ...other shared types
   } from 'agency-prompt-creator';
   ```

2. **Define only specialist-engine-specific types**
   - Keep: `ExtractedKnowledge`, `ExtractionConfig`, `EnrichmentConfig`, etc.
   - Remove: Duplicate types that exist in agency-prompt-creator

3. **Organize types.ts**
   ```typescript
   // Re-export agency-prompt-creator types
   export type { SpecialistTemplate, TaskType } from 'agency-prompt-creator';

   // Specialist-engine-specific types
   export type ExtractedKnowledge = { ... };
   export type ExtractionConfig = { ... };
   ```

### Phase 2: Refactor Modules (Function-based) 🔄

#### Before (Class-based):
```typescript
export class DocumentationExtractor {
  constructor(apiKey?: string, model?: string) { ... }
  async extractFromUrl(url: string) { ... }
}

// Usage:
const extractor = new DocumentationExtractor();
const knowledge = await extractor.extractFromUrl(url);
```

#### After (Function-based):
```typescript
export async function extractFromUrl(
  url: string,
  config: ExtractionConfig
): Promise<Partial<ExtractedKnowledge>> {
  // Implementation
}

export async function extractFromSite(
  urls: string[],
  config: ExtractionConfig
): Promise<ExtractedKnowledge> {
  // Implementation
}

// Usage:
const knowledge = await extractFromUrl(url, config);
```

### Phase 3: Module Refactoring Details

#### 1. **extractor.ts** → **extraction.ts**
```typescript
// Current: Class with methods
export class DocumentationExtractor { ... }

// New: Pure functions
export async function extractFromUrl(
  url: string,
  config: ExtractionConfig
): Promise<Partial<ExtractedKnowledge>>;

export async function extractFromSite(
  urls: string[],
  config: ExtractionConfig
): Promise<ExtractedKnowledge>;

export async function extractWithLLM(
  text: string,
  sourceUrl: string,
  config: LLMConfig
): Promise<Partial<ExtractedKnowledge>>;
```

#### 2. **structurer.ts** - Already good! ✅
```typescript
// Already function-based
export function structure(
  knowledge: ExtractedKnowledge,
  options: StructureOptions
): SpecialistTemplate;

export function buildPersona(...): Persona;
export function buildCapabilities(...): Capabilities;
```

#### 3. **enricher.ts** → **enrichment.ts**
```typescript
// Current: Class
export class Enricher { ... }

// New: Functions
export async function enrichDocumentation(
  doc: DocumentationEntry,
  config: EnrichmentConfig
): Promise<DocumentationEntry>;

export async function enrichTemplate(
  template: SpecialistTemplate,
  config: EnrichmentConfig
): Promise<SpecialistTemplate>;

export function generateTiers(
  template: SpecialistTemplate,
  baseTask: string,
  scenario: string
): TierSet;

export function generateTierPrompt(
  level: TierLevel,
  baseTask: string,
  template: SpecialistTemplate
): TierPrompt;
```

#### 4. **validator.ts** - Already good! ✅
```typescript
// Already function-based
export function validate(template: SpecialistTemplate): ValidationResult;
```

#### 5. **generator.ts** - Already good! ✅
```typescript
// Already function-based
export function generate(
  template: SpecialistTemplate,
  tiers: TierSet | undefined,
  config: GeneratorConfig
): SpecialistPackage;
```

#### 6. **engine.ts** → Keep orchestrator pattern
```typescript
// Current: Class with methods
export class SpecialistEngine { ... }

// Keep but simplify:
export class SpecialistEngine {
  // Orchestrates other modules
  async createSpecialist(config: CreateConfig): Promise<SpecialistPackage> {
    const knowledge = await extract(config.extraction);
    const template = structure(knowledge, config.template);
    const enriched = await enrich(template, config.enrichment);
    const validated = validate(enriched);
    return generate(enriched, config.output);
  }
}

// Also export convenience instance
export const engine = new SpecialistEngine();
```

### Phase 4: API Organization

#### index.ts Structure (like agency-prompt-creator)
```typescript
// Main API
export { SpecialistEngine, engine } from './engine.js';

// Extraction
export {
  extractFromUrl,
  extractFromSite,
  extractWithLLM,
} from './extraction.js';

// Structuring
export {
  structure,
  buildPersona,
  buildCapabilities,
} from './structurer.js';

// Enrichment
export {
  enrichDocumentation,
  enrichTemplate,
  generateTiers,
  generateTierPrompt,
} from './enrichment.js';

// Validation
export { validate } from './validator.js';

// Generation
export { generate } from './generator.js';

// Types - organized by category
export type {
  // Engine types
  CreateSpecialistConfig,
  SpecialistPackage,

  // Extraction types
  ExtractedKnowledge,
  ExtractionConfig,
  Concept,
  Gotcha,
  BestPractice,

  // Enrichment types
  EnrichmentConfig,
  TierSet,
  TierLevel,
  TierPrompt,

  // Validation types
  ValidationResult,
  ValidationIssue,

  // Generation types
  GeneratorConfig,

  // Re-export shared types
  SpecialistTemplate,
  TaskType,
  Persona,
  Capabilities,
} from './types/index.js';
```

### Phase 5: Implementation Standards

1. **Error Handling**
   ```typescript
   // Follow agency-prompt-creator pattern
   try {
     // operation
   } catch (error) {
     if (error instanceof Error) {
       throw new Error(`Context: ${error.message}`);
     }
     throw error;
   }
   ```

2. **Logging**
   ```typescript
   // Use console.log with prefixes like agency-prompt-creator
   console.log('[SpecialistEngine] Creating specialist...');
   console.error('[SpecialistEngine] Error:', error);
   ```

3. **LLM Configuration**
   ```typescript
   // Consistent with agency-prompt-creator
   interface LLMConfig {
     provider: 'openrouter' | 'anthropic';
     model: string;
     apiKey: string;
     timeout: number;
   }
   ```

4. **Async Patterns**
   ```typescript
   // Use Promise.all for parallel operations
   const results = await Promise.all(
     urls.map(url => extractFromUrl(url, config))
   );
   ```

### Phase 6: Documentation Alignment

1. **README.md structure**
   - Mirror agency-prompt-creator format
   - Quick Start section
   - API Reference section
   - Examples section

2. **Code Comments**
   ```typescript
   /**
    * Extract knowledge from documentation URL
    *
    * @param url - Documentation URL to extract from
    * @param config - Extraction configuration
    * @returns Extracted knowledge with concepts, gotchas, and best practices
    */
   export async function extractFromUrl(...): Promise<...> { }
   ```

## Implementation Checklist

### Type System
- [ ] Remove duplicate type definitions
- [ ] Import shared types from agency-prompt-creator
- [ ] Organize types.ts with clear sections
- [ ] Add JSDoc comments to types

### Modules
- [ ] Refactor extraction.ts to function-based
- [ ] Refactor enrichment.ts to function-based
- [ ] Verify structurer.ts, validator.ts, generator.ts are function-based ✅
- [ ] Simplify engine.ts orchestrator

### API
- [ ] Reorganize index.ts exports by category
- [ ] Add JSDoc to all exported functions
- [ ] Ensure consistent naming conventions

### Testing
- [ ] Create simple example scripts
- [ ] Test type imports work correctly
- [ ] Verify CLI still works with refactored code
- [ ] Run end-to-end workflow test

### Documentation
- [ ] Update README.md to match agency-prompt-creator format
- [ ] Update QUICKSTART.md with new API
- [ ] Add API reference section
- [ ] Include migration guide if needed

## Benefits

1. **Consistency**: Same patterns across related packages
2. **Maintainability**: Easier to understand and modify
3. **Interoperability**: Shared types and conventions
4. **Developer Experience**: Familiar API for users of both packages
5. **Testing**: Pure functions are easier to test
6. **Tree-shaking**: Function exports allow better tree-shaking

## Success Criteria

- [ ] All modules use function-based exports (except main engine orchestrator)
- [ ] Types are imported from agency-prompt-creator where appropriate
- [ ] API follows same patterns as agency-prompt-creator
- [ ] Documentation structure matches agency-prompt-creator
- [ ] CLI and examples work with refactored code
- [ ] End-to-end workflow runs successfully