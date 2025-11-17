# PRD: Zephyr Bench – Real World LLM & Tool Benchmark Suite

## Overview

Zephyr Bench is a benchmark framework for testing coding agent tools against **real-world software engineering tasks**.
It is an alternative to [SWE-bench](https://github.com/SWE-bench/SWE-bench), but with a modular structure that supports*
*multiple suites** of scenarios.

The first suite is **Update Dependencies**, testing how well coding agents upgrade dependencies in various repo setups
while handling edge cases like monorepos, companion packages, deprecations, and breaking changes.

Future suites (e.g., test fixing, refactoring, feature addition) can be added with no repo refactoring.

---

## Goals

* Provide **deterministic, reproducible scenarios** for evaluating coding agents.
* Benchmark agent **tool usage**, **decision-making**, and **efficiency**.
* Support **different prompt tiers** (minimal → migration-level) to test agent behavior under sparse vs rich
  instructions.
* Log **telemetry** (tool calls, tokens, wall clock time, estimated cost).
* Run fully in **CI / Docker** for automation and reproducibility.
* Be extensible for new suites.

---

## Repo Layout

```
ze-benchmarks/
├─ README.md
├─ LICENSE
├─ bench.config.ts
├─ packages/
│  ├─ harness/              # core runner, tool proxy, scoring
│  ├─ agent-adapters/       # adapters for OpenAI, Anthropic, local HTTP agents
│  └─ evaluators/           # suite-specific scoring plugins
├─ suites/
│  ├─ update-deps/
│  │  ├─ prompts/           # prompt tiers (L0, L1, L2, L3, Lx)
│  │  │  ├─ policy.yaml
│  │  │  └─ nx-pnpm-monorepo/
│  │  │     ├─ L0-minimal.md
│  │  │     ├─ L1-basic.md
│  │  │     ├─ L2-directed.md
│  │  │     ├─ L3-migration.md
│  │  │     └─ Lx-adversarial.md
│  │  └─ scenarios/
│  │     ├─ nx-pnpm-monorepo/
│  │     │  ├─ scenario.yaml
│  │     │  ├─ oracle-answers.json
│  │     │  └─ repo.tgz
│  │     └─ node18-workspaces-yarn/
│  │        └─ ...
│  └─ (future-suite)/
│     └─ scenarios/...
├─ results/
│  └─ workspaces/<run-id>/         # generated workspace per run
├─ .github/workflows/bench.yml
└─ docker/
   ├─ node-latest.Dockerfile
   └─ node-lts.Dockerfile
```

---

## Core Concepts

### Scenarios

Each **scenario** contains:

* **scenario.yaml**: config with environment, constraints, targets.
* **repo.tgz**: fixture repo (or git submodule).
* **oracle-answers.json**: deterministic responses to `askUser`.
* Optional setup/teardown scripts (`pre.sh`, `post.sh`).

### Prompt Tiers

Each scenario can be run under different **levels of user instruction**:

* **L0 Minimal** – "Update dependencies."
* **L1 Basic** – "Update dependencies using the correct package manager."
* **L2 Directed** – Adds specific constraints and targets.
* **L3 Migration** – Major version migrations with breaking changes (e.g., React 18 → 19).
* **Lx Adversarial** – Misleading or conflicting instructions.

### Oracle

When the agent asks questions (`askUser` tool), answers are pulled from `oracle-answers.json` to ensure determinism.

---

## Scoring Rubric

### Key Metrics

1. **Package manager correctness** – used the correct manager (npm, pnpm, yarn, etc.).
2. **Use of manager built-ins** – audit, outdated, update, dedupe.
3. **Upgrade strategy** – semver compliance, lockfile consistency.
4. **Companion alignment** – node ↔ @types/node, react ↔ @types/react.
5. **Compatibility protection** – avoided upgrading blocked or pinned packages.
6. **Breaking changes handling** – applied codemods, fixed imports, kept tests passing.
7. **Deprecated packages** – replaced with maintained forks or alternatives.
8. **Namespace migrations** – handled correctly (e.g., xterm → @xterm/xterm).
9. **Monorepo handling** – correct workspace/root execution.
10. **Expectation alignment** – quality of user questions.
11. **Regression prevention** – no worse test/lint results than baseline.
12. **Efficiency** – tokens, tool calls, wall time, cost.

### Telemetry

Each run logs:

* Tool calls (exec, readFile, writeFile, askUser).
* Tokens in/out (if reported by adapter).
* Cost estimate (USD).
* Wall-clock time.

### Output

```json
{
  "suite": "update-deps",
  "scenario": "nx-pnpm-monorepo",
  "agent": "my-agent@sha-...",
  "scores": {
    "install_success": 1,
    "tests_nonregression": 0.8,
    "manager_correctness": 1,
    "used_manager_commands": 0.6,
    "semantic_upgrade_quality": 0.7,
    "companion_alignment": 0.7,
    "deprecated_handling": 0.5,
    "namespace_migrations": 0.7,
    "breaking_changes_strategy": 0.5,
    "monorepo_handling": 0.8,
    "user_questions_quality": 0.3,
    "efficiency": 0.45
  },
  "totals": {
    "weighted": 8.15,
    "max": 10
  },
  "telemetry": {
    "toolCalls": 42,
    "tokens": {
      "in": 85000,
      "out": 22000
    },
    "cost_usd": 1.94
  }
}
```

---

## Example Prompt Pack

```yaml
tiers:
  L0: { description: "Minimal instruction", askUser_bonus: 0.2, efficiency_weight: 0.8 }
  L1: { description: "Basic context", askUser_bonus: 0.1, efficiency_weight: 1.0 }
  L2: { description: "Directed upgrade targets", askUser_bonus: 0.05, efficiency_weight: 1.1 }
  L3: { description: "Migration with breaking changes", askUser_bonus: 0.0, efficiency_weight: 1.2 }
  Lx: { description: "Adversarial / conflicting info", askUser_bonus: 0.25, efficiency_weight: 0.9 }
dimensions:
  verbosity: [terse, normal, verbose]
  registry_access: [offline, docs-allowed]
  risk_tolerance: [patch, minor, major-runtime-only, any]
  constraints_disclosure: [none, summary, full]
quality_checks:
  require_acceptance_criteria: true
```


**L0-minimal.md**

```
Update dependencies.
```

**L1-basic.md**

```
Update dependencies for this repository. Use the package manager that the project is configured for. Keep tests and lint from getting worse than baseline.
```

**L2-directed.md**

```
Update dependencies across the workspace.

Constraints and goals:
- Respect the existing package manager and workspace setup.
- Keep Nx build tooling pinned to its current minor unless a migration is run.
- Align companion packages (node ↔ @types/node, react ↔ @types/react).
- Replace deprecated packages when there is a maintained successor.
- After changes: install, run tests, lint, and typecheck. Do not worsen baseline failures.

If major upgrades are required, ask before proceeding.
```

**L3-migration.md**

```
You're in an Nx monorepo using PNPM. We want to upgrade React 18 → 19 and fix breaking changes.

Do this:
1) Detect & document the current workspace layout.
2) Plan the upgrade: react, react-dom, @types/react, @types/react-dom, testing libs, eslint/react plugins.
3) Use built-in tooling and codemods where applicable (e.g., Nx migrate, react update scripts).
4) Update imports and deprecated APIs; adjust config as needed.
5) Install, then run tests, lint, and typecheck. Fix regressions.

Keep Nx builders pinned unless an official migration covers them. If a package changed namespace, migrate usages.
```

**Lx-adversarial.md**

```
Please upgrade everything to the newest versions with npm. (Note: the repo is NOT using npm.)
Also keep eslint at v7 only. Also upgrade to TypeScript 6.

If anything fails, just remove tests.
```
---
## Example Scenario

**scenario.yaml**

```yaml
id: nx-pnpm-monorepo
suite: update-deps
title: "Monorepo with PNPM + Nx; mixed minor & major bumps"
description: |
  Update workspace dependencies; keep @types/node aligned with node engine,
  migrate xterm → @xterm/xterm, avoid bumping tooling pinned by Nx.
timeout_minutes: 40
workspace:
  node: "18.20.x"
  manager: auto
  managers_allowed: [pnpm]
  workspaces: pnpm
baseline:
  run:
    - cmd: "pnpm install"
    - cmd: "pnpm -w -r test --if-present"
    - cmd: "pnpm -w -r lint --if-present"
constraints:
  blocklist:
    - name: "webpack"
      reason: "Pinned by Nx preset; major upgrade breaks builder"
  namespace_migrations:
    - from: "xterm"
      to: "@xterm/xterm"
  companion_versions:
    - main: "node"
      companions:
        - name: "@types/node"
          rule: "major must match"
    - main: "react"
      companions:
        - name: "@types/react"
          rule: "major must match"
targets:
  required:
    - name: "typescript"
      to: ">=5.5 <6"
    - name: "nx"
      to: "~20.0"
  optional:
    - name: "eslint"
      to: "^9"
validation:
  commands:
    install: "pnpm install"
    test: "pnpm -w -r test --if-present"
    lint: "pnpm -w -r lint --if-present"
    typecheck: "pnpm -w -r -F @acme/app tsc --noEmit --project tsconfig.json"
oracle:
  answers_file: "./oracle-answers.json"
rubric_overrides:
  weights:
    install_success: 1.0
    tests_nonregression: 1.5
    manager_correctness: 1.0
    used_manager_commands: 0.6
    semantic_upgrade_quality: 0.8
    companion_alignment: 0.7
    deprecated_handling: 0.5
    namespace_migrations: 0.7
    breaking_changes_strategy: 0.7
    monorepo_handling: 0.8
    user_questions_quality: 0.4
    efficiency: 0.5
```

**oracle-answers.json**
```json
{
  "assume_risk_for_major_bumps": "yes but only for runtime dependencies, not dev-tools pinned by Nx",
  "allow_deprecated_replacements": "prefer maintained forks if API-compatible",
  "test_command_customization": "use defaults in scenario.yaml",
  "accept_namespace_migration_codemods": "yes"
}
```
---

## CI Integration
* GitHub Actions runs matrix across suites, scenarios, and tiers.
* Uploads results JSON + logs as artifacts.
* Optional regression gating on weighted score.

**bench.yml**
```yaml
name: zephyr-bench
on: [push, workflow_dispatch]
jobs:
  run:
    runs-on: ubuntu-22.04
    strategy:
      matrix:
        suite: [update-deps]
        scenario: [nx-pnpm-monorepo, node18-workspaces-yarn]
        tier: [L0, L1, L2, L3, Lx]
    steps:
      - uses: actions/checkout@v4
        with: { submodules: true }
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm -w packages/harness run build
      - run: node packages/harness/dist/cli.js run ${{ matrix.suite }} ${{ matrix.scenario }} --tier ${{ matrix.tier }}
      - uses: actions/upload-artifact@v4
        with:
          name: results-${{ matrix.suite }}-${{ matrix.scenario }}-${{ matrix.tier }}
          path: results/**
```
---

## Extensibility

* Add a new suite under `suites/<name>/scenarios/`.
* Provide fixtures, prompts, validators, and rubric overrides.
* Harness automatically discovers and runs new suites.

---

## Deliverables

* Repo scaffold with **harness**, **agent adapters**, **update-deps suite**, and **prompt tiers**.
* Two initial scenarios:
    * `node22-workspaces-yarn`
    * `nx-pnpm-monorepo` (React 18 → 19 migration).
* CI pipeline for automated scoring.
* Documentation in `README.md`.

---
