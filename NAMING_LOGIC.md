# Naming Logic in ze-benchmarks

This document catalogs all naming logic throughout the repository, showing where different naming conventions are implemented.

## Table of Contents

1. [Specialist Template Naming](#specialist-template-naming)
2. [Enriched Template Naming](#enriched-template-naming)
3. [Run ID Naming](#run-id-naming)
4. [Batch ID Naming](#batch-id-naming)
5. [Snapshot ID Naming](#snapshot-id-naming)
6. [Specialist Name Extraction](#specialist-name-extraction)

---

## Specialist Template Naming

**File**: `packages/harness/src/domain/agent.ts`

**Function**: `resolveSpecialistTemplatePath()`

**Lines**: 145-166

```typescript
export function resolveSpecialistTemplatePath(specialistName: string, workspaceRoot: string): string {
  // Strip namespace prefix if present (e.g., @zephyr-cloud/)
  const templateName = specialistName.replace(/^@[^/]+\//, '');
  
  // Construct template path relative to workspace root
  const templatePath = `templates/${templateName}-template.json5`;
  const absolutePath = resolve(workspaceRoot, templatePath);
  
  // Verify template exists
  if (!existsSync(absolutePath)) {
    throw new Error(`Specialist template not found: ${templatePath}`);
  }
  
  return absolutePath;
}
```

**Naming Convention:**
- Input: `nextjs-specialist` or `@zephyr-cloud/nextjs-specialist`
- Output: `templates/nextjs-specialist-template.json5`
- Pattern: `templates/{name}-template.json5`
- Namespace handling: Strips `@org/` prefix if present

**Usage:**
- Called when `--specialist` flag is provided
- Used to resolve specialist name to template file path

---

## Enriched Template Naming

### Generation Logic

**File**: `packages/specialist-mint/src/enrich-template.ts`

**Function**: `getEnrichedTemplatePath()`

**Lines**: 361-395

```typescript
function getEnrichedTemplatePath(templatePath: string, version: string, specialistName: string): string {
  const dir = dirname(templatePath);
  const enrichedDir = join(dir, 'enriched', version);
  
  // Create enriched directory if it doesn't exist
  if (!existsSync(enrichedDir)) {
    mkdirSync(enrichedDir, { recursive: true });
    // First enrichment for this version
    return join(enrichedDir, `${specialistName}.enriched.001.json5`);
  }
  
  // Find highest numbered enriched file for this specialist
  const escapedName = specialistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);
  
  const files = readdirSync(enrichedDir);
  const enrichedFiles = files
    .filter(f => filePattern.test(f))
    .map(f => {
      const match = f.match(filePattern);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);
  
  // Get next number
  const nextNumber = enrichedFiles.length > 0
    ? Math.max(...enrichedFiles) + 1
    : 1;
  
  // Format with leading zeros (e.g., 001, 002, 010)
  const formattedNumber = String(nextNumber).padStart(3, '0');
  
  return join(enrichedDir, `${specialistName}.enriched.${formattedNumber}.json5`);
}
```

**Naming Convention:**
- Input: `templates/nextjs-specialist-template.json5`, version `0.0.1`, specialist name `nextjs-specialist`
- Output: `templates/enriched/0.0.1/nextjs-specialist.enriched.001.json5`
- Pattern: `templates/enriched/{version}/{specialist-name}.enriched.{number}.json5`
- Numbering: Auto-increments (001, 002, 003, ...) with 3-digit zero-padding
- Directory structure: `templates/enriched/{version}/`

**Specialist Name Extraction** (used by enrichment):

**File**: `packages/specialist-mint/src/enrich-template.ts`

**Lines**: 93-96

```typescript
// Extract specialist name from template path or use template name
// e.g., templates/nextjs-specialist-template.json5 -> nextjs-specialist
const templateBasename = basename(resolvedTemplatePath, '.json5');
const specialistName = templateBasename.replace(/-template$/, '') || template.name;
```

### Discovery Logic

**File**: `packages/agent-adapters/src/specialist.ts`

**Function**: `getLatestEnrichedTemplatePath()`

**Lines**: 433-470

```typescript
private static getLatestEnrichedTemplatePath(templatePath: string, version: string): string | null {
  const enrichedDir = SpecialistAdapter.getEnrichedDir(templatePath, version);
  
  if (!existsSync(enrichedDir)) {
    return null;
  }
  
  try {
    // Extract specialist name from template path
    // e.g., templates/nextjs-specialist-template.json5 -> nextjs-specialist
    const templateBasename = basename(templatePath, '.json5');
    const specialistName = templateBasename.replace(/-template$/, '');
    
    // Escape special regex characters in specialist name
    const escapedName = specialistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);
    
    // Find all {specialist-name}.enriched.{number}.json5 files
    const files = readdirSync(enrichedDir);
    const enrichedFiles = files
      .filter(f => filePattern.test(f))
      .map(f => {
        const match = f.match(filePattern);
        return match ? { filename: f, number: parseInt(match[1], 10) } : null;
      })
      .filter((f): f is { filename: string; number: number } => f !== null)
      .sort((a, b) => b.number - a.number); // Sort descending
    
    if (enrichedFiles.length === 0) {
      return null;
    }
    
    // Return the highest numbered file
    return join(enrichedDir, enrichedFiles[0].filename);
  } catch {
    return null;
  }
}
```

**Naming Convention:**
- Searches for files matching: `{specialist-name}.enriched.{number}.json5`
- Returns the highest numbered file (latest enrichment)
- Returns `null` if no enriched templates exist

**Usage:**
- Called when loading a specialist template
- Checks for enriched version before using base template
- Priority: Enriched template → Base template

---

## Run ID Naming

**File**: `packages/worker-client/src/logger.ts`

**Function**: `startRun()`

**Lines**: 88

```typescript
// Old signature - generate runId and create run data
runId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
```

**Naming Convention:**
- Format: `{timestamp}-{random}`
- Example: `1704067200000-k3j9x2m8p`
- Pattern: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- Timestamp: Unix timestamp in milliseconds
- Random: 9-character base36 string (alphanumeric)

**Usage:**
- Generated when starting a new benchmark run
- Used as unique identifier for the run in the database
- Can also be provided explicitly (new signature)

---

## Batch ID Naming

**File**: `packages/worker-client/src/logger.ts`

**Function**: `startBatch()`

**Lines**: 369-370

```typescript
async startBatch(): Promise<string> {
  const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create the batch in the database immediately
  await this.upsertBatch({
    batchId,
    createdAt: Date.now(),
    totalRuns: 0,
    successfulRuns: 0,
  });
  
  return batchId;
}
```

**Naming Convention:**
- Format: `batch-{timestamp}-{random}`
- Example: `batch-1704067200000-k3j9x2m8p`
- Pattern: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- Prefix: Always starts with `batch-`
- Timestamp: Unix timestamp in milliseconds
- Random: 9-character base36 string (alphanumeric)

**Usage:**
- Generated when starting a new batch of benchmarks
- Groups multiple benchmark runs together
- Created in database before any runs reference it (ensures foreign key constraint)

---

## Snapshot ID Naming

**File**: `packages/specialist-mint/src/utils.ts`

**Function**: `getNextSnapshotId()`

**Lines**: 148-173

```typescript
export function getNextSnapshotId(snapshotDir: string): string {
  if (!existsSync(snapshotDir)) {
    return '001';
  }
  
  const files = readdirSync(snapshotDir);
  const snapshotFiles = files.filter(f => f.startsWith('snapshot-') && f.endsWith('.json5'));
  
  if (snapshotFiles.length === 0) {
    return '001';
  }
  
  // Extract snapshot IDs and find the max
  const ids = snapshotFiles
    .map(f => {
      const match = f.match(/snapshot-(\d+)\.json5/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(id => !isNaN(id));
  
  const maxId = Math.max(...ids);
  const nextId = maxId + 1;
  
  // Pad with zeros to 3 digits
  return nextId.toString().padStart(3, '0');
}
```

**Naming Convention:**
- Format: `snapshot-{number}.json5`
- Example: `snapshot-001.json5`, `snapshot-002.json5`
- Pattern: `snapshot-{number}.json5` where number is 3-digit zero-padded
- Numbering: Auto-increments (001, 002, 003, ...)
- Directory: `output/{name}/{version}/snapshot-{number}.json5`

**Usage:**
- Called when minting a snapshot from benchmark results
- Finds the highest existing snapshot number and increments
- Returns 3-digit zero-padded string (e.g., "001", "010", "100")

---

## Specialist Name Extraction

### From Template Path

**File**: `packages/specialist-mint/src/enrich-template.ts`

**Lines**: 93-96

```typescript
// Extract specialist name from template path or use template name
// e.g., templates/nextjs-specialist-template.json5 -> nextjs-specialist
const templateBasename = basename(resolvedTemplatePath, '.json5');
const specialistName = templateBasename.replace(/-template$/, '') || template.name;
```

**Extraction Logic:**
- Input: `templates/nextjs-specialist-template.json5`
- Steps:
  1. Get basename without extension: `nextjs-specialist-template`
  2. Remove `-template` suffix: `nextjs-specialist`
  3. Fallback to `template.name` if extraction fails

### From Filename (Interactive Mode)

**File**: `packages/harness/src/interactive/benchmark.ts`

**Lines**: 1038-1048

```typescript
// Use template.name if available, otherwise extract from filename
// Filename format: "nextjs-specialist-template.json5" -> "nextjs-specialist"
let name = template.name;
if (!name) {
  // Remove "-template.json5" suffix if present
  name = file.replace(/-specialist-template\.json5$/, '-specialist');
  // If still doesn't end with "-specialist", add it
  if (!name.endsWith('-specialist')) {
    name = name.replace(/-template\.json5$/, '') + '-specialist';
  }
}
```

**Extraction Logic:**
- Input: `nextjs-specialist-template.json5`
- Steps:
  1. Try `template.name` first
  2. Remove `-specialist-template.json5` suffix, add `-specialist`
  3. If doesn't end with `-specialist`, remove `-template.json5` and add `-specialist`
  4. Ensures name always ends with `-specialist`

---

## Summary Table

| Entity | File | Function | Format | Example |
|--------|------|----------|--------|---------|
| **Specialist Template** | `packages/harness/src/domain/agent.ts` | `resolveSpecialistTemplatePath()` | `templates/{name}-template.json5` | `templates/nextjs-specialist-template.json5` |
| **Enriched Template** | `packages/specialist-mint/src/enrich-template.ts` | `getEnrichedTemplatePath()` | `templates/enriched/{version}/{name}.enriched.{number}.json5` | `templates/enriched/0.0.1/nextjs-specialist.enriched.001.json5` |
| **Enriched Discovery** | `packages/agent-adapters/src/specialist.ts` | `getLatestEnrichedTemplatePath()` | Same as above | Returns highest numbered file |
| **Run ID** | `packages/worker-client/src/logger.ts` | `startRun()` | `{timestamp}-{random}` | `1704067200000-k3j9x2m8p` |
| **Batch ID** | `packages/worker-client/src/logger.ts` | `startBatch()` | `batch-{timestamp}-{random}` | `batch-1704067200000-k3j9x2m8p` |
| **Snapshot ID** | `packages/specialist-mint/src/utils.ts` | `getNextSnapshotId()` | `snapshot-{number}.json5` | `snapshot-001.json5` |
| **Specialist Name** | Multiple | Various | Extract from path/filename | `nextjs-specialist` |

---

## Key Patterns

### Template Naming Pattern
```
templates/{specialist-name}-template.json5
```

### Enriched Template Pattern
```
templates/enriched/{version}/{specialist-name}.enriched.{number}.json5
```
- Number is 3-digit zero-padded (001, 002, 003, ...)
- Always increments, never overwrites

### ID Generation Pattern
- **Run ID**: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- **Batch ID**: `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
- **Snapshot ID**: Auto-increment with 3-digit zero-padding

### Name Extraction Pattern
1. Remove file extension (`.json5`)
2. Remove `-template` suffix
3. Fallback to `template.name` if extraction fails

---

## Notes

1. **Enriched Template Numbering**: Always increments, never overwrites. The system finds the highest existing number and adds 1.

2. **Specialist Name Consistency**: The name extraction logic ensures consistency across:
   - Template path resolution
   - Enriched template generation
   - Enriched template discovery
   - Interactive mode specialist listing

3. **Batch ID Format**: The `batch-` prefix ensures batch IDs are easily identifiable and don't conflict with run IDs.

4. **Snapshot ID Format**: The `snapshot-` prefix with zero-padded numbers ensures proper sorting and easy identification.

5. **Regex Escaping**: When matching enriched template filenames, special regex characters in specialist names are escaped to prevent pattern matching issues.

---

This document provides a complete reference for all naming logic in the ze-benchmarks repository.

