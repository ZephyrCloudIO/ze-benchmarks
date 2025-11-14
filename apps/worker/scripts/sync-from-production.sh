#!/bin/bash

# Script to sync local database from production (optional)
# This downloads production data and imports it into your local D1 database

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🔄 Sync Local Database from Production${NC}"
echo ""
echo "This will:"
echo "  1. Export data from production D1 database"
echo "  2. Import it into your local D1 database"
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will overwrite your local database${NC}"
read -p "Continue? (y/n): " -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Sync cancelled${NC}"
    exit 0
fi

# Export from production
echo -e "${BLUE}📤 Exporting from production...${NC}"
if npx wrangler d1 export ze-benchmarks-prod --remote --output=./.local-sync.sql --env production; then
    echo -e "${GREEN}✅ Export complete${NC}"
else
    echo -e "${RED}❌ Export failed${NC}"
    echo "Make sure you have access to the production database and wrangler is authenticated"
    exit 1
fi

# Import to local
echo ""
echo -e "${BLUE}📥 Importing to local database...${NC}"
if npx wrangler d1 execute ze-benchmarks-local --local --file=./.local-sync.sql; then
    echo -e "${GREEN}✅ Import complete${NC}"
else
    echo -e "${RED}❌ Import failed${NC}"
    exit 1
fi

# Cleanup
echo ""
echo -e "${BLUE}🧹 Cleaning up...${NC}"
rm ./.local-sync.sql
echo -e "${GREEN}✅ Local database synced from production${NC}"
echo ""
echo "You can now run 'pnpm dev' to start the local worker"
