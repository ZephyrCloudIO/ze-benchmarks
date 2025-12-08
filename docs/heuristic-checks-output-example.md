# Heuristic Checks - Console Output Example

This document shows what the console output looks like when running benchmarks with heuristic checks enabled.

## Full Benchmark Output Example

When you run a benchmark with heuristic checks, you'll see two detailed tables:
1. **Heuristic Checks** - Deterministic validation results
2. **LLM Judge Detailed Scores** - Subjective quality assessment

### Example: Running Next.js Scenario 002 (Client Component)

```bash
$ pnpm harness run next.js 002-client-component L1 --agent anthropic
```

#### Output:

```
Benchmark Results
┌────────────────────────────────────────────────────────────┐
│ Agent: anthropic        Tier: L1       Duration: 125.34s   │
├────────────────────────────────────────────────────────────┤
│ Score (mean ± σ): 0.9500 ± 0.0000 (out of 10.0)           │
│ Range (min ... max): 0.9500 ... 0.9500 (1 run)            │
└────────────────────────────────────────────────────────────┘

Heuristic Checks
┌────────────────────────────────────────────────────────────┐
│ Check Name                          Weight   Status         │
├────────────────────────────────────────────────────────────┤
│ install_succeeds                    2.0      Passed         │
│   Dependencies install successfully                        │
│ build_succeeds                      3.0      Passed         │
│   Production build completes without errors                │
│ tests_pass                          2.0      Passed         │
│   Test suite passes                                        │
│ lint_passes                         1.0      Passed         │
│   Code meets linting standards                             │
│ has_use_client_directive            3.0      Passed         │
│   Client component has 'use client' directive              │
│ uses_state_hook                     2.0      Passed         │
│   Uses useState for state management                       │
│ has_event_handlers                  1.5      Passed         │
│   Event handlers implemented for interactivity             │
│ has_effect_hook                     1.0      Failed         │
│   Error: Pattern not found in any matching files          │
│ imports_react_hooks                 1.5      Passed         │
│   Imports React hooks properly                             │
│ has_typescript_types                0.5      Passed         │
│   TypeScript types defined                                 │
├────────────────────────────────────────────────────────────┤
│ 9/10 checks passed                  Score: 94.3%           │
└────────────────────────────────────────────────────────────┘

LLM Judge Detailed Scores
┌────────────────────────────────────────────────────────────┐
│ Category                                 Score    Status    │
├────────────────────────────────────────────────────────────┤
│ Client Component Correctness             5.0      Excellent│
│ State Management Implementation          5.0      Excellent│
│ Interactivity & UX                       5.0      Excellent│
│ Code Quality & Structure                 5.0      Excellent│
│ Overall Implementation                   4.0      Good     │
└────────────────────────────────────────────────────────────┘
```

## Different Scenarios Output

### Scenario 000: App Router Migration

```
Heuristic Checks
┌────────────────────────────────────────────────────────────┐
│ Check Name                          Weight   Status         │
├────────────────────────────────────────────────────────────┤
│ install_succeeds                    2.0      Passed         │
│   Dependencies install successfully                        │
│ build_succeeds                      3.0      Passed         │
│   Production build completes without errors                │
│ tests_pass                          2.0      Passed         │
│   Test suite passes                                        │
│ lint_passes                         1.0      Passed         │
│   Code meets linting standards                             │
│ app_directory_exists                2.0      Passed         │
│   App Router directory exists                              │
│ next_config_exists                  0.5      Passed         │
│   Next.js configuration file exists                        │
│ has_page_files                      2.0      Passed         │
│   App Router page components exist                         │
│ has_layout_file                     1.5      Passed         │
│   Layout component exists in App Router                    │
│ uses_metadata_api                   1.0      Passed         │
│   Uses App Router metadata API                             │
│ no_pages_router_patterns            1.5      Passed         │
│   No legacy Pages Router data fetching patterns            │
├────────────────────────────────────────────────────────────┤
│ 10/10 checks passed                 Score: 100.0%          │
└────────────────────────────────────────────────────────────┘
```

### Scenario 001: Server Component

```
Heuristic Checks
┌────────────────────────────────────────────────────────────┐
│ Check Name                          Weight   Status         │
├────────────────────────────────────────────────────────────┤
│ install_succeeds                    2.0      Passed         │
│   Dependencies install successfully                        │
│ build_succeeds                      3.0      Passed         │
│   Production build completes without errors                │
│ tests_pass                          2.0      Passed         │
│   Test suite passes                                        │
│ lint_passes                         1.0      Passed         │
│   Code meets linting standards                             │
│ has_async_component                 2.5      Passed         │
│   Server component uses async pattern                      │
│ has_server_data_fetch               2.0      Passed         │
│   Server-side data fetching implemented                    │
│ no_client_hooks_in_server           2.0      Passed         │
│   No client-side hooks in server components                │
│ proper_component_structure          1.0      Passed         │
│   Components follow proper structure                       │
│ has_typescript_types                0.5      Passed         │
│   TypeScript types defined                                 │
├────────────────────────────────────────────────────────────┤
│ 9/9 checks passed                   Score: 100.0%          │
└────────────────────────────────────────────────────────────┘
```

## Quiet Mode Output

Even in quiet mode, the heuristic checks table is displayed (along with LLM Judge):

```bash
$ pnpm harness run next.js 002-client-component L1 --agent anthropic --quiet
```

```
✓ next.js/002-client-component (L1) anthropic - 9.50/10 [SUCCESS]

Heuristic Checks
┌────────────────────────────────────────────────────────────┐
│ Check Name                          Weight   Status         │
├────────────────────────────────────────────────────────────┤
│ install_succeeds                    2.0      Passed         │
│ build_succeeds                      3.0      Passed         │
│ tests_pass                          2.0      Passed         │
│ lint_passes                         1.0      Passed         │
│ has_use_client_directive            3.0      Passed         │
│ uses_state_hook                     2.0      Passed         │
│ has_event_handlers                  1.5      Passed         │
│ has_effect_hook                     1.0      Failed         │
│   Error: Pattern not found in any matching files          │
│ imports_react_hooks                 1.5      Passed         │
│ has_typescript_types                0.5      Passed         │
├────────────────────────────────────────────────────────────┤
│ 9/10 checks passed                  Score: 94.3%           │
└────────────────────────────────────────────────────────────┘

LLM Judge Detailed Scores
┌────────────────────────────────────────────────────────────┐
│ Category                                 Score    Status    │
├────────────────────────────────────────────────────────────┤
│ Client Component Correctness             5.0      Excellent│
│ State Management Implementation          5.0      Excellent│
│ Interactivity & UX                       5.0      Excellent│
│ Code Quality & Structure                 5.0      Excellent│
│ Overall Implementation                   4.0      Good     │
└────────────────────────────────────────────────────────────┘
```

## Failed Checks Example

When checks fail, errors are displayed with context:

```
Heuristic Checks
┌────────────────────────────────────────────────────────────┐
│ Check Name                          Weight   Status         │
├────────────────────────────────────────────────────────────┤
│ install_succeeds                    2.0      Passed         │
│   Dependencies install successfully                        │
│ build_succeeds                      3.0      Failed         │
│   Error: Command exited with code 1                        │
│ tests_pass                          2.0      Failed         │
│   Error: 3 tests failed                                    │
│ lint_passes                         1.0      Passed         │
│   Code meets linting standards                             │
│ has_use_client_directive            3.0      Failed         │
│   Error: Pattern not found in any matching files          │
├────────────────────────────────────────────────────────────┤
│ 2/5 checks passed                   Score: 42.9%           │
└────────────────────────────────────────────────────────────┘
```

## Color Coding

The output uses colors to make it easy to scan:

- **Check Names**: Cyan
- **Passed Status**: Green
- **Failed Status**: Red
- **Weights (passed)**: Blue
- **Weights (failed)**: Gray
- **Descriptions**: Gray (subtle)
- **Errors**: Red (prominent)
- **Score**:
  - Green: ≥ 90%
  - Yellow: 70-89%
  - Red: < 70%

## Integration with Final Score

The heuristic checks score is combined with the LLM judge score:

```
Final Score Calculation:
- Heuristic Checks: 94.3%
- LLM Judge: 96.0%
- Combined: (94.3 + 96.0) / 2 = 95.15%
- Status: PASSED ✓ (threshold: 70%)
```

## Key Benefits

1. **Immediate Feedback**: See exactly which checks passed/failed
2. **Weighted Importance**: Understand which failures matter most
3. **Error Context**: Failed checks show why they failed
4. **At-a-Glance Status**: Color coding makes success/failure obvious
5. **Complementary**: Works alongside LLM judge for comprehensive evaluation
