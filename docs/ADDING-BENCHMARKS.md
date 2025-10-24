# Adding Benchmarks

This guide explains how to create and contribute new benchmarks to the ze-benchmarks system.

## Overview

Benchmarks are structured tests that evaluate AI agents' ability to perform specific tasks. Each benchmark consists of:

- **Scenarios**: Specific tasks within a domain (e.g., "update dependencies")
- **Prompts**: Different levels of instruction detail (L0-L3, Lx)
- **Evaluators**: Automated scoring mechanisms
- **Fixtures**: Starting repository states for testing

## Directory Structure

```
suites/
  <suite-name>/                    # Domain grouping (e.g., "dependency-management")
    prompts/
      <scenario-name>/             # Task-specific prompts
        L0-minimal.md             # Minimal context prompt
        L1-basic.md               # Basic context prompt  
        L2-directed.md            # Detailed guidance prompt
        L3-migration.md           # (optional) Migration-specific
        Lx-adversarial.md         # (optional) Edge cases
      policy.yaml                 # (optional) Suite-level policies
    scenarios/
      <scenario-name>/            # Task configuration
        scenario.yaml             # Main configuration
        oracle-answers.json       # Expected agent responses
        repo-fixture/             # Starting repository state
```

## Required Files

### 1. scenario.yaml
The main configuration file defining the benchmark scenario.

**Required fields:**
- `id`: Unique identifier for the scenario
- `suite`: Parent suite name
- `workspace`: Node version and package manager settings
- `baseline`: Commands to run before agent execution
- `validation`: Commands to verify success

**Optional fields:**
- `title`: Human-readable title
- `description`: Detailed description
- `constraints`: Package restrictions and rules
- `targets`: Dependencies to update
- `oracle`: Expected agent responses
- `llm_judge`: AI-powered evaluation settings
- `rubric_overrides`: Custom scoring weights

### 2. Oracle Answers (oracle-answers.json)
Expected responses to common agent questions, used for validation.

```json
{
  "question_key": "Expected response to this question",
  "another_question": "Another expected response"
}
```

### 3. Repository Fixture (repo-fixture/)
Starting state of the repository before agent execution.

**Structure:**
```
repo-fixture/
  package.json                    # Root package.json
  apps/
    app/
      package.json               # App-specific dependencies
  libs/
    util/
      package.json               # Library dependencies
  pnpm-workspace.yaml            # Workspace configuration
```

### 4. Prompt Files
Different instruction levels for testing agent adaptability.

- **L0-minimal.md**: Bare minimum context
- **L1-basic.md**: Standard user scenario
- **L2-directed.md**: Detailed guidance
- **L3-migration.md**: (optional) Migration-specific
- **Lx-adversarial.md**: (optional) Edge cases

## Step-by-Step Tutorial

### Step 1: Choose Your Domain
Select a domain for your benchmark suite (e.g., "dependency-management", "code-migration", "testing").

### Step 2: Create Suite Structure
```bash
mkdir -p suites/my-suite/prompts/my-scenario
mkdir -p suites/my-suite/scenarios/my-scenario
```

### Step 3: Write scenario.yaml
Create the main configuration file:

```yaml
id: my-scenario
suite: my-suite
title: "Update React Dependencies"
description: |
  Update React and related dependencies while maintaining compatibility
  and following best practices.

workspace:
  node: "18.20.x"
  manager: auto
  managers_allowed: [pnpm]
  workspaces: pnpm

baseline:
  run:
    - cmd: "pnpm install"
    - cmd: "pnpm test"

constraints:
  blocklist:
    - name: "webpack"
      reason: "Pinned by build system"
  companion_versions:
    - main: "react"
      companions:
        - name: "@types/react"
          rule: "major must match"

targets:
  required:
    - name: "react"
      to: "^18.3.0"
  optional:
    - name: "eslint"
      to: "^9"

validation:
  commands:
    install: "pnpm install"
    test: "pnpm test"
    lint: "pnpm lint"

oracle:
  answers_file: "./oracle-answers.json"

llm_judge:
  enabled: true
  model: "anthropic/claude-3.5-sonnet"
  temperature: 0.1
  max_tokens: 2000

rubric_overrides:
  weights:
    install_success: 1.0
    tests_nonregression: 1.5
    manager_correctness: 1.0
    dependency_targets: 1.0
    llm_judge: 1.0
```

### Step 4: Create Oracle Answers
Define expected responses to common questions:

```json
{
  "should_i_update_to_react_19": "No, stay on React 18.x for compatibility",
  "how_to_handle_breaking_changes": "Update incrementally and test thoroughly",
  "which_packages_to_update": "Update React, @types/react, and related packages"
}
```

### Step 5: Set Up Repository Fixture
Create a minimal but realistic starting repository:

```
repo-fixture/
  package.json
  apps/
    my-app/
      package.json
      src/
        App.tsx
  libs/
    shared/
      package.json
      src/
        utils.ts
  pnpm-workspace.yaml
```

### Step 6: Write Prompts
Create different instruction levels:

**L0-minimal.md:**
```markdown
Update the dependencies in this project.
```

**L1-basic.md:**
```markdown
This project needs its dependencies updated. Please update React and related packages to their latest compatible versions while ensuring the project still builds and tests pass.
```

**L2-directed.md:**
```markdown
Update the dependencies in this React monorepo:

1. Update React to the latest 18.x version
2. Update @types/react to match React version
3. Update other React-related packages
4. Ensure all tests pass
5. Maintain workspace structure

Constraints:
- Keep React on 18.x (not 19.x)
- Maintain TypeScript compatibility
- Preserve workspace configuration
```

### Step 7: Test Your Benchmark
Run your benchmark locally:

```bash
# Test with a specific agent
pnpm bench my-suite my-scenario --tier L1 --agent anthropic

# Test all tiers
pnpm bench my-suite my-scenario --tier L0,L1,L2 --agent anthropic
```

## Best Practices

### Scenario Design
- **Realistic**: Use real-world scenarios that developers face
- **Specific**: Clear success criteria and constraints
- **Reproducible**: Consistent results across runs
- **Challenging**: Test agent capabilities, not just basic tasks

### Prompt Writing
- **L0**: Test agent's ability to discover requirements
- **L1**: Standard user scenario with reasonable context
- **L2**: Detailed guidance for complex tasks
- **L3**: Specific migration or upgrade scenarios
- **Lx**: Edge cases and adversarial scenarios

### Repository Fixtures
- **Minimal**: Include only necessary files
- **Realistic**: Use real package.json structures
- **Complete**: Ensure the fixture can be built and tested
- **Isolated**: Avoid external dependencies when possible

### Oracle Answers
- **Comprehensive**: Cover common agent questions
- **Specific**: Provide clear, actionable responses
- **Realistic**: Use responses a human expert would give
- **Consistent**: Align with scenario constraints

## Testing Your Benchmark

### Local Testing
```bash
# Test with different agents
pnpm bench my-suite my-scenario --agent anthropic
pnpm bench my-suite my-scenario --agent claude

# Test different tiers
pnpm bench my-suite my-scenario --tier L0,L1,L2

# Test batch execution
pnpm bench my-suite my-scenario --batch
```

### Validation Checklist
- [ ] All required files present
- [ ] scenario.yaml validates
- [ ] Repository fixture builds successfully
- [ ] Validation commands work
- [ ] Oracle answers are comprehensive
- [ ] Prompts are clear and appropriate
- [ ] Tested with multiple agents
- [ ] Tested with multiple tiers

## Common Patterns

### Dependency Updates
Focus on realistic dependency management scenarios:
- Version compatibility constraints
- Breaking change handling
- Workspace coordination
- Testing after updates

### Code Migrations
Test agent's ability to perform code transformations:
- Framework migrations
- API updates
- Configuration changes
- Test updates

### Monorepo Management
Complex scenarios involving multiple packages:
- Cross-package dependencies
- Workspace coordination
- Build system integration
- Testing strategies

## Troubleshooting

### Common Issues
- **Scenario not loading**: Check YAML syntax and required fields
- **Repository fixture issues**: Ensure all files are present and valid
- **Validation failures**: Verify commands work in the fixture
- **Oracle mismatches**: Update answers to match expected responses

### Getting Help
- Check existing benchmarks for examples
- Review the configuration reference
- Test with minimal scenarios first
- Ask for feedback on your design

## Next Steps

1. **Review**: Have others review your benchmark design
2. **Test**: Run with multiple agents and tiers
3. **Refine**: Improve based on test results
4. **Document**: Add clear documentation and examples
5. **Submit**: Create a pull request with your benchmark

Remember: Good benchmarks are realistic, challenging, and provide clear value for evaluating AI agents.
