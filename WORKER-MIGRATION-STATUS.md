# Worker Migration Status

## Goal
Remove local SQLite database and make the Cloudflare Worker the ONLY data storage system. Worker must be running locally for benchmarks to work.

## Progress

### ✅ Completed

1. **Created `@ze/worker-client` package** (`packages/worker-client/`)
   - Drop-in replacement for `@ze/database`
   - HTTP client for Worker API
   - Same `BenchmarkLogger` interface for compatibility
   - Built successfully

2. **Updated harness package** (`packages/harness/`)
   - Changed dependency from `@ze/database` to `@ze/worker-client`
   - Updated import in `cli.ts`
   - No other code changes needed (same API)

3. **Build system working**
   - All packages compile successfully
   - Worker-client TypeScript types resolved

### 🚧 In Progress

4. **Remove old database package**
   - Delete `packages/database/` directory
   - Remove from workspace
   - Remove SQLite files from `benchmark-report/public/`

### ⏳ To Do

5. **Update web dashboard** (`benchmark-report/`)
   - Replace `sql.js` with Worker API client
   - Fetch data from `http://localhost:8787/api/*` instead of SQLite file
   - Update all database queries to API calls

6. **Update environment configuration**
   - Add `ZE_BENCHMARKS_WORKER_URL=http://localhost:8787` to `.env.example`
   - Add `ZE_BENCHMARKS_API_KEY=dev-local-key` to `.env.example`
   - Document that worker must be running

7. **Create dev workflow scripts**
   - `pnpm dev` - Start both worker AND dashboard together
   - `pnpm dev:worker` - Start worker only
   - `pnpm dev:frontend` - Start dashboard only
   - Update `mprocs` config for parallel startup

8. **Update test scripts**
   - `test-benchmarks.sh` - Check worker is running before tests
   - Add automatic worker startup option
   - Fail fast if worker not accessible

9. **Update documentation**
   - `README.md` - Worker required for all operations
   - `TESTING.md` - How to start worker
   - `TESTING-QUICK-REFERENCE.md` - Worker commands
   - Remove SQLite references

10. **Database initialization**
    - Ensure D1 migrations run automatically
    - Or provide clear "first-time setup" instructions
    - `cd worker && pnpm db:push:local`

## Current Architecture

### Before (Local SQLite)
```
Harness → Local SQLite file ← Dashboard
          (benchmark-report/public/benchmarks.db)
```

### After (Worker Only)
```
Harness → Worker API → D1 Database ← Dashboard
          (http://localhost:8787)
```

## Required Dev Workflow

### Before running ANY benchmarks:

```bash
# Terminal 1: Start worker
cd worker
pnpm dev

# Terminal 2: Run benchmarks
pnpm bench test-suite test-scenario L0 echo

# Terminal 3: View results
pnpm dev:frontend
```

## API Endpoints Used

- `POST /api/results` - Submit benchmark run
- `POST /api/results/batch` - Submit batch
- `GET /api/runs` - List all runs
- `GET /api/runs/:id` - Get run details
- `GET /api/batches` - List all batches
- `GET /api/batches/:id` - Get batch details
- `GET /api/stats` - Get global stats
- `GET /health` - Health check

## Breaking Changes

### For Users

1. **Worker must be running** - No longer works offline
2. **Network dependency** - Requires localhost:8787 accessible
3. **Database setup** - Must run D1 migrations first time

### For Developers

1. **No more SQLite package** - Use `@ze/worker-client` instead
2. **Async everywhere** - All database operations are now HTTP calls
3. **Error handling** - Network errors possible, handle timeouts

## Rollback Plan

If issues arise:

```bash
# Revert changes
git checkout main packages/harness/
git checkout main packages/worker-client/

# Reinstall
pnpm install

# Rebuild
pnpm build
```

The old `@ze/database` package is preserved in git history.

## Next Steps

1. Test worker-only flow end-to-end
2. Update dashboard to use Worker API
3. Remove old database package
4. Update all documentation
5. Create easy startup script
6. Test with all agents
7. Update CI/CD if applicable

## Questions to Resolve

1. How to handle worker not running? Fail fast or start automatically?
2. Should we provide Docker Compose for easy startup?
3. Do we need a "local development mode" that's simpler?
4. How to handle database migrations on first run?

## Files Modified

- ✅ `packages/worker-client/` (new package)
- ✅ `packages/harness/package.json`
- ✅ `packages/harness/src/cli.ts`
- ⏳ `.env.example`
- ⏳ `package.json` (root - dev scripts)
- ⏳ `.mprocs.yaml` (if using mprocs)
- ⏳ `benchmark-report/src/` (multiple files)
- ⏳ `README.md`
- ⏳ `TESTING.md`
- ⏳ `test-benchmarks.sh`
