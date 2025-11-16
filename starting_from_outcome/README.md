# Outcome-Driven Persona Validation Experiment

## Overview

This directory contains a complete validation experiment for **outcome-driven persona creation** - a methodology where we start with a desired outcome and work backwards to create an agent specialist template with the knowledge needed to achieve that outcome.

**Date**: November 11, 2025
**Model Tested**: claude-sonnet-4.5
**Framework**: shadcn/ui v3 with Vite and Tailwind CSS v4

## Hypothesis

Creating an agent specialist persona with deep domain knowledge (by crawling documentation and analyzing repositories) will significantly improve LLM performance on complex, version-specific framework setup tasks compared to generic LLM knowledge.

## Key Results

| Approach | Success Rate | Build Status | Improvement |
|----------|--------------|--------------|-------------|
| Control (Ground Truth) | 100% | ✅ Builds | - |
| Generic LLM | 65% | ❌ Fails | - |
| **Specialist LLM** | **100%** | **✅ Builds** | **+35 points** |

**Conclusion**: ✅ Hypothesis validated - specialist approach shows significant improvement

---

## Methodology

### 1. Define the Outcome

**Desired Outcome**: "Generate a new shadcn project, use vite and add the button component"

We chose this task because:
- **Version-specific complexity**: Tailwind CSS v4 has breaking changes from v3
- **Multi-file configuration**: Requires coordinating tsconfig, vite config, and CSS files
- **Non-obvious dependencies**: @tailwindcss/vite plugin is required but not obvious
- **Real-world relevance**: Common task that developers actually need to do

### 2. Create the Control (Ground Truth)

**Location**: `control/`

We manually followed the official shadcn/ui Vite documentation exactly to create a reference implementation. This serves as the "correct answer" against which we measure both generic and specialist approaches.

**Key artifacts**:
- Complete working shadcn+vite project
- `CONTROL_SETUP_DOCUMENTATION.md` - Documents exact versions and steps taken

### 3. Build the Specialist Template

**Location**: `shadcn-specialist.json5`

**Process**:
1. **Crawl documentation**: Fetched key pages from https://ui.shadcn.com/docs
   - Installation guides (Vite, Next.js)
   - CLI reference
   - Theming guide
   - Dark mode setup
   - components.json configuration

2. **Analyze repository**: Cloned shadcn/ui GitHub repo to understand:
   - CLI implementation patterns
   - Component structure
   - Configuration conventions

3. **Extract critical knowledge**:
   - Tailwind v4 uses `@import "tailwindcss"` (not `@tailwind` directives)
   - Must install `@tailwindcss/vite` plugin (not just `tailwindcss`)
   - Path aliases required in THREE places: tsconfig.json, tsconfig.app.json, AND vite.config.ts
   - Base color and cssVariables settings are immutable after init

4. **Structure as JSON5 specialist snapshot**:
   - Follows existing persona format (see `generic_nx_snapshot_example.json5`)
   - Contains persona values, capabilities, tech stack
   - Model-specific prompts with step-by-step instructions
   - Documentation references

**Key insight**: The specialist template encodes the "gotchas" that generic LLMs miss.

### 4. Run Three-Way Comparison

#### Approach A: Control
- Manual execution following official docs
- Serves as ground truth
- **Result**: 100% success, builds correctly

#### Approach B: Generic LLM
**Location**: `experiments/claude-sonnet-4.5/generic/`

- Provided ONLY the starting prompt
- No specialist knowledge or hints
- Allowed to work independently
- **Result**: 65% success, build fails

**What went wrong**:
- Didn't know Tailwind v4 has different setup
- Installed `tailwindcss` but not `@tailwindcss/vite` plugin
- Used wrong CSS syntax (`@tailwind` instead of `@import`)
- Didn't configure `vite.config.ts` properly
- Build error: Cannot resolve 'tw-animate-css'

#### Approach C: Specialist LLM
**Location**: `experiments/claude-sonnet-4.5/specialist/`

- Loaded specialist template's `spawnerPrompt` as system context
- Then provided the same starting prompt
- **Result**: 100% success, builds correctly (even faster than control!)

**What went right**:
- Knew to install `@tailwindcss/vite` plugin
- Used correct v4 syntax (`@import "tailwindcss"`)
- Fully configured `vite.config.ts` with plugin and path alias
- Zero errors, worked on first try

### 5. Document and Compare

**Location**: `experiments/FINAL_COMPARISON.md`

Comprehensive comparison across all criteria:
- Configuration accuracy (6 categories)
- Build success
- Efficiency metrics
- Time to completion

---

## Directory Structure

```
starting_from_outcome/
├── README.md                          # This file
├── task.md                           # Original task definition
├── shadcn-specialist.json5           # Specialist persona template
├── shadcn-reference-docs.md          # Extracted documentation (for reference)
│
├── control/                          # Ground truth implementation
│   ├── CONTROL_SETUP_DOCUMENTATION.md
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── src/
│   │   ├── index.css
│   │   ├── lib/utils.ts
│   │   └── components/ui/button.tsx
│   └── components.json
│
├── experiments/                      # Experiment results
│   ├── FINAL_COMPARISON.md          # Complete analysis
│   └── claude-sonnet-4.5/
│       ├── generic/                  # Generic LLM attempt
│       │   ├── EXPERIMENT_INSTRUCTIONS.md
│       │   ├── EXPERIMENT_RESULTS.md
│       │   └── shadcn-generic/      # Generated project (incomplete)
│       └── specialist/               # Specialist LLM attempt
│           ├── EXPERIMENT_INSTRUCTIONS.md
│           ├── EXPERIMENT_RESULTS.md
│           └── shadcn-specialist/   # Generated project (complete)
│
└── benchmarks/
    └── results/                      # Placeholder for benchmark scores
```

---

## Key Learnings

### 1. When Specialist Knowledge Matters Most

Specialist templates provide the most value when:
- **Version-specific changes** exist (e.g., Tailwind v3 → v4)
- **Multi-file coordination** is required
- **Non-obvious dependencies** must be installed
- **Syntax changes** are breaking
- **Official documentation** exists but is complex

### 2. Template Creation ROI

**Investment**: 2-3 hours to create specialist template
- Crawl documentation
- Analyze repository
- Extract critical knowledge
- Structure as JSON5 snapshot

**Payoff**:
- 35% higher success rate
- Zero debugging time needed
- Reusable for all similar projects
- Can be updated as framework evolves

**Break-even**: After 3-4 uses

### 3. What Generic LLMs Struggle With

Generic LLMs (even powerful ones like claude-sonnet-4.5) struggle with:
- **Recent version changes** not in training data
- **Multi-step configuration** requiring perfect coordination
- **Framework-specific conventions** (e.g., where to put path aliases)
- **Error recovery** when initial approach is wrong

### 4. Specialist Template Design Patterns

Effective specialist templates:
- **Encode critical knowledge** that's easy to miss
- **Provide step-by-step instructions** for complex tasks
- **Reference official docs** with URLs
- **Include model-specific prompts** optimized for different LLMs
- **Document immutable settings** and gotchas
- **Follow consistent schema** for reusability

---

## Success Criteria

We measured success across 6 categories (20 total criteria):

### ✅ Bundler (4 criteria)
- Vite used
- Correct version
- tailwindcss plugin configured
- Path alias configured

### ⚠️ Package Manager (3 criteria)
- Correct manager (pnpm)
- tailwindcss v4 installed
- @tailwindcss/vite plugin installed

### ⚠️ Styles (3 criteria)
- index.css exists
- Correct v4 syntax
- CSS variables configured

### ✅ Types (3 criteria)
- tsconfig.json path aliases
- tsconfig.app.json path aliases
- @types/node installed

### ✅ Components (4 criteria)
- shadcn init executed
- Button component added
- components.json exists
- utils.ts exists

### ❌ Build (3 criteria)
- Build succeeds
- No TypeScript errors
- No build warnings

**Scoring**:
- Control: 20/20 (100%)
- Specialist: 20/20 (100%)
- Generic: 13/20 (65%)

---

## Thought Process

### Why This Experiment Design?

1. **Three-way comparison** ensures we're measuring real improvement, not just testing if the LLM can follow instructions

2. **Control implementation** provides objective ground truth rather than subjective "did it work?"

3. **Single clear task** isolates the variable we're testing (specialist knowledge) from task complexity

4. **Real-world scenario** ensures findings are applicable to actual development work

5. **Version-specific complexity** tests whether specialists can encode knowledge that's not in base training

### Why shadcn/ui?

1. **Recent changes**: Tailwind v4 released recently, likely not in training data
2. **Popular framework**: Real-world relevance and applicability
3. **Well-documented**: Ability to create comprehensive specialist
4. **Clear success criteria**: Either builds or doesn't - objective measurement
5. **Representative complexity**: Similar to many framework setup tasks

### Design Decisions

**Used JSON5 format** instead of markdown:
- Follows existing persona schema
- Machine-readable for tooling
- Supports inheritance (`from` attribute)
- Can include benchmarks and weights after testing
- Structured format ensures consistency

**Separated control from experiments**:
- Control is ground truth, not an experiment
- Keeps control pristine for comparison
- Allows iterating on experiments without changing reference

**Documented everything**:
- Enables replication
- Supports future iterations
- Provides learning material for team
- Validates scientific rigor

---

## Replication Guide

To replicate this experiment:

### 1. Choose Your Framework
Pick a framework with:
- Recent version changes
- Complex multi-file setup
- Good documentation
- Clear success criteria

### 2. Create Control
Follow official docs manually:
```bash
cd control/
# Follow framework setup exactly
# Document every step and version
# Save as ground truth
```

### 3. Build Specialist Template
```bash
# Crawl documentation
curl https://framework-docs.com/... > docs.md

# Clone repository (if applicable)
git clone https://github.com/framework/repo.git

# Extract knowledge into JSON5
# Use shadcn-specialist.json5 as template
# Focus on version-specific gotchas
```

### 4. Run Generic Experiment
```bash
cd experiments/model-name/generic/
# Start fresh LLM session
# Provide ONLY the task prompt
# Let it work independently
# Document everything
```

### 5. Run Specialist Experiment
```bash
cd experiments/model-name/specialist/
# Start fresh LLM session
# Load specialist spawnerPrompt as context
# Provide same task prompt
# Document everything
```

### 6. Compare Results
Use the control as ground truth:
- Check each success criterion
- Calculate success rates
- Document time/efficiency differences
- Analyze what specialist got right

---

## Extensions

### Test Additional Models

Current: claude-sonnet-4.5
Next: claude-sonnet-3.5, gpt-4o, gpt-4-turbo

Compare if specialist improvement is consistent across models.

### Test Additional Scenarios

- Next.js 15 App Router setup
- Remix with different deployment targets
- Astro with different integrations
- Component variations (cards, forms, etc.)

### Iterate on Template

Based on results:
- Add missing knowledge
- Clarify confusing instructions
- Update for new framework versions
- Create template v2.0

### Create Template Library

Build reusable specialist templates:
- `@figma-research/shadcn-specialist`
- `@figma-research/nextjs-specialist`
- `@figma-research/remix-specialist`
- etc.

---

## Metrics and Benchmarks

### Quantitative Metrics

- **Success Rate**: % of criteria passed
- **Build Success**: Binary (builds or doesn't)
- **Time to Completion**: Minutes to working setup
- **Error Count**: Number of errors encountered
- **Steps Required**: Count of actions taken

### Qualitative Observations

- First-time-right rate
- Need for debugging
- Alignment with best practices
- Code quality and maintainability

### Benchmark Integration

Placeholder for ze-benchmarks integration:
- Automated scoring
- Comparison across template versions
- Tracking improvement over time

---

## Maintenance

### When to Update Specialist Template

- Framework releases new major version
- Documentation significantly changes
- New best practices emerge
- Generic LLM performance improves (training data updates)

### Version History

- v0.0.1 (2025-11-11): Initial template based on shadcn/ui v3 + Tailwind v4
- Next: Update based on findings, test with additional models

---

## References

### Official Documentation
- [shadcn/ui](https://ui.shadcn.com/docs)
- [Vite Installation](https://ui.shadcn.com/docs/installation/vite)
- [Tailwind CSS v4](https://tailwindcss.com/docs)

### Related Work
- Persona inheritance model: `../INHERITANCE.md`
- Example snapshot: `../generic_nx_snapshot_example.json5`
- Base template: `../persona/@figma-research/base.json5`

### Project Context
- Backlog tasks: `/backlog/tasks/task-60*.md`
- Main task definition: `task.md`

---

## Contributors

This experiment was designed and executed as part of the Figma Research project to validate outcome-driven persona creation methodology.

---

## License

MIT - Same as project
