# Next.js Specialist - Complete Workflow

This guide walks through creating, enriching, and testing a Next.js specialist.

## Step 1: Create Next.js Specialist Template

```bash
cd packages/specialist-engine
pnpm exec tsx examples/create-nextjs-specialist.ts
```

This will:
- Extract knowledge from Next.js documentation
- Generate a template skeleton matching shadcn format
- Create enriched version with documentation metadata
- Generate tier-based prompts (L0-Lx)

**Output:** `starting_from_outcome/nextjs-specialist/nextjs-specialist-template.json5`

## Step 2: Enrich the Template (Optional)

If you want to add more documentation or update enrichment:

```bash
cd packages/specialist-engine
pnpm exec tsx examples/enrich-nextjs-specialist.ts
```

Or use the CLI:

```bash
cd packages/specialist-engine
pnpm exec tsx src/cli/index.ts enrich
```

This will:
- Load the existing template
- Enrich documentation entries with metadata
- Create a new enriched version (enriched-002.json5, etc.)

## Step 3: Run Benchmarks with Specialist

### Option A: Run Individual Benchmark

```bash
# From project root
pnpm bench next.js 001-server-component L1 openrouter \
  --model anthropic/claude-sonnet-4.5 \
  --specialist @zephyr/nextjs-specialist
```

### Option B: Run Multiple Benchmarks (Script)

```bash
cd packages/specialist-engine
pnpm exec tsx examples/run-nextjs-benchmarks.ts
```

This script will run several Next.js scenarios with the specialist.

### Option C: Interactive Mode

```bash
# From project root
pnpm bench
```

Then select:
- Suite: `next.js`
- Scenarios: Choose one or more
- Tiers: `L1` (or others)
- Agents: `openrouter`
- Model: `anthropic/claude-sonnet-4.5`
- Specialist: `@zephyr/nextjs-specialist` (if prompted)

## Step 4: View Results

Results are automatically saved to the database. You can:

1. **View in web dashboard:**
   ```bash
   pnpm dash:dev
   # Open http://localhost:3000
   ```

2. **View via CLI:**
   ```bash
   pnpm stats
   pnpm batches
   ```

## Troubleshooting

### Template Not Found
- Ensure template is at: `starting_from_outcome/nextjs-specialist/nextjs-specialist-template.json5`
- Check the specialist name matches: `@zephyr/nextjs-specialist`

### API Key Missing
- Set `OPENROUTER_API_KEY` in `.env` file at project root
- Or export: `export OPENROUTER_API_KEY=your-key`

### Worker Not Running
- Start worker: `cd apps/worker && pnpm dev`
- Or from root: `pnpm worker:dev`

## File Locations

- **Template:** `starting_from_outcome/nextjs-specialist/nextjs-specialist-template.json5`
- **Enriched:** `starting_from_outcome/nextjs-specialist/enriched/{version}/enriched-*.json5`
- **Tier Prompts:** `starting_from_outcome/nextjs-specialist/prompts/nextjs-setup/L*.md`
- **Results:** Stored in database at `apps/benchmark-report/public/benchmarks.db`

