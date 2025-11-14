# Testing Guide for Zephyr Benchmarks

This guide explains how to test all parts of the benchmarks system to ensure everything works correctly.

## Quick Start - Automated Testing

The fastest way to test the entire system:

```bash
# Run the automated test suite
./test-benchmarks.sh
```

This script tests:
- ✅ Build system compilation
- ✅ Database connectivity
- ✅ Scenario structure integrity
- ✅ Benchmark execution (with echo agent)
- ✅ File structure validation
- ✅ Prompt tier availability
- ✅ Environment configuration

**Expected output:** All 15 tests should pass.

---

## Manual Testing Steps

### 1. Environment Setup Test

**Verify prerequisites are installed:**

```bash
# Check Node.js version (requires 18+)
node --version

# Check pnpm is installed
pnpm --version

# Check .env file exists and has required keys
cat .env | grep ANTHROPIC_API_KEY
```

**Expected:** Node v18+ and pnpm installed, `.env` file present with API keys.

---

### 2. Build System Test

**Test that all packages compile:**

```bash
# Clean build
pnpm build

# Check for build artifacts
ls -la packages/harness/dist
ls -la packages/evaluators/dist
ls -la packages/agent-adapters/dist
```

**Expected:** All packages build without errors, `dist/` directories contain `.js` and `.d.ts` files.

---

### 3. Database Test

**Verify database initialization:**

```bash
# Check database file exists
ls -la benchmark-report/public/benchmarks.db

# Check database version file
cat benchmark-report/public/db-version.json
```

**Expected:** Database file exists (should be created on first benchmark run).

---

### 4. Scenario Structure Test

**Verify benchmark scenarios are properly structured:**

```bash
# Check update-deps scenario
ls -la suites/update-deps/scenarios/nx-pnpm-monorepo/
# Should contain: scenario.yaml, oracle-answers.json, repo-fixture/

# Check test-suite scenario
ls -la suites/test-suite/scenarios/test-scenario/
# Should contain: scenario.yaml, oracle-answers.json, repo-fixture/

# Check prompts exist
ls -la suites/update-deps/prompts/nx-pnpm-monorepo/
# Should contain: L0-minimal.md, L1-basic.md, L2-directed.md, etc.
```

**Expected:** All required files present for each scenario.

---

### 5. Agent Execution Tests

Test each available agent adapter:

#### Echo Agent (No API Key Required)

```bash
# Test with minimal prompt tier
pnpm bench test-suite test-scenario L0 echo

# Test with basic prompt tier
pnpm bench test-suite test-scenario L1 echo

# Test with directed prompt tier
pnpm bench test-suite test-scenario L2 echo
```

**Expected:** Benchmark completes successfully, results stored in database.

#### Anthropic Claude Agent

```bash
# Ensure ANTHROPIC_API_KEY is set in .env
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

**Expected:** Agent executes, makes tool calls, completes benchmark with evaluation results.

#### OpenRouter Agent (Optional)

```bash
# Ensure OPENROUTER_API_KEY is set in .env
pnpm bench update-deps nx-pnpm-monorepo L1 openrouter
```

**Expected:** Agent executes via OpenRouter API.

---

### 6. Evaluator Tests

Evaluators run automatically after benchmark execution. Verify they work:

```bash
# Run a benchmark that triggers all evaluators
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# Check the output for evaluation breakdown:
# - install_success
# - tests_nonregression
# - manager_correctness
# - dependency_targets
# - integrity_guard
# - llm_judge (if enabled)
```

**Expected:** Each evaluator runs and produces a score (0.0 to 1.0).

---

### 7. Batch Execution Test

Test running multiple tiers at once:

```bash
# Run all tiers for a scenario
pnpm bench update-deps nx-pnpm-monorepo --batch echo

# This will run L0, L1, L2, and any other available tiers
```

**Expected:** Multiple benchmarks execute sequentially, batch ID assigned.

---

### 8. Interactive CLI Test

Test the interactive mode:

```bash
# Start interactive CLI
pnpm cli

# Navigate through menus:
# 1. Select "Run benchmarks"
# 2. Choose suite: update-deps
# 3. Choose scenario: nx-pnpm-monorepo
# 4. Choose agent: echo
# 5. Choose tier: L1
# 6. Observe execution
```

**Expected:** Interactive prompts work, benchmark executes successfully.

---

### 9. Web Dashboard Test

Test the results viewer:

```bash
# Start the web dashboard
pnpm dev

# Open browser to http://localhost:3000
```

**In the browser, verify:**
- ✅ Recent runs display correctly
- ✅ Batch results show aggregate statistics
- ✅ Individual run details expand properly
- ✅ Charts render (score over time, evaluator breakdown)
- ✅ Real-time updates work (run a new benchmark and watch it appear)

**Expected:** Dashboard loads, displays results, updates automatically.

---

### 10. Validation Command Tests

Test that validation commands work in repo fixtures:

```bash
# Navigate to a repo fixture
cd suites/update-deps/scenarios/nx-pnpm-monorepo/repo-fixture

# Run validation commands
pnpm install
pnpm test
pnpm lint
pnpm tsc --noEmit

# Return to root
cd ../../../../..
```

**Expected:** All commands execute successfully in the fixture.

---

## Component-Specific Testing

### Testing Individual Evaluators

You can test evaluator logic directly:

```bash
# Navigate to evaluators package
cd packages/evaluators

# Run evaluator tests (if available)
pnpm test

cd ../..
```

### Testing Agent Adapters

```bash
# Navigate to agent adapters
cd packages/agent-adapters

# Check available adapters
ls -la src/

cd ../..
```

### Testing the Harness

```bash
# Run harness directly with tsx
tsx packages/harness/src/cli.ts --help

# Test scenario loading
tsx packages/harness/src/cli.ts update-deps nx-pnpm-monorepo L1 echo
```

---

## Troubleshooting Common Issues

### Issue: "No raw fixture directory found"

**Problem:** Scenario is missing `repo-fixture/` directory.

**Solution:**
```bash
# Check if repo-fixture exists
ls -la suites/YOUR-SUITE/scenarios/YOUR-SCENARIO/

# If missing, copy from a working scenario
cp -r suites/update-deps/scenarios/nx-pnpm-monorepo/repo-fixture \
      suites/YOUR-SUITE/scenarios/YOUR-SCENARIO/
```

### Issue: "Database connection failed"

**Problem:** Database file doesn't exist or is corrupted.

**Solution:**
```bash
# Remove and recreate database
rm -f benchmark-report/public/benchmarks.db
pnpm bench test-suite test-scenario L0 echo  # Will create new DB
```

### Issue: "Agent adapter error"

**Problem:** Missing or invalid API key.

**Solution:**
```bash
# Check .env file
cat .env

# Ensure required keys are set:
# ANTHROPIC_API_KEY=sk-ant-...
# OPENROUTER_API_KEY=sk-or-...
```

### Issue: "Validation commands fail"

**Problem:** Repo fixture is incomplete or has errors.

**Solution:**
```bash
# Test fixture directly
cd suites/SUITE/scenarios/SCENARIO/repo-fixture
pnpm install
pnpm test  # Should pass
pnpm lint  # Should pass
```

### Issue: "Build errors"

**Problem:** TypeScript compilation issues.

**Solution:**
```bash
# Clean build
rm -rf packages/*/dist
pnpm build

# Check for errors in specific packages
cd packages/harness && pnpm build
cd packages/evaluators && pnpm build
cd packages/agent-adapters && pnpm build
```

---

## Performance Testing

### Test Benchmark Execution Time

```bash
# Time a simple benchmark
time pnpm bench test-suite test-scenario L0 echo

# Time a complex benchmark
time pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

**Expected times:**
- Echo agent: < 10 seconds
- Anthropic agent: 30-120 seconds (depending on complexity)

### Test Database Write Performance

```bash
# Run multiple benchmarks in sequence
for i in {1..5}; do
  pnpm bench test-suite test-scenario L0 echo
done

# Check database size
ls -lh benchmark-report/public/benchmarks.db
```

---

## Continuous Testing Workflow

Recommended workflow when making changes:

```bash
# 1. Make your changes to code

# 2. Rebuild affected packages
pnpm build

# 3. Run automated tests
./test-benchmarks.sh

# 4. Test with echo agent (fast)
pnpm bench test-suite test-scenario L1 echo

# 5. Test with real agent (if needed)
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# 6. Check results in dashboard
pnpm dev
```

---

## Success Criteria

Your benchmark system is working correctly if:

✅ All 15 automated tests pass
✅ Echo agent completes benchmarks successfully
✅ Real agents (Anthropic/OpenRouter) execute without errors
✅ Evaluators produce scores between 0.0 and 1.0
✅ Database stores results correctly
✅ Web dashboard displays results
✅ Validation commands pass in repo fixtures
✅ Interactive CLI navigates without errors
✅ Batch execution processes multiple tiers

---

## Next Steps

Once all tests pass:

1. **Create new benchmarks:** See `docs/ADDING-BENCHMARKS.md`
2. **Add evaluators:** See `docs/ADDING-EVALUATORS.md`
3. **Contribute:** See `CONTRIBUTING.md`
4. **Review checklist:** See `docs/BENCHMARK-CHECKLIST.md`

---

## Getting Help

If tests fail:
1. Check the troubleshooting section above
2. Review error messages carefully
3. Verify environment setup (Node version, pnpm, .env)
4. Check existing benchmarks for reference
5. Review documentation in `docs/` directory

For questions or issues:
- Check `README.md` for system overview
- Review `docs/` for detailed guides
- Run `./test-benchmarks.sh` for diagnostic output
