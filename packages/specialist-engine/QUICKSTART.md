# Specialist Engine - Quick Start

## What is it?

The Specialist Engine is a complete system for automatically creating specialist templates from documentation. It extracts knowledge, structures it into templates, enriches documentation with metadata, and generates tier-based prompts.

## Setup (1 minute)

```bash
# 1. Set your API key
export OPENROUTER_API_KEY=your-key-here

# 2. Navigate to the specialist-engine directory
cd packages/specialist-engine

# 3. You're ready! (dependencies already installed)
```

## Try it Now (2 ways)

### Option 1: Interactive CLI (Easiest)

```bash
pnpm exec tsx src/cli/index.ts create
```

Follow the prompts to create a specialist interactively.

### Option 2: Run the Example

```bash
pnpm exec tsx examples/create-shadcn-specialist.ts
```

This will create a shadcn-ui specialist with:
- Extracted knowledge from documentation
- Enriched documentation metadata
- Tier-based prompts (L0-Lx)
- Complete specialist package

## What Gets Created

```
specialists/shadcn-vite-specialist/
├── shadcn-vite-specialist-template.json5  ← Base template
├── enriched/
│   └── 1.0.0/
│       └── enriched-001.json5             ← With metadata
├── prompts/
│   └── vite-setup/
│       ├── L0-minimal.md                  ← Tiers
│       ├── L1-basic.md
│       ├── L2-directed.md
│       ├── L3-migration.md
│       └── Lx-adversarial.md
└── README.md
```

## Use with Benchmarks

Once created, use your specialist:

```bash
# From repo root
pnpm bench shadcn-generate-vite shadcn-generate-vite tier1 anthropic \
  --specialist @zephyr/shadcn-vite-specialist
```

## How It Works

```
Documentation URL
       ↓
1. Extract knowledge (LLM analysis)
       ↓
2. Structure template (persona, capabilities, prompts)
       ↓
3. Enrich documentation (metadata extraction)
       ↓
4. Generate tiers (L0 → L1 → L2 → L3 → Lx)
       ↓
5. Validate quality
       ↓
6. Generate package
       ↓
Complete Specialist Package ✅
```

## Customization

Edit the generated template to:
- Add more documentation URLs
- Adjust prompts for your use case
- Add model-specific optimizations
- Define custom tier levels

Then re-enrich:

```bash
pnpm exec tsx src/cli/index.ts enrich
```

## Next Steps

1. **Create your first specialist** with the interactive CLI
2. **Test it** with benchmarks
3. **Iterate** based on results
4. **Share** successful specialists with the team

## Need Help?

- See [README.md](./README.md) for full documentation
- See [../../docs/specialist-engine.md](../../docs/specialist-engine.md) for architecture
- Run `pnpm exec tsx src/cli/index.ts help` for CLI help

## Pro Tips

- Start with 1-2 documentation URLs
- Use `depth: 'standard'` for balanced extraction
- Enable `enrichDocumentation: true` for better filtering
- Always generate tiers for maximum flexibility
- Test with benchmarks early and iterate
