# Next.js Scenarios - Heuristic Checks Summary

This document summarizes the heuristic checks added to the first 3 Next.js scenarios.

## Overview

Each scenario now has deterministic validation checks that verify:
1. **Build Quality**: Install, build, test, and lint commands succeed
2. **Pattern-Specific Checks**: Scenario-specific code patterns are present

## Scenario 000: App Router Migration Simple

**File**: `suites/next.js/scenarios/000-app-router-migration-simple/scenario.yaml`

### Checks Added (Total: 10 checks)

#### Commands (4 checks, weight: 8.0)
- ✓ `install_succeeds` (2.0) - Dependencies install successfully
- ✓ `build_succeeds` (3.0) - Production build completes without errors
- ✓ `tests_pass` (2.0) - Test suite passes
- ✓ `lint_passes` (1.0) - Code meets linting standards

#### Files (2 checks, weight: 2.5)
- ✓ `app_directory_exists` (2.0) - App Router directory exists
- ✓ `next_config_exists` (0.5) - Next.js configuration file exists

#### Patterns (4 checks, weight: 7.0)
- ✓ `has_page_files` (2.0) - App Router page components exist
- ✓ `has_layout_file` (1.5) - Layout component exists in App Router
- ✓ `uses_metadata_api` (1.0) - Uses App Router metadata API
- ✓ `no_pages_router_patterns` (1.5) - No legacy Pages Router data fetching patterns

**Total Weight**: 17.5

### What This Validates
- Project successfully builds and passes tests
- Migration from Pages Router to App Router is complete
- App Router structure is properly implemented
- Legacy patterns are removed

---

## Scenario 001: Server Component

**File**: `suites/next.js/scenarios/001-server-component/scenario.yaml`

### Checks Added (Total: 9 checks)

#### Commands (4 checks, weight: 8.0)
- ✓ `install_succeeds` (2.0) - Dependencies install successfully
- ✓ `build_succeeds` (3.0) - Production build completes without errors
- ✓ `tests_pass` (2.0) - Test suite passes
- ✓ `lint_passes` (1.0) - Code meets linting standards

#### Patterns (5 checks, weight: 8.0)
- ✓ `has_async_component` (2.5) - Server component uses async pattern
- ✓ `has_server_data_fetch` (2.0) - Server-side data fetching implemented
- ✓ `no_client_hooks_in_server` (2.0) - No client-side hooks in server components
- ✓ `proper_component_structure` (1.0) - Components follow proper structure
- ✓ `has_typescript_types` (0.5) - TypeScript types defined

**Total Weight**: 16.0

### What This Validates
- Project successfully builds and passes tests
- Server components use async patterns correctly
- Server-side data fetching is implemented
- No client-side React hooks are used in server components
- Proper TypeScript usage

---

## Scenario 002: Client Component

**File**: `suites/next.js/scenarios/002-client-component/scenario.yaml`

### Checks Added (Total: 10 checks)

#### Commands (4 checks, weight: 8.0)
- ✓ `install_succeeds` (2.0) - Dependencies install successfully
- ✓ `build_succeeds` (3.0) - Production build completes without errors
- ✓ `tests_pass` (2.0) - Test suite passes
- ✓ `lint_passes` (1.0) - Code meets linting standards

#### Patterns (6 checks, weight: 9.5)
- ✓ `has_use_client_directive` (3.0) - Client component has 'use client' directive
- ✓ `uses_state_hook` (2.0) - Uses useState for state management
- ✓ `has_event_handlers` (1.5) - Event handlers implemented for interactivity
- ✓ `has_effect_hook` (1.0) - Uses useEffect for side effects (optional)
- ✓ `imports_react_hooks` (1.5) - Imports React hooks properly
- ✓ `has_typescript_types` (0.5) - TypeScript types defined

**Total Weight**: 17.5

### What This Validates
- Project successfully builds and passes tests
- Client component has proper 'use client' directive
- React state management hooks are used
- Event handlers are implemented
- Proper imports and TypeScript usage

---

## Scoring Impact

### How Heuristic Checks Affect Scores

Each scenario now has two evaluation methods:
1. **Heuristic Checks**: Objective, deterministic validation (new)
2. **LLM Judge**: Subjective quality assessment (existing)

### Default Weights (can be customized)
```yaml
rubric_overrides:
  weights:
    heuristic_checks: 1.0  # Objective validation
    llm_judge: 1.0         # Subjective assessment
```

### Success Calculation
- **Heuristic Score**: `(passed_weight / total_weight)`
- **Final Score**: Average of heuristic_checks + llm_judge (if both enabled)
- **Pass Criteria**: Critical commands pass AND final_score >= 0.7

---

## Testing the Heuristic Checks

### Option 1: Run a Full Benchmark

```bash
# Run a specific scenario with heuristic checks
pnpm harness run next.js 000-app-router-migration-simple L1 --agent anthropic

# The output will show:
# - Heuristic checks results with pass/fail for each check
# - LLM judge evaluation
# - Combined final score
```

### Option 2: Test Locally (Coming Soon)

```bash
# Test just the heuristic checks without running the full benchmark
pnpm harness validate next.js 000-app-router-migration-simple --checks-only
```

---

## Example Output

When a benchmark runs with heuristic checks enabled, you'll see output like:

```
[Heuristic Checks]
Running heuristic validation checks...

Commands:
  ✓ install_succeeds (2.0) - Dependencies install successfully
  ✓ build_succeeds (3.0) - Production build completes without errors
  ✓ tests_pass (2.0) - Test suite passes
  ✓ lint_passes (1.0) - Code meets linting standards

Files:
  ✓ app_directory_exists (2.0) - App Router directory exists
  ✓ next_config_exists (0.5) - Next.js configuration file exists

Patterns:
  ✓ has_page_files (2.0) - App Router page components exist
  ✓ has_layout_file (1.5) - Layout component exists
  ✗ uses_metadata_api (1.0) - Uses App Router metadata API
    Error: Pattern not found in any matching files
  ✓ no_pages_router_patterns (1.5) - No legacy patterns

Heuristic Checks: 9/10 passed
Score: 0.94 (16.5/17.5)

[LLM Judge]
Evaluating implementation quality...
Score: 0.85

[Final Score]
Success Metric: 0.90 (average of heuristic + llm_judge)
Status: PASSED ✓
```

---

## Customizing Checks

You can customize the weights or add/remove checks by editing the scenario.yaml files:

```yaml
heuristic_checks:
  enabled: true

  commands:
    - name: "build_succeeds"
      command: "pnpm build"
      weight: 5.0  # Increase weight for critical checks
      description: "Build must pass"

  patterns:
    - name: "custom_check"
      file: "app/**/*.tsx"
      pattern: "your-regex-here"
      weight: 1.0
      description: "Your custom validation"
```

---

## Next Steps

1. **Run the benchmarks** to see heuristic checks in action
2. **Review the results** to see which checks pass/fail
3. **Adjust weights** based on what's most important for your scenarios
4. **Add more checks** to other scenarios as needed

For more information, see:
- [Heuristic Checks Guide](./heuristic-checks-guide.md)
- [Scenario Template](./templates/scenario.yaml)
