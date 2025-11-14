#!/bin/bash

# Deployment script for ze-benchmarks worker
# Handles deployment to dev, staging, or production environments

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to display usage
usage() {
    echo "Usage: $0 [dev|staging|production]"
    echo ""
    echo "Environments:"
    echo "  dev         Deploy to bench-api-dev.zephyr-cloud.io"
    echo "  staging     Deploy to bench-api-stg.zephyr-cloud.io"
    echo "  production  Deploy to bench-api.zephyr-cloud.io"
    echo ""
    echo "Example:"
    echo "  $0 staging"
    exit 1
}

# Check if environment argument is provided
if [ $# -eq 0 ]; then
    usage
fi

ENV=$1

# Validate environment
if [ "$ENV" != "dev" ] && [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo -e "${RED}❌ Invalid environment: $ENV${NC}"
    usage
fi

# Set environment-specific variables
case $ENV in
    dev)
        DOMAIN="bench-api-dev.zephyr-cloud.io"
        DB_NAME="ze-benchmarks-dev"
        ;;
    staging)
        DOMAIN="bench-api-stg.zephyr-cloud.io"
        DB_NAME="ze-benchmarks-staging"
        ;;
    production)
        DOMAIN="bench-api.zephyr-cloud.io"
        DB_NAME="ze-benchmarks-prod"
        ;;
esac

echo -e "${BLUE}🚀 Deploying ze-benchmarks worker${NC}"
echo -e "${BLUE}   Environment: ${YELLOW}$ENV${NC}"
echo -e "${BLUE}   Domain: ${YELLOW}$DOMAIN${NC}"
echo -e "${BLUE}   Database: ${YELLOW}$DB_NAME${NC}"
echo ""

# Confirmation for production
if [ "$ENV" = "production" ]; then
    echo -e "${YELLOW}⚠️  WARNING: You are about to deploy to PRODUCTION${NC}"
    read -p "Are you sure you want to continue? (yes/no): " -r
    echo
    if [[ ! $REPLY =~ ^[Yy]es$ ]]; then
        echo -e "${RED}Deployment cancelled${NC}"
        exit 1
    fi
fi

# Check if database migrations exist
if [ ! -d "drizzle" ] || [ -z "$(ls -A drizzle)" ]; then
    echo -e "${YELLOW}⚠️  Warning: No database migrations found in drizzle/${NC}"
    echo -e "${YELLOW}   Run 'pnpm db:generate' first if you have schema changes${NC}"
    echo ""
fi

# Deploy the worker
echo -e "${BLUE}📦 Deploying worker...${NC}"
if pnpm deploy:$ENV; then
    echo -e "${GREEN}✅ Worker deployed successfully to $DOMAIN${NC}"
else
    echo -e "${RED}❌ Worker deployment failed${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}🔍 Post-deployment checklist:${NC}"
echo ""
echo "1. Test health endpoint:"
echo -e "   ${GREEN}curl https://$DOMAIN/health${NC}"
echo ""
echo "2. Test API endpoints:"
echo -e "   ${GREEN}curl https://$DOMAIN/api/stats${NC}"
echo ""
echo "3. Verify database migrations (if applied):"
echo -e "   Check that tables exist and schema is correct"
echo ""
echo "4. Update client configurations:"
echo -e "   Set ${YELLOW}ZE_BENCHMARKS_WORKER_URL=https://$DOMAIN${NC}"
echo ""

if [ "$ENV" = "production" ]; then
    echo -e "${YELLOW}📝 Don't forget to:${NC}"
    echo "   - Update monitoring/alerting"
    echo "   - Notify team of deployment"
    echo "   - Monitor logs for errors"
    echo ""
fi

echo -e "${GREEN}✅ Deployment complete!${NC}"
