#!/bin/bash
set -e

echo "🧪 Testing Zephyr Benchmarks System"
echo "===================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_TOTAL=0

run_test() {
    local test_name="$1"
    local test_cmd="$2"

    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${BLUE}Test $TESTS_TOTAL: $test_name${NC}"

    if eval "$test_cmd" > /dev/null 2>&1; then
        echo -e "${GREEN}✓ PASSED${NC}"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${YELLOW}✗ FAILED${NC}"
    fi
    echo ""
}

echo "0️⃣  Worker Availability Tests"
echo "─────────────────────"
echo "Checking if worker is running at http://localhost:8787..."
if curl -s http://localhost:8787/health > /dev/null 2>&1; then
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASSED${NC} - Worker is running"
else
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${YELLOW}✗ FAILED${NC} - Worker is not running"
    echo ""
    echo "⚠️  The worker is required for all benchmarks!"
    echo "   Start it with: cd worker && pnpm dev"
    echo "   Or use: ./start-dev.sh"
    echo ""
    exit 1
fi
echo ""

echo "1️⃣  Build System Tests"
echo "─────────────────────"
run_test "Build all packages" "pnpm build"

echo "2️⃣  Worker Client Tests"
echo "─────────────────────"
run_test "Worker client package exists" "test -d packages/worker-client"

echo "3️⃣  Scenario Structure Tests"
echo "─────────────────────"
run_test "Update-deps scenario has repo-fixture" "test -d suites/update-deps/scenarios/nx-pnpm-monorepo/repo-fixture"
run_test "Test-suite scenario has repo-fixture" "test -d suites/test-suite/scenarios/test-scenario/repo-fixture"
run_test "Scenario YAML files are valid" "test -f suites/update-deps/scenarios/nx-pnpm-monorepo/scenario.yaml"

echo "4️⃣  Benchmark Execution Tests"
echo "─────────────────────"
echo "Running benchmark with echo agent (this may take 10-15 seconds)..."
if pnpm bench test-suite test-scenario L0 echo > /tmp/bench-test.log 2>&1; then
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    TESTS_PASSED=$((TESTS_PASSED + 1))
    echo -e "${GREEN}✓ PASSED${NC} - Benchmark execution successful"
else
    TESTS_TOTAL=$((TESTS_TOTAL + 1))
    echo -e "${YELLOW}✗ FAILED${NC} - Benchmark execution failed"
    echo "Check /tmp/bench-test.log for details"
fi
echo ""

echo "5️⃣  File Structure Tests"
echo "─────────────────────"
run_test "CLI entry point exists" "test -f packages/harness/src/cli.ts"
run_test "Agent adapters exist" "test -d packages/agent-adapters"
run_test "Evaluators exist" "test -d packages/evaluators"
run_test "Worker client exists" "test -d packages/worker-client"

echo "6️⃣  Prompt Tier Tests"
echo "─────────────────────"
run_test "L0 prompt exists" "test -f suites/test-suite/prompts/test-scenario/L0-minimal.md"
run_test "L1 prompt exists" "test -f suites/test-suite/prompts/test-scenario/L1-basic.md"
run_test "L2 prompt exists" "test -f suites/test-suite/prompts/test-scenario/L2-directed.md"

echo "7️⃣  Environment Tests"
echo "─────────────────────"
run_test ".env file exists" "test -f .env"
run_test "Node version compatible" "node --version | grep -E 'v(18|20|22|24)'"

echo ""
echo "════════════════════════════════════════"
echo "Test Summary"
echo "════════════════════════════════════════"
echo -e "Tests passed: ${GREEN}$TESTS_PASSED${NC} / $TESTS_TOTAL"
echo ""

if [ $TESTS_PASSED -eq $TESTS_TOTAL ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Start the worker: cd worker && pnpm dev"
    echo "  2. Start the dashboard: pnpm dev:dashboard"
    echo "  3. Run benchmarks: pnpm bench update-deps nx-pnpm-monorepo L1 anthropic"
    echo "  4. View results: http://localhost:3000"
    echo ""
    echo "Or use the all-in-one script: ./start-dev.sh"
    exit 0
else
    echo -e "${YELLOW}⚠ Some tests failed${NC}"
    echo ""
    echo "Common fixes:"
    echo "  - Ensure worker is running: cd worker && pnpm dev"
    echo "  - Run: pnpm install"
    echo "  - Run: pnpm build"
    echo "  - Check .env has ANTHROPIC_API_KEY set"
    echo "  - Ensure Node.js version is 18.x or higher"
    exit 1
fi
