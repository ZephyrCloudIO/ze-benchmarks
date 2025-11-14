# Worker Scripts

Collection of utility scripts for managing the ze-benchmarks worker.

## Available Scripts

### `deploy.sh`

Automated deployment script with environment validation and safety checks.

```bash
# Deploy to dev
./scripts/deploy.sh dev

# Deploy to staging
./scripts/deploy.sh staging

# Deploy to production (requires confirmation)
./scripts/deploy.sh production
```

**Features:**
- Environment validation
- Production deployment confirmation
- Database migration warnings
- Post-deployment checklist

### `setup-secrets.sh`

Interactive script for configuring environment secrets (API keys).

```bash
# Set up secrets for an environment
./scripts/setup-secrets.sh dev
./scripts/setup-secrets.sh staging
./scripts/setup-secrets.sh production
```

**Features:**
- Auto-generation of secure random keys
- Interactive prompts
- Environment-specific configuration

### `sync-from-production.sh`

Optional script to populate your local database with production data.

```bash
# Sync local database from production
./scripts/sync-from-production.sh

# Or use npm script
pnpm db:sync-from-prod
```

**Features:**
- Exports full production database
- Imports into local D1 database
- Confirmation prompt before overwriting
- Automatic cleanup

**Use cases:**
- Testing with real data locally
- Debugging production issues
- Development with realistic datasets

**Warning:** This will overwrite your local database. Make sure you have backups if needed.

## Usage with NPM Scripts

All scripts can be run via package.json scripts:

```bash
# Deployment
pnpm deploy:dev
pnpm deploy:staging
pnpm deploy:production

# Database migrations (apply all pending migrations)
pnpm db:migrate:local
pnpm db:migrate:dev
pnpm db:migrate:staging
pnpm db:migrate:production

# Database sync (optional - populates local from production)
pnpm db:sync-from-prod
```

## Requirements

- Wrangler CLI installed and authenticated
- Access to the production Cloudflare account
- Proper permissions for D1 database access
