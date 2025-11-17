# Specialist Engine

A modular, engine-based system for systematically creating benchmark templates, enrichments, and specialists that flow through the complete benchmark workflow.

## Features

- **Knowledge Extraction**: Extract domain knowledge from documentation using LLM analysis
- **Template Structuring**: Transform knowledge into specialist template structure
- **Documentation Enrichment**: Enhance docs with metadata for intelligent filtering
- **Tier Generation**: Create difficulty-graded prompts (L0 → L1 → L2 → L3 → Lx)
- **Validation**: Ensure template quality before use
- **Package Generation**: Generate complete specialist packages

## Installation

```bash
pnpm install
```

## Environment Variables

```bash
export OPENROUTER_API_KEY=your-api-key-here
```

## Usage

### CLI (Interactive)

```bash
# Interactive specialist creation
pnpm exec tsx src/cli/index.ts create

# Extract knowledge only
pnpm exec tsx src/cli/index.ts extract

# Show help
pnpm exec tsx src/cli/index.ts help
```

### Programmatic API

```typescript
import { engine } from '@ze/specialist-engine';

// Complete workflow
const pkg = await engine.createSpecialist({
  extraction: {
    domain: 'shadcn-ui',
    framework: 'vite',
    sources: {
      documentation: ['https://ui.shadcn.com/docs']
    },
    depth: 'standard'
  },
  template: {
    name: '@zephyr/shadcn-specialist',
    version: '1.0.0'
  },
  enrichment: {
    enrichDocumentation: true,
    generateTiers: true,
    baseTask: 'Set up shadcn/ui project',
    scenario: 'project-setup'
  },
  output: {
    outputDir: './specialists/shadcn-specialist',
    includeDocs: true,
    format: 'json5'
  }
});

console.log(`Created: ${pkg.path}`);
```

### Example

```bash
# Run the example (requires OPENROUTER_API_KEY)
pnpm exec tsx examples/create-shadcn-specialist.ts
```

## Modules

### 1. Extractor
Extracts domain knowledge from documentation:
- Web scraping
- LLM analysis
- Concept extraction
- Gotcha detection
- Best practices mining

### 2. Structurer
Transforms knowledge into template structure:
- Persona building
- Capability mapping
- Documentation organization

### 3. Enricher
Enriches templates with metadata:
- Documentation enrichment
- Tier generation (L0-Lx)
- Model-specific optimization

### 4. Validator
Validates template quality:
- Structure validation
- Completeness checks
- Consistency verification

### 5. Generator
Generates specialist packages:
- Template files (JSON5)
- Enriched versions
- Tier prompts (markdown)
- Documentation

## Architecture

```
Input → Extraction → Structuring → Enrichment → Validation → Output
  ↓         ↓            ↓            ↓            ↓          ↓
 Docs   Knowledge     Template      Tiers      Testing   Specialist
        Base          Structure    Prompts    Validation  Package
```

## Output Structure

```
specialists/
  └── shadcn-vite-specialist/
      ├── shadcn-vite-specialist-template.json5  # Base template
      ├── enriched/
      │   └── 1.0.0/
      │       └── enriched-001.json5  # Enriched version
      ├── prompts/
      │   └── vite-setup/
      │       ├── L0-minimal.md
      │       ├── L1-basic.md
      │       ├── L2-directed.md
      │       ├── L3-migration.md
      │       └── Lx-adversarial.md
      └── README.md
```

## Integration with Benchmarks

Once created, use specialists with the benchmark harness:

```bash
pnpm bench --specialist @zephyr/shadcn-vite-specialist
```

The harness will automatically use the enriched template for intelligent prompt generation.

## Development

```bash
# Run with tsx (no build needed)
pnpm exec tsx src/cli/index.ts create

# Build TypeScript
pnpm build

# Run tests (coming soon)
pnpm test
```

## Documentation

See [docs/specialist-engine.md](../../docs/specialist-engine.md) for detailed documentation.

## License

MIT
