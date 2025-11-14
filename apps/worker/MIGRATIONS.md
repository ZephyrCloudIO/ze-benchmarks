# Database Migrations Guide

This guide explains how to work with database migrations for the ze-benchmarks worker.

## Overview

We use [Drizzle ORM](https://orm.drizzle.team/) for database schema management and migrations. Drizzle automatically generates migration files based on schema changes.

## Migration Workflow

### 1. Modify Database Schema

Edit the schema file:

```typescript
// apps/worker/src/db/schema.ts

export const benchmarkRuns = sqliteTable('benchmark_runs', {
  id: text('id').primaryKey(),
  suite: text('suite').notNull(),
  scenario: text('scenario').notNull(),
  // Add new columns here
  newColumn: text('new_column'),
});
```

### 2. Generate Migration

Run the migration generator:

```bash
cd apps/worker
pnpm db:generate
```

This will:
- Analyze your schema changes
- Create a new SQL migration file in `drizzle/`
- Update `drizzle/meta/_journal.json`

**Example output:**
```
drizzle/0001_new_feature.sql created
drizzle/meta/_journal.json updated
```

### 3. Apply Migrations

Apply migrations to your environments:

```bash
# Local development
pnpm db:migrate:local

# Remote environments
pnpm db:migrate:dev
pnpm db:migrate:staging
pnpm db:migrate:production
```

**Important:** The `migrations apply` command:
- Automatically detects and applies **all pending migrations**
- Runs migrations in the correct order (based on the journal)
- Tracks which migrations have been applied
- Is idempotent (safe to run multiple times)

### 4. Verify Migration

Check that the migration was applied:

```bash
# List applied migrations
wrangler d1 migrations list ze-benchmarks-local --local
wrangler d1 migrations list ze-benchmarks-prod --env production --remote

# Test with a query
wrangler d1 execute ze-benchmarks-local --local --command "SELECT * FROM benchmark_runs LIMIT 1"
```

## Migration File Structure

```
apps/worker/drizzle/
├── 0000_quiet_turbo.sql       # Initial schema
├── 0001_new_feature.sql       # Your new migration
├── 0002_another_change.sql    # Next migration
└── meta/
    ├── _journal.json          # Migration tracking
    ├── 0000_snapshot.json
    ├── 0001_snapshot.json
    └── 0002_snapshot.json
```

## Best Practices

### 1. Test Migrations Locally First

Always test migrations in local environment before remote:

```bash
# Test locally
pnpm db:migrate:local

# Run tests to verify
pnpm test

# If all good, apply to dev
pnpm db:migrate:dev
```

### 2. Progressive Deployment

Follow this order for deployments:

1. **Local** → Test with local data
2. **Dev** → Test in dev environment
3. **Staging** → Full integration testing
4. **Production** → Final deployment

```bash
pnpm db:migrate:local   && pnpm test
pnpm db:migrate:dev     && pnpm deploy:dev
pnpm db:migrate:staging && pnpm deploy:staging
pnpm db:migrate:production && pnpm deploy:production
```

### 3. Backward Compatible Changes

When possible, make migrations backward compatible:

**Good:**
```sql
-- Add nullable column (safe)
ALTER TABLE benchmark_runs ADD COLUMN new_field TEXT;

-- Add column with default (safe)
ALTER TABLE benchmark_runs ADD COLUMN status TEXT DEFAULT 'pending';
```

**Risky:**
```sql
-- Dropping columns (data loss)
ALTER TABLE benchmark_runs DROP COLUMN old_field;

-- Changing column types (potential data loss)
-- SQLite doesn't support ALTER COLUMN - requires table recreation
```

### 4. Review Generated SQL

Always review the generated SQL before applying:

```bash
# Check the latest migration file
cat drizzle/0001_*.sql
```

### 5. Commit Migrations to Git

Migration files should be committed to version control:

```bash
git add drizzle/
git commit -m "feat: add new_column to benchmark_runs table"
```

## Common Operations

### Add a New Table

```typescript
// src/db/schema.ts
export const newTable = sqliteTable('new_table', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

```bash
pnpm db:generate
pnpm db:migrate:local
```

### Add a Column

```typescript
// Modify existing table
export const benchmarkRuns = sqliteTable('benchmark_runs', {
  // ... existing columns
  newField: text('new_field'),
});
```

```bash
pnpm db:generate
pnpm db:migrate:local
```

### Create an Index

```typescript
export const benchmarkRuns = sqliteTable('benchmark_runs', {
  // ... columns
}, (table) => ({
  suiteIdx: index('suite_idx').on(table.suite),
  scenarioIdx: index('scenario_idx').on(table.scenario),
}));
```

```bash
pnpm db:generate
pnpm db:migrate:local
```

## Troubleshooting

### Migration Failed Midway

If a migration fails, D1 tracks which migrations succeeded:

```bash
# Check which migrations have been applied
wrangler d1 migrations list ze-benchmarks-local --local

# The failed migration won't be marked as applied
# Fix the issue and run again
pnpm db:migrate:local
```

### Schema Drift

If your local schema doesn't match remote:

```bash
# Export production schema
wrangler d1 export ze-benchmarks-prod --remote --output=prod-schema.sql --no-data

# Compare with local
wrangler d1 export ze-benchmarks-local --local --output=local-schema.sql --no-data

# Use diff to compare
diff prod-schema.sql local-schema.sql
```

### Reset Local Database

If you need to start fresh:

```bash
# Option 1: Delete local database file
rm -rf .wrangler/state/v3/d1/miniflare-D1DatabaseObject

# Option 2: Sync from production
pnpm db:sync-from-prod
```

## Advanced: Manual Migrations

In rare cases, you might need to write custom SQL:

```bash
# Create a new migration file manually
touch drizzle/0003_custom_migration.sql
```

```sql
-- drizzle/0003_custom_migration.sql
-- Custom data transformation
UPDATE benchmark_runs
SET status = 'completed'
WHERE completed_at IS NOT NULL;
```

Update the journal manually and apply:

```bash
pnpm db:migrate:local
```

**Note:** This is not recommended unless absolutely necessary. Let Drizzle generate migrations when possible.

## Resources

- [Drizzle ORM Migrations](https://orm.drizzle.team/docs/migrations)
- [Cloudflare D1 Migrations](https://developers.cloudflare.com/d1/platform/migrations/)
- [SQLite ALTER TABLE](https://www.sqlite.org/lang_altertable.html)

---

**Last Updated**: November 2024
