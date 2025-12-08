# Heuristic Checks Guide

Heuristic checks are deterministic, hard-coded validation checks that complement LLM-based evaluation. Unlike LLM judges that provide subjective assessments, heuristic checks provide objective, repeatable validation for specific criteria.

## When to Use Heuristic Checks

Use heuristic checks when you need to verify:
- **Code scenarios**: Build succeeds, tests pass, linting passes
- **Design scenarios**: Specific colors are used, accessibility attributes exist
- **Product scenarios**: Required document sections exist, API specs are complete
- **File structure**: Required configuration files exist
- **Content validation**: Specific patterns or text appears in files

## Configuration

Add the `heuristic_checks` section to your `scenario.yaml`:

```yaml
heuristic_checks:
  enabled: true
  commands: [...]
  files: [...]
  patterns: [...]
  structured: [...]
  scripts: [...]
```

## Check Types

### 1. Command Checks

Run shell commands and verify they succeed (exit code 0).

**Use cases**: Build verification, test execution, linting, type checking

```yaml
commands:
  - name: "build_succeeds"
    command: "pnpm build"
    weight: 2.0
    description: "Verify build completes without errors"

  - name: "tests_pass"
    command: "pnpm test"
    weight: 2.0
    description: "Verify all tests pass"

  - name: "lint_passes"
    command: "pnpm lint"
    weight: 1.0
    description: "Code meets linting standards"
```

### 2. File Checks

Verify that specific files or directories exist.

**Use cases**: Configuration files, documentation, required project structure

```yaml
files:
  - name: "config_exists"
    path: "next.config.js"
    weight: 1.0
    description: "Next.js config file should exist"

  - name: "env_example_exists"
    path: ".env.example"
    weight: 0.5
    description: "Environment template should be provided"

  - name: "readme_exists"
    path: "README.md"
    weight: 0.5
    description: "Project documentation exists"
```

### 3. Pattern Checks

Search for regex patterns in files (supports glob patterns).

**Use cases**: Design systems (colors, themes), code patterns, accessibility attributes

```yaml
patterns:
  # Design: Check for specific colors
  - name: "uses_primary_color"
    file: "src/styles/**/*.{ts,tsx,css}"
    pattern: "#3B82F6|#2563EB|rgb\\(37,\\s*99,\\s*235\\)"
    weight: 1.5
    description: "Primary blue color is used"

  # Design: Dark mode implementation
  - name: "has_dark_mode"
    file: "src/**/*.{ts,tsx}"
    pattern: "dark:|darkMode:|theme\\.dark"
    weight: 1.0
    description: "Dark mode implementation exists"

  # Accessibility: Check for ARIA attributes
  - name: "uses_accessibility"
    file: "src/components/**/*.tsx"
    pattern: "aria-|role=|alt="
    weight: 1.0
    description: "Accessibility attributes present"

  # Code: Check for error handling
  - name: "has_error_handling"
    file: "src/**/*.ts"
    pattern: "try\\s*\\{|catch\\s*\\(|throw\\s+new"
    weight: 0.8
    description: "Error handling implemented"
```

### 4. Structured Checks

Validate JSON/YAML structure or check for sections in Markdown documents.

**Use cases**: API specs, package.json validation, documentation structure

```yaml
structured:
  # JSON Path checks
  - name: "package_has_test_script"
    file: "package.json"
    json_path: "$.scripts.test"
    exists: true
    weight: 1.0
    description: "Test script defined in package.json"

  - name: "api_spec_has_users_endpoint"
    file: "openapi.json"
    json_path: "$.paths./users.get"
    exists: true
    weight: 1.5
    description: "API spec defines GET /users endpoint"

  # Markdown section headers
  - name: "prd_has_security_section"
    file: "docs/PRD.md"
    section_header: "## Security Requirements"
    weight: 2.0
    description: "PRD includes security requirements"

  - name: "prd_has_testing_section"
    file: "docs/PRD.md"
    section_header: "## Testing Strategy"
    weight: 1.5
    description: "PRD documents testing approach"
```

### 5. Script Checks

Execute custom validation scripts with arguments.

**Use cases**: Complex validation logic, external API checks, custom business rules

```yaml
scripts:
  # Check Figma design
  - name: "figma_color_palette"
    script: "./scripts/check-figma-colors.js"
    args: ["--file-id", "${artifact.figma_file_id}"]
    weight: 1.5
    description: "Figma design uses correct color palette"

  # Validate component structure
  - name: "component_structure"
    script: "./scripts/validate-components.sh"
    args: ["src/components"]
    weight: 1.0
    description: "Components follow project conventions"

  # API health check
  - name: "api_reachable"
    script: "./scripts/check-api.sh"
    args: ["http://localhost:3000/health"]
    weight: 0.5
    description: "API is running and reachable"
```

## Template Variables

Script checks support template variable interpolation:

- `${artifact.figma_file_id}` - Figma file ID from scenario config
- `${artifact.figma_file_key}` - Figma file key from scenario config
- `${scenario.id}` - Scenario ID
- `${scenario.suite}` - Suite name

Example:
```yaml
scripts:
  - name: "check_figma"
    script: "./scripts/validate-figma.js"
    args:
      - "--file-id"
      - "${artifact.figma_file_id}"
      - "--scenario"
      - "${scenario.id}"
    weight: 2.0
```

## Weighting System

Each check has a `weight` parameter (default: 1.0) that determines its importance:

- **High weight (2.0+)**: Critical checks that must pass (builds, tests, required sections)
- **Medium weight (1.0-1.9)**: Important but not critical (linting, optional features)
- **Low weight (0.1-0.9)**: Nice-to-have checks (documentation, minor patterns)

The final heuristic_checks score is: `(sum of passed weights) / (sum of all weights)`

## Scoring Integration

Heuristic checks integrate with the overall scoring system:

```yaml
rubric_overrides:
  weights:
    heuristic_checks: 2.0  # How much heuristic checks contribute
    llm_judge: 3.0         # How much LLM judge contributes
```

The success metric combines both:
- If both are available: `(heuristic_checks + llm_judge) / 2`
- If only one is available: uses that score
- Benchmark passes if: critical commands pass AND success_metric >= 0.7

## Practical Examples

### Coding Scenario: Next.js Upgrade

```yaml
heuristic_checks:
  enabled: true

  commands:
    - name: "install_succeeds"
      command: "pnpm install"
      weight: 2.0
      description: "Dependencies install successfully"

    - name: "build_succeeds"
      command: "pnpm build"
      weight: 3.0
      description: "Production build completes"

    - name: "tests_pass"
      command: "pnpm test"
      weight: 2.0
      description: "Test suite passes"

  files:
    - name: "next_config_updated"
      path: "next.config.js"
      weight: 1.0
      description: "Next.js config exists"

  patterns:
    - name: "uses_app_router"
      file: "src/app/**/*.{ts,tsx}"
      pattern: "export default|export const"
      weight: 1.5
      description: "App Router patterns detected"
```

### Design Scenario: Component Library

```yaml
heuristic_checks:
  enabled: true

  patterns:
    - name: "primary_color_used"
      file: "src/components/**/*.{ts,tsx,css}"
      pattern: "#6366F1|rgb\\(99,\\s*102,\\s*241\\)"
      weight: 2.0
      description: "Primary indigo color used"

    - name: "dark_mode_support"
      file: "src/**/*.{ts,tsx}"
      pattern: "dark:|data-theme=\"dark\"|className.*dark"
      weight: 1.5
      description: "Dark mode implementation"

    - name: "accessibility_attrs"
      file: "src/components/**/*.tsx"
      pattern: "aria-label|aria-describedby|role="
      weight: 2.0
      description: "Accessibility attributes present"

  structured:
    - name: "theme_config_complete"
      file: "tailwind.config.js"
      section_header: "colors:"
      weight: 1.0
      description: "Theme colors configured"
```

### Product Scenario: PRD Creation

```yaml
heuristic_checks:
  enabled: true

  structured:
    - name: "problem_statement_exists"
      file: "PRD.md"
      section_header: "## Problem Statement"
      weight: 2.0
      description: "PRD defines the problem"

    - name: "success_metrics_defined"
      file: "PRD.md"
      section_header: "## Success Metrics"
      weight: 2.0
      description: "Success criteria documented"

    - name: "technical_requirements"
      file: "PRD.md"
      section_header: "## Technical Requirements"
      weight: 1.5
      description: "Technical specs included"

    - name: "security_considerations"
      file: "PRD.md"
      section_header: "## Security"
      weight: 1.5
      description: "Security requirements addressed"

  patterns:
    - name: "has_user_stories"
      file: "PRD.md"
      pattern: "As a.*I want.*so that"
      weight: 1.0
      description: "User stories included"
```

## Best Practices

1. **Start Simple**: Begin with command and file checks, add complexity as needed
2. **Weight Appropriately**: Critical checks should have higher weights
3. **Be Specific**: Use precise regex patterns to avoid false positives
4. **Combine with LLM Judge**: Use heuristic checks for objective criteria, LLM judge for subjective quality
5. **Test Your Checks**: Run them manually to ensure they work as expected
6. **Document Clearly**: Good descriptions help understand why checks failed
7. **Balance Coverage**: Don't over-specify—focus on what truly matters

## Debugging Failed Checks

When checks fail, the evaluator provides detailed output:

```
Heuristic Checks: 3/5 passed (score: 0.60)

✓ build_succeeds (weight: 2.0) - Verify build completes without errors
✓ tests_pass (weight: 2.0) - Verify all tests pass
✗ lint_passes (weight: 1.0) - Code meets linting standards
  Error: Command exited with code 1
✓ config_exists (weight: 1.0) - Next.js config file should exist
✗ uses_primary_color (weight: 1.5) - Primary blue color is used
  Error: Pattern not found in any matching files
```

Use this output to:
1. Identify which specific checks failed
2. Understand the weight impact on the score
3. Fix the underlying issues
4. Re-run the benchmark
