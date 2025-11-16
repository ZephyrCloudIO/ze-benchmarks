# Implementation Plan: Migrating zack-wip to Main

## Overview

This document outlines the strategy for migrating the specialist architecture and benchmark execution improvements from `zack-wip` branch to a new branch based on `main`.

## Prerequisites

Before starting the migration:

1. ✅ Read `SPECIALISTS.md` for specialist architecture details
2. ✅ Read `BENCHMARK_EXECUTION.md` for execution architecture details
3. ✅ Ensure `main` branch is up to date
4. ✅ Backup any local changes
5. ✅ Ensure all dependencies are installed

## Migration Strategy

### Phase 1: Preparation (Branch Setup)

#### Step 1.1: Switch to Main
```bash
git checkout main
git pull origin main
```

#### Step 1.2: Create Implementation Branch
```bash
git checkout -b feature/specialist-and-execution-improvements
```

#### Step 1.3: Verify Clean State
```bash
git status
# Should show clean working tree
```

### Phase 2: Specialist Architecture Implementation

This phase implements the specialist adapter system from `zack-wip`.

#### Step 2.1: Add Core Dependencies

**File:** `packages/agent-adapters/package.json`

Add dependencies:
```json
{
  "dependencies": {
    "agency-prompt-creator": "link:../../../agency-prompt-creator",
    "json5": "^2.2.3",
    "openai": "^4.20.1"
  }
}
```

Run:
```bash
cd packages/agent-adapters
pnpm install
```

#### Step 2.2: Create Specialist Adapter

**New File:** `packages/agent-adapters/src/specialist.ts`

Copy from `zack-wip`:
```bash
# On zack-wip branch
git show zack-wip:packages/agent-adapters/src/specialist.ts > /tmp/specialist.ts

# On feature branch
cp /tmp/specialist.ts packages/agent-adapters/src/specialist.ts
```

#### Step 2.3: Create LLM Cache

**New File:** `packages/agent-adapters/src/llm-cache.ts`

Copy from `zack-wip`:
```bash
git show zack-wip:packages/agent-adapters/src/llm-cache.ts > packages/agent-adapters/src/llm-cache.ts
```

#### Step 2.4: Create LLM Prompt Selector

**New File:** `packages/agent-adapters/src/llm-prompt-selector.ts`

Copy from `zack-wip`:
```bash
git show zack-wip:packages/agent-adapters/src/llm-prompt-selector.ts > packages/agent-adapters/src/llm-prompt-selector.ts
```

#### Step 2.5: Update Agent Adapters Index

**File:** `packages/agent-adapters/src/index.ts`

Add export:
```typescript
export { SpecialistAdapter } from './specialist.js';
```

#### Step 2.6: Add Specialist Documentation

**New File:** `packages/agent-adapters/SPECIALIST_INTEGRATION.md`

Copy from `zack-wip`:
```bash
git show zack-wip:packages/agent-adapters/SPECIALIST_INTEGRATION.md > packages/agent-adapters/SPECIALIST_INTEGRATION.md
```

#### Step 2.7: Create Test File (Optional)

**New File:** `packages/agent-adapters/test-specialist.ts`

Copy from `zack-wip`:
```bash
git show zack-wip:packages/agent-adapters/test-specialist.ts > packages/agent-adapters/test-specialist.ts
```

#### Step 2.8: Add Unit Tests

**New Files:**
- `packages/agent-adapters/src/__tests__/llm-cache.test.ts`
- `packages/agent-adapters/src/__tests__/llm-prompt-selector.test.ts`

Copy from `zack-wip`.

#### Step 2.9: Update TypeScript Config

**File:** `packages/agent-adapters/tsconfig.json`

Ensure compatibility with new imports from `agency-prompt-creator`.

#### Step 2.10: Verify Specialist Build

```bash
cd packages/agent-adapters
pnpm build
```

### Phase 3: Benchmark Execution Restructuring

This phase implements the modular execution architecture.

#### Step 3.1: Create Configuration Files

**New File:** `benchmark.config.json`

```json
{
  "$schema": "./benchmark.config.schema.json",
  "suitesDir": "./suites",
  "outputDir": "./results",
  "databasePath": "./benchmarks.db",
  "comment": "Configuration for ze-benchmarks. All paths are relative to the project root where this file is located."
}
```

**New File:** `benchmark.config.schema.json`

Copy from `zack-wip`:
```bash
git show zack-wip:benchmark.config.schema.json > benchmark.config.schema.json
```

#### Step 3.2: Create CLI Module

**Directory:** `packages/harness/src/cli/`

Create directory and files:
```bash
mkdir -p packages/harness/src/cli
```

**New Files:**
- `packages/harness/src/cli/args.ts` - Argument parsing
- `packages/harness/src/cli/environment.ts` - Environment validation

Copy from `zack-wip`:
```bash
git show zack-wip:packages/harness/src/cli/args.ts > packages/harness/src/cli/args.ts
git show zack-wip:packages/harness/src/cli/environment.ts > packages/harness/src/cli/environment.ts
```

#### Step 3.3: Create Domain Module

**Directory:** `packages/harness/src/domain/`

Create directory and files:
```bash
mkdir -p packages/harness/src/domain
```

**New Files:**
- `packages/harness/src/domain/agent.ts` - Agent management
- `packages/harness/src/domain/scenario.ts` - Scenario loading
- `packages/harness/src/domain/scoring.ts` - Score calculation
- `packages/harness/src/domain/warmup.ts` - Warmup execution

Copy from `zack-wip`:
```bash
git show zack-wip:packages/harness/src/domain/agent.ts > packages/harness/src/domain/agent.ts
git show zack-wip:packages/harness/src/domain/scenario.ts > packages/harness/src/domain/scenario.ts
git show zack-wip:packages/harness/src/domain/scoring.ts > packages/harness/src/domain/scoring.ts
git show zack-wip:packages/harness/src/domain/warmup.ts > packages/harness/src/domain/warmup.ts
```

#### Step 3.4: Create Execution Module

**Directory:** `packages/harness/src/execution/`

Create directory and files:
```bash
mkdir -p packages/harness/src/execution
```

**New File:**
- `packages/harness/src/execution/benchmark.ts` - Core benchmark runner

Copy from `zack-wip`:
```bash
git show zack-wip:packages/harness/src/execution/benchmark.ts > packages/harness/src/execution/benchmark.ts
```

#### Step 3.5: Create Interactive Module

**Directory:** `packages/harness/src/interactive/`

Create directory and files:
```bash
mkdir -p packages/harness/src/interactive
```

**New Files:**
- `packages/harness/src/interactive/menu.ts` - Main menu
- `packages/harness/src/interactive/benchmark.ts` - Interactive benchmark execution
- `packages/harness/src/interactive/statistics.ts` - Stats viewing
- `packages/harness/src/interactive/clear.ts` - Database clearing
- `packages/harness/src/interactive/history.ts` - History viewing
- `packages/harness/src/interactive/suite-management.ts` - Suite/scenario creation

Copy all from `zack-wip`:
```bash
for file in menu benchmark statistics clear history suite-management; do
  git show zack-wip:packages/harness/src/interactive/${file}.ts > packages/harness/src/interactive/${file}.ts
done
```

#### Step 3.6: Create Lib Module

**Directory:** `packages/harness/src/lib/`

Create directory and files:
```bash
mkdir -p packages/harness/src/lib
```

**New Files:**
- `packages/harness/src/lib/config.ts` - Configuration loading
- `packages/harness/src/lib/constants.ts` - Shared constants
- `packages/harness/src/lib/display.ts` - Display utilities
- `packages/harness/src/lib/project-root.ts` - Project root detection
- `packages/harness/src/lib/workspace-utils.ts` - Workspace utilities

Copy all from `zack-wip`:
```bash
for file in config constants display project-root workspace-utils; do
  git show zack-wip:packages/harness/src/lib/${file}.ts > packages/harness/src/lib/${file}.ts
done
```

#### Step 3.7: Refactor Main CLI

**File:** `packages/harness/src/cli.ts`

This file needs careful migration as it's the entry point:

1. Backup current `cli.ts`:
   ```bash
   cp packages/harness/src/cli.ts packages/harness/src/cli.ts.backup
   ```

2. Copy new version from `zack-wip`:
   ```bash
   git show zack-wip:packages/harness/src/cli.ts > packages/harness/src/cli.ts
   ```

3. Review changes and merge any custom modifications from backup if needed

#### Step 3.8: Update Database Schema

**File:** `packages/database/src/schema.ts`

The schema needs updates to track specialist usage:

1. Review changes in `zack-wip`:
   ```bash
   git diff main zack-wip -- packages/database/src/schema.ts
   ```

2. Apply changes manually (adding specialist tracking fields)

#### Step 3.9: Update Database Logger

**File:** `packages/database/src/logger.ts`

Apply specialist logging enhancements:

1. Review changes:
   ```bash
   git diff main zack-wip -- packages/database/src/logger.ts
   ```

2. Apply changes manually

#### Step 3.10: Verify Harness Build

```bash
cd packages/harness
pnpm build
```

### Phase 4: Evaluator Enhancements

New evaluators were added in `zack-wip`.

#### Step 4.1: Add New Evaluators

**New Files:**
- `packages/evaluators/src/evaluators/config-accuracy.ts`
- `packages/evaluators/src/evaluators/dependency-proximity.ts`
- `packages/evaluators/src/evaluators/file-structure.ts`

Copy from `zack-wip`:
```bash
git show zack-wip:packages/evaluators/src/evaluators/config-accuracy.ts > packages/evaluators/src/evaluators/config-accuracy.ts
git show zack-wip:packages/evaluators/src/evaluators/dependency-proximity.ts > packages/evaluators/src/evaluators/dependency-proximity.ts
git show zack-wip:packages/evaluators/src/evaluators/file-structure.ts > packages/evaluators/src/evaluators/file-structure.ts
```

#### Step 4.2: Update Evaluator Index

**File:** `packages/evaluators/src/index.ts`

Add exports for new evaluators.

#### Step 4.3: Update Evaluator Types

**File:** `packages/evaluators/src/types.ts`

Apply type updates from `zack-wip`:
```bash
git diff main zack-wip -- packages/evaluators/src/types.ts
```

#### Step 4.4: Add Workspace Utils

**New File:** `packages/evaluators/src/utils/workspace.ts`

Copy from `zack-wip`:
```bash
mkdir -p packages/evaluators/src/utils
git show zack-wip:packages/evaluators/src/utils/workspace.ts > packages/evaluators/src/utils/workspace.ts
```

#### Step 4.5: Update Existing Evaluators

Review and apply changes to:
- `packages/evaluators/src/evaluators/dependency-targets.ts`
- `packages/evaluators/src/evaluators/package-manager.ts`
- `packages/evaluators/src/evaluators/test.ts`

```bash
git diff main zack-wip -- packages/evaluators/src/evaluators/
```

#### Step 4.6: Verify Evaluators Build

```bash
cd packages/evaluators
pnpm build
```

### Phase 5: Scripts and Utilities

New utility scripts were added in `zack-wip`.

#### Step 5.1: Add Utility Scripts

**New Files:**
- `scripts/clear-database.ts`
- `scripts/compare-batches.ts`
- `scripts/export-batch-prompts.ts`
- `scripts/run-all-models.ts`
- `scripts/validate-prompts.ts`
- `scripts/workflow-iterate.ts`

Copy from `zack-wip`:
```bash
for file in clear-database compare-batches export-batch-prompts run-all-models validate-prompts workflow-iterate; do
  git show zack-wip:scripts/${file}.ts > scripts/${file}.ts
done
```

#### Step 5.2: Add Script Documentation

**New File:** `scripts/README-validate-prompts.md`

Copy from `zack-wip`:
```bash
git show zack-wip:scripts/README-validate-prompts.md > scripts/README-validate-prompts.md
```

### Phase 6: Documentation Updates

#### Step 6.1: Update Main Documentation

Review and merge changes to:
- `README.md`
- `prd.md`
- `evaluators-design.md`

```bash
git diff main zack-wip -- README.md prd.md evaluators-design.md
```

#### Step 6.2: Add New Documentation

Copy new documentation files created in Phase 2-5 preparation:
- `SPECIALISTS.md` (already created)
- `BENCHMARK_EXECUTION.md` (already created)
- `IMPLEMENTATION_PLAN.md` (this file)

### Phase 7: Configuration and Build Files

#### Step 7.1: Update Root Package.json

**File:** `package.json`

Review dependency changes:
```bash
git diff main zack-wip -- package.json
```

Apply necessary dependency updates.

#### Step 7.2: Update Workspace Configuration

**File:** `pnpm-workspace.yaml`

Review workspace changes:
```bash
git diff main zack-wip -- pnpm-workspace.yaml
```

#### Step 7.3: Update Lock Files

```bash
pnpm install
```

This will regenerate `pnpm-lock.yaml` with new dependencies.

#### Step 7.4: Update .gitignore

**File:** `.gitignore`

Review and apply changes:
```bash
git diff main zack-wip -- .gitignore
```

### Phase 8: Testing and Validation

#### Step 8.1: Build All Packages

```bash
# From root
pnpm build
```

Should build successfully:
- ✅ `@ze/database`
- ✅ `@ze/agent-adapters`
- ✅ `@ze/evaluators`
- ✅ `@ze/harness`

#### Step 8.2: Run Unit Tests

```bash
pnpm test
```

#### Step 8.3: Test CLI Help

```bash
pnpm run cli --help
```

Should display updated help with specialist options.

#### Step 8.4: Test Interactive Mode

```bash
pnpm run cli interactive
```

Should launch new interactive menu.

#### Step 8.5: Test Basic Benchmark Run

```bash
pnpm run cli run shadcn-generate-vite basic L0 echo
```

Should execute successfully without specialist.

#### Step 8.6: Test Specialist Integration

```bash
# Assuming shadcn-specialist template exists
pnpm run cli run shadcn-generate-vite basic L0 anthropic --specialist @zephyr-cloud/shadcn-specialist
```

Should execute with specialist adapter.

#### Step 8.7: Test External Invocation

```bash
# From parent directory
cd ..
cd ze-benchmarks/packages/harness
pnpm exec tsx src/cli.ts run shadcn-generate-vite basic L0 echo
```

Should find project root and execute successfully.

#### Step 8.8: Test Configuration Loading

```bash
# Verify config loads correctly
node -e "const { loadBenchmarkConfig } = require('./packages/harness/dist/lib/config.js'); console.log(JSON.stringify(loadBenchmarkConfig(), null, 2))"
```

Should output resolved configuration.

### Phase 9: Documentation and Cleanup

#### Step 9.1: Update CHANGELOG

Create `CHANGELOG.md` entry:
```markdown
## [Unreleased]

### Added
- Specialist adapter system for prompt engineering
- LLM-powered intent extraction and component selection
- Enriched template support with documentation
- Modular benchmark execution architecture
- Configuration-driven path resolution
- External invocation support
- Interactive menu system enhancements
- New evaluators: config-accuracy, dependency-proximity, file-structure
- Utility scripts for batch operations and validation

### Changed
- Refactored CLI into modular architecture (cli/, domain/, execution/, interactive/, lib/)
- Database schema to track specialist usage
- Project root detection for flexible invocation
- Environment variable loading strategy

### Fixed
- Path resolution issues when invoking from different directories
- Workspace root detection for nested monorepos
```

#### Step 9.2: Update README

Add sections:
- Specialist usage instructions
- External invocation examples
- Configuration file documentation
- Link to `SPECIALISTS.md` and `BENCHMARK_EXECUTION.md`

#### Step 9.3: Remove Backup Files

```bash
rm packages/harness/src/cli.ts.backup
```

### Phase 10: Commit and PR

#### Step 10.1: Review Changes

```bash
git status
git diff --stat
```

#### Step 10.2: Stage Changes

```bash
git add .
```

#### Step 10.3: Commit

```bash
git commit -m "feat: add specialist architecture and modular execution system

This commit introduces significant architectural improvements:

Specialist Architecture:
- SpecialistAdapter decorator for prompt engineering
- 3-step LLM-powered workflow (intent extraction, component selection, substitution)
- Enriched template support with documentation
- LLM caching for performance
- Comprehensive telemetry

Benchmark Execution:
- Modular architecture (cli/, domain/, execution/, interactive/, lib/)
- Configuration-driven via benchmark.config.json
- Project root auto-detection for external invocation
- Enhanced interactive menu system
- Better separation of concerns

New Features:
- New evaluators: config-accuracy, dependency-proximity, file-structure
- Utility scripts for batch operations and validation
- Enhanced database schema for specialist tracking

Documentation:
- SPECIALISTS.md for specialist architecture
- BENCHMARK_EXECUTION.md for execution architecture
- IMPLEMENTATION_PLAN.md for migration guide

Breaking Changes: None (backward compatible)

See SPECIALISTS.md and BENCHMARK_EXECUTION.md for detailed documentation."
```

#### Step 10.4: Push Branch

```bash
git push origin feature/specialist-and-execution-improvements
```

#### Step 10.5: Create Pull Request

Create PR with:
- **Title:** "feat: Specialist architecture and modular execution system"
- **Description:** Link to this implementation plan and key documentation
- **Reviewers:** Tag relevant team members
- **Labels:** enhancement, architecture, documentation

## Rollback Strategy

If issues are encountered:

### Quick Rollback

```bash
git checkout main
git branch -D feature/specialist-and-execution-improvements
```

### Partial Rollback

If only specific components have issues:

```bash
# Revert specific files
git checkout main -- packages/harness/src/cli.ts
git checkout main -- packages/agent-adapters/src/specialist.ts
```

### Database Migration Rollback

If database schema changes cause issues:

```bash
# Backup current database
cp benchmarks.db benchmarks.db.backup

# Restore from pre-migration backup
cp benchmarks.db.pre-migration benchmarks.db
```

## Risk Mitigation

### High-Risk Areas

1. **Database Schema Changes**
   - Risk: Data loss or corruption
   - Mitigation: Backup database before migration, test thoroughly

2. **CLI Entry Point Refactor**
   - Risk: Breaking existing scripts and workflows
   - Mitigation: Maintain backward compatibility, extensive testing

3. **Path Resolution Changes**
   - Risk: Benchmarks fail to find suites or configurations
   - Mitigation: Comprehensive path resolution tests

### Testing Checklist

Before merging to main:

- [ ] All packages build successfully
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] CLI works in interactive mode
- [ ] CLI works in run mode
- [ ] Specialists load and execute correctly
- [ ] External invocation works
- [ ] Configuration loading works
- [ ] Database migrations complete successfully
- [ ] Backward compatibility maintained
- [ ] Documentation is complete and accurate

## Post-Migration Tasks

After merging to main:

1. **Update CI/CD Pipelines**
   - Update build scripts to handle new structure
   - Add specialist adapter tests
   - Test external invocation in CI

2. **Update Deployment Docs**
   - Document new environment variables
   - Update configuration examples
   - Add specialist setup instructions

3. **Team Training**
   - Demo new interactive menu
   - Show specialist usage examples
   - Explain external invocation patterns

4. **Monitor Production**
   - Watch for path resolution issues
   - Monitor specialist LLM API usage
   - Track database performance

## Timeline Estimate

- Phase 1-2 (Specialist): ~2 hours
- Phase 3-4 (Execution): ~3 hours
- Phase 5-6 (Scripts & Docs): ~1 hour
- Phase 7 (Config & Build): ~1 hour
- Phase 8 (Testing): ~2 hours
- Phase 9-10 (Docs & PR): ~1 hour

**Total: ~10 hours**

## Success Criteria

Migration is successful when:

1. ✅ All builds pass
2. ✅ All tests pass
3. ✅ CLI works in all modes (interactive, run, dev, stats, create, clear)
4. ✅ Specialists load and execute
5. ✅ External invocation works from any directory
6. ✅ Configuration system works
7. ✅ Documentation is complete
8. ✅ No regressions in existing functionality
9. ✅ PR is approved and merged
10. ✅ Team is trained on new features

## Support and Questions

For questions or issues during migration:

1. Review `SPECIALISTS.md` for specialist-specific questions
2. Review `BENCHMARK_EXECUTION.md` for execution architecture questions
3. Compare with `zack-wip` branch for reference implementations
4. Check git diff for specific file changes
5. Reach out to team for clarification

## Appendix: Key File Mapping

This table shows where files moved or were created:

| zack-wip Path | New Branch Path | Change Type |
|---------------|-----------------|-------------|
| `packages/harness/src/cli.ts` | `packages/harness/src/cli.ts` | Modified (refactored) |
| N/A | `packages/harness/src/cli/args.ts` | New |
| N/A | `packages/harness/src/cli/environment.ts` | New |
| N/A | `packages/harness/src/domain/agent.ts` | New (logic extracted from cli.ts) |
| N/A | `packages/harness/src/domain/scenario.ts` | New (logic extracted from cli.ts) |
| N/A | `packages/harness/src/domain/scoring.ts` | New (logic extracted from cli.ts) |
| N/A | `packages/harness/src/domain/warmup.ts` | New (logic extracted from cli.ts) |
| N/A | `packages/harness/src/execution/benchmark.ts` | New (logic extracted from cli.ts) |
| N/A | `packages/harness/src/interactive/*.ts` | New |
| N/A | `packages/harness/src/lib/*.ts` | New |
| N/A | `packages/agent-adapters/src/specialist.ts` | New |
| N/A | `packages/agent-adapters/src/llm-cache.ts` | New |
| N/A | `packages/agent-adapters/src/llm-prompt-selector.ts` | New |
| N/A | `benchmark.config.json` | New |
| N/A | `benchmark.config.schema.json` | New |
