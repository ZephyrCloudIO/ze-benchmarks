# Specialist Adapter Integration Guide

## Overview

The `SpecialistAdapter` wraps existing adapters (Anthropic, OpenRouter) and enhances them with specialist template-based prompt transformation using the agency-prompt-creator package.

## Architecture

```
User Prompt → SpecialistAdapter → Prompt Transformation → Underlying Adapter → Model API
                   ↓
            Template Loading
            Task Detection
            Model Selection
            Mustache Substitution
```

## Usage

### Basic Usage

```typescript
import { AnthropicAdapter, SpecialistAdapter } from '@ze/agent-adapters';

// Create base adapter
const anthropic = new AnthropicAdapter();

// Wrap with specialist adapter
const specialist = new SpecialistAdapter(
  anthropic,
  'agency-specialist-mint/snapshots/shadcn-specialist/1.0.0/snapshot-001.json5'
);

// Use like any other adapter
const response = await specialist.send({
  messages: [
    { role: 'user', content: 'Set up a new Vite project with shadcn/ui' }
  ]
});
```

### Integration with CLI

To integrate with the ze-benchmarks CLI (`packages/harness/src/cli.ts`), update the `createAgentAdapter` function:

```typescript
function createAgentAdapter(agentName: string, model?: string, specialistTemplate?: string): AgentAdapter {
  // Create base adapter
  let baseAdapter: AgentAdapter;

  switch (agentName) {
    case 'openrouter':
      baseAdapter = new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, model);
      break;
    case 'anthropic':
      if (model) {
        process.env.CLAUDE_MODEL = model;
      }
      baseAdapter = new AnthropicAdapter();
      break;
    case 'claude-code':
      baseAdapter = new ClaudeCodeAdapter(model);
      break;
    case 'echo':
    default:
      baseAdapter = new EchoAgent();
  }

  // Wrap with specialist if template provided
  if (specialistTemplate) {
    return new SpecialistAdapter(baseAdapter, specialistTemplate);
  }

  return baseAdapter;
}
```

### Reading from models.json5

To integrate with the `models.json5` configuration:

```typescript
import JSON5 from 'json5';
import { readFileSync } from 'fs';

interface ModelConfig {
  provider: string;
  model: string;
  specialist?: string;
}

interface ModelsConfig {
  vanilla_models: ModelConfig[];
  specialist_models: ModelConfig[];
}

function loadModelsConfig(path: string): ModelsConfig {
  const contents = readFileSync(path, 'utf-8');
  return JSON5.parse(contents);
}

function createAdapterFromConfig(config: ModelConfig): AgentAdapter {
  // Create base adapter based on provider
  let baseAdapter: AgentAdapter;
  switch (config.provider) {
    case 'anthropic':
      process.env.CLAUDE_MODEL = config.model;
      baseAdapter = new AnthropicAdapter();
      break;
    case 'openai':
    case 'openrouter':
      baseAdapter = new OpenRouterAdapter(process.env.OPENROUTER_API_KEY, config.model);
      break;
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }

  // Wrap with specialist if specified
  if (config.specialist) {
    // Resolve specialist namespace to template path
    const templatePath = resolveSpecialistTemplate(config.specialist);
    return new SpecialistAdapter(baseAdapter, templatePath);
  }

  return baseAdapter;
}

function resolveSpecialistTemplate(namespace: string): string {
  // Convert @zephyr-cloud/shadcn-specialist to file path
  // For now, use the latest snapshot
  // TODO: Support version pinning
  const name = namespace.replace('@zephyr-cloud/', '');
  return `agency-specialist-mint/snapshots/${name}/1.0.0/snapshot-001.json5`;
}
```

## Template Resolution

The adapter expects a path to a specialist template JSON5 file. The path should be:
- Relative to the project root
- Point to either a template or a snapshot

**Template path**: `starting_from_outcome/shadcn-specialist-template.json5`
**Snapshot path**: `agency-specialist-mint/snapshots/shadcn-specialist/1.0.0/snapshot-001.json5`

## Error Handling

The adapter includes error handling for:

1. **Missing template file**: Clear error message with file path
2. **Invalid JSON5**: Parse error with details
3. **Malformed template**: Validation of required fields (name, prompts)
4. **Empty user message**: Validation that request has user content
5. **Prompt transformation errors**: Wrapped with specialist context

## Prompt Transformation Flow

1. **Extract user prompt**: Gets the last user message from the request
2. **Detect task type**: Uses agency-prompt-creator to detect task (project_setup, component_add, etc.)
3. **Select prompt**: Chooses model-specific prompt if available, falls back to default
4. **Apply substitution**: Uses mustache template substitution with context
5. **Inject system prompt**: Replaces or adds system message with transformed prompt
6. **Delegate**: Sends modified request to underlying adapter

## Template Context

The following context variables are available for mustache substitution:

- `workspaceDir`: The workspace directory from the request
- `hasTools`: Whether tools are available
- `toolCount`: Number of tools available
- (Additional context can be added in `buildTemplateContext()`)

## Dependency Setup

**Note**: Due to nested workspace issues, the agency-prompt-creator dependency may need to be resolved:

### Option 1: Link Protocol (Current)
```json
{
  "dependencies": {
    "agency-prompt-creator": "link:../../../agency-prompt-creator"
  }
}
```

### Option 2: Workspace Protocol (Preferred if root workspace)
```json
{
  "dependencies": {
    "agency-prompt-creator": "workspace:*"
  }
}
```

After updating package.json, run:
```bash
pnpm install
```

## Testing

To test the specialist adapter:

1. Ensure agency-prompt-creator is built: `cd agency-prompt-creator && pnpm build`
2. Create a test script or use the provided `test-specialist.ts`
3. Run with tsx: `pnpm exec tsx test-specialist.ts`

## Next Steps

1. Update ze-benchmarks CLI to support specialist adapter
2. Add CLI flags: `--specialist <template-path>`
3. Integrate with models.json5 loading
4. Add specialist to benchmark result metadata
5. Update benchmark report to show specialist vs vanilla comparisons
