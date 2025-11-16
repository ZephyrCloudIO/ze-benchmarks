# Specialist Architecture

## Overview

The Specialist Architecture in `zack-wip` introduces a sophisticated prompt engineering system that wraps existing agent adapters to provide context-aware, LLM-powered prompt transformation. This allows benchmarks to use specialized templates that adapt dynamically based on user intent, task type, and available documentation.

## Key Concepts

### 1. SpecialistAdapter (Decorator Pattern)

The `SpecialistAdapter` is a decorator that wraps any base agent adapter (AnthropicAdapter, OpenRouterAdapter, etc.) and intercepts requests to transform prompts before sending them to the underlying model.

**Location:** `packages/agent-adapters/src/specialist.ts`

**Key Features:**
- Wraps existing adapters without modifying them
- Loads specialist templates from JSON5 files
- Uses LLM-powered 3-step workflow for prompt generation
- Supports enriched templates with documentation
- Includes caching to reduce LLM API calls

### 2. Three-Step Workflow

The specialist adapter uses a sophisticated 3-step workflow to generate optimal prompts:

#### Step 3a: Intent Extraction
- Uses an LLM (claude-3.5-haiku via OpenRouter) to analyze the user's prompt
- Extracts structured intent including:
  - Primary goal
  - Keywords
  - Framework (Vite, Next.js, etc.)
  - Package manager
  - Components mentioned
  - Features requested

**Implementation:** `buildIntentExtractionPrompt()` from `agency-prompt-creator`

#### Step 3b: Component Selection
- Uses the extracted intent to select optimal specialist components:
  - **Spawner Prompt**: General introduction and capabilities
  - **Task Prompt**: Task-specific instructions
  - **Documentation**: Relevant docs filtered by tags and tech stack
- Returns structured selection with reasoning

**Implementation:** `buildComponentSelectionPrompt()` from `agency-prompt-creator`

#### Step 3c: System Prompt Creation
- Performs LLM-powered substitution on spawner and task prompts
- Uses `substituteWithLLM()` to intelligently fill template variables
- Formats documentation section with CRITICAL markers
- Concatenates all components into final system prompt

**Output:** Complete system prompt sent to the underlying model

### 3. Template Structure

Specialist templates use the following structure:

```json5
{
  name: "shadcn-specialist",
  version: "0.0.5",
  prompts: {
    default: {
      spawnerPrompt: "...",
      taskPrompt: "..."
    },
    project_setup: {
      default: {
        systemPrompt: "..."
      },
      model_specific: {
        "claude-sonnet-4.5": {
          systemPrompt: "..."
        }
      }
    },
    component_generation: { /* ... */ },
    // ... other task types
  },
  documentation: [
    {
      title: "shadcn/ui Installation",
      url: "https://ui.shadcn.com/docs/installation/vite",
      summary: "...",
      keyConcepts: ["..."],
      codePatterns: ["..."],
      tags: ["project_setup", "installation"],
      techStack: ["Vite", "React"]
    }
    // ... more documentation entries
  ],
  llm_config: {
    provider: "openrouter",
    selection_model: "anthropic/claude-3.5-haiku",
    extraction_model: "anthropic/claude-3.5-haiku",
    timeout_ms: 10000,
    cache_ttl_ms: 3600000
  }
}
```

### 4. Enriched Templates

Templates can be enriched with additional documentation:

**Original:** `starting_from_outcome/shadcn-specialist-template.json5`

**Enriched:** `starting_from_outcome/enriched/0.0.5/enriched-001.json5`

The adapter automatically uses the latest enriched version if available (highest numbered `enriched-NNN.json5`).

### 5. LLM Cache

**Location:** `packages/agent-adapters/src/llm-cache.ts`

Provides TTL-based in-memory caching for:
- Intent extraction results
- Component selection results
- Prompt selection results (legacy)
- Variable extraction results (legacy)

**Benefits:**
- Reduces LLM API calls for similar prompts
- Default TTL: 1 hour (configurable)
- Automatic expiry and cleanup

### 6. LLM Prompt Selector

**Location:** `packages/agent-adapters/src/llm-prompt-selector.ts`

Legacy system for static prompt selection (replaced by 3-step workflow but still supported):
- Builds prompts for LLM-powered template selection
- Extracts mustache template variables
- Validates and normalizes extracted data

## Integration Points

### CLI Integration

**File:** `packages/harness/src/domain/agent.ts`

The specialist is integrated via the `createAgentAdapter()` function:

```typescript
export async function createAgentAdapter(
  agentName: string,
  model?: string,
  specialistName?: string,
  workspaceRoot?: string
): Promise<AgentAdapter> {
  // Create base adapter
  let baseAdapter = /* ... */;

  // Wrap with specialist if provided
  if (specialistName && workspaceRoot) {
    const templatePath = resolveSpecialistTemplatePath(specialistName, workspaceRoot);
    const { SpecialistAdapter } = await import('../../../agent-adapters/src/specialist.ts');
    return new SpecialistAdapter(baseAdapter, templatePath);
  }

  return baseAdapter;
}
```

### Template Path Resolution

**Function:** `resolveSpecialistTemplatePath()`

Converts specialist name to template path:
- Input: `@zephyr-cloud/shadcn-specialist`
- Output: `starting_from_outcome/shadcn-specialist-template.json5` (absolute path)

The absolute path is critical for cross-directory invocation.

## Environment Variables

The specialist adapter requires:

- `OPENROUTER_API_KEY` - For LLM-powered prompt operations (if using OpenRouter)
- `ANTHROPIC_API_KEY` - Alternative provider for LLM operations
- `LLM_SELECTION_MODEL` - Override default selection model
- `LLM_EXTRACTION_MODEL` - Override default extraction model
- `LLM_SELECTION_TIMEOUT` - Override timeout (default: 10000ms)
- `SPECIALIST_VALIDATION_MODE` - Enable validation mode (bypasses LLM processing)

## Telemetry

The SpecialistAdapter tracks comprehensive telemetry:

```typescript
interface LLMTelemetry {
  intent_extraction?: {
    intent: ExtractedIntent;
    duration_ms: number;
    model: string;
    cache_hit: boolean;
  };
  component_selection?: {
    selection: SpecialistSelection;
    duration_ms: number;
    model: string;
    cache_hit: boolean;
  };
  substitution?: {
    spawner_duration_ms: number;
    task_duration_ms: number;
    model: string;
  };
}
```

Access via: `specialistAdapter.getLLMTelemetry()`

## Documentation Section Format

When documentation is selected, it's added to the system prompt with CRITICAL markers:

```markdown
## ⚠️ CRITICAL: Required Documentation Reading

**YOU MUST START BY USING THE WEB FETCH TOOL TO READ THESE DOCUMENTATION PAGES BEFORE PROCEEDING WITH ANY IMPLEMENTATION.**

These documentation pages contain essential patterns and configurations that you must follow exactly.

### [Title]

**📄 Documentation URL**: [url]
**YOU MUST READ THIS PAGE FIRST**

**Summary**: [summary]

**Key Concepts**: [concept1], [concept2], ...

**Code Patterns from Documentation**:
- `pattern1`
- `pattern2`

---
```

This format signals to the agent that documentation reading is mandatory before implementation.

## Testing

**Test file:** `packages/agent-adapters/test-specialist.ts`

Example usage:

```typescript
import { AnthropicAdapter } from './src/anthropic.js';
import { SpecialistAdapter } from './src/specialist.js';

const anthropic = new AnthropicAdapter();
const specialist = new SpecialistAdapter(
  anthropic,
  'starting_from_outcome/shadcn-specialist-template.json5'
);

const response = await specialist.send({
  messages: [
    { role: 'user', content: 'Set up a new Vite project with shadcn/ui' }
  ],
  workspaceDir: '/path/to/workspace'
});

// Check telemetry
const telemetry = specialist.getLLMTelemetry();
console.log('Intent:', telemetry.intent_extraction?.intent);
console.log('Selection:', telemetry.component_selection?.selection);
```

## Key Benefits

1. **Context-Aware**: Adapts prompts based on actual user intent
2. **Documentation-Driven**: Automatically includes relevant documentation
3. **Model-Agnostic**: Works with any base adapter
4. **Efficient**: Caching reduces repeated LLM calls
5. **Transparent**: Full telemetry for debugging
6. **Flexible**: Supports both static and LLM-powered modes

## Migration Path

To use specialists in benchmarks:

1. Add `specialist` parameter to scenario config
2. Ensure template exists in `starting_from_outcome/`
3. Set required environment variables
4. Run benchmark with `--specialist` flag (or via scenario config)

The system gracefully falls back to base adapter if specialist setup fails.
