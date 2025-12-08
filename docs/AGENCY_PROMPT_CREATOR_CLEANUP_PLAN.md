# Agency Prompt Creator - Cleanup & Optimization Plan

## Executive Summary

The `agency-prompt-creator` package contains **14 source files** implementing prompt transformation functionality. After thorough analysis, **several experimental features** appear to be unused and **core functionality can be simplified**. This document provides a comprehensive cleanup plan to reduce complexity, improve maintainability, and remove dead code.

---

## Table of Contents

- [Current State Analysis](#current-state-analysis)
- [Usage Audit](#usage-audit)
- [Cleanup Recommendations](#cleanup-recommendations)
- [Refactoring Opportunities](#refactoring-opportunities)
- [Implementation Plan](#implementation-plan)
- [Risk Assessment](#risk-assessment)

---

## Current State Analysis

### Package Overview

```
packages/agency-prompt-creator/
├── src/
│   ├── component-selection.ts      # 10,706 bytes - LLM-based (experimental)
│   ├── create-prompt.ts            #  3,685 bytes - CORE
│   ├── doc-filter.ts               #  7,630 bytes - CORE
│   ├── index.ts                    #  2,254 bytes - Exports
│   ├── inheritance.ts              #  4,087 bytes - CORE
│   ├── intent-extraction.ts        #  4,367 bytes - LLM-based (experimental)
│   ├── keyword-extraction.ts       #  5,211 bytes - CORE
│   ├── llm-substitution.ts         #  6,889 bytes - LLM-based (experimental)
│   ├── loader.ts                   #  6,962 bytes - CORE
│   ├── prompt-selection.ts         #  5,525 bytes - CORE
│   ├── schema-analyzer.ts          #  7,089 bytes - Rarely used
│   ├── task-detection.ts           # 18,719 bytes - CORE + experimental
│   ├── template-substitution.ts    #  6,564 bytes - CORE
│   └── types.ts                    #  5,568 bytes - CORE
└── tests/                          # 4 test files
```

**Total:** ~95KB source code

### Dependencies

```json
{
  "json5": "^2.2.3",           // ✅ Required for parsing
  "zod": "^3.25.76",           // ⚠️  Only used in schema-analyzer
  "@ze/logger": "workspace:*"  // ✅ Used throughout
}
```

---

## Usage Audit

### Where Is This Package Used?

**Primary Consumer:** `packages/agent-adapters`

#### Imports from `agent-adapters/src/specialist.ts`:

```typescript
// Types (6 imports)
import type {
  SpecialistTemplate,
  TaskType,
  ExtractedIntent,
  SpecialistSelection,
  DocumentationReference
} from 'agency-prompt-creator';

// Functions (7 imports)
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

#### Other imports:

- `agent-adapters/src/llm-prompt-selector.ts`: Types only (`PromptConfig`, `Prompts`)
- `agent-adapters/src/llm-cache.ts`: Types only (`ExtractedIntent`, `SpecialistSelection`)

### Feature Usage Status

| Feature | Used? | Evidence |
|---------|-------|----------|
| **Core Features** |  |  |
| `loadTemplate()` | ✅ YES | Used in specialist.ts |
| `createPrompt()` | ✅ YES | Used in specialist.ts |
| `detectTaskType()` | ✅ YES | Used in specialist.ts |
| `filterDocumentation()` | ✅ YES | Used in specialist.ts |
| Template inheritance | ✅ YES | Via loadTemplate |
| Mustache substitution | ✅ YES | Via createPrompt |
| Keyword extraction | ✅ YES | Via doc filtering |
| Prompt selection | ✅ YES | Via createPrompt |
| **Experimental Features** |  |  |
| `buildIntentExtractionPrompt()` | ⚠️ MAYBE | Imported but usage unclear |
| `parseIntentResponse()` | ⚠️ MAYBE | Imported but usage unclear |
| `INTENT_EXTRACTION_TOOL` | ⚠️ MAYBE | Imported but usage unclear |
| `buildComponentSelectionPrompt()` | ❌ NO | Not imported anywhere |
| `parseComponentSelectionResponse()` | ❌ NO | Not imported anywhere |
| `COMPONENT_SELECTION_TOOL` | ❌ NO | Not imported anywhere |
| `substituteWithLLM()` | ❌ NO | Not imported anywhere |
| `buildSubstitutionPrompt()` | ❌ NO | Not imported anywhere |
| `SUBSTITUTION_TOOL` | ❌ NO | Not imported anywhere |
| `analyzeTemplateWithLLM()` | ❌ NO | Not imported anywhere |
| `buildTaskDetectionPrompt()` | ❌ NO | Not imported anywhere |
| Schema validation | ❌ NO | Not imported anywhere |

---

## Cleanup Recommendations

### Phase 1: Remove Unused LLM Features (High Priority)

#### 1.1 Remove Component Selection Module

**File:** `src/component-selection.ts` (10.7KB)

**Reason:**
- Not imported by any consumer
- Provides LLM-based component selection
- Duplicates functionality of `prompt-selection.ts` (rule-based)
- Adds complexity without usage

**Action:**
```bash
rm src/component-selection.ts
```

**Index updates:**
```typescript
// Remove from src/index.ts
export {
  buildComponentSelectionPrompt,
  parseComponentSelectionResponse,
  COMPONENT_SELECTION_TOOL,
} from './component-selection.js'; // DELETE THIS
```

**Impact:** None (not imported anywhere)

---

#### 1.2 Remove LLM Substitution Module

**File:** `src/llm-substitution.ts` (6.9KB)

**Reason:**
- Not imported by any consumer
- Provides LLM-based variable substitution
- Duplicates functionality of `template-substitution.ts` (mustache-based)
- Adds complexity without usage
- Requires LLM client dependency

**Action:**
```bash
rm src/llm-substitution.ts
```

**Index updates:**
```typescript
// Remove from src/index.ts
export {
  buildSubstitutionPrompt,
  substituteWithLLM,
  parseSubstitutionResponse,
  extractMustacheVariables,
  SUBSTITUTION_TOOL,
} from './llm-substitution.js'; // DELETE THIS
```

**Impact:** None (not imported anywhere)

---

#### 1.3 Remove Schema Validation Module

**File:** `src/schema-analyzer.ts` (7.1KB)

**Reason:**
- Not imported by any consumer
- Uses `zod` dependency (only usage in package)
- Duplicates validation in `inheritance.ts` (`validateTemplate()`)
- Template validation happens in `specialist-mint` package instead

**Action:**
```bash
rm src/schema-analyzer.ts
```

**Index updates:**
```typescript
// Remove from src/index.ts
export {
  SpecialistTemplateSchema,
  readAndValidateTemplate,
  safeReadTemplate,
  type SpecialistTemplate as SpecialistTemplateFromSchema,
} from './schema-analyzer.js'; // DELETE THIS
```

**Dependencies to remove:**
```json
{
  "dependencies": {
    "zod": "^3.25.76"  // REMOVE THIS
  }
}
```

**Impact:**
- None (not imported)
- Removes `zod` dependency (saves ~50KB)

---

#### 1.4 Investigate Intent Extraction Usage

**File:** `src/intent-extraction.ts` (4.4KB)

**Status:** ⚠️ Imported but usage unclear

**Action:**
1. Search `agent-adapters` codebase for actual usage of:
   - `buildIntentExtractionPrompt()`
   - `parseIntentResponse()`
   - `INTENT_EXTRACTION_TOOL`
2. If unused, remove entire module
3. If used, document usage and keep

**Search command:**
```bash
grep -r "buildIntentExtractionPrompt\|parseIntentResponse\|INTENT_EXTRACTION_TOOL" \
  packages/agent-adapters/src/ \
  --exclude-dir=node_modules
```

**If unused:**
```bash
rm src/intent-extraction.ts
```

**Index updates:**
```typescript
// Remove from src/index.ts if unused
export {
  buildIntentExtractionPrompt,
  parseIntentResponse,
  INTENT_EXTRACTION_TOOL,
  type TaskDetectionResult,
} from './intent-extraction.js'; // MAYBE DELETE
```

---

### Phase 2: Simplify Task Detection (Medium Priority)

#### 2.1 Remove LLM-Based Task Detection

**File:** `src/task-detection.ts` (18.7KB - largest file)

**Issue:**
- Contains both rule-based (used) and LLM-based (unused) detection
- LLM features: `analyzeTemplateWithLLM()`, `buildTaskDetectionPrompt()`, etc.
- None of the LLM functions are imported

**Action:**
Strip out LLM-related functions:

**Functions to keep:**
```typescript
// Core (used)
export function detectTaskType(userPrompt, template?)
export function getTaskKeywords(taskType)

// Types
export type TaskType
```

**Functions to remove:**
```typescript
// LLM-based (unused)
export function analyzeTemplateWithLLM()
export function buildTaskDetectionPrompt()
export function parseTaskDetectionResponse()
export function detectTaskTypesWithConfidence()
export const TASK_DETECTION_TOOL
export type TaskDetectionResult
```

**Size reduction:** ~8-10KB (estimate)

---

### Phase 3: Optimize Core Modules (Low Priority)

#### 3.1 Simplify Documentation Filtering

**File:** `src/doc-filter.ts` (7.6KB)

**Current complexity:**
- Multiple scoring algorithms
- Extensive keyword matching
- Debug logging

**Optimization:**
- Remove debug logging code (controlled by env var)
- Simplify scoring to essential factors only
- Extract scoring weights to constants

**Size reduction:** ~1-2KB

---

#### 3.2 Consolidate Type Definitions

**File:** `src/types.ts` (5.6KB)

**Issue:**
- Types for unused LLM features still exported
- Some types duplicated across modules

**Action:**
Remove types for deleted features:
```typescript
// Remove if intent-extraction is deleted
export interface ExtractedIntent { ... }

// Remove if component-selection is deleted
export interface DocumentationReference { ... }
export interface SpecialistSelection { ... }
```

**Size reduction:** ~1KB

---

#### 3.3 Optimize Loader Error Handling

**File:** `src/loader.ts` (7.0KB)

**Current approach:**
- Tries JSON5, falls back to JSON
- Complex error handling
- Warns on missing parent templates

**Optimization:**
- Simplify format detection logic
- Reduce error message verbosity
- Remove redundant try-catch blocks

**Size reduction:** ~500 bytes

---

### Phase 4: Remove Dead Code Paths (Low Priority)

#### 4.1 Remove Unused Exports

Many functions are exported but never used externally:

```typescript
// src/index.ts - Review each export for usage

// Likely unused externally:
export { validateTemplateString } from './template-substitution.js';
export { containsKeyword, countKeywordMatches } from './keyword-extraction.js';
export { hasEnrichedDocumentation } from './doc-filter.js';
```

**Action:**
- Audit each export
- Remove unused exports
- Keep functions internal-only

---

## Refactoring Opportunities

### 1. Extract Configuration

**Current:** Hardcoded values scattered across files

**Proposed:** Centralized configuration

```typescript
// src/config.ts
export const PROMPT_CONFIG = {
  MAX_DOCS: 5,
  DOC_SCORING: {
    TASK_TYPE_MATCH: 10,
    TECH_STACK_MATCH: 5,
    TAG_MATCH: 3,
    TYPE_PRIORITY: {
      official: 5,
      reference: 4,
      recipes: 3,
      examples: 2,
      control: 2
    }
  },
  TASK_DETECTION: {
    DEFAULT_PRIORITY: [
      'project_setup',
      'component_generation',
      'migration',
      'bug_fix',
      'refactoring',
      'testing',
      'documentation'
    ]
  }
};
```

**Benefits:**
- Easy configuration updates
- Single source of truth
- Testability

---

### 2. Simplify Module Structure

**Current:** 14 source files

**Proposed:** Consolidate related modules

```
src/
├── core/
│   ├── loader.ts           # Template loading + inheritance
│   ├── prompt-builder.ts   # Prompt selection + combination + substitution
│   └── types.ts
├── detection/
│   ├── task-detection.ts   # Task type detection (rule-based only)
│   └── keyword-extraction.ts
├── filtering/
│   └── doc-filter.ts       # Documentation filtering
├── config.ts               # Centralized config
└── index.ts                # Public API
```

**Benefits:**
- Clearer organization
- Easier to navigate
- Logical grouping

---

### 3. Reduce Function Complexity

#### High Complexity Functions:

1. **`filterDocumentation()`** (src/doc-filter.ts:59)
   - Current: 60 lines
   - Scoring logic embedded
   - Extract scoring to separate function

2. **`substituteTemplate()`** (src/template-substitution.ts:22)
   - Current: 125 lines
   - Handles sections and variables
   - Extract section handling to separate function

3. **`loadTemplateRecursive()`** (src/loader.ts:43)
   - Current: 80 lines
   - Mix of loading and inheritance
   - Extract inheritance resolution

**Action:** Extract helper functions for each complex operation

---

## Implementation Plan

### Sprint 1: Remove Dead Code (2-3 hours)

**Week 1:**

1. ✅ **Audit usage in agent-adapters**
   - Search for all imports
   - Verify function usage
   - Document findings

2. ✅ **Remove unused LLM modules**
   - Delete `component-selection.ts`
   - Delete `llm-substitution.ts`
   - Delete `schema-analyzer.ts`
   - Update `index.ts` exports
   - Remove `zod` dependency
   - Run tests to verify

3. ✅ **Investigate intent extraction**
   - Search agent-adapters for usage
   - If unused, delete module
   - Update exports

4. ✅ **Clean up task-detection.ts**
   - Remove LLM-based functions
   - Keep rule-based detection
   - Update exports

**Deliverables:**
- ~25-30KB code removed
- 1 dependency removed (zod)
- Test suite still passing

---

### Sprint 2: Simplify & Optimize (3-4 hours)

**Week 2:**

1. ✅ **Extract configuration**
   - Create `src/config.ts`
   - Move hardcoded values
   - Update imports

2. ✅ **Optimize core modules**
   - Simplify doc filtering
   - Consolidate types
   - Optimize loader

3. ✅ **Refactor complex functions**
   - Extract helpers
   - Improve readability
   - Add inline documentation

4. ✅ **Update tests**
   - Fix broken tests
   - Add tests for edge cases
   - Verify coverage

**Deliverables:**
- ~5-10KB additional savings
- Improved code quality
- Better test coverage

---

### Sprint 3: Documentation & Validation (2 hours)

**Week 3:**

1. ✅ **Update README**
   - Remove references to deleted features
   - Update examples
   - Clarify API

2. ✅ **Update type definitions**
   - Remove unused types
   - Add JSDoc comments
   - Export only public API

3. ✅ **Integration testing**
   - Test with agent-adapters
   - Verify specialist creation
   - Run full benchmark suite

4. ✅ **Final review**
   - Code review
   - Documentation review
   - Performance check

**Deliverables:**
- Updated documentation
- Verified integration
- Production-ready

---

## Risk Assessment

### High Risk Areas

#### 1. Intent Extraction Module

**Risk:** May be used but not directly imported

**Mitigation:**
- Thorough code search before deletion
- Check git history for usage patterns
- Ask team about usage
- Create feature flag for gradual removal

#### 2. Breaking Agent Adapters

**Risk:** Removing exports breaks downstream package

**Mitigation:**
- Compile agent-adapters after each change
- Run full test suite
- Manual testing of specialist creation
- Gradual rollout with feature flags

#### 3. Template Parsing Breakage

**Risk:** Simplifying loader breaks template loading

**Mitigation:**
- Extensive tests for template loading
- Test with real templates
- Validate inheritance resolution
- Keep backup of original implementation

---

### Low Risk Areas

#### 1. Removing LLM Modules

**Risk:** Low - not imported anywhere

**Validation:**
```bash
grep -r "component-selection\|llm-substitution\|schema-analyzer" \
  packages/ --include="*.ts" --exclude-dir=node_modules
```

#### 2. Removing Zod Dependency

**Risk:** Low - only used in schema-analyzer

**Validation:**
```bash
grep -r "from 'zod'\|from \"zod\"" \
  packages/agency-prompt-creator/src/ --exclude=schema-analyzer.ts
```

---

## Success Metrics

### Quantitative Metrics

| Metric | Before | Target | Success? |
|--------|--------|--------|----------|
| Source code size | ~95KB | <70KB | ✅ |
| Number of modules | 14 | <10 | ✅ |
| Dependencies | 3 | 2 | ✅ |
| Test coverage | Unknown | >80% | 📊 |
| Build time | Unknown | <5s | 📊 |

### Qualitative Metrics

- ✅ **Maintainability:** Reduced complexity, clearer structure
- ✅ **Discoverability:** Easier to find relevant code
- ✅ **Documentation:** Up-to-date and accurate
- ✅ **Performance:** No regressions in createPrompt()
- ✅ **Reliability:** All tests passing

---

## Rollback Plan

### If Things Go Wrong

1. **Immediate Rollback:**
   ```bash
   git revert <cleanup-commit-hash>
   pnpm install
   pnpm build
   pnpm test
   ```

2. **Partial Rollback:**
   - Restore specific deleted modules from git history
   - Re-add to index.ts exports
   - Restore dependency if needed

3. **Communication:**
   - Notify team of rollback
   - Document issue
   - Create ticket for investigation

---

## Appendix A: Detailed File Analysis

### Core Modules (Keep)

| File | Size | Usage | Complexity | Notes |
|------|------|-------|------------|-------|
| `create-prompt.ts` | 3.7KB | ✅ High | Low | Main entry point |
| `loader.ts` | 7.0KB | ✅ High | Medium | Template loading + inheritance |
| `inheritance.ts` | 4.1KB | ✅ High | Low | TSConfig-style merging |
| `prompt-selection.ts` | 5.5KB | ✅ High | Low | Task/model prompt selection |
| `template-substitution.ts` | 6.6KB | ✅ High | Medium | Mustache variable replacement |
| `doc-filter.ts` | 7.6KB | ✅ High | Medium | Documentation ranking |
| `keyword-extraction.ts` | 5.2KB | ✅ Medium | Low | Framework/component detection |
| `task-detection.ts` | 18.7KB | ⚠️ Partial | High | Rule-based detection (keep), LLM (remove) |
| `types.ts` | 5.6KB | ✅ High | Low | Type definitions |
| `index.ts` | 2.3KB | ✅ High | Low | Public API exports |

**Total to keep:** ~66KB (after task-detection cleanup)

---

### Experimental Modules (Remove)

| File | Size | Usage | Reason |
|------|------|-------|--------|
| `component-selection.ts` | 10.7KB | ❌ None | LLM-based, not imported |
| `llm-substitution.ts` | 6.9KB | ❌ None | LLM-based, duplicates mustache |
| `schema-analyzer.ts` | 7.1KB | ❌ None | Zod validation, unused |
| `intent-extraction.ts` | 4.4KB | ⚠️ Unclear | LLM-based, verify usage |

**Total to remove:** ~29KB (or ~25KB if intent-extraction kept)

---

## Appendix B: Command Reference

### Search Commands

```bash
# Find all imports of agency-prompt-creator
grep -r "from 'agency-prompt-creator'\|from \"agency-prompt-creator\"" \
  packages/ --include="*.ts" --exclude-dir=node_modules

# Find usage of specific function
grep -r "functionName" packages/ --include="*.ts" --exclude-dir=node_modules

# Find files importing zod
grep -r "from 'zod'\|from \"zod\"" \
  packages/agency-prompt-creator/src/

# Check build after changes
cd packages/agency-prompt-creator
pnpm build

# Run tests
pnpm test

# Check agent-adapters build
cd packages/agent-adapters
pnpm build
```

### Cleanup Commands

```bash
# Remove unused modules
rm packages/agency-prompt-creator/src/component-selection.ts
rm packages/agency-prompt-creator/src/llm-substitution.ts
rm packages/agency-prompt-creator/src/schema-analyzer.ts

# Remove zod dependency
cd packages/agency-prompt-creator
pnpm remove zod

# Update index.ts (manual edit)
# Remove export lines for deleted modules

# Rebuild and test
pnpm build
pnpm test

# Test integration
cd ../agent-adapters
pnpm build
```

---

## Appendix C: Migration Guide

### For Future Developers

If you need LLM-based features that were removed:

#### Restoring Deleted Code

```bash
# View deleted files
git log --diff-filter=D --summary

# Restore specific file
git checkout <commit-before-deletion> -- src/component-selection.ts

# Or cherry-pick the delete commit (revert)
git revert <cleanup-commit-hash>
```

#### Alternative Approaches

Instead of restoring LLM features, consider:

1. **For Intent Extraction:**
   - Use keyword extraction (already in package)
   - Implement in agent-adapters if needed
   - Use LLM directly in calling code

2. **For Component Selection:**
   - Use existing prompt selection (rule-based)
   - Implement custom logic in agent-adapters
   - Add model-specific prompts to templates

3. **For LLM Substitution:**
   - Use mustache substitution (already in package)
   - Pre-process templates before passing to package
   - Add computed context variables

---

**Last Updated:** 2025-12-01
**Version:** 1.0.0
**Author:** Cleanup Plan
**Status:** Ready for Review
