# Experiments

## Overview

This directory contains the experimental results from testing the outcome-driven persona validation hypothesis. Each subdirectory represents tests with a specific AI model, comparing generic LLM performance against specialist LLM performance on the same task.

## Directory Structure

```
experiments/
├── README.md                          # This file
├── FINAL_COMPARISON.md               # Complete analysis across all approaches
└── claude-sonnet-4.5/
    ├── generic/                       # Generic LLM without specialist knowledge
    │   ├── EXPERIMENT_INSTRUCTIONS.md # How to run the generic experiment
    │   ├── EXPERIMENT_RESULTS.md      # Results and analysis
    │   └── shadcn-generic/           # Generated project (incomplete, build fails)
    └── specialist/                    # Specialist LLM with domain knowledge
        ├── EXPERIMENT_INSTRUCTIONS.md # How to run the specialist experiment
        ├── EXPERIMENT_RESULTS.md      # Results and analysis
        └── shadcn-specialist/        # Generated project (complete, builds successfully)
```

## Experiment Design

### Task
**Prompt**: "Generate a new shadcn project, use vite and add the button component"

### Models Tested
- claude-sonnet-4.5 (completed)
- claude-sonnet-3.5 (planned)
- gpt-4o (planned)

### Approaches

#### 1. Generic LLM
- **Setup**: Fresh LLM session with NO specialist knowledge
- **Input**: Only the task prompt
- **Purpose**: Establish baseline performance using general training data
- **Expected**: Some success, but likely missing version-specific details

#### 2. Specialist LLM
- **Setup**: Fresh LLM session with specialist template loaded
- **Input**: Specialist `spawnerPrompt` + task prompt
- **Purpose**: Test if domain-specific knowledge improves performance
- **Expected**: Higher success rate due to targeted knowledge

### Measurement Criteria

Both approaches are measured against the control implementation across 20 criteria in 6 categories:

1. **Bundler** (4 criteria)
   - Vite version
   - tailwindcss plugin configuration
   - Path alias configuration

2. **Package Manager** (3 criteria)
   - Correct manager used
   - tailwindcss installation
   - @tailwindcss/vite plugin installation

3. **Styles** (3 criteria)
   - index.css configuration
   - Correct v4 syntax
   - CSS variables

4. **Types** (3 criteria)
   - tsconfig.json path aliases
   - tsconfig.app.json path aliases
   - @types/node installation

5. **Components** (4 criteria)
   - shadcn initialization
   - Button component addition
   - components.json creation
   - utils.ts creation

6. **Build** (3 criteria)
   - Build success
   - No TypeScript errors
   - No build warnings

## Results Summary

### claude-sonnet-4.5

| Approach | Success Rate | Build Status | Key Issues |
|----------|--------------|--------------|------------|
| Generic | 65% (13/20) | ❌ Fails | Missing @tailwindcss/vite, wrong CSS syntax, incomplete vite config |
| Specialist | 100% (20/20) | ✅ Succeeds | None - perfect match with control |

**Improvement**: +35 percentage points with specialist knowledge

### Key Findings

**What Generic Missed**:
1. @tailwindcss/vite plugin requirement
2. Tailwind v4 syntax (@import vs @tailwind)
3. Complete vite.config.ts configuration
4. Version-specific setup differences

**What Specialist Got Right**:
1. All package dependencies correct
2. Proper v4 syntax throughout
3. Complete configuration files
4. Zero errors, immediate success

## File Descriptions

### EXPERIMENT_INSTRUCTIONS.md
Located in each approach folder (generic/specialist)

Contains:
- Experiment setup instructions
- Exact prompt to use
- Documentation requirements
- Success criteria checklist
- Files to capture
- Comparison methodology

**Purpose**: Enables replication of experiments

### EXPERIMENT_RESULTS.md
Located in each approach folder (generic/specialist)

Contains:
- Steps executed by the LLM
- Errors encountered
- Success criteria evaluation
- Comparison to control
- Time/efficiency metrics
- Summary and insights

**Purpose**: Documents actual experiment outcomes

### FINAL_COMPARISON.md
Located in experiments root

Contains:
- Executive summary
- Detailed comparison matrix
- Configuration file comparisons
- Build outcome analysis
- Success criteria breakdown
- Overall scores
- Key insights and conclusions
- Recommendations

**Purpose**: Comprehensive analysis across all approaches

## Methodology Notes

### Why Three-Way Comparison?

1. **Control**: Provides objective ground truth
2. **Generic**: Establishes baseline LLM capability
3. **Specialist**: Tests hypothesis about domain knowledge value

This design isolates the variable we're testing (specialist knowledge) while controlling for:
- Task complexity (same task for all)
- Model capability (same model)
- Success criteria (same for all)

### Measurement Approach

**Objective Criteria**: Build success/failure is binary and objective

**Granular Scoring**: 20 specific criteria allow us to see WHERE improvements occur, not just IF they occur

**Functional Equivalence**: We compare functional outcomes (does it work?) rather than exact code matches

### Fair Comparison

**Same Starting Point**:
- Fresh LLM session for both
- Same initial prompt
- Same model (claude-sonnet-4.5)

**Only Difference**:
- Generic has no specialist knowledge
- Specialist has domain-specific template loaded

**Objective Measurement**:
- Both measured against human-created control
- Binary pass/fail for each criterion
- No subjective judgment

## Replication Guide

To replicate these experiments:

### 1. Set Up Control
```bash
cd ../control/
# Follow official docs to create control
# Document exact steps and versions
```

### 2. Run Generic Experiment
```bash
cd experiments/[model-name]/generic/
# Start fresh LLM session
# Provide ONLY: "Generate a new shadcn project, use vite and add the button component"
# Let LLM work independently
# Document everything
```

### 3. Run Specialist Experiment
```bash
cd experiments/[model-name]/specialist/
# Start fresh LLM session
# Load specialist template spawnerPrompt
# Provide same task prompt
# Document everything
```

### 4. Compare Results
```bash
# Check each of 20 criteria against control
# Calculate success rates
# Document differences
# Analyze improvement
```

## Future Experiments

### Additional Models to Test
- claude-sonnet-3.5
- gpt-4o
- gpt-4-turbo
- gemini-2.0-flash

### Additional Scenarios
- Next.js 15 App Router setup
- Remix with Vite
- Component variations (forms, cards, dialogs)
- Dark mode implementation
- Multiple components

### Template Iterations
- v1.0: Initial template (current)
- v1.1: Based on findings from claude-sonnet-4.5
- v1.2: Based on findings from other models
- v2.0: Comprehensive update after all experiments

## Analysis Tools

### Planned Integrations
- ze-benchmarks automated scoring
- Statistical significance testing
- Trend analysis across models
- Template version comparison

## Learnings

### What Makes a Good Experiment
1. **Clear success criteria** - Binary pass/fail is better than subjective
2. **Objective ground truth** - Human-created control removes bias
3. **Isolated variable** - Only difference is specialist knowledge
4. **Reproducible** - Detailed documentation enables replication
5. **Measurable** - Quantitative metrics allow comparison

### What Doesn't Work
1. **Subjective evaluation** - "Looks good" isn't measurable
2. **Single-criterion tests** - Miss where improvements occur
3. **No control group** - Can't tell if specialist actually helps
4. **Vague tasks** - Hard to measure success
5. **Moving targets** - Control must be stable

## Contributors

This experiment structure was designed to validate the outcome-driven persona creation methodology as part of the Figma Research project.

## References

- Main README: `../README.md`
- Control implementation: `../control/`
- Specialist template: `../shadcn-specialist.json5`
- Task definition: `../task.md`
