# Worker Deployment Guide

This guide covers deploying the ze-benchmarks worker to multiple environments on Cloudflare.

## Environments

We support three remote environments plus local development:

| Environment | Domain | Purpose |
|------------|---------|---------|
| **Local** | `localhost:8787` | Local development and testing |
| **Dev** | `bench-api-dev.zephyr-cloud.io` | Development/testing environment |
| **Staging** | `bench-api-stg.zephyr-cloud.io` | Pre-production testing |
| **Production** | `bench-api.zephyr-cloud.io` | Production environment |

## Prerequisites

1. **Cloudflare Account**: You need a Cloudflare account with Workers enabled
2. **Wrangler CLI**: Installed and authenticated
3. **Custom Domain**: `zephyr-cloud.io` must be added to your Cloudflare account
4. **D1 Databases**: Create three D1 databases (one for each remote environment)

## Initial Setup

### 1. Install Wrangler

```bash
npm install -g wrangler

# Login to Cloudflare
wrangler login
```

### 2. Create D1 Databases

Create a D1 database for each environment:

```bash
# Development database
wrangler d1 create ze-benchmarks-dev

# Staging database
wrangler d1 create ze-benchmarks-staging

# Production database
wrangler d1 create ze-benchmarks-prod
```

Save the database IDs that are returned. You'll need them for the next step.

### 3. Update wrangler.toml

Edit `wrangler.toml` and replace the placeholder database IDs:

```toml
# Find these sections and update with your actual database IDs
[env.dev.d1_databases]
database_id = "YOUR_ACTUAL_DEV_DATABASE_ID"

[env.staging.d1_databases]
database_id = "YOUR_ACTUAL_STAGING_DATABASE_ID"

[env.production.d1_databases]
database_id = "YOUR_ACTUAL_PRODUCTION_DATABASE_ID"
```

### 4. Set Up Custom Domains

In Cloudflare Dashboard:
1. Go to your domain (`zephyr-cloud.io`)
2. Navigate to Workers & Pages → Your Worker
3. Add custom domains for each environment:
   - `bench-api-dev.zephyr-cloud.io`
   - `bench-api-stg.zephyr-cloud.io`
   - `bench-api.zephyr-cloud.io`

### 5. Initialize Database Schemas

Run migrations for each environment:

```bash
# Development
pnpm db:push:dev

# Staging
pnpm db:push:staging

# Production
pnpm db:push:production
```

### 6. Configure Secrets

Use the helper script to set up API secrets:

```bash
# Development environment
./scripts/setup-secrets.sh dev

# Staging environment
./scripts/setup-secrets.sh staging

# Production environment
./scripts/setup-secrets.sh production
```

Or manually set secrets:

```bash
# Generate a secure random key
openssl rand -base64 32

# Set for each environment
echo "your-secret-key" | wrangler secret put API_SECRET_KEY --env dev
echo "your-secret-key" | wrangler secret put API_SECRET_KEY --env staging
echo "your-secret-key" | wrangler secret put API_SECRET_KEY --env production
```

## Deployment

### Quick Deployment

Use the deployment script:

```bash
# Deploy to development
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires confirmation)
./scripts/deploy.sh production
```

### Manual Deployment

Or use npm scripts directly:

```bash
# Deploy to development
pnpm deploy:dev

# Deploy to staging
pnpm deploy:staging

# Deploy to production
pnpm deploy:production
```

## Post-Deployment Verification

After deploying, verify the deployment:

### 1. Health Check

```bash
# Development
curl https://bench-api-dev.zephyr-cloud.io/health

# Staging
curl https://bench-api-stg.zephyr-cloud.io/health

# Production
curl https://bench-api.zephyr-cloud.io/health
```

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Test API Endpoints

```bash
# Get statistics (public endpoint)
curl https://bench-api.zephyr-cloud.io/api/stats

# List runs (public endpoint)
curl https://bench-api.zephyr-cloud.io/api/runs?limit=10
```

### 3. Test Authenticated Endpoints

```bash
# Submit a test result (requires API key)
curl -X POST https://bench-api.zephyr-cloud.io/api/results \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d @test-payload.json
```

## Configuring Clients

Update your client configuration to use the deployed worker:

### Development/Staging

```bash
# .env file
ZE_BENCHMARKS_WORKER_URL=https://bench-api-dev.zephyr-cloud.io
ZE_BENCHMARKS_API_KEY=your-dev-api-key
```

### Production

```bash
# .env file
ZE_BENCHMARKS_WORKER_URL=https://bench-api.zephyr-cloud.io
ZE_BENCHMARKS_API_KEY=your-production-api-key
```

## Environment Variables

Each environment has specific variables configured in `wrangler.toml`:

### Development
- `ENVIRONMENT=dev`
- `ALLOWED_ORIGINS=https://bench-dev.zephyr-cloud.io,http://localhost:3000`

### Staging
- `ENVIRONMENT=staging`
- `ALLOWED_ORIGINS=https://bench-stg.zephyr-cloud.io,http://localhost:3000`

### Production
- `ENVIRONMENT=production`
- `ALLOWED_ORIGINS=https://bench.zephyr-cloud.io,https://app.zephyr-cloud.io`

## Database Migrations

When you need to update the database schema:

### 1. Generate Migration

```bash
# Update your Drizzle schema in src/db/schema.ts
# Then generate migration
pnpm db:generate
```

This creates a new migration file in `drizzle/`.

### 2. Apply Migration

```bash
# Apply to specific environment
pnpm db:push:dev
pnpm db:push:staging
pnpm db:push:production
```

### 3. Test Migration

Always test migrations in dev/staging before production:

1. Apply to dev → test → verify
2. Apply to staging → test → verify
3. Apply to production

## Rollback Procedure

If a deployment fails:

### 1. Immediate Rollback

Cloudflare keeps previous versions. Rollback via dashboard:
1. Go to Workers & Pages → Your Worker
2. Click "Deployments" tab
3. Find previous working version
4. Click "Rollback to this deployment"

### 2. Fix and Redeploy

```bash
# Fix the issue locally
# Test thoroughly
pnpm dev

# Redeploy
./scripts/deploy.sh production
```

## Monitoring

### View Logs

```bash
# Tail logs for specific environment
wrangler tail --env production

# Filter by status
wrangler tail --env production --status error
```

### Metrics

View metrics in Cloudflare Dashboard:
- Workers & Pages → Your Worker → Metrics
- Monitor request rate, errors, CPU time

## Troubleshooting

### Deployment Fails

```bash
# Check wrangler configuration
wrangler deploy --dry-run --env production

# Verify authentication
wrangler whoami

# Check for syntax errors
pnpm build
```

### Database Connection Issues

```bash
# List D1 databases
wrangler d1 list

# Execute test query
wrangler d1 execute ze-benchmarks-prod --env production --command "SELECT 1"

# Check migrations were applied
wrangler d1 execute ze-benchmarks-prod --env production --command "SELECT name FROM sqlite_master WHERE type='table'"
```

### CORS Issues

If clients can't connect:
1. Check `ALLOWED_ORIGINS` in `wrangler.toml`
2. Verify custom domain is properly configured
3. Check SSL certificate status

### Secret Not Found

```bash
# List all secrets for environment
wrangler secret list --env production

# Set missing secret
wrangler secret put API_SECRET_KEY --env production
```

## CI/CD Integration

For automated deployments:

### GitHub Actions Example

```yaml
name: Deploy Worker

on:
  push:
    branches:
      - main # production
      - staging # staging
      - develop # dev

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: pnpm install

      - name: Deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
        run: |
          if [ "$GITHUB_REF" == "refs/heads/main" ]; then
            pnpm deploy:production
          elif [ "$GITHUB_REF" == "refs/heads/staging" ]; then
            pnpm deploy:staging
          else
            pnpm deploy:dev
          fi
```

## Security Best Practices

1. **API Keys**: Never commit API keys to git
2. **Secrets**: Use Wrangler secrets for sensitive data
3. **CORS**: Restrict `ALLOWED_ORIGINS` to known domains
4. **Rate Limiting**: Consider adding rate limiting for public endpoints
5. **Monitoring**: Set up alerts for errors and unusual traffic

## Support

For issues or questions:
1. Check Cloudflare Workers documentation
2. Review worker logs: `wrangler tail`
3. Check Cloudflare Dashboard for service status
4. Contact team for access/permission issues

---

**Last Updated**: 2024
**Maintainer**: Zephyr Team
