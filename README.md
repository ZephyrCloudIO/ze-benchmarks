# Zephyr Bench – Real-world LLM & Tool Benchmark Suite

Zephyr Bench is a comprehensive benchmark for evaluating coding agents on real software tasks. This system allows you to create realistic coding scenarios, test different AI agents, and measure their performance across multiple evaluation criteria.

> **Environment Setup**: Create a `.env` file in the **project root directory** (`ze-benchmarks/.env`) with your API keys. See [Environment Variables](#environment-variables) section below for details.





## Quick Setup

### 1. Installation
```bash
# Clone and install
git clone https://github.com/your-org/ze-benchmarks.git
cd ze-benchmarks
pnpm install

```

### 2. Environment Setup (`.env`)
```bash

# Edit .env and add your API keys
# Required for Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional for OpenRouter models
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Worker configuration (already set for local development)
ZE_BENCHMARKS_WORKER_URL=https://bench-api-dev.zephyr-cloud.io
ZE_PUBLIC_API_URL=https://bench-api-dev.zephyr-cloud.io
ZE_PUBLIC_VITE_WORKER_URL=https://bench-api-dev.zephyr-cloud.io
ZE_BENCHMARKS_API_KEY=dev-local-key
```

**Get API Keys:**
- **Anthropic Claude**: https://console.anthropic.com/settings/keys
- **OpenRouter**: https://openrouter.ai/keys

```bash
# 2. Run benchmark with enrichment
pnpm bench next.js 001-server-component \
  --tier L1 \
  --specialist nextjs-specialist \
  --enrich-template templates/nextjs-specialist-template.json5

# This will:
# 1. Load the specialist template: templates/nextjs-specialist-template.json5
# 2. Auto-detect agent/model from template's preferred_models
# 3. Run the benchmark once (default iterations: 1)
# 4. Store results in the database
# 5. After benchmark completes, enrich the template:
#    - Analyze each documentation entry
#    - Generate metadata using LLM (default: anthropic/claude-3.5-haiku via OpenRouter)
#    - Save enriched template to templates/enriched/<version>/enriched-XXX.json5
```

### Multiple Iterations with Enrichment

For statistical confidence, run multiple iterations:

```bash
pnpm bench next.js 000-app-router-migration-simple \
  --tier L1-basic \
  --specialist nextjs-specialist \
  --iterations 3 \
  --enrich-template templates/nextjs-specialist-template.json5

# This will:
# 1. Run the benchmark 3 times
# 2. Store all 3 runs in a batch
# 3. After all runs complete, enrich the template once
```

### Suite Structure
A **suite** is a collection of related benchmarks. Each suite contains:
- **Scenarios**: Individual test cases within the suite
- **Prompts**: Difficulty tiers (L0-L3, Lx) for each scenario
- **Repository Fixtures**: Real codebases with intentional issues

### Current Suites
- **`next.js`**: Next.js App Router scenarios (migrations, components, etc.)
- **`update-deps`**: Dependency update scenarios (React, TypeScript, etc.)
- **`test-suite`**: Basic test scenarios with limited tiers

### Scenario Components
Each scenario requires:
1. **`scenario.yaml`**: Configuration and evaluation criteria
2. **`oracle-answers.json`**: Expected outcomes for validation
3. **`repo-fixture/`**: Complete codebase with intentional issues
4. **Prompts**: L0-L3 and Lx difficulty tiers

## Available Agents

| Agent | Description | API Key Required |
|-------|-------------|------------------|
| **Echo** | Test agent that echoes the prompt | No |
| **Anthropic Claude** | Direct Claude API integration | `ANTHROPIC_API_KEY` |
| **OpenRouter** | Multiple LLM providers via OpenRouter | `OPENROUTER_API_KEY` |
| **Claude Code** | Claude Code CLI tool integration | `ANTHROPIC_API_KEY` |

**Note**: When using `--specialist`, you don't need to specify `--agent` - it's auto-detected from the template.

## Prompt Tier System

The system automatically scans available difficulty tiers:

| Tier | Description | Use Case |
|------|-------------|----------|
| **L0** | Minimal context | Tests discovery and inference skills |
| **L1** | Basic context | Standard user scenarios |
| **L2** | Directed guidance | Complex tasks with detailed instructions |
| **L3** | Migration specific | Technology transitions and upgrades |
| **Lx** | Adversarial | Edge cases and challenging scenarios |

## Evaluation System

### Automated Evaluators
- **BuildEvaluator**: Validates project builds successfully
- **LintEvaluator**: Ensures code quality standards
- **TypecheckEvaluator**: Verifies TypeScript type correctness
- **CompanionAlignmentEvaluator**: Ensures companion packages align
- **NamespaceMigrationEvaluator**: Handles package namespace changes

### LLM Judge
- **AI-Powered Assessment**: Quality evaluation using language models
- **Weighted Scoring**: Configurable evaluation weights
- **Detailed Feedback**: Comprehensive reasoning and suggestions

## Project Structure

```
ze-benchmarks/
├── packages/
│   ├── harness/              # CLI and execution engine
│   ├── agent-adapters/        # Agent implementations  
│   ├── evaluators/           # Evaluation logic and LLM Judge
│   └── database/             # SQLite database management
├── suites/                   # Benchmark scenarios
│   ├── next.js/              # Next.js App Router scenarios
│   ├── update-deps/          # Dependency update scenarios
│   │   ├── prompts/          # L0-L3 and Lx prompts
│   │   └── scenarios/        # Scenario configs and fixtures
│   └── test-suite/           # Basic test scenarios
├── templates/                # Specialist templates
│   ├── nextjs-specialist-template.json5
│   ├── shadcn-specialist-template.json5
│   └── enriched/             # Enriched templates (auto-generated)
│       └── <version>/
│           └── enriched-XXX.json5
├── apps/benchmark-report/    # Web dashboard (React + Rsbuild)
│   └── public/               # Database and static assets
└── docs/                     # Comprehensive documentation
    ├── ADDING-BENCHMARKS.md  # Guide for creating benchmarks
    ├── ADDING-EVALUATORS.md  # Guide for creating evaluators
    └── templates/            # Ready-to-use templates
```

## CLI Usage

### Interactive Mode (Recommended)
```bash
# Start interactive CLI
pnpm cli

# Choose from:
# - Run benchmarks (select suite, scenario, specialist)
# - View statistics and history  
# - Compare model performance
# - Analyze batch results
```

### Direct Execution
```bash
# Run specific benchmark with specialist
pnpm bench next.js 001-server-component --tier L1 --specialist nextjs-specialist

# With enrichment
pnpm bench next.js 001-server-component \
  --tier L1 \
  --specialist nextjs-specialist \
  --enrich-template templates/nextjs-specialist-template.json5

# View results
pnpm stats suite next.js
pnpm batches
```

### Statistics and Analysis
```bash
# View comprehensive statistics
pnpm stats

# Compare batches
pnpm compare-batches

# View batch details
pnpm batch-details <batch-id>
```

## Contributing

We welcome contributions! Whether you want to add new benchmarks, create evaluators, or improve documentation, we have comprehensive guides to help you get started.

### Quick Start - IMPORTANT
- **[Contributing Guide](CONTRIBUTING.md)** - Complete contribution guidelines
- **[Adding Benchmarks](docs/ADDING-BENCHMARKS.md)** - Step-by-step benchmark creation
- **[Adding Evaluators](docs/ADDING-EVALUATORS.md)** - Evaluator development guide

### Propose New Benchmarks
Use our GitHub issue template to propose new benchmarks:
1. Go to [GitHub Issues](https://github.com/your-org/ze-benchmarks/issues)
2. Click "New Issue" → "New Benchmark Proposal"
3. Fill out the template with your benchmark idea
4. We'll review and help you implement it!

### Ready to Contribute?
Check out our [Contributing Guide](CONTRIBUTING.md) for detailed instructions on:
- Setting up your development environment
- Creating new benchmarks and evaluators
- Submitting pull requests
- Code quality standards

## Environment Variables

The system uses environment variables for configuration. Create a `.env` file from the example:


### Required Variables
- **`ANTHROPIC_API_KEY`**: Required for Anthropic Claude agent and Claude Code
- **`OPENROUTER_API_KEY`**: Required for OpenRouter agent
ZE_BENCHMARKS_WORKER_URL=write these
ZE_PUBLIC_API_URL=write these
ZE_PUBLIC_VITE_WORKER_URL=write these

### Optional Variables

- **`DEBUG`**: Enable debug logging (default: `false`)
- **`PORT`**: Web dashboard port (default: `3000`)

## Data Storage and Results

### Worker API Architecture
- **Storage**: Cloudflare D1 (SQLite) via Worker API
- **API Endpoint**: `http://localhost:8787` (local development)
- **Authentication**: Bearer token authentication for write operations
- **Real-time**: All data fetched fresh on each request

### API Endpoints
- `GET /api/runs` - List all benchmark runs
- `GET /api/runs/:id` - Get run details with evaluations and telemetry
- `GET /api/batches` - List all batches
- `GET /api/batches/:id` - Get batch details with runs
- `GET /api/stats` - Get global statistics
- `POST /api/results` - Submit benchmark run (authenticated)
- `POST /api/results/batch` - Submit batch (authenticated)

### Result Storage
- **Runs**: Individual benchmark executions with detailed metadata
- **Batches**: Groups of runs with aggregate statistics
- **Evaluations**: Detailed evaluator results and scores
- **Telemetry**: Tool calls, tokens, costs, duration

### Web Dashboard Features
- **Real-time Updates**: Fetches data directly from Worker API
- **Interactive Charts**: Performance visualization with proper 0-1 scoring
- **Batch Analytics**: Comprehensive batch-level statistics
- **Run Details**: Individual run analysis and debugging
- **Failure Analysis**: Detailed failure reasons and patterns

---

**Ready to create benchmarks?** Check out our [Contributing Guide](CONTRIBUTING.md) for comprehensive instructions!
