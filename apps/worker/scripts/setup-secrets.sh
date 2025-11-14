#!/bin/bash

# Script to set up secrets for worker environments
# This helps ensure all required secrets are configured

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

usage() {
    echo "Usage: $0 [dev|staging|production]"
    echo ""
    echo "This script will prompt you to set up required secrets for the specified environment."
    echo ""
    echo "Environments:"
    echo "  dev         bench-api-dev.zephyr-cloud.io"
    echo "  staging     bench-api-stg.zephyr-cloud.io"
    echo "  production  bench-api.zephyr-cloud.io"
    exit 1
}

if [ $# -eq 0 ]; then
    usage
fi

ENV=$1

if [ "$ENV" != "dev" ] && [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    echo -e "${RED}❌ Invalid environment: $ENV${NC}"
    usage
fi

echo -e "${BLUE}🔐 Setting up secrets for ${YELLOW}$ENV${BLUE} environment${NC}"
echo ""

# API_SECRET_KEY
echo -e "${BLUE}1. API_SECRET_KEY${NC}"
echo "   This key is used to authenticate POST requests to the worker API"
echo ""
read -p "Do you want to set/update API_SECRET_KEY? (y/n): " -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Enter the API secret key (or press Enter to generate a random one):"
    read -rs secret_key

    if [ -z "$secret_key" ]; then
        # Generate a random secret
        secret_key=$(openssl rand -base64 32)
        echo -e "${GREEN}Generated random secret key${NC}"
    fi

    echo ""
    echo "Setting API_SECRET_KEY for $ENV environment..."
    echo "$secret_key" | wrangler secret put API_SECRET_KEY --env $ENV

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ API_SECRET_KEY set successfully${NC}"
        echo ""
        echo -e "${YELLOW}⚠️  IMPORTANT: Save this key securely!${NC}"
        echo "   You'll need to configure it in your .env file:"
        echo -e "   ${GREEN}ZE_BENCHMARKS_API_KEY=$secret_key${NC}"
        echo ""
    else
        echo -e "${RED}❌ Failed to set API_SECRET_KEY${NC}"
        exit 1
    fi
fi

echo ""
echo -e "${GREEN}✅ Secret setup complete for $ENV environment${NC}"
echo ""
echo "Next steps:"
echo "1. Update your .env file with the API key"
echo "2. Deploy the worker: ./scripts/deploy.sh $ENV"
echo "3. Test the deployment"
