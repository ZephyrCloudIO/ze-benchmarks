# Where to Use `safeReadTemplate`

The `safeReadTemplate` function provides non-throwing validation for template files. It returns a result object instead of throwing errors, making it ideal for:

1. **Validation scripts** - Check templates without crashing
2. **CLI tools** - Provide user-friendly error messages
3. **Development tools** - Linting, formatting, or migration scripts
4. **Error recovery** - Gracefully handle invalid templates

## Use Cases

### 1. Template Validation Script

```typescript
import { safeReadTemplate } from 'agency-prompt-creator';

async function validateAllTemplates(templatePaths: string[]) {
  const results = [];
  
  for (const path of templatePaths) {
    const result = await safeReadTemplate(path);
    
    if (!result.success) {
      console.error(`❌ ${path}:`);
      result.error.errors.forEach(err => {
        console.error(`  - ${err.path.join('.')}: ${err.message}`);
      });
      results.push({ path, valid: false, errors: result.error.errors });
    } else {
      console.log(`✅ ${path}: Valid template "${result.data.name}"`);
      results.push({ path, valid: true, template: result.data });
    }
  }
  
  return results;
}
```

### 2. Enhanced Loader with Better Error Messages

**Current location**: `packages/agency-prompt-creator/src/loader.ts`

```typescript
// In loadTemplateFile function, replace:
function loadTemplateFile(filePath: string): any {
  // ... existing code ...
  
  // Instead of basic JSON5 parsing, use safe validation:
  const result = await safeReadTemplate(filePath);
  if (!result.success) {
    const errorDetails = result.error.errors
      .map(e => `  ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    throw new Error(
      `Template validation failed in ${filePath}:\n${errorDetails}`
    );
  }
  return result.data;
}
```

### 3. SpecialistAdapter with Detailed Validation

**Current location**: `packages/agent-adapters/src/specialist.ts` (line 154)

```typescript
private async loadTemplate(templatePath: string): Promise<SpecialistTemplate> {
  const resolvedPath = this.resolveTemplatePath(templatePath);
  
  // Use safeReadTemplate for better error reporting
  const result = await safeReadTemplate(resolvedPath);
  
  if (!result.success) {
    const errors = result.error.errors
      .map(e => `  - ${e.path.join('.')}: ${e.message}`)
      .join('\n');
    
    throw new Error(
      `Invalid specialist template: ${templatePath}\n` +
      `Validation errors:\n${errors}\n` +
      `Make sure the template follows the SpecialistTemplate schema.`
    );
  }
  
  console.log('[SpecialistAdapter] Template loaded:', result.data.name);
  return result.data;
}
```

### 4. CLI Validation Command

```typescript
// scripts/validate-templates.ts
import { safeReadTemplate } from 'agency-prompt-creator';
import { glob } from 'glob';

async function main() {
  const templateFiles = await glob('templates/**/*.json5');
  let hasErrors = false;
  
  for (const file of templateFiles) {
    const result = await safeReadTemplate(file);
    
    if (!result.success) {
      hasErrors = true;
      console.error(`\n❌ ${file}`);
      result.error.errors.forEach(err => {
        const path = err.path.length > 0 ? err.path.join('.') : 'root';
        console.error(`   ${path}: ${err.message}`);
      });
    } else {
      console.log(`✅ ${file} - ${result.data.name} v${result.data.version}`);
    }
  }
  
  process.exit(hasErrors ? 1 : 0);
}
```

### 5. Template Migration/Transformation Scripts

```typescript
import { safeReadTemplate } from 'agency-prompt-creator';

async function migrateTemplate(oldPath: string, newPath: string) {
  const result = await safeReadTemplate(oldPath);
  
  if (!result.success) {
    console.error('Cannot migrate invalid template:');
    result.error.errors.forEach(err => {
      console.error(`  ${err.path.join('.')}: ${err.message}`);
    });
    return false;
  }
  
  // Transform the template
  const migrated = {
    ...result.data,
    schema_version: '0.0.2', // Update schema version
    // ... other migrations
  };
  
  // Write migrated template
  await writeFile(newPath, JSON.stringify(migrated, null, 2));
  return true;
}
```

### 6. Development: Template Editor/Linter

```typescript
// For a VS Code extension or editor tool
import { safeReadTemplate } from 'agency-prompt-creator';

export async function lintTemplate(filePath: string): Promise<LintResult[]> {
  const result = await safeReadTemplate(filePath);
  
  if (!result.success) {
    return result.error.errors.map(err => ({
      severity: 'error',
      message: err.message,
      line: err.path[0] ? getLineNumber(err.path[0]) : 1,
      column: 0,
    }));
  }
  
  // Additional custom linting rules
  const warnings: LintResult[] = [];
  
  if (!result.data.persona.tech_stack || result.data.persona.tech_stack.length === 0) {
    warnings.push({
      severity: 'warning',
      message: 'Consider adding tech_stack to persona',
      line: 1,
    });
  }
  
  return warnings;
}
```

## Key Benefits

1. **Non-throwing**: Doesn't crash your application
2. **Detailed errors**: Zod provides structured error information
3. **Type-safe**: Returns validated data with proper TypeScript types
4. **Flexible**: Can be used in try-catch or result-based error handling

## Comparison with `readAndValidateTemplate`

- **`readAndValidateTemplate`**: Throws errors immediately - use when you want to fail fast
- **`safeReadTemplate`**: Returns result object - use when you want to handle errors gracefully

## Recommended Integration Points

1. ✅ **loader.ts** - Replace basic validation with Zod schema validation
2. ✅ **specialist.ts** - Better error messages for users
3. ✅ **CLI tools** - User-friendly validation output
4. ✅ **CI/CD pipelines** - Validate templates before deployment
5. ✅ **Template generators** - Validate generated templates

