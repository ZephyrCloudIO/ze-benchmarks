# Testing the New Multi-Environment Setup

This guide shows you how to test the new wrangler configuration with local environment and migration system.

## Quick Test Checklist

### ✅ 1. Test Root-Level Scripts

```bash
# Test migration command (from root)
pnpm db:migrate
# Expected: "No migrations to apply!" (if already migrated)
# Or: Shows migration progress

# Test worker start (from root)
pnpm dev:worker
# Expected: Worker starts on http://localhost:8787

# In another terminal, test health endpoint
curl http://localhost:8787/health
# Expected: {"status":"ok","timestamp":"2025-..."}
```

### ✅ 2. Test Database Migrations

```bash
# Check what migrations exist
ls apps/worker/drizzle/*.sql

# Apply migrations explicitly
cd apps/worker
pnpm db:migrate:local
# Expected: "No migrations to apply!" or applies pending migrations

# Check migration status
npx wrangler d1 migrations list ze-benchmarks-local --local
# Expected: Shows list of applied migrations
```

### ✅ 3. Test Worker API Endpoints

```bash
# Make sure worker is running first
pnpm dev:worker

# In another terminal:

# Test health
curl http://localhost:8787/health

# Test stats
curl http://localhost:8787/api/stats

# Test runs list
curl http://localhost:8787/api/runs

# Test batches
curl http://localhost:8787/api/batches
```

### ✅ 4. Test Optional Production Sync (If You Have Access)

```bash
# This will only work if you have access to production D1
pnpm db:sync
# Expected: Asks for confirmation, then syncs data from production

# Or use the full command
cd apps/worker
pnpm db:sync-from-prod
```

### ✅ 5. Test Complete Flow (End-to-End)

```bash
# Terminal 1: Start worker
pnpm dev:worker

# Terminal 2: Run a benchmark
pnpm bench test-suite test-scenario L0 echo

# Expected output:
# - Worker receives the run data
# - Evaluations execute
# - Results stored in D1
# - Success message

# Terminal 3: View in dashboard
pnpm dev:dashboard
# Open http://localhost:3000
# Expected: See your test run in the UI
```

### ✅ 6. Test Dashboard Connection

```bash
# Make sure worker is running
pnpm dev:worker

# Start dashboard
pnpm dev:dashboard

# Open browser: http://localhost:3000
# Expected:
# - Dashboard loads without errors
# - Shows stats from worker API
# - Can view runs and batches
```

## Testing Deployment Scripts

### Test Dev Deployment (Requires Cloudflare Access)

```bash
# Deploy to dev environment
pnpm deploy:dev

# Or use the script directly
cd apps/worker
./scripts/deploy.sh dev

# Expected:
# - Deploys to bench-api-dev.zephyr-cloud.io
# - Shows success message
# - Provides post-deployment checklist
```

### Test Migration on Remote Environment

```bash
# Apply migrations to dev
cd apps/worker
pnpm db:migrate:dev

# Or from root
# (Note: root only has db:migrate for local)
```

## Troubleshooting Tests

### Issue: "No migrations to apply" but DB seems empty

```bash
# Check if local DB file exists
ls -la apps/worker/.wrangler/state/v3/d1/

# If needed, delete and recreate
rm -rf apps/worker/.wrangler/state/v3/d1/
pnpm db:migrate

# Or sync from production
pnpm db:sync
```

### Issue: Worker won't start

```bash
# Check if port 8787 is already in use
lsof -ti:8787

# Kill existing process if needed
lsof -ti:8787 | xargs kill -9

# Try again
pnpm dev:worker
```

### Issue: Benchmark fails with "Worker not available"

```bash
# Verify worker is running
curl http://localhost:8787/health

# If not running, start it
pnpm dev:worker

# Then try benchmark again
pnpm bench test-suite test-scenario L0 echo
```

### Issue: Dashboard shows no data

```bash
# Check if worker is running and accessible
curl http://localhost:8787/api/stats

# Check worker logs for errors
# (Worker logs are in the terminal where you ran pnpm dev:worker)

# Try running a test benchmark first
pnpm bench test-suite test-scenario L0 echo
```

## Verification Commands

### Check Everything is Working

```bash
# 1. Worker health
curl http://localhost:8787/health | jq

# 2. Database has tables
cd apps/worker
npx wrangler d1 execute ze-benchmarks-local --local --command "SELECT name FROM sqlite_master WHERE type='table'"

# 3. Check for data
npx wrangler d1 execute ze-benchmarks-local --local --command "SELECT COUNT(*) as count FROM benchmark_runs"

# 4. List applied migrations
npx wrangler d1 migrations list ze-benchmarks-local --local
```

## Performance Test

Run a quick benchmark to test the entire pipeline:

```bash
# Terminal 1: Worker (leave running)
pnpm dev:worker

# Terminal 2: Run benchmark
time pnpm bench test-suite test-scenario L0 echo

# Terminal 3: Check results
curl http://localhost:8787/api/runs?limit=1 | jq

# Terminal 4: View in dashboard
pnpm dev:dashboard
# Open http://localhost:3000
```

## Testing New Migration Files

If you want to test adding a new migration:

```bash
cd apps/worker

# 1. Modify schema (example)
# Edit src/db/schema.ts and add a new column

# 2. Generate migration
pnpm db:generate

# 3. Check new migration file
ls -la drizzle/

# 4. Apply migration
pnpm db:migrate:local

# 5. Verify
npx wrangler d1 execute ze-benchmarks-local --local --command "PRAGMA table_info(benchmark_runs)"
```

## Success Criteria

Your setup is working correctly if:

- ✅ `pnpm db:migrate` runs without errors
- ✅ `pnpm dev:worker` starts worker successfully
- ✅ `curl http://localhost:8787/health` returns OK
- ✅ `pnpm bench test-suite test-scenario L0 echo` completes successfully
- ✅ Dashboard at http://localhost:3000 shows the test run
- ✅ All API endpoints return valid JSON

## Next Steps

Once everything is working:

1. **Run the full test suite**: `./test-benchmarks.sh`
2. **Try with real agents**: `pnpm bench update-deps nx-pnpm-monorepo L1 anthropic`
3. **Set up remote environments**: Follow `apps/worker/DEPLOYMENT.md`
4. **Create new benchmarks**: See `docs/ADDING-BENCHMARKS.md`

---

**Quick Reference:**
- Health: `curl http://localhost:8787/health`
- Stats: `curl http://localhost:8787/api/stats`
- Runs: `curl http://localhost:8787/api/runs`
- Dashboard: `http://localhost:3000`
