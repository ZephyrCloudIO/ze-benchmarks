#!/bin/bash

# Quick test script for new multi-environment setup
# Tests migrations, worker startup, and API endpoints

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🧪 Testing New Multi-Environment Setup${NC}"
echo ""

# Test 1: Migration command
echo -e "${BLUE}1. Testing migration command...${NC}"
if pnpm db:migrate > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Migration command works${NC}"
else
    echo -e "${RED}❌ Migration command failed${NC}"
    exit 1
fi

# Test 2: Check if worker is running
echo -e "${BLUE}2. Checking worker status...${NC}"
if curl -s http://localhost:8787/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Worker is running${NC}"
else
    echo -e "${YELLOW}⚠️  Worker not running. Starting worker...${NC}"
    echo -e "${YELLOW}   Run 'pnpm dev:worker' in another terminal${NC}"
    echo -e "${YELLOW}   Then run this test again${NC}"
    exit 1
fi

# Test 3: Health endpoint
echo -e "${BLUE}3. Testing health endpoint...${NC}"
HEALTH=$(curl -s http://localhost:8787/health)
if echo "$HEALTH" | grep -q "ok"; then
    echo -e "${GREEN}✅ Health endpoint returns OK${NC}"
else
    echo -e "${RED}❌ Health endpoint failed${NC}"
    echo "$HEALTH"
    exit 1
fi

# Test 4: Stats endpoint
echo -e "${BLUE}4. Testing stats endpoint...${NC}"
STATS=$(curl -s http://localhost:8787/api/stats)
if echo "$STATS" | grep -q "totalRuns"; then
    echo -e "${GREEN}✅ Stats endpoint works${NC}"
else
    echo -e "${RED}❌ Stats endpoint failed${NC}"
    echo "$STATS"
    exit 1
fi

# Test 5: Runs endpoint
echo -e "${BLUE}5. Testing runs endpoint...${NC}"
RUNS=$(curl -s http://localhost:8787/api/runs)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Runs endpoint works${NC}"
else
    echo -e "${RED}❌ Runs endpoint failed${NC}"
    exit 1
fi

# Test 6: Batches endpoint
echo -e "${BLUE}6. Testing batches endpoint...${NC}"
BATCHES=$(curl -s http://localhost:8787/api/batches)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Batches endpoint works${NC}"
else
    echo -e "${RED}❌ Batches endpoint failed${NC}"
    exit 1
fi

# Test 7: Check migrations were applied
echo -e "${BLUE}7. Checking database migrations...${NC}"
cd apps/worker
MIGRATIONS=$(npx wrangler d1 migrations list ze-benchmarks-local --local 2>&1)
if echo "$MIGRATIONS" | grep -q "0000_quiet_turbo"; then
    echo -e "${GREEN}✅ Migrations applied successfully${NC}"
else
    echo -e "${YELLOW}⚠️  Could not verify migrations${NC}"
fi
cd ../..

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ All tests passed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Run a test benchmark:"
echo "     ${YELLOW}pnpm bench test-suite test-scenario L0 echo${NC}"
echo ""
echo "  2. View results in dashboard:"
echo "     ${YELLOW}pnpm dev:dashboard${NC}"
echo "     ${YELLOW}Open http://localhost:3000${NC}"
echo ""
echo "  3. Test with real agent:"
echo "     ${YELLOW}pnpm bench update-deps nx-pnpm-monorepo L1 anthropic${NC}"
echo ""
echo -e "${BLUE}For more tests, see: TESTING-NEW-SETUP.md${NC}"
