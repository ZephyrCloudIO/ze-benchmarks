# Specialist Template Guide

## Overview

This document explains the `shadcn-specialist.json5` template - how it was created, what it contains, and how to use or extend it.

## Template Location

**File**: `shadcn-specialist.json5`
**Type**: Agent specialist template (not yet a snapshot)
**Version**: 0.0.1
**Status**: Template → will become snapshot after benchmarks

## What is a Template vs Snapshot?

### Template (Current State)
- Contains specialist knowledge and prompts
- No benchmark scores or weights yet
- Created by gathering documentation and analyzing repositories
- Ready to be used in experiments

### Snapshot (Future State)
- Template + actual benchmark results
- Includes model weights from real performance data
- Shows proven success rates
- Updated with lessons learned from experiments

This file will become a snapshot after we:
1. Run experiments with multiple models
2. Calculate actual success rates
3. Add benchmark scores to `preferred_models` section
4. Document proven performance metrics

## Creation Process

### 1. Identified Knowledge Gaps

Started by asking: "What does a generic LLM need to know to successfully set up shadcn+vite?"

**Critical gaps identified**:
- Tailwind v4 has different syntax than v3
- Must install @tailwindcss/vite plugin
- Path aliases required in 3 different files
- Specific configuration patterns for vite.config.ts

### 2. Gathered Documentation

**Sources**:
- https://ui.shadcn.com/docs - Main documentation
- https://ui.shadcn.com/docs/installation/vite - Vite setup
- https://ui.shadcn.com/docs/cli - CLI reference
- https://ui.shadcn.com/docs/theming - Theming guide
- https://ui.shadcn.com/docs/components-json - Configuration

**Method**: Used WebFetch to extract key information from each page

### 3. Analyzed Repository

**Source**: https://github.com/shadcn-ui/ui

**Focus areas**:
- CLI implementation in `packages/shadcn/src/commands/`
- Configuration patterns
- Component structure
- Common conventions

### 4. Extracted Critical Knowledge

**Key insights that generic LLMs miss**:

```typescript
// Tailwind v4 Syntax (NEW!)
"@import \"tailwindcss\"" // NOT @tailwind directives

// Required Plugin
"@tailwindcss/vite" // NOT optional!

// Path Aliases (3 places!)
// 1. tsconfig.json
// 2. tsconfig.app.json
// 3. vite.config.ts

// Immutable Settings
baseColor // Cannot change after init
cssVariables // Cannot change after init
```

### 5. Structured as JSON5

Following the persona schema format:
- `persona`: Purpose, values, attributes, tech stack
- `capabilities`: Tags, descriptions, considerations
- `dependencies`: Tools, MCPs, subscriptions
- `documentation`: Official docs, reference materials
- `preferred_models`: Model list (scores added later)
- `prompts`: Model-specific instructions
- `benchmarks`: Test suite definitions

## Template Structure

### Persona Section

```json5
"persona": {
  "purpose": "Expert shadcn/ui specialist...",
  "values": [
    "Performance first",
    "Component transparency",      // shadcn-specific
    "Code ownership over abstraction" // shadcn-specific
  ],
  "tech_stack": [
    "shadcn/ui",
    "Tailwind CSS v4",  // Version specified!
    "Radix UI",
    "Vite 7",
    "React 19"
  ]
}
```

**Key decisions**:
- Extends base values with shadcn-specific ones
- Specifies exact versions to avoid ambiguity
- Focuses on the philosophical difference (code ownership)

### Capabilities Section

```json5
"capabilities": {
  "tags": [
    "shadcn-ui",
    "tailwindcss-v4",    // Version-specific tag!
    "vite-setup",
    "component-theming",
    // ... more
  ],
  "descriptions": {
    "shadcn-ui": "Initialize and configure shadcn/ui projects from scratch following official documentation exactly",
    // ... detailed descriptions for each
  },
  "considerations": [
    "shadcn/ui is NOT a component library - it's a code distribution platform",
    "Tailwind CSS v4 has different configuration than v3",
    // ... important gotchas
  ]
}
```

**Key decisions**:
- Tags are searchable/discoverable
- Descriptions explain WHAT each capability does
- Considerations document GOTCHAS that cause problems

### Documentation Section

```json5
"documentation": [
  {
    "type": "official",
    "url": "https://ui.shadcn.com/docs/installation/vite",
    "description": "Vite installation guide"
  },
  {
    "type": "reference",
    "path": "./shadcn-reference-docs.md",
    "description": "Comprehensive shadcn/ui reference documentation"
  }
]
```

**Key decisions**:
- Link to official sources (authoritative)
- Include reference docs (extracted knowledge)
- Provide clear descriptions

### Prompts Section

This is where the magic happens - encoding step-by-step knowledge.

```json5
"prompts": {
  "model_specific": {
    "claude-sonnet-4.5": {
      "spawnerPrompt": "I'm a shadcn/ui specialist...\n\nKey principles I follow:\n1. ALWAYS follow official documentation exactly...\n2. Use the official CLI: pnpm dlx shadcn@latest\n3. Tailwind CSS v4 uses @import \"tailwindcss\" syntax...",

      "project_setup": "I'll set up a {framework} project...\n\n1. Create {framework} project with TypeScript template\n2. Install Tailwind CSS v4 with @tailwindcss/vite plugin\n3. Configure Tailwind CSS (replace src/index.css with @import \"tailwindcss\")\n4. Configure TypeScript path aliases in tsconfig.json AND tsconfig.app.json\n5. Install @types/node for path resolution\n6. Update {framework} config with tailwindcss plugin and path alias resolver\n7. Initialize shadcn/ui with pnpm dlx shadcn@latest init (select base color)\n8. Configure {features} as requested\n9. Verify build succeeds..."
    }
  }
}
```

**Key decisions**:
- Model-specific prompts (different models may need different styles)
- Step-by-step instructions (no ambiguity)
- Template variables ({framework}, {features}) for reusability
- Explicit version callouts (v4 syntax)
- Numbered steps (easy to follow)

### Benchmarks Section

```json5
"benchmarks": {
  "test_suites": [
    {
      "name": "vite-project-setup",
      "path": "./benchmarks/vite-setup",
      "type": "functional",
      "description": "Validate complete Vite + shadcn/ui project setup"
    }
  ],
  "scoring": {
    "methodology": "weighted_average",
    "update_frequency": "per_experiment",
    "comparison_targets": ["control", "generic"]
  }
}
```

**Key decisions**:
- Define test suites (but no scores yet)
- Specify comparison methodology
- Document what we're measuring against

## How the Template is Used

### In Generic Experiment
**NOT USED** - Generic LLM has only its base training

### In Specialist Experiment

1. **Load spawnerPrompt**:
   ```typescript
   const spawnerPrompt = template.prompts.model_specific["claude-sonnet-4.5"].spawnerPrompt
   // Load this as system context/initial instruction
   ```

2. **Provide Task**:
   ```
   "Generate a new shadcn project, use vite and add the button component"
   ```

3. **LLM Behavior**:
   - Follows the principles in spawnerPrompt
   - Knows about v4 syntax
   - Installs correct packages
   - Configures all files properly
   - Achieves 100% success

## Critical Knowledge Encoded

### 1. Version-Specific Syntax

**Problem**: Tailwind v3 vs v4 syntax differs
**Solution**: Explicitly documented in spawnerPrompt

```json5
"3. Tailwind CSS v4 uses @import \"tailwindcss\" syntax (not @tailwind directives)"
```

### 2. Non-Obvious Dependencies

**Problem**: @tailwindcss/vite plugin is required but not obvious
**Solution**: Explicitly documented in setup steps

```json5
"2. Install Tailwind CSS v4 with @tailwindcss/vite plugin"
```

### 3. Multi-File Coordination

**Problem**: Path aliases must be in 3 places
**Solution**: Explicitly listed in principles

```json5
"4. Path aliases (@/*) must be configured in BOTH tsconfig.json AND tsconfig.app.json AND bundler config"
```

### 4. Immutable Settings

**Problem**: Some settings can't be changed after init
**Solution**: Documented in considerations

```json5
"Base color and cssVariables settings cannot be changed after init"
```

### 5. Framework Philosophy

**Problem**: shadcn is different from typical libraries
**Solution**: Explained in spawnerPrompt

```json5
"shadcn/ui is NOT a component library - it's a code distribution platform where components are copied into your project as source code, not installed as dependencies"
```

## Design Patterns

### Pattern 1: Explicit Version Callouts

❌ Bad:
```json5
"tech_stack": ["Tailwind CSS"]
```

✅ Good:
```json5
"tech_stack": ["Tailwind CSS v4"]
"3. Tailwind CSS v4 uses @import syntax..."
```

**Why**: Removes ambiguity about which version's behavior to follow

### Pattern 2: Step-by-Step Instructions

❌ Bad:
```json5
"project_setup": "Set up the project with Tailwind and shadcn"
```

✅ Good:
```json5
"project_setup": "I'll set up...\n\n1. Create project\n2. Install X\n3. Configure Y\n4. ..."
```

**Why**: Reduces chance of skipped steps or incorrect order

### Pattern 3: Gotcha Documentation

❌ Bad:
```json5
"considerations": ["Works with Vite"]
```

✅ Good:
```json5
"considerations": [
  "Tailwind CSS v4 has different configuration than v3 (@import vs directives)",
  "Path aliases must be configured in BOTH tsconfig files AND bundler config"
]
```

**Why**: Encodes the mistakes that generic LLMs make

### Pattern 4: Official Documentation Links

❌ Bad:
```json5
"documentation": ["Check the shadcn docs"]
```

✅ Good:
```json5
"documentation": [
  {
    "type": "official",
    "url": "https://ui.shadcn.com/docs/installation/vite",
    "description": "Vite installation guide"
  }
]
```

**Why**: Provides authoritative source, enables future updates

## Extending the Template

### Adding New Framework Support

To add Next.js support:

1. Add to tech_stack:
   ```json5
   "tech_stack": ["Next.js 15", ...]
   ```

2. Add capability:
   ```json5
   "nextjs-setup": "Configure Next.js projects with App Router and shadcn/ui"
   ```

3. Add model-specific prompt:
   ```json5
   "nextjs_setup": "I'll set up Next.js with shadcn/ui...\n\n1. Create Next.js app\n2. ..."
   ```

4. Add documentation:
   ```json5
   {
     "url": "https://ui.shadcn.com/docs/installation/next",
     "description": "Next.js installation guide"
   }
   ```

### Updating for New Versions

When Tailwind v5 releases:

1. Update tech_stack version numbers
2. Update syntax in spawnerPrompt
3. Update setup steps with new commands
4. Add migration guide in considerations
5. Test and update benchmarks

### Adding More Models

To optimize for gpt-4o:

1. Add model entry to preferred_models
2. Add model-specific prompts:
   ```json5
   "gpt-4o": {
     "spawnerPrompt": "You are a shadcn/ui expert...",
     "project_setup": "To set up shadcn with Vite..."
   }
   ```

Different models may prefer different instruction styles.

## Maintenance

### When to Update

- Framework releases new major version
- Documentation changes significantly
- New best practices emerge
- Generic LLM performance improves (base training updates)
- Benchmark results suggest improvements

### Version History

Track template versions:
- v0.0.1: Initial template (current)
- v0.1.0: After claude-sonnet-4.5 experiments
- v0.2.0: After multi-model testing
- v1.0.0: Production-ready snapshot with proven scores

### Testing Updates

After updating template:
1. Re-run specialist experiments
2. Compare new vs old scores
3. Verify improvements
4. Document changes

## From Template to Snapshot

This template becomes a snapshot when:

1. **Benchmarks Run**: Experiments executed with real LLMs
2. **Scores Calculated**: Success rates measured
3. **Weights Added**: preferred_models populated with actual performance data
4. **Proven Value**: Statistical validation of improvement

Example transformation:

**Template (now)**:
```json5
"preferred_models": [
  {"model": "claude-sonnet-4.5"}
]
```

**Snapshot (after experiments)**:
```json5
"preferred_models": [
  {
    "model": "claude-sonnet-4.5",
    "weight": 0.95,
    "benchmarks": {
      "project_setup": 1.00,          // 100% success
      "component_installation": 1.00,
      "configuration_accuracy": 1.00,
      "build_success": 1.00
    }
  }
]
```

## Key Takeaways

1. **Templates encode knowledge** that generic LLMs lack
2. **Step-by-step instructions** eliminate ambiguity
3. **Version-specific details** are critical for success
4. **Gotchas must be explicit** - don't assume LLM knows
5. **Structure matters** - follow schema for consistency
6. **Documentation links** provide authority and update path
7. **Model-specific prompts** optimize for different LLMs
8. **Benchmarks prove value** - template → snapshot transition

## References

- Inheritance model: `../INHERITANCE.md`
- Base template: `../@figma-research/base.json5`
- Example snapshot: `../generic_nx_snapshot_example.json5`
- Experiment results: `./experiments/`
- Control implementation: `./control/`
