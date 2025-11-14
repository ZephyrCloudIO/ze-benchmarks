# Testing Quick Reference

## One-Command Tests

```bash
# Run full automated test suite
./test-benchmarks.sh

# Quick smoke test (no API key needed)
pnpm bench test-suite test-scenario L0 echo

# Test with real agent
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# Start web dashboard
pnpm dev
```

## Test Categories

### 🏗️ Build Tests
```bash
pnpm build                          # Build all packages
pnpm --filter @ze/harness build    # Build harness only
```

### 🎯 Scenario Tests
```bash
# Test all tiers with echo agent (fast)
pnpm bench test-suite test-scenario L0 echo
pnpm bench test-suite test-scenario L1 echo
pnpm bench test-suite test-scenario L2 echo

# Test realistic scenario
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic
```

### 🤖 Agent Tests
```bash
pnpm bench SUITE SCENARIO L1 echo       # No API key
pnpm bench SUITE SCENARIO L1 anthropic  # Requires ANTHROPIC_API_KEY
pnpm bench SUITE SCENARIO L1 openrouter # Requires OPENROUTER_API_KEY
```

### 📊 Evaluator Tests
Run any benchmark - evaluators run automatically. Check output for:
- install_success
- tests_nonregression
- manager_correctness
- dependency_targets
- integrity_guard
- llm_judge

### 🗄️ Database Tests
```bash
ls -la benchmark-report/public/benchmarks.db  # Check file exists
pnpm bench SUITE SCENARIO L1 echo             # Creates/updates DB
```

### 🖥️ Dashboard Tests
```bash
pnpm dev                    # Start at http://localhost:3000
# Then verify:
# - Results display
# - Charts render
# - Real-time updates work
```

### 🔄 Batch Tests
```bash
pnpm bench update-deps nx-pnpm-monorepo --batch echo
# Runs all available tiers (L0, L1, L2, etc.)
```

### 🎮 Interactive CLI Tests
```bash
pnpm cli
# Navigate menus and test UI
```

## Common Test Patterns

### End-to-End Test
```bash
pnpm build && \
pnpm bench test-suite test-scenario L0 echo && \
echo "✅ E2E test passed"
```

### Multi-Agent Test
```bash
pnpm bench test-suite test-scenario L1 echo
pnpm bench test-suite test-scenario L1 anthropic
# Compare results
```

### Multi-Tier Test
```bash
for tier in L0 L1 L2; do
  pnpm bench test-suite test-scenario $tier echo
done
```

### Performance Test
```bash
time pnpm bench test-suite test-scenario L0 echo
# Should complete in < 10 seconds
```

## Verification Checklist

Quick checks to ensure system health:

```bash
# ✅ Packages build
ls packages/harness/dist packages/evaluators/dist packages/agent-adapters/dist

# ✅ Database exists
ls benchmark-report/public/benchmarks.db

# ✅ Scenarios have fixtures
ls suites/*/scenarios/*/repo-fixture

# ✅ Prompts exist
ls suites/*/prompts/*/*.md

# ✅ Environment configured
grep ANTHROPIC_API_KEY .env
```

## Troubleshooting Quick Fixes

```bash
# Missing repo-fixture
cp -r suites/update-deps/scenarios/nx-pnpm-monorepo/repo-fixture \
      suites/TARGET-SUITE/scenarios/TARGET-SCENARIO/

# Clean rebuild
rm -rf packages/*/dist && pnpm build

# Reset database
rm benchmark-report/public/benchmarks.db
pnpm bench test-suite test-scenario L0 echo

# Reinstall dependencies
rm -rf node_modules && pnpm install
```

## Expected Results

### Echo Agent (Fast Test)
```
Duration: ~7-10 seconds
Score: 7.0833/10 (or similar)
Evaluators: All pass except llm_judge
Cost: $0.00
```

### Anthropic Agent (Real Test)
```
Duration: 30-120 seconds
Score: Varies (6-9/10)
Evaluators: All run including llm_judge
Cost: $0.01-0.50
```

## Success Indicators

Your system is working if:
- ✅ `./test-benchmarks.sh` shows 15/15 passed
- ✅ Echo benchmarks complete in < 10 seconds
- ✅ Results appear in dashboard immediately
- ✅ Database file grows after each run
- ✅ Validation commands pass in fixtures

## Need More Details?

- Full testing guide: `TESTING.md`
- Adding benchmarks: `docs/ADDING-BENCHMARKS.md`
- Benchmark checklist: `docs/BENCHMARK-CHECKLIST.md`
- System overview: `README.md`
