# agency-prompt-creator

Prompt transformation package with template inheritance and mustache substitution for specialist AI agents.

## Features

- **Template Inheritance**: TSConfig-style template inheritance with `from` attribute
- **Task Detection**: Automatic detection of task types from user prompts
- **Prompt Selection**: Model-specific and task-specific prompt selection with fallback
- **Template Substitution**: Mustache-style variable substitution
- **TypeScript**: Full TypeScript support with comprehensive type definitions

## Installation

```bash
pnpm add agency-prompt-creator
```

## Quick Start

```typescript
import { createPrompt, loadTemplate } from 'agency-prompt-creator';

// Load a specialist template (with inheritance resolved)
const template = await loadTemplate('./templates/my-specialist.json5');

// Create a prompt
const result = createPrompt(template, {
  userPrompt: 'Create a button component',
  model: 'claude-sonnet-4.5',
  context: {
    project_name: 'my-app',
  },
});

console.log(result.prompt); // Final prompt ready for LLM
console.log(result.taskType); // 'component_generation'
console.log(result.usedModelSpecific); // true/false
```

## Template Structure

Templates follow the specialist template format with inheritance support:

```json5
{
  // Optional: inherit from another template
  from: '@base/specialist',

  // Identity
  name: '@my-org/my-specialist',
  version: '1.0.0',

  // Specialist definition
  persona: {
    purpose: 'Component generation specialist',
    values: ['Clean Code', 'Best Practices'],
    tech_stack: ['React', 'TypeScript'],
  },

  capabilities: {
    tags: ['react', 'components', 'ui'],
  },

  // Prompts with mustache template variables
  prompts: {
    default: {
      spawnerPrompt: 'You are {{persona.purpose}} specialized in {{tech_stack}}',
      systemPrompt: 'Follow best practices for {{persona.values}}',
    },
    // Optional: model-specific overrides
    model_specific: {
      'claude-sonnet-4.5': {
        spawnerPrompt: 'Claude-specific prompt here',
      },
    },
    // Optional: task-specific prompts
    component_generation: {
      spawnerPrompt: 'Generate a high-quality React component',
    },
  },
}
```

## Template Inheritance

Templates support inheritance following TSConfig-style merge rules:

### Merge Rules

1. **Primitives**: Child overrides parent
2. **Objects**: Deep merge (child keys override parent keys)
3. **Arrays**: Complete replacement (NO merging)

### Example

```json5
// Parent: @base/specialist.json5
{
  name: '@base/specialist',
  persona: {
    values: ['Quality', 'Performance'],
    tech_stack: ['TypeScript', 'Node.js'],
  },
}

// Child: @my-org/my-specialist.json5
{
  from: '@base/specialist',
  name: '@my-org/my-specialist',
  persona: {
    purpose: 'My specialist',
    tech_stack: ['React', 'TypeScript'], // Replaces parent array
  },
}

// Result after merging:
{
  name: '@my-org/my-specialist',
  persona: {
    purpose: 'My specialist',
    values: ['Quality', 'Performance'], // From parent
    tech_stack: ['React', 'TypeScript'], // Child replaced parent
  },
}
```

## Task Detection

The package automatically detects task types from user prompts:

- `project_setup` - "Setup a new React project"
- `component_generation` - "Create a button component"
- `migration` - "Migrate to React 18"
- `bug_fix` - "Fix the login bug"
- `refactoring` - "Refactor the code"
- `testing` - "Write unit tests"
- `documentation` - "Add documentation"
- `default` - Fallback for unmatched prompts

## Template Substitution

Templates support mustache-style variable substitution:

```typescript
const template = {
  prompts: {
    default: {
      spawnerPrompt: 'You are {{persona.purpose}} specialized in {{tech_stack}}',
    },
  },
};

// Variables are automatically populated from the template
// You can also provide custom context:
const result = createPrompt(template, {
  userPrompt: 'Test',
  context: {
    custom_var: 'value',
  },
});
```

### Built-in Variables

- `{{name}}` - Specialist name
- `{{version}}` - Specialist version
- `{{persona.purpose}}` - Persona purpose
- `{{tech_stack}}` - Comma-separated tech stack
- `{{values}}` - Comma-separated values
- `{{tags}}` - Comma-separated capability tags
- `{{task_type}}` - Detected task type
- `{{user_prompt}}` - Original user prompt

## API Reference

### `createPrompt(template, options)`

Create a prompt from a specialist template.

**Parameters:**
- `template: SpecialistTemplate` - Loaded specialist template
- `options: CreatePromptOptions` - Prompt creation options
  - `userPrompt: string` - User's prompt text
  - `model?: string` - Model name for model-specific prompts
  - `taskType?: TaskType` - Override automatic task detection
  - `context?: TemplateContext` - Additional context variables

**Returns:** `CreatePromptResult`
- `prompt: string` - Final processed prompt
- `taskType: TaskType` - Detected or specified task type
- `usedModelSpecific: boolean` - Whether model-specific prompt was used

### `loadTemplate(templatePath, options?)`

Load a template with inheritance resolution.

**Parameters:**
- `templatePath: string` - Path to template file or scoped package name
- `options?: LoadTemplateOptions` - Loading options
  - `baseDir?: string` - Base directory for resolving relative paths
  - `cache?: Map<string, SpecialistTemplate>` - Template cache

**Returns:** `Promise<SpecialistTemplate>` - Fully resolved template

### `detectTaskType(userPrompt)`

Detect task type from user prompt.

**Parameters:**
- `userPrompt: string` - User's prompt text

**Returns:** `TaskType` - Detected task type

## Development

```bash
# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build

# Watch mode
pnpm dev
```

## License

MIT
