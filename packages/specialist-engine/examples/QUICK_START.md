# Quick Start: Next.js Specialist

## Prerequisites

1. **Environment Variables** - Set in `.env` at project root:
   ```bash
   OPENROUTER_API_KEY=your-key-here
   ```

2. **Verify Setup**:
   ```bash
   cd packages/specialist-engine
   pnpm install
   ```

## Step 1: Create Next.js Specialist Template

This will extract knowledge from Next.js docs and create the initial template:

```bash
cd packages/specialist-engine
pnpm exec tsx examples/create-nextjs-specialist.ts
```

**Expected Output:**
- Creates: `starting_from_outcome/nextjs-specialist/nextjs-specialist-template.json5`
- Creates: `starting_from_outcome/nextjs-specialist/enriched/1.0.0/enriched-001.json5`
- Creates: `starting_from_outcome/nextjs-specialist/README.md`

**What it does:**
- Extracts knowledge from Next.js documentation URLs
- Generates template skeleton with all sections (matching shadcn format)
- Uses template substitution to fill domain/framework values
- Enriches documentation with metadata
- Generates tier-based prompts (L0-Lx)

## Step 2: Enrich Template (Optional)

If you want to add more documentation or update enrichment:

```bash
cd packages/specialist-engine
pnpm exec tsx examples/enrich-nextjs-specialist.ts
```

**What it does:**
- Loads existing template
- Enriches documentation entries with metadata
- Creates new enriched version: `enriched-002.json5`, `enriched-003.json5`, etc.
- Allows rollback by keeping numbered versions

**Or use CLI:**
```bash
cd packages/specialist-engine
pnpm exec tsx src/cli/index.ts enrich
```

## Step 3: Run Benchmarks with Specialist

### Option A: Run Script (Multiple Scenarios)

```bash
cd packages/specialist-engine
pnpm exec tsx examples/run-nextjs-benchmarks.ts
```

This runs:
- `next.js/001-server-component` (L1)
- `next.js/002-client-component` (L1)
- `next.js/003-cookies` (L1)
- `next.js/004-search-params` (L1)

### Option B: Run Single Benchmark

```bash
# From project root
pnpm bench next.js 001-server-component L1 openrouter \
  --model anthropic/claude-sonnet-4.5 \
  --specialist @zephyr/nextjs-specialist
```

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

### View Statistics
```bash
pnpm stats
```

### View Batches
```bash
pnpm batches
```

### View in Dashboard
```bash
pnpm dash:dev
# Open http://localhost:3000
```

## Troubleshooting

### Template Not Found
**Error:** `Specialist template not found: starting_from_outcome/nextjs-specialist-template.json5`

**Solution:** 
1. Run Step 1 to create the template first
2. Verify file exists: `ls starting_from_outcome/nextjs-specialist/`

### JSON5 Parse Error
**Error:** `JSON5.parse is not a function`

**Solution:** Fixed! Make sure you have the latest code. The import was changed from dynamic to static.

### API Key Missing
**Error:** `OPENROUTER_API_KEY environment variable is required`

**Solution:**
1. Create `.env` file at project root
2. Add: `OPENROUTER_API_KEY=your-key-here`
3. Or export: `export OPENROUTER_API_KEY=your-key-here`

### Specialist Not Found During Benchmark
**Error:** `Specialist template not found`

**Solution:**
- Verify specialist name: `@zephyr/nextjs-specialist`
- Verify template path: `starting_from_outcome/nextjs-specialist/nextjs-specialist-template.json5`
- The specialist name gets converted to: `nextjs-specialist-template.json5`

## File Structure

After creating the specialist:

```
starting_from_outcome/
└── nextjs-specialist/
    ├── nextjs-specialist-template.json5  # Main template
    ├── README.md                          # Generated docs
    └── enriched/
        └── 1.0.0/
            ├── enriched-001.json5         # First enriched version
            ├── enriched-002.json5         # Second enriched (if enriched again)
            └── ...
```

## Next Steps

1. ✅ Create specialist template
2. ✅ Enrich template (optional)
3. ✅ Run benchmarks
4. ✅ Review results
5. 🔄 Iterate and improve based on results

## Tips

- **Start Small**: Test with 1-2 scenarios first before running full suite
- **Check Logs**: Look for `[Enricher]` and `[Generator]` logs to see progress
- **Review Template**: Open the JSON5 file to see the generated structure
- **Version Control**: Each enrichment creates a new numbered version for rollback

