# Specialist Template Interface Documentation

## Overview

The Specialist Template Interface defines the structure for AI specialist configurations in the Zephyr Agency system. Templates specify specialist capabilities, persona, prompts, and benchmarking configuration before deployment.

---

## Core Metadata Fields

### `schema_version` (required)
- **Type**: String
- **Format**: Semantic version (e.g., "0.0.1")
- **Pattern**: `^\d+\.\d+\.\d+$`
- **Purpose**: Tracks the version of the template specification itself
- **Usage**: Enables compatibility checking and migration between schema versions

### `name` (required)
- **Type**: String
- **Format**: Namespaced identifier
- **Pattern**: `^(@[a-z0-9-]+/)?[a-z0-9-]+$`
- **Example**: `"@zephyr-cloud/shadcn-specialist"`
- **Purpose**: Unique identifier for the specialist
- **Usage**: Package reference and specialist discovery

### `displayName` (optional)
- **Type**: String
- **Example**: `"shadcn/ui Expert"`
- **Purpose**: Human-readable name shown to users
- **Usage**: UI display and specialist selection interfaces

### `version` (required)
- **Type**: String
- **Format**: Semantic version
- **Pattern**: `^\d+\.\d+\.\d+$`
- **Purpose**: Version of this specialist template
- **Usage**: Enables version tracking, updates, and compatibility management

### `from` (optional)
- **Type**: String
- **Format**: Scoped package reference, relative path, or absolute path
- **Examples**:
  - `"@zephyr-cloud/base"`
  - `"./base.json5"`
  - `"/path/to/base.json5"`
- **Purpose**: Enables template inheritance from a parent specialist
- **Usage**: Create specialized variants by extending base templates (see INHERITANCE.md)

### `license` (optional)
- **Type**: String
- **Examples**: `"MIT"`, `"Apache-2.0"`, `"UNLICENSED"`
- **Purpose**: Software license for this specialist
- **Usage**: Legal usage terms and distribution rights

### `availability` (optional)
- **Type**: Enum
- **Values**: `"public"`, `"private"`, `"paid"`
- **Purpose**: Controls distribution and access to the specialist
- **Usage**:
  - `"public"`: Freely available to all
  - `"private"`: Internal/organizational use only
  - `"paid"`: Requires subscription or payment

### `maintainers` (optional)
- **Type**: Array of objects
- **Structure**:
  - `name` (required): Maintainer name or team name
  - `email` (optional): Contact email (must be valid email format)
- **Purpose**: Contact information for support and contributions
- **Usage**: Enables community collaboration and support channels

---

## Persona Definition

### `persona` (required)
Defines the specialist's identity, expertise, and behavioral characteristics. This forms the specialist's "character" and guides how it responds to tasks.

#### `persona.purpose` (required)
- **Type**: String
- **Purpose**: Clear statement of what this specialist does and its primary focus area
- **Example**: `"Expert in shadcn/ui component library, specializing in building accessible React components with Tailwind CSS"`

#### `persona.values` (required)
- **Type**: Array of strings
- **Min Items**: 1
- **Purpose**: Core principles and priorities that guide the specialist's behavior
- **Examples**:
  - `"Performance first"`
  - `"Developer experience"`
  - `"Accessibility by default"`
- **Usage**: Informs decision-making and response style

#### `persona.attributes` (required)
- **Type**: Array of strings
- **Min Items**: 1
- **Purpose**: Key characteristics and expertise areas of the specialist
- **Examples**:
  - `"Deep knowledge of React component patterns"`
  - `"Expert in Tailwind CSS utilities"`
  - `"Accessibility compliance specialist"`

#### `persona.tech_stack` (required)
- **Type**: Array of strings
- **Min Items**: 1
- **Purpose**: Technologies, frameworks, and tools the specialist is proficient with
- **Examples**:
  - `"React"`
  - `"TypeScript"`
  - `"Tailwind CSS"`
  - `"shadcn/ui"`

---

## Capabilities & Discovery

### `capabilities` (required)
Defines what the specialist can do and enables specialist discovery through searchable metadata.

#### `capabilities.tags` (required)
- **Type**: Array of strings
- **Pattern**: `^[a-zA-Z0-9-]+$`
- **Min Items**: 1
- **Unique Items**: true
- **Purpose**: Searchable keywords for capability matching
- **Examples**: `"shadcn-ui"`, `"component-theming"`, `"react-components"`
- **Usage**: Powers specialist discovery and automatic task matching

#### `capabilities.descriptions` (required)
- **Type**: Object (key-value pairs)
- **Pattern**: Keys must match entries in the `tags` array
- **Purpose**: Detailed descriptions for each capability tag
- **Structure**: `{ "tag-name": "Description of what this capability enables" }`
- **Usage**: Provides context for capability selection and user understanding

#### `capabilities.considerations` (optional)
- **Type**: Array of strings
- **Purpose**: Important notes, limitations, or context about the specialist's capabilities
- **Examples**:
  - `"Requires shadcn/ui to be installed in the project"`
  - `"Best suited for React 18+ projects"`
  - `"May need manual configuration for custom Tailwind setups"`

---

## Dependencies & Integrations

### `dependencies` (optional)
Specifies external services, tools, and Model Context Protocol servers required or used by this specialist.

#### `dependencies.subscription` (optional)
- **Type**: Object
- **Structure**:
  - `required` (boolean): Whether a paid subscription is required
  - `purpose` (string): Explanation of what the subscription provides
- **Usage**: Informs users about subscription requirements before using the specialist

#### `dependencies.available_tools` (optional)
- **Type**: Array of strings
- **Purpose**: System tools the specialist requires or uses
- **Examples**: `"file_system"`, `"terminal"`, `"git"`, `"web_search"`
- **Usage**: Ensures proper environment setup and tool availability

#### `dependencies.mcps` (optional)
- **Type**: Array of objects
- **Purpose**: Model Context Protocol servers used by this specialist
- **Structure**:
  - `name` (required): Name of the MCP server
  - `version` (required): Version constraint (e.g., `"^1.0.0"`)
  - `permissions` (optional): Array of `"read"`, `"write"`, `"execute"`
  - `description` (optional): Purpose of this MCP integration
  - `required` (optional): Whether this MCP is mandatory or optional
- **Usage**: Enables integration with external services and tools

---

## Documentation & Knowledge

### `documentation` (optional)
Documentation resources for the specialist and its domain, with optional LLM-generated enrichment for intelligent context injection.

#### Documentation Entry Structure
- **Type**: Array of objects
- **Required per entry**: `type`, `description`, and either `url` or `path`

#### `documentation[].type` (required)
- **Type**: Enum
- **Values**: `"official"`, `"reference"`, `"recipes"`, `"examples"`, `"control"`
- **Purpose**: Categorizes the type of documentation resource

#### `documentation[].url` (optional)
- **Type**: String (URI format)
- **Purpose**: External URL for web-based documentation
- **Usage**: Links to official docs, tutorials, or external resources

#### `documentation[].path` (optional)
- **Type**: String
- **Purpose**: Local file path for documentation stored with the specialist
- **Usage**: Bundle documentation directly with the specialist template

#### `documentation[].description` (required)
- **Type**: String
- **Purpose**: Brief description of what this documentation covers
- **Usage**: Helps select relevant documentation for specific tasks

#### `documentation[].enrichment` (optional)
LLM-generated metadata for intelligent documentation injection:

- **`summary`** (string): Comprehensive 2-3 paragraph summary of the documentation content
- **`key_concepts`** (array): Key concepts and patterns extracted from the documentation
- **`relevant_for_tasks`** (array): Task types this documentation is relevant for
- **`relevant_tech_stack`** (array): Tech stack items from persona that this doc relates to
- **`relevant_tags`** (array): Capability tags this documentation supports
- **`code_patterns`** (array): Extracted code patterns and examples
- **`last_enriched`** (string, date-time): Timestamp when enrichment was last performed
- **`enrichment_model`** (string): Model used for enrichment (e.g., `"claude-sonnet-4.5"`)

**Usage**: Enables context-aware, intelligent documentation injection during task execution. The specialist can automatically inject relevant docs based on the current task context.

---

## Model Configuration

### `preferred_models` (optional)
Specifies AI models recommended for use with this specialist, with optional performance weights for intelligent model selection.

#### Model Entry Structure
- **Type**: Array of objects
- **Required per entry**: `model`

#### `preferred_models[].model` (required)
- **Type**: String
- **Examples**: `"claude-sonnet-4.5"`, `"gpt-4o"`, `"anthropic/claude-3.5-haiku"`
- **Purpose**: Model identifier for selection

#### `preferred_models[].specialist_enabled` (optional)
- **Type**: Boolean
- **Purpose**: Whether this model should use the specialist (true) or run as baseline/vanilla (false)
- **Usage**: Enables A/B testing and baseline comparisons

#### `preferred_models[].weight` (optional)
- **Type**: Number
- **Range**: 0-1
- **Purpose**: Overall performance weight for this model
- **Usage**: Influences model selection based on historical performance

#### `preferred_models[].benchmarks` (optional)
- **Type**: Object (key-value pairs)
- **Pattern**: Keys are benchmark names (pattern: `^[a-z_]+$`)
- **Values**: Numbers between 0-1
- **Purpose**: Per-benchmark performance weights for this model
- **Usage**: Enables fine-grained model selection based on task type

---

## Prompts & Task Execution

### `prompts` (required)
Core configuration for specialist behavior, using Mustache interpolation for dynamic content.

#### `prompts.default` (required)
Default prompts used when no model-specific prompt is available.

- **Type**: Object (key-value pairs)
- **Structure**:
  - `spawnerPrompt` (optional string): Prompt used when spawning this specialist in a conversation
  - Additional task-specific prompts with pattern `^[a-z_]+$`
- **Template Syntax**: Uses `{mustache}` placeholders for variable interpolation
- **Usage**: Fallback prompts that work across all models

#### `prompts.model_specific` (optional)
Prompts tailored for specific AI models, optimized for their unique capabilities.

- **Type**: Nested object
- **Structure**: `{ "model-name": { "spawnerPrompt": "...", "task_name": "..." } }`
- **Pattern**: Model names match pattern `^[a-z0-9.-]+$`
- **Usage**: Override default prompts with model-optimized versions

#### `prompts.prompt_strategy` (required)
Configuration for prompt selection and interpolation behavior.

##### `prompt_strategy.fallback` (optional)
- **Type**: Enum
- **Values**: `"default"`, `"error"`
- **Purpose**: What to do when no model-specific prompt is found
- **Usage**:
  - `"default"`: Use the default prompt
  - `"error"`: Throw an error if model-specific prompt is missing

##### `prompt_strategy.model_detection` (optional)
- **Type**: Enum
- **Values**: `"auto"`, `"manual"`
- **Purpose**: How to detect which model is being used
- **Usage**:
  - `"auto"`: Automatically detect from runtime environment
  - `"manual"`: Require explicit model specification

##### `prompt_strategy.allow_override` (optional)
- **Type**: Boolean
- **Purpose**: Whether users can override prompts at runtime
- **Usage**: Enables experimentation and customization

##### `prompt_strategy.interpolation` (optional)
Template interpolation settings:
- **`style`** (enum): `"mustache"` or `"handlebars"` - Template syntax style
- **`escape_html`** (boolean): Whether to escape HTML in interpolated values

---

## Extensibility

### `spawnable_sub-agent_specialists` (optional, preferred naming)
### `spawnable_sub_agent_specialists` (optional, backward compatibility)

Sub-specialists that can be spawned by this specialist for specialized subtasks, enabling hierarchical specialist architectures.

#### Sub-Specialist Entry Structure
- **Type**: Array of objects
- **Required per entry**: `name`, `version`, `purpose`

#### Fields
- **`name`** (required, string): Name of the sub-specialist
- **`version`** (required, string): Version of the sub-specialist (pattern: `^\d+\.\d+\.\d+$`)
- **`license`** (optional, string): License for the sub-specialist
- **`availability`** (optional, enum): `"public"`, `"private"`, or `"paid"`
- **`purpose`** (required, string): What specialized task this sub-specialist handles

**Usage**: Enables complex workflows where a primary specialist can delegate specific subtasks to specialized sub-specialists. For example, a "Full-Stack Developer" specialist might spawn "React UI" and "Database Design" sub-specialists.

---

## Benchmarking & Quality Assurance

### `benchmarks` (optional)
Configuration for validating and measuring specialist performance through systematic testing.

#### `benchmarks.test_suites` (optional)
Array of benchmark test suites for this specialist.

**Structure per suite**:
- **`name`** (required): Unique identifier for the test suite
- **`path`** (required): Path to the benchmark suite directory or file
- **`type`** (required, enum): `"functional"`, `"accuracy"`, `"performance"`, `"integration"`
- **`description`** (optional): What this benchmark tests

**Usage**: Defines systematic tests to validate specialist capabilities

#### `benchmarks.scoring` (optional)
Scoring methodology and comparison configuration.

##### `scoring.methodology` (optional)
- **Type**: Enum
- **Values**: `"weighted_average"`, `"pass_fail"`, `"percentile"`, `"custom"`
- **Purpose**: How scores are calculated across benchmarks

##### `scoring.update_frequency` (optional)
- **Type**: Enum
- **Values**: `"per_run"`, `"per_experiment"`, `"daily"`, `"weekly"`, `"manual"`
- **Purpose**: How often benchmark results should be refreshed

##### `scoring.comparison_targets` (optional)
- **Type**: Array of strings
- **Examples**: `"control"`, `"generic"`, `"baseline"`
- **Purpose**: What to compare specialist performance against
- **Usage**: Enables performance tracking and improvement measurement

---

## Key Design Patterns

### 1. Template Inheritance
Use the `from` field to extend base templates, enabling code reuse and specialization:
```json5
{
  from: "@zephyr-cloud/base-specialist",
  name: "@zephyr-cloud/react-specialist"
}
```

### 2. Model Optimization
Combine `preferred_models` with `model_specific` prompts for optimal performance:
```json5
{
  preferred_models: [
    { model: "claude-sonnet-4.5", weight: 0.95 }
  ],
  prompts: {
    model_specific: {
      "claude-sonnet-4.5": {
        spawnerPrompt: "Optimized prompt for Sonnet..."
      }
    }
  }
}
```

### 3. Documentation Enrichment
Pre-process documentation with LLM-generated metadata to enable intelligent, context-aware injection during task execution.

### 4. Capability-Based Discovery
Use `tags` + `descriptions` to enable automatic specialist selection based on task requirements.

### 5. Hierarchical Composition
Use sub-specialists to enable modular, specialized workflows where complex tasks can be delegated to specialized agents.

---

## Minimal vs. Production Templates

### Minimal Template (Required Fields Only)
```json5
{
  schema_version: "0.0.1",
  name: "my-specialist",
  version: "1.0.0",
  persona: {
    purpose: "Does something useful",
    values: ["Quality"],
    attributes: ["Helpful"],
    tech_stack: ["JavaScript"]
  },
  capabilities: {
    tags: ["helpful"],
    descriptions: { helpful: "Helps with tasks" }
  },
  prompts: {
    default: { spawnerPrompt: "I'm a helpful specialist" },
    prompt_strategy: { fallback: "default" }
  }
}
```

### Production Template
A full production template includes:
- Complete persona with detailed values and attributes
- Comprehensive capability tags with descriptions
- Documentation with enrichment
- Multiple preferred models with weights
- Model-specific optimized prompts
- Benchmark configuration
- Sub-specialist definitions
- Dependency specifications

---

## Related Files

- **Schema**: `packages/specialist-mint/src/schemas/template.schema.json5`
- **TypeScript Types**: `packages/specialist-mint/src/types.ts`
- **Examples**:
  - `templates/shadcn-specialist-template.json5`
  - `templates/nextjs-specialist-template.json5`
- **Documentation**:
  - `packages/specialist-mint/README.md`
  - Inheritance rules (referenced: `INHERITANCE.md`)

---

## Template File Discovery

Specialist templates are automatically discovered from the `templates/` directory based on the following rules:

### File Requirements
- **File Extension**: Templates must use either `.json5` or `.json` extension
- **Location**: Templates must be placed in the `templates/` directory at the repository root
- **Naming**: Any filename is accepted - no specific naming pattern is required

### Template Identification
When the `name` field is not specified in the template, the filename (without extension) is used as the template identifier:
- `shadcn-specialist.json5` → identifier: `shadcn-specialist`
- `nextjs.json` → identifier: `nextjs`
- `my-custom-template.json5` → identifier: `my-custom-template`

### Recommended Naming Conventions
While any filename is supported, these conventions are recommended for clarity:
- **Descriptive names**: Use clear, descriptive names (e.g., `react-expert.json5`, `database-specialist.json`)
- **Consistent patterns**: Consider using suffixes like `-specialist` or `-template` for easy identification
- **Lowercase with hyphens**: Use lowercase letters with hyphens for word separation

### Legacy Support
Templates using older naming patterns (e.g., `-specialist-template.json5` suffix) continue to work without modification.
