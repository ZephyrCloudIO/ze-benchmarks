# Agency Prompt Creator - Architecture & Function-Level Documentation

## Overview

The **agency-prompt-creator** package is responsible for transforming specialist templates into ready-to-use prompts for LLMs. It handles template inheritance, task detection, prompt selection, and variable substitution to create contextual prompts based on user input.

**Primary Consumer:** `packages/agent-adapters` (specialist handling)

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Core Pipeline](#core-pipeline)
- [Module Breakdown](#module-breakdown)
- [Data Flow](#data-flow)
- [Usage in Agent Adapters](#usage-in-agent-adapters)
- [Feature Matrix](#feature-matrix)
- [API Reference](#api-reference)

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────┐
│                  AGENCY PROMPT CREATOR                         │
│                 (packages/agency-prompt-creator)               │
└────────────────────────────────────────────────────────────────┘

INPUT                         PROCESSING                    OUTPUT
┌──────────────┐             ┌──────────────┐          ┌─────────────┐
│              │             │              │          │             │
│  Template    │────────────▶│   Loader     │          │   Final     │
│  File        │             │  +Inheritance│          │   Prompt    │
│  (.json5)    │             │              │          │  (string)   │
│              │             └──────┬───────┘          │             │
└──────────────┘                    │                  └─────────────┘
                                    │
┌──────────────┐                    │
│              │                    │
│  User        │────────────────────┼──────────┐
│  Prompt      │                    │          │
│              │                    │          │
└──────────────┘                    │          │
                                    ▼          ▼
                         ┌──────────────────────────┐
                         │   createPrompt()         │
                         │                          │
                         │  1. Task Detection       │
                         │  2. Prompt Selection     │
                         │  3. Part Combination     │
                         │  4. Doc Filtering        │
                         │  5. Substitution         │
                         └──────────────────────────┘
```

### Key Responsibilities

1. **Template Loading** - Load and parse JSON5 templates
2. **Inheritance Resolution** - Merge parent and child templates (TSConfig-style)
3. **Task Detection** - Classify user intent from prompts
4. **Prompt Selection** - Choose appropriate prompts (task-specific, model-specific)
5. **Documentation Filtering** - Rank and filter relevant docs using enrichment
6. **Template Substitution** - Replace mustache variables with actual values

---

## Core Pipeline

### Main Entry Point: `createPrompt()`

**Location:** `src/create-prompt.ts:33`

```typescript
function createPrompt(
  template: SpecialistTemplate,
  options: CreatePromptOptions
): CreatePromptResult
```

**Pipeline Steps:**

```
User Prompt + Template
         │
         ▼
    1. Task Detection
         │ detectTaskType()
         ▼
    2. Prompt Selection
         │ selectPrompt()
         ▼
    3. Part Combination
         │ combinePromptParts()
         ▼
    4. Context Building
         │ buildTemplateContext()
         │ filterDocumentation()
         ▼
    5. Doc Appending
         │ appendDocumentationSection()
         ▼
    6. Substitution
         │ substituteTemplate()
         ▼
    Final Prompt String
```

---

## Module Breakdown

### 1. Template Loader (`src/loader.ts`)

**Purpose:** Load templates with recursive inheritance resolution

#### **Key Functions:**

##### `loadTemplate(templatePath, options)`
**Location:** `loader.ts:30`

```typescript
async function loadTemplate(
  templatePath: string,
  options?: LoadTemplateOptions
): Promise<SpecialistTemplate>
```

**What it does:**
1. Resolves template path (supports scoped packages, relative paths, absolute paths)
2. Checks cache to prevent circular dependencies
3. Loads template file (JSON5 or JSON)
4. If template has `from` field, recursively loads parent
5. Merges parent and child using TSConfig-style rules
6. Returns fully resolved template

**Path Resolution:**
- Scoped package: `@scope/name` → `personas/@scope/name.json5`
- Relative: `./base.json5` → resolved from baseDir
- Absolute: `/path/to/template.json5` → used as-is

##### `loadTemplateFile(filePath)`
**Location:** `loader.ts:161`

```typescript
async function loadTemplateFile(filePath: string): Promise<any>
```

**What it does:**
- Detects file format (JSON5 vs JSON)
- Parses with appropriate parser
- Handles comments and trailing commas
- Falls back gracefully if parsing fails

---

### 2. Inheritance Resolver (`src/inheritance.ts`)

**Purpose:** Merge templates following TSConfig-style rules

#### **Key Functions:**

##### `mergeTemplates(parent, child)`
**Location:** `inheritance.ts:17`

```typescript
function mergeTemplates(
  parent: SpecialistTemplate,
  child: Partial<SpecialistTemplate>
): SpecialistTemplate
```

**Merge Rules:**
1. **Primitives** - Child overrides parent
2. **Objects** - Deep merge (child keys win)
3. **Arrays** - Complete replacement (NO merging)

**Example:**
```typescript
// Parent
{ persona: { values: ['Quality'], tech_stack: ['Node'] } }

// Child
{ persona: { purpose: 'Specialist', tech_stack: ['React'] } }

// Result
{ persona: { purpose: 'Specialist', values: ['Quality'], tech_stack: ['React'] } }
```

##### `validateTemplate(template)`
**Location:** `inheritance.ts:129`

Validates minimum required fields:
- `name` (string)
- `version` (string)
- `persona` (object)
- `capabilities` (object)
- `prompts` (object)

##### `detectCircularDependency(name, chain)`
**Location:** `inheritance.ts:160`

Prevents infinite loops in inheritance chains.

---

### 3. Task Detection (`src/task-detection.ts`)

**Purpose:** Classify user prompt into task types

#### **Three-Tier Fallback System:**

1. **LLM-based detection** (preferred) - Analyzes template dynamically
2. **Template-defined patterns** (fallback) - Uses `task_detection` field
3. **Default patterns** (ultimate fallback) - Hardcoded regex patterns

#### **Key Functions:**

##### `detectTaskType(userPrompt, template?, llmResult?)`
**Location:** `task-detection.ts:100` (approx)

```typescript
function detectTaskType(
  userPrompt: string,
  template?: SpecialistTemplate,
  llmResult?: TaskDetectionResult
): TaskType
```

**What it does:**
1. Checks LLM-generated patterns (if provided)
2. Falls back to template's `task_detection.patterns`
3. Falls back to default patterns
4. Returns detected task type or 'default'

**Default Task Types:**
- `project_setup` - Setup/scaffold/initialize projects
- `component_generation` - Create UI components
- `migration` - Migrate/upgrade/port code
- `bug_fix` - Fix bugs/errors
- `refactoring` - Refactor/restructure code
- `testing` - Write tests
- `documentation` - Add docs/comments
- `default` - Fallback

**Detection Logic:**
```typescript
// Patterns are regex arrays
const patterns = {
  project_setup: [
    /\b(setup|scaffold|initialize).*(project|app)\b/i,
    /\bnew\s+(project|app)\b/i,
  ],
  component_generation: [
    /\b(create|generate).*(component|button|form)\b/i,
  ],
  // ...
};

// Checks in priority order
for (const taskType of priority) {
  for (const pattern of patterns[taskType]) {
    if (pattern.test(userPrompt)) {
      return taskType;
    }
  }
}
```

##### `analyzeTemplateWithLLM(client, model, template)`
**Location:** `task-detection.ts:200` (approx)

**LLM-based analysis (experimental):**
- Sends template to LLM
- LLM generates custom task types and patterns
- Returns dynamic detection rules

---

### 4. Prompt Selection (`src/prompt-selection.ts`)

**Purpose:** Select appropriate prompt from template based on task type and model

#### **Key Functions:**

##### `selectPrompt(template, taskType, model?)`
**Location:** `prompt-selection.ts:89`

```typescript
function selectPrompt(
  template: SpecialistTemplate,
  taskType: TaskType,
  model?: string
): {
  config: PromptConfig;
  usedModelSpecific: boolean;
  usedTaskSpecific: boolean;
}
```

**Selection Priority:**
1. Task-specific, model-specific prompt
2. Task-specific, default prompt
3. Default, model-specific prompt
4. Default, default prompt

**Model Matching Strategies:**
1. Exact match: `"claude-sonnet-4.5"` === `"claude-sonnet-4.5"`
2. Normalized match: `"anthropic/claude-sonnet-4.5"` → `"claude-sonnet-4.5"`
3. Version prefix match: `"claude-sonnet-4"` matches `"claude-sonnet-4.5"`

##### `combinePromptParts(config)`
**Location:** `prompt-selection.ts:181`

```typescript
function combinePromptParts(config: PromptConfig): string
```

**What it does:**
- Extracts `spawnerPrompt`, `systemPrompt`, `contextPrompt`
- Joins with double newlines (`\n\n`)
- Ignores other properties to prevent unintended concatenation

---

### 5. Documentation Filtering (`src/doc-filter.ts`)

**Purpose:** Filter and rank documentation based on task relevance

#### **Key Functions:**

##### `filterDocumentation(template, taskType, userPrompt, maxDocs)`
**Location:** `doc-filter.ts:59`

```typescript
function filterDocumentation(
  template: SpecialistTemplate,
  taskType: TaskType,
  userPrompt: string,
  maxDocs: number = 5
): FilteredDocumentation[]
```

**What it does:**
1. Extracts keywords from user prompt
2. Scores each documentation entry based on:
   - Task type match (+10 points)
   - Tech stack overlap (+5 per match)
   - Capability tag overlap (+3 per match)
   - Documentation type priority (+2-5 based on type)
   - Keyword matches from user prompt (+variable)
3. Sorts by score (descending)
4. Returns top N docs

**Scoring Logic:**
```typescript
// Task type exact match
if (doc.enrichment.relevant_for_tasks.includes(taskType)) {
  score += 10;
}

// Tech stack matches
const techMatches = intersection(
  doc.enrichment.relevant_tech_stack,
  template.persona.tech_stack
);
score += techMatches.length * 5;

// Keyword matches from user prompt
const keywordMatches = extractKeywords(userPrompt);
score += calculateKeywordScore(doc, keywordMatches);
```

**Requires:** Documentation with `enrichment` field (from `pnpm mint:enrich`)

---

### 6. Keyword Extraction (`src/keyword-extraction.ts`)

**Purpose:** Extract structured keywords from user prompts

#### **Key Functions:**

##### `extractKeywords(userPrompt)`
**Location:** `keyword-extraction.ts:100` (approx)

```typescript
function extractKeywords(userPrompt: string): ExtractedKeywords
```

**Extracts:**
- **Frameworks:** vite, next, remix, astro, etc.
- **Components:** button, form, modal, card, etc.
- **Tech stack:** typescript, tailwind, radix, shadcn, etc.
- **Package managers:** pnpm, npm, yarn, bun

**Example:**
```typescript
extractKeywords("Create a vite project with shadcn button")
// Returns:
{
  frameworks: ['vite'],
  competingFrameworks: [],
  components: ['button'],
  techStack: ['shadcn'],
  all: ['vite', 'button', 'shadcn']
}
```

---

### 7. Template Substitution (`src/template-substitution.ts`)

**Purpose:** Replace mustache variables with actual values

#### **Key Functions:**

##### `substituteTemplate(template, context)`
**Location:** `template-substitution.ts:22`

```typescript
function substituteTemplate(
  template: string,
  context: TemplateContext
): string
```

**Supports:**
- Simple variables: `{{name}}`
- Nested properties: `{{persona.purpose}}`
- Array access: `{{capabilities.tags.0}}`
- Sections: `{{#documentation}}...{{/documentation}}`
- Nested in sections: `{{#documentation}}{{title}}{{/documentation}}`

**Substitution Logic:**
```typescript
// Simple variable
"{{name}}" → context.name

// Nested property
"{{persona.purpose}}" → context.persona.purpose

// Array (joins with commas)
"{{capabilities.tags}}" → "react, typescript, tailwind"

// Section (repeats for array items)
{{#documentation}}
  {{title}}: {{summary}}
{{/documentation}}
```

##### `buildTemplateContext(template, userPrompt, taskType, additionalContext)`
**Location:** `template-substitution.ts:161`

```typescript
function buildTemplateContext(
  template: any,
  userPrompt: string,
  taskType: TaskType,
  additionalContext: TemplateContext = {}
): TemplateContext
```

**Builds context object with:**
- Specialist info: `name`, `version`, `persona`, `capabilities`
- Task info: `task_type`, `user_prompt`
- Filtered documentation: `documentation` array
- Helper values: `tech_stack`, `values`, `tags` (comma-separated)
- Additional context from caller

---

### 8. LLM-Based Features (Experimental)

These modules provide LLM-powered enhancements but may not be actively used:

#### **Intent Extraction** (`src/intent-extraction.ts`)

**Purpose:** Extract structured intent from user prompts using LLM

```typescript
interface ExtractedIntent {
  intent: string;
  primaryGoal: string;
  keywords: string[];
  framework?: string;
  components?: string[];
  packageManager?: string;
  features?: string[];
}
```

**Functions:**
- `buildIntentExtractionPrompt(userPrompt)` - Builds LLM prompt
- `parseIntentResponse(toolCall)` - Parses LLM tool call response
- `INTENT_EXTRACTION_TOOL` - OpenAI tool schema

#### **Component Selection** (`src/component-selection.ts`)

**Purpose:** Use LLM to select spawner prompts, task prompts, and docs

```typescript
interface SpecialistSelection {
  spawnerPromptId: string;
  taskPromptId: string;
  relevantTags: string[];
  relevantTechStack: string[];
  documentation: DocumentationReference[];
  reasoning: string;
}
```

**Functions:**
- `buildComponentSelectionPrompt(userPrompt, intent, template)` - Builds LLM prompt
- `parseComponentSelectionResponse(toolCall)` - Parses response
- `COMPONENT_SELECTION_TOOL` - OpenAI tool schema

#### **LLM Substitution** (`src/llm-substitution.ts`)

**Purpose:** Use LLM to fill mustache variables (alternative to rule-based)

**Functions:**
- `buildSubstitutionPrompt(template, userPrompt, intent, context)` - Builds prompt
- `substituteWithLLM(client, model, ...)` - Calls LLM
- `parseSubstitutionResponse(toolCall)` - Parses response
- `extractMustacheVariables(template)` - Finds all `{{var}}` patterns
- `SUBSTITUTION_TOOL` - OpenAI tool schema

---

### 9. Schema Validation (`src/schema-analyzer.ts`)

**Purpose:** Validate templates against Zod schemas

#### **Key Functions:**

##### `SpecialistTemplateSchema`
**Location:** `schema-analyzer.ts:30` (approx)

Zod schema for template validation.

##### `readAndValidateTemplate(filePath)`
**Location:** `schema-analyzer.ts:100` (approx)

```typescript
function readAndValidateTemplate(filePath: string): SpecialistTemplate
```

**What it does:**
- Reads template file
- Parses JSON5
- Validates against Zod schema
- Returns validated template or throws

##### `safeReadTemplate(filePath)`
**Location:** `schema-analyzer.ts:120` (approx)

```typescript
function safeReadTemplate(filePath: string): {
  success: boolean;
  data?: SpecialistTemplate;
  error?: string;
}
```

Non-throwing version of `readAndValidateTemplate`.

---

## Data Flow

### Complete Flow Example

```typescript
// 1. Load template (with inheritance)
const template = await loadTemplate('./templates/shadcn-specialist.json5');
// Result: Fully merged template with parent fields

// 2. Create prompt from user input
const result = createPrompt(template, {
  userPrompt: 'Create a vite project with a button component',
  model: 'claude-sonnet-4.5',
  context: { custom_var: 'value' }
});

// Internal steps:
// 2a. Detect task type
//     → detectTaskType("Create a vite project...")
//     → 'project_setup'
//
// 2b. Select prompt
//     → selectPrompt(template, 'project_setup', 'claude-sonnet-4.5')
//     → Checks: project_setup.model_specific['claude-sonnet-4.5']
//     → Falls back to: project_setup.default
//     → Returns: { spawnerPrompt, systemPrompt, contextPrompt }
//
// 2c. Combine parts
//     → combinePromptParts(config)
//     → Joins with \n\n
//     → Returns: combined string
//
// 2d. Build context
//     → buildTemplateContext(template, userPrompt, 'project_setup', context)
//     → Filters documentation based on keywords
//     → Returns: context object
//
// 2e. Append docs
//     → appendDocumentationSection(combinedPrompt, context)
//     → Adds formatted documentation section
//
// 2f. Substitute variables
//     → substituteTemplate(prompt, context)
//     → Replaces {{variable}} with actual values
//     → Returns: final prompt

// 3. Result
console.log(result.prompt); // Final prompt string ready for LLM
console.log(result.taskType); // 'project_setup'
console.log(result.usedModelSpecific); // true/false
```

---

## Usage in Agent Adapters

### How `agent-adapters` Uses This Package

**Location:** `packages/agent-adapters/src/specialist.ts`

#### **Imports:**

```typescript
import type {
  SpecialistTemplate,
  TaskType,
  ExtractedIntent,
  SpecialistSelection,
  DocumentationReference
} from 'agency-prompt-creator';

import {
  loadTemplate,
  createPrompt,
  detectTaskType,
  filterDocumentation,
  buildIntentExtractionPrompt,
  parseIntentResponse,
  INTENT_EXTRACTION_TOOL
} from 'agency-prompt-creator';
```

#### **Main Usage:**

1. **Load Specialist Template**
   ```typescript
   const template = await loadTemplate(specialistPath);
   ```

2. **Create Spawner Prompt**
   ```typescript
   const result = createPrompt(template, {
     userPrompt: request.userPrompt,
     model: request.model
   });
   ```

3. **Inject into Agent Messages**
   ```typescript
   messages[0].content = result.prompt + '\n\n' + messages[0].content;
   ```

#### **Other Usage in `agent-adapters`:**

- **`llm-prompt-selector.ts`** - Uses types: `PromptConfig`, `Prompts`
- **`llm-cache.ts`** - Uses types: `ExtractedIntent`, `SpecialistSelection`

---

## Feature Matrix

### Core Features (Actively Used)

| Feature | Module | Status | Used By |
|---------|--------|--------|---------|
| Template loading | `loader.ts` | ✅ Active | agent-adapters |
| Inheritance resolution | `inheritance.ts` | ✅ Active | loader |
| Task detection (regex) | `task-detection.ts` | ✅ Active | create-prompt |
| Prompt selection | `prompt-selection.ts` | ✅ Active | create-prompt |
| Mustache substitution | `template-substitution.ts` | ✅ Active | create-prompt |
| Documentation filtering | `doc-filter.ts` | ✅ Active | create-prompt |
| Keyword extraction | `keyword-extraction.ts` | ✅ Active | doc-filter |

### Experimental Features (May Be Unused)

| Feature | Module | Status | Used By |
|---------|--------|--------|---------|
| LLM task detection | `task-detection.ts` | ⚠️ Experimental | None? |
| Intent extraction | `intent-extraction.ts` | ⚠️ Experimental | None? |
| Component selection | `component-selection.ts` | ⚠️ Experimental | None? |
| LLM substitution | `llm-substitution.ts` | ⚠️ Experimental | None? |
| Schema validation | `schema-analyzer.ts` | ⚠️ Rarely used | None? |

---

## API Reference

### Main API

#### `createPrompt(template, options)`

Create a prompt from a specialist template.

**Parameters:**
- `template: SpecialistTemplate` - Loaded template (use `loadTemplate()`)
- `options: CreatePromptOptions`:
  - `userPrompt: string` - User's request
  - `model?: string` - Model name for model-specific prompts
  - `taskType?: TaskType` - Override auto-detection
  - `context?: TemplateContext` - Additional context variables

**Returns:** `CreatePromptResult`
- `prompt: string` - Final processed prompt
- `taskType: TaskType` - Detected/specified task type
- `usedModelSpecific: boolean` - Whether model-specific prompt was used

#### `loadTemplate(templatePath, options?)`

Load a template with inheritance resolution.

**Parameters:**
- `templatePath: string` - Path to template file or scoped package name
- `options?: LoadTemplateOptions`:
  - `baseDir?: string` - Base directory for resolving paths
  - `cache?: Map<string, SpecialistTemplate>` - Template cache

**Returns:** `Promise<SpecialistTemplate>` - Fully resolved template

#### `detectTaskType(userPrompt, template?, llmResult?)`

Detect task type from user prompt.

**Parameters:**
- `userPrompt: string` - User's request
- `template?: SpecialistTemplate` - Optional template for custom patterns
- `llmResult?: TaskDetectionResult` - Optional LLM-generated patterns

**Returns:** `TaskType` - Detected task type or 'default'

---

## Key Data Structures

### SpecialistTemplate

```typescript
interface SpecialistTemplate {
  // Inheritance
  from?: string;

  // Identity
  name: string;
  version: string;
  schema_version?: string;

  // Specialist definition
  persona: {
    purpose: string;
    values?: string[];
    attributes?: string[];
    tech_stack?: string[];
  };

  capabilities: {
    tags: string[];
    descriptions?: Record<string, string>;
  };

  prompts: {
    default?: {
      spawnerPrompt?: string;
      systemPrompt?: string;
      contextPrompt?: string;
    };
    model_specific?: Record<string, PromptConfig>;
    [taskType: string]: PromptConfig | Record<string, PromptConfig>;
  };

  documentation?: Array<{
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
  }>;

  task_detection?: {
    patterns?: Record<string, string[]>;
    priority?: string[];
  };
}
```

### TemplateContext

```typescript
interface TemplateContext {
  // Specialist info
  name?: string;
  version?: string;
  persona?: Persona;
  capabilities?: Capabilities;

  // Task info
  task_type?: TaskType;
  user_prompt?: string;

  // Documentation
  documentation?: FilteredDocumentation[];

  // Helper values
  tech_stack?: string;  // Comma-separated
  values?: string;      // Comma-separated
  tags?: string;        // Comma-separated

  // Custom values
  [key: string]: any;
}
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG_DOC_FILTERING` | Enable documentation filtering debug logs | `false` |

---

## Testing

### Test Files

```
tests/
├── doc-filtering.test.ts        # Documentation filtering tests
├── index.test.ts                # Main API tests
├── keyword-extraction.test.ts   # Keyword extraction tests
└── model-matching.test.ts       # Model name matching tests
```

### Running Tests

```bash
cd packages/agency-prompt-creator
pnpm test
```

---

## Dependencies

```json
{
  "dependencies": {
    "json5": "^2.2.3",      // JSON5 parsing
    "zod": "^3.25.76",      // Schema validation
    "@ze/logger": "workspace:*"  // Logging
  }
}
```

---

## Related Documentation

- [Specialist Template Interface](./SPECIALIST_TEMPLATE_INTERFACE.md)
- [Agent Adapters Integration](../packages/agent-adapters/SPECIALIST_INTEGRATION.md)
- [Safe Read Usage](../packages/agency-prompt-creator/SAFE_READ_USAGE.md)
- [Task Detection Explanation](../packages/agency-prompt-creator/TASK_DETECTION_EXPLANATION.md)

---

**Last Updated:** 2025-12-01
**Version:** 1.0.0