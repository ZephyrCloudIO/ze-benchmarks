# shadcn-generate-vite Benchmark Suite

## Overview

This benchmark suite tests an AI agent's ability to generate a new shadcn/ui project from scratch using Vite as the bundler. It evaluates whether agents can correctly follow shadcn/ui documentation and best practices to set up a functional React project with proper tooling configuration.

## What This Benchmark Tests

This is a **generation test** (not a mutation test), meaning there is no starting repository fixture. The agent must create the entire project from scratch based on minimal instructions.

### Core Competencies Evaluated

1. **Bundler Configuration** (Vite)
   - Correct Vite setup with appropriate plugins
   - Proper integration with React and Tailwind CSS
   - Correct vite.config.ts configuration

2. **Package Management** (pnpm)
   - Using the correct package manager
   - Installing appropriate dependencies and versions
   - Proper package.json structure

3. **Styling Configuration** (Tailwind CSS)
   - Correct Tailwind CSS setup with @tailwindcss/vite plugin
   - Proper src/index.css configuration with @tailwind directives
   - Integration with shadcn/ui component system

4. **TypeScript Configuration**
   - Proper tsconfig.json setup
   - Correct tsconfig.app.json configuration
   - Type-safe component integration

5. **Component Integration** (shadcn/ui)
   - Successfully adding the button component
   - Proper component file structure (src/components/ui/)
   - Following shadcn/ui conventions

6. **Build Success**
   - The generated project must build without errors
   - All dependencies must be correctly resolved
   - Build output must be valid

## Why This Matters

Generating a new project from scratch is a common developer task that requires:
- Understanding of modern frontend tooling
- Knowledge of framework-specific best practices
- Ability to follow documentation accurately
- Integration of multiple tools and configurations

This benchmark specifically tests shadcn/ui project generation, which is a popular React component library that requires precise configuration of Vite, Tailwind CSS, and TypeScript.

## Prompt Tiers

### L0 - Minimal Context
```
Generate a new shadcn project, use vite and add the button component
```

This minimal prompt tests the agent's ability to:
- Discover requirements from minimal context
- Reference shadcn/ui documentation
- Make appropriate tool choices
- Configure everything correctly without explicit guidance

## Success Criteria

The benchmark evaluates success based on:

1. **Bundler** (Weight: 2.0)
   - Vite is used as the bundler
   - vite.config.ts exists and contains proper configuration
   - React and Tailwind plugins are configured

2. **Package Manager** (Weight: 1.5)
   - pnpm is used
   - Correct dependencies are installed
   - package.json is properly structured

3. **Styles** (Weight: 1.5)
   - src/index.css exists
   - Contains @tailwind directives
   - Properly imports Tailwind CSS

4. **TypeScript** (Weight: 1.5)
   - tsconfig.json exists
   - tsconfig.app.json exists
   - Both are properly configured

5. **Components** (Weight: 2.0)
   - Button component exists at src/components/ui/button.tsx
   - Component follows shadcn/ui structure
   - Properly integrated into the project

6. **Build** (Weight: 3.0)
   - `pnpm build` succeeds without errors
   - Build output is valid
   - All dependencies resolve correctly

7. **LLM Judge** (Weight: 1.0)
   - Overall code quality assessment
   - Best practices adherence
   - Documentation compliance

## Running This Benchmark

```bash
# From the ze-benchmarks directory
pnpm bench shadcn-generate-vite shadcn-generate-vite --tier L0 --agent anthropic

# Or from the root workspace
pnpm bench:shadcn
```

## Comparison Strategy

This benchmark is designed to compare:

1. **Vanilla Models**: Standard LLMs without specialist knowledge
2. **Shadcn Specialist**: Models augmented with shadcn-specific context and prompts
3. **Control**: Human-generated reference implementation

Results are scored using ze-benchmarks universal evaluators and LLM-as-judge assessment.

## Directory Structure

```
shadcn-generate-vite/
├── README.md                           # This file
├── prompts/
│   └── shadcn-generate-vite/
│       └── L0-minimal.md              # Minimal context prompt
└── scenarios/
    └── shadcn-generate-vite/
        ├── scenario.yaml              # Main benchmark configuration
        └── oracle-answers.json        # Expected agent responses
```

Note: There is no `repo-fixture/` directory because this is a generation test.

## Future Enhancements

Potential additions to this benchmark suite:

1. **Additional Prompt Tiers**
   - L1: Basic context with more guidance
   - L2: Detailed step-by-step instructions
   - L3: Migration-specific scenarios

2. **More Components**
   - Test adding multiple shadcn components
   - Test component customization
   - Test theme configuration

3. **Advanced Scenarios**
   - Dark mode configuration
   - Custom component variants
   - Integration with routing (React Router)

4. **MCP Integration**
   - Test with shadcn MCP server enabled
   - Evaluate enhanced capabilities with MCP

## Related Files

- `starting_from_outcome/task.md` - Original task definition
- `starting_from_outcome/shadcn-specialist.json5` - Specialist template
- `starting_from_outcome/control/` - Reference implementation
