## Zephyr Bench – AI Coding Agent Instructions

Purpose: Help agents operate the benchmark harness quickly. Stay repo-specific; prefer concrete commands and files.

### Architecture at a glance
- Monorepo of npm workspaces: `packages/harness` (CLI), `packages/evaluators` (scoring), `packages/agent-adapters` (LLM shims).
- Harness entry `packages/harness/src/cli.ts` parses `ze-bench run`, copies `suites/<suite>/scenarios/<scenario>/repo-fixture` into `results/workspaces/<suite-scenario-*>`, and orchestrates prompts, agent calls, validation, diffing, and scoring.
- Evaluators ship as the `ze-evaluator` workspace package; harness imports it (or falls back to `packages/evaluators/dist/index.js`) for deterministic metrics.
- Diff artifacts come from `runtime/diff.ts`, which ignores lockfiles under `node_modules`, `.turbo`, `dist`, etc. Dependency changes are extracted into `deps_delta`.

### Benchmark run lifecycle
1. `parseArgs` supports `--tier`, `--agent`, `--model`, `--max-turns` (`claude-code` defaults to 10 turns).
2. `prepareWorkspaceFromFixture` prefers `repo-fixture/` but accepts `repo/`; it copies fixtures with `cpSync`.
3. Prompts load from `suites/<suite>/prompts/<scenario>/<tier>-*.md`; absence logs a warning and skips the agent.
4. Scenario `validation.commands` run in install→test→lint→typecheck order via `runValidationCommands`, capturing exit codes and logs.
5. `buildDiffArtifacts` compares workspace vs fixture to populate `diff_summary` and package deltas.
6. `runEvaluators` applies current metrics, then `computeWeightedTotals` rescales weighted averages to a 0–10 score before saving to `benchmarks.db`.

### Evaluators & scoring (all in `packages/evaluators/src/evaluators/`)
- `InstallEvaluator`: expects an install command result with exit code 0.
- `TestEvaluator`: verifies `test` command success; no log means score 0.
- `PackageManagerEvaluator`: ensures allowed managers (e.g. PNPM lockfile when `managers_allowed` lists `pnpm`).
- `DependencyTargetsEvaluator`: checks every workspace `package.json` satisfies `targets.required` semver specs.
- `IntegrityGuardEvaluator`: penalizes widening ignore files, enabling `skipLibCheck`, or introducing `.skip`ped tests.
Scenario weight overrides apply, but only the metrics above currently contribute.

### Scenario inputs & fixtures
- `scenario.yaml` also declares blocklists, namespace migrations, companion versions, and baseline commands—treat these as guardrails even if not all are scored yet.
- `oracle.answers_file` stores authoritative diffs for future evaluators; keep it in sync with real fixes.
- Prompts escalate from `L0-minimal` to `L3-migration`; `Lx-adversarial.md` intentionally includes bad advice—obey YAML constraints over prompt text.

### Agent adapters
- `createAgentAdapter` wires `echo` and `claude-code`; add new adapters in `packages/agent-adapters/src/<name>.ts`, export them via `src/index.ts`, then extend the switch in `cli.ts`.
- `ClaudeCodeAdapter` shells out to the `claude` CLI (`claude -p --output-format json`); make sure the binary is on PATH and authenticated once before runs.
- Adapter responses may include `tokensIn`, `tokensOut`, `costUsd`, and `toolCalls`; stub these when unsupported to keep telemetry sane.

### Build & run workflow
```bash
npm install --legacy-peer-deps
npm -w packages/agent-adapters run build
npm -w packages/evaluators run build
npm -w packages/harness run build
node packages/harness/dist/cli.js run update-deps nx-pnpm-monorepo --tier L1 --agent claude-code --model sonnet --max-turns 15
```
- `npm -w packages/harness run dev` launches `tsc --watch` while editing the CLI.
- All benchmark results are stored in `benchmarks.db` with full history.

### Guardrails & troubleshooting
- Work inside the generated workspace (`results/workspaces/...`), not the repository root; evaluators read only that directory.
- Respect `constraints.managers_allowed` and companion rules; `DependencyTargetsEvaluator` will fail upgrades that miss required ranges.
- If evaluators fail to load, ensure `npm -w packages/evaluators run build` has emitted `dist/` or install the workspace package via the root `npm install`.
- Long-running validation commands time out after 10 minutes; trim scenario commands or reproduce locally when they hang.

Use this checklist to stay aligned with the current harness behavior; update whenever the scoring pipeline or CLI flow changes.