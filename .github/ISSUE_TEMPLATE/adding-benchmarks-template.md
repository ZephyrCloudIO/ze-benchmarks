---
name: Adding Benchmarks template
about: Adding new Benchmarks suites and scenarios
title: "[BENCHMARKS]"
labels: ''
assignees: ''

---

# New Benchmark Proposal

Thank you for proposing a new benchmark! This template will help us understand your proposal and ensure it meets our quality standards.

## What is Being Added

**Suite Name:** `<your-suite-name>`

**Scenario Name(s):** `<your-scenario-name>`

**Brief Description:** 
Describe what this benchmark tests and why it's valuable for evaluating AI agents.

**Number of Scenarios:** `<number>`

## Objective Goal (Optional)

What specific capability or task are you trying to evaluate?

Examples:
- Dependency updates and compatibility management
- Code migrations between frameworks
- Refactoring and code quality improvements
- Testing framework integration
- Build system configuration

## Validation & Testing

Please provide the specific commands you used to test your benchmark:

**Test Commands Used:**
```bash
# Test with echo agent first
pnpm bench <suite-name> <scenario-name> L1 echo

# Test with anthropic agent
pnpm bench <suite-name> <scenario-name> L1 anthropic

# Test all tiers (if applicable)
pnpm bench <suite-name> <scenario-name> --batch echo
```

**Testing Results:**
- [ ] Echo agent completed successfully
- [ ] Anthropic agent completed successfully  
- [ ] All validation commands passed
- [ ] Repository fixture builds correctly

## Scenario Configuration (scenario.yaml)

Please provide your scenario.yaml configuration:

```yaml
id: "<scenario-id>"
suite: "<suite-name>"
title: "<human-readable-title>"
description: |
  Detailed description of what this scenario tests
  and the expected outcomes.

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
    - name: "<package-name>"
      reason: "<reason-for-blocking>"
  companion_versions:
    - main: "<main-package>"
      companions:
        - name: "<companion-package>"
          rule: "major must match"

targets:
  required:
    - name: "<package-name>"
      to: "<target-version>"
  optional:
    - name: "<optional-package>"
      to: "<target-version>"

validation:
  commands:
    install: "pnpm install"
    build: "pnpm run build"
    test: "pnpm test"
    lint: "pnpm run lint"
    typecheck: "tsc --noEmit"

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

## Repository Fixture Structure

Describe your repository fixture structure:

**Directory Layout:**
```
repo-fixture/
├── package.json                    # Root package.json
├── <config-files>                  # (e.g., tsconfig.json, vite.config.ts)
├── src/                           # Source files
│   ├── <main-files>               # (e.g., App.tsx, index.tsx)
│   └── <additional-files>          # (e.g., components/, utils/)
└── <other-files>                   # (e.g., README.md, .gitignore)
```

**Key Files Included:**
- [ ] package.json with outdated dependencies
- [ ] Source code files
- [ ] Configuration files (tsconfig, build configs, etc.)
- [ ] Test files (if applicable)

**Intentional Issues:**
Describe what outdated dependencies or issues you've included:
- `<package-name>`: `<current-version>` → `<target-version>` (reason)
- `<other-issues>`: `<description>`

## Prompt Tier Content

Provide examples of your prompt content for each tier you need not stick to it but these are our best practices:

### L0 - Minimal Context
```
<single-sentence-minimal-instruction>
```

### L1 - Basic Context  
```
<paragraph-with-basic-requirements-and-context>
```

### L2 - Directed Guidance
```
<detailed-numbered-instructions-with-specific-requirements>

1. <specific-task-1>
2. <specific-task-2>
3. <specific-task-3>

Constraints:
- <constraint-1>
- <constraint-2>
```

## Oracle Answers (Optional)

If applicable, describe what questions the agent might ask and expected responses:

```json
{
  "question_key_1": "Expected response to this question",
  "question_key_2": "Another expected response",
  "question_key_3": "Response for common scenario"
}
```

## Additional Information

**Complexity Level:**
- [ ] Beginner (simple dependency updates)
- [ ] Intermediate (framework migrations)
- [ ] Advanced (complex refactoring)

**Estimated Completion Time:**
- [ ] < 30 minutes
- [ ] 30-60 minutes  
- [ ] 1-2 hours
- [ ] > 2 hours

**Related Benchmarks:**
Are there existing benchmarks this relates to or builds upon?

## Pre-Submission Checklist

Before submitting, please ensure:

- [ ] Repository fixture is realistic and complete
- [ ] Tested with at least one agent (echo or anthropic)
- [ ] Prompts are clear and appropriate for each tier
- [ ] Validation commands work correctly
- [ ] Documentation is clear and complete
- [ ] scenario.yaml validates without errors
- [ ] Oracle answers are comprehensive (if applicable)

## Next Steps

After submitting this proposal:

1. **Review**: Maintainers will review your proposal within 1-2 business days
2. **Feedback**: You may receive feedback on design, testing, or implementation
3. **Implementation**: Once approved, you can create a pull request with your benchmark
4. **Integration**: Your benchmark will be integrated into the main suite

## Resources

- **[Contributing Guide](../CONTRIBUTING.md)** - Complete contribution guidelines
- **[Adding Benchmarks](../docs/ADDING-BENCHMARKS.md)** - Detailed benchmark creation guide
- **[Benchmark Checklist](../docs/BENCHMARK-CHECKLIST.md)** - Quality validation checklist

---

Thank you for contributing to ze-benchmarks! Your proposal helps make AI agent evaluation more comprehensive and useful for the entire community.
