# Setup Guide

This guide will help you set up the ze-benchmarks system with Cloudflare Worker + D1 backend.

## Architecture Overview

The system now consists of:

1. **Cloudflare Worker API**: Serverless backend for persisting benchmark results
2. **D1 Database**: SQLite-compatible serverless database
3. **CLI**: Local benchmarking tool that POSTs results to the Worker
4. **Frontend**: React app that fetches data from the Worker API

Both local development and production use the same architecture - just different URLs.

## Prerequisites

- Node.js 24+
- pnpm 8+
- Cloudflare account (for deployment)
- Wrangler CLI (`pnpm add -g wrangler`)

## Initial Setup

### 1. Install Dependencies

```bash
# Install all dependencies
pnpm install

# Install frontend dependencies
cd benchmark-report && pnpm install
```

### 2. Set Up Environment Variables

```bash
# Copy the example file
cp .env.example .env

# Edit .env and configure:
# - ZE_BENCHMARKS_WORKER_URL (http://localhost:8787 for local)
# - ZE_BENCHMARKS_API_KEY (dev-local-key for local)
# - Agent API keys if testing with real agents
```

### 3. Set Up Cloudflare D1 Database

```bash
cd worker

# Create D1 database (first time only)
wrangler d1 create ze-benchmarks

# Copy the database_id from output and update worker/wrangler.toml
# Replace the empty database_id with your actual ID

# Generate and apply migrations
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

### 4. Update wrangler.toml

Edit `worker/wrangler.toml` and set:
- `database_id` from the previous step
- `API_SECRET_KEY` for production (or use dev-local-key for local)

## Running Locally

### Option 1: Single Command (Recommended)

```bash
# Start both Worker and Frontend with one command
pnpm dev
```

This uses mprocs to run both services. Press `q` to quit all processes.

### Option 2: Separate Terminals

Terminal 1 (Worker):
```bash
cd worker
pnpm dev
```

Terminal 2 (Frontend):
```bash
cd benchmark-report
pnpm dev
```

Terminal 3 (Run benchmarks):
```bash
# Example: Run a benchmark
pnpm --filter packages/harness cli run \
  --suite update-deps \
  --scenario nx-pnpm-monorepo \
  --tier L0 \
  --agent echo
```

## Deployment

### Deploy Worker

```bash
cd worker

# Deploy to production
wrangler deploy

# Set production secrets
wrangler secret put API_SECRET_KEY
# Enter a secure random key (generate with: openssl rand -hex 32)
```

### Deploy Frontend

The frontend can be deployed to any static hosting service:

```bash
cd benchmark-report

# Build for production
pnpm build

# Deploy dist/ directory to your hosting service
# (Vercel, Netlify, Cloudflare Pages, etc.)
```

Remember to set `VITE_API_URL` to your production Worker URL before building.

### Configure GitHub Secrets

See `SECRETS.md` for the list of secrets needed for CI/CD.

## Verifying Setup

### 1. Check Worker Health

```bash
curl http://localhost:8787/health
# Should return: {"status":"ok","timestamp":"..."}
```

### 2. Run a Test Benchmark

```bash
pnpm --filter packages/harness cli run \
  --suite update-deps \
  --scenario nx-pnpm-monorepo \
  --tier L0 \
  --agent echo
```

Check the console output for:
- "📊 Benchmark results will be submitted to: http://localhost:8787"
- "📤 Submitting results to http://localhost:8787/api/results"
- "✅ Results submitted successfully"

### 3. View Results

Open http://localhost:3000 in your browser to see the dashboard with your benchmark results.

## Troubleshooting

### Worker not receiving data

Check that:
- Worker is running (`pnpm dev` in worker directory)
- `ZE_BENCHMARKS_WORKER_URL` is set correctly in `.env`
- No firewall blocking localhost:8787

### Frontend showing no data

Check that:
- Worker API is running and accessible
- `VITE_API_URL` is set correctly (default: http://localhost:8787)
- Browser console for any CORS or fetch errors

### D1 database errors

```bash
cd worker

# Check database status
wrangler d1 list

# Re-run migrations if needed
pnpm drizzle-kit migrate
```

## Architecture Decisions

- **Drizzle ORM**: Type-safe database queries with D1
- **TanStack Query**: Client-side data fetching with caching
- **itty-router**: Lightweight routing for Cloudflare Workers
- **Unified Architecture**: Same Worker + D1 pattern for local and production

## Next Steps

- Configure GitHub secrets for CI/CD
- Deploy Worker to production
- Deploy Frontend to your hosting service
- Update CLI to use production Worker URL in CI

## Support

For issues or questions, check:
- Implementation Plan: `IMPLEMENTATION_PLAN.md`
- Environment Variables: `.env.example`
- GitHub Secrets: `SECRETS.md`
