# Worker Multi-Environment Deployment Summary

## Overview

The ze-benchmarks worker now supports deployment to multiple environments with custom domains on `zephyr-cloud.io`.

## Environments Configured

| Environment | Domain | Database | Purpose |
|------------|---------|----------|---------|
| **Local** | `localhost:8787` | Local D1 | Development & Testing |
| **Dev** | `bench-api-dev.zephyr-cloud.io` | `ze-benchmarks-dev` | Remote Development |
| **Staging** | `bench-api-stg.zephyr-cloud.io` | `ze-benchmarks-staging` | Pre-production Testing |
| **Production** | `bench-api.zephyr-cloud.io` | `ze-benchmarks-prod` | Production |

## Quick Start

### Deploy to an Environment

```bash
cd apps/worker

# Deploy to dev
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires confirmation)
./scripts/deploy.sh production
```

### Set Up Secrets

```bash
cd apps/worker

# Set up API keys for each environment
./scripts/setup-secrets.sh dev
./scripts/setup-secrets.sh staging
./scripts/setup-secrets.sh production
```

## Files Created/Modified

### Configuration
- ✅ `apps/worker/wrangler.toml` - Multi-environment configuration
- ✅ `apps/worker/.env.example` - Secrets documentation
- ✅ `apps/worker/package.json` - Added deployment scripts

### Scripts
- ✅ `apps/worker/scripts/deploy.sh` - Deployment automation
- ✅ `apps/worker/scripts/setup-secrets.sh` - Secret management

### Documentation
- ✅ `apps/worker/DEPLOYMENT.md` - Complete deployment guide
- ✅ `DEPLOYMENT-SUMMARY.md` - This file

## NPM Scripts Available

```bash
# Local development
pnpm dev                  # Start local worker

# Deployment
pnpm deploy:dev          # Deploy to dev environment
pnpm deploy:staging      # Deploy to staging environment
pnpm deploy:production   # Deploy to production environment

# Database migrations
pnpm db:push:dev         # Apply migrations to dev
pnpm db:push:staging     # Apply migrations to staging
pnpm db:push:production  # Apply migrations to production
```

## Initial Setup Required

Before first deployment to each environment:

1. **Create D1 Databases**:
   ```bash
   wrangler d1 create ze-benchmarks-dev
   wrangler d1 create ze-benchmarks-staging
   wrangler d1 create ze-benchmarks-prod
   ```

2. **Update wrangler.toml**:
   - Replace placeholder database IDs with actual IDs from step 1

3. **Configure Custom Domains**:
   - Add custom domains in Cloudflare Dashboard
   - Point to worker deployments

4. **Set Up Secrets**:
   ```bash
   cd apps/worker
   ./scripts/setup-secrets.sh dev
   ./scripts/setup-secrets.sh staging
   ./scripts/setup-secrets.sh production
   ```

5. **Apply Database Migrations**:
   ```bash
   pnpm db:push:dev
   pnpm db:push:staging
   pnpm db:push:production
   ```

## Client Configuration

Update your `.env` file to point to the desired environment:

### Development
```bash
ZE_BENCHMARKS_WORKER_URL=https://bench-api-dev.zephyr-cloud.io
ZE_BENCHMARKS_API_KEY=your-dev-api-key
```

### Staging
```bash
ZE_BENCHMARKS_WORKER_URL=https://bench-api-stg.zephyr-cloud.io
ZE_BENCHMARKS_API_KEY=your-staging-api-key
```

### Production
```bash
ZE_BENCHMARKS_WORKER_URL=https://bench-api.zephyr-cloud.io
ZE_BENCHMARKS_API_KEY=your-production-api-key
```

## Environment Variables per Environment

Each environment has specific CORS origins configured:

- **Dev**: `https://bench-dev.zephyr-cloud.io,http://localhost:3000`
- **Staging**: `https://bench-stg.zephyr-cloud.io,http://localhost:3000`
- **Production**: `https://bench.zephyr-cloud.io,https://app.zephyr-cloud.io`

## Testing Deployments

After deployment, verify with:

```bash
# Health check
curl https://bench-api-dev.zephyr-cloud.io/health

# Test API
curl https://bench-api-dev.zephyr-cloud.io/api/stats

# Test authenticated endpoint (requires API key)
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://bench-api-dev.zephyr-cloud.io/api/results
```

## Deployment Workflow

Recommended workflow for changes:

1. **Develop Locally**: Test with `pnpm dev`
2. **Deploy to Dev**: `./scripts/deploy.sh dev`
3. **Test Dev**: Verify functionality
4. **Deploy to Staging**: `./scripts/deploy.sh staging`
5. **Test Staging**: Full integration testing
6. **Deploy to Production**: `./scripts/deploy.sh production`
7. **Monitor**: Watch logs and metrics

## Rollback

If a deployment fails:
1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your worker
3. Click "Deployments" tab
4. Find previous working version
5. Click "Rollback to this deployment"

## CI/CD Ready

The configuration supports automated deployments via GitHub Actions or other CI/CD tools. See `apps/worker/DEPLOYMENT.md` for example workflows.

## Security Notes

- ✅ API keys are stored as Cloudflare secrets (not in code)
- ✅ CORS origins are restricted per environment
- ✅ Each environment has isolated databases
- ✅ Production deployments require confirmation

## Next Steps

1. **Create D1 databases** in Cloudflare
2. **Update database IDs** in `wrangler.toml`
3. **Set up custom domains** in Cloudflare Dashboard
4. **Configure secrets** using `setup-secrets.sh`
5. **Deploy to dev** and test
6. **Deploy to staging** for final testing
7. **Deploy to production** when ready

## Documentation

- Full deployment guide: `apps/worker/DEPLOYMENT.md`
- Wrangler config: `apps/worker/wrangler.toml`
- Example secrets: `apps/worker/.env.example`

---

**Status**: ✅ Configuration Complete, Ready for Initial Setup
**Date**: November 2024
