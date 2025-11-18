# Zephyr Bench – Real-world LLM & Tool Benchmark Suite

Zephyr Bench is a comprehensive benchmark for evaluating coding agents on real software tasks. This system allows you to create realistic coding scenarios, test different AI agents, and measure their performance across multiple evaluation criteria.

> **Environment Setup**: Create a `.env` file in the **project root directory** (`ze-benchmarks/.env`) with your API keys. See [Environment Variables](#environment-variables) section below for details.

## How the System Works

### Architecture Overview
The system consists of six main components:

1. **Harness** (`packages/harness/`) - CLI interface and execution engine
2. **Agent Adapters** (`packages/agent-adapters/`) - Integration with different AI providers
3. **Evaluators** (`packages/evaluators/`) - Automated testing and evaluation logic
4. **Worker API** (`apps/worker/`) - Cloudflare Worker with D1 database for data storage
5. **Web Dashboard** (`apps/benchmark-report/`) - React-based UI for viewing results
6. **Specialist Mint** (`packages/specialist-mint/`) - Create specialist snapshots from benchmark results

### Execution Flow
1. **CLI** scans available suites and scenarios
2. **Agent** receives prompt and workspace context
3. **Agent** performs the requested task (e.g., update dependencies)
4. **Evaluators** test the result (build, lint, tests, etc.)
5. **Worker API** stores results in Cloudflare D1 database
6. **Web Dashboard** fetches and displays results from Worker API

### Current Working Features
- **Interactive CLI**: Dynamic suite/scenario loading with progress tracking
- **Multi-Agent Support**: Echo, Anthropic Claude, OpenRouter, Claude Code
- **Dynamic Tier System**: Automatic L0-L3 and Lx difficulty scanning
- **Batch Execution**: Run multiple agent/tier combinations
- **Worker-Based Storage**: All data stored in Cloudflare D1 via Worker API
- **Web Dashboard**: React-based results viewer at `localhost:3000`
- **Comprehensive Evaluators**: Build, lint, typecheck, dependency analysis
- **Failure Detection**: Detailed error logging and categorization
- **Specialist Snapshots**: Create versioned specialist definitions with benchmark metrics

## Quick Setup

### 1. Installation
```bash
# Clone and install
git clone https://github.com/your-org/ze-benchmarks.git
cd ze-benchmarks
pnpm install
pnpm build
```

### 2. Environment Setup (`.env`)
```bash
# Copy example environment file
cp .env.example .env

# Edit .env and add your API keys
# Required for Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional for OpenRouter models
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Worker configuration (already set for local development)
ZE_BENCHMARKS_WORKER_URL=http://localhost:8787
ZE_BENCHMARKS_API_KEY=dev-local-key
```

**Get API Keys:**
- **Anthropic Claude**: https://console.anthropic.com/settings/keys
- **OpenRouter**: https://openrouter.ai/keys

### 3. Initialize D1 Database (First Time Only)
```bash
pnpm db:migrate
```

### 4. Start the Worker (Required!)
**⚠️ The worker MUST be running for benchmarks to work**

```bash
# Terminal 1: Start worker
cd apps/worker && pnpm dev

# Worker will be available at http://localhost:8787
```

### 5. Run Your First Benchmark
```bash
# Terminal 2: Run a benchmark
pnpm bench test-suite test-scenario L0 echo

# Or use interactive CLI
pnpm cli
```

### 6. View Results
```bash
# Terminal 3: Start web dashboard
pnpm dev:dashboard

# Open http://localhost:3000
```

### Easy Mode: Start Everything at Once
```bash
# One command to start worker + dashboard
./start-dev.sh
```

## Understanding Suites and Scenarios

### Suite Structure
A **suite** is a collection of related benchmarks. Each suite contains:
- **Scenarios**: Individual test cases within the suite
- **Prompts**: Difficulty tiers (L0-L3, Lx) for each scenario
- **Repository Fixtures**: Real codebases with intentional issues

### Current Suites
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
│   ├── update-deps/          # Dependency update scenarios
│   │   ├── prompts/          # L0-L3 and Lx prompts
│   │   └── scenarios/        # Scenario configs and fixtures
│   └── test-suite/           # Basic test scenarios
├── apps/benchmark-report/         # Web dashboard (React + Rsbuild)
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
# - Run benchmarks (select suite, scenario, agent, tier)
# - View statistics and history  
# - Compare model performance
# - Analyze batch results
```

### Direct Execution
```bash
# Run specific benchmark
pnpm bench update-deps nx-pnpm-monorepo L1 anthropic

# Batch execution (all tiers)
pnpm bench update-deps nx-pnpm-monorepo --batch anthropic

# View results
pnpm stats suite update-deps
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

## Creating Specialist Snapshots

You can create specialist snapshots that combine templates with benchmark results in two ways:

### Option 1: Integrated Workflow (Recommended)

Run benchmarks and automatically mint snapshots in one command:

```bash
# Start Worker (required)
pnpm worker:dev

# Run benchmarks with automatic snapshot minting
pnpm bench update-deps nx-pnpm-monorepo \
  --tier L1 \
  --agent anthropic \
  --iterations 3 \
  --mint-template templates/my-specialist.json5 \
  --mint-output ./snapshots

# This will:
# 1. Run the benchmark 3 times
# 2. Store all runs in a batch
# 3. Automatically mint a snapshot with the results
```

### Option 2: Manual Workflow

Separate benchmark running from snapshot minting:

```bash
# 1. Start Worker (required)
pnpm worker:dev

# 2. Run benchmarks and note the batch ID
pnpm bench update-deps nx-pnpm-monorepo --batch-id my_batch
# Output: Created batch: my_batch

# 3. Create specialist snapshot from results
pnpm mint:snapshot \
  <path-to-template.json5> \
  --batch-id my_batch \
  --output ./snapshots

# 4. Enrich template with LLM-generated metadata (optional)
pnpm mint:enrich <path-to-template.json5>
```

### New CLI Options

- `--iterations <n>` - Run benchmark multiple times (useful for statistical confidence)
- `--mint-template <path>` - Automatically mint snapshot after benchmarks complete
- `--mint-output <path>` - Output directory for snapshots (default: ./snapshots)
- `--batch-id <id>` - Custom batch ID for grouping runs

### Specialist Mint Package

The `@ze/specialist-mint` package (`packages/specialist-mint/`) provides tools for:
- **Minting snapshots**: Combine specialist templates with benchmark results
- **Template enrichment**: Use LLMs to generate documentation metadata
- **Schema validation**: Ensure templates and snapshots meet specifications
- **Version management**: Auto-increment snapshot IDs and track versions

See `packages/specialist-mint/README.md` for detailed documentation.

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

```bash
cp .env.example .env
```

### Required Variables
- **`ANTHROPIC_API_KEY`**: Required for Anthropic Claude agent and Claude Code
- **`OPENROUTER_API_KEY`**: Required for OpenRouter agent

### Optional Variables
- **`CLAUDE_MODEL`**: Override default Claude model (default: `claude-3-5-sonnet-20241022`)
- **`LLM_JUDGE_MODEL`**: Override LLM Judge model (default: `anthropic/claude-3.5-sonnet`)
- **`ZE_BENCHMARKS_DB`**: Override database path (default: `apps/benchmark-report/public/benchmarks.db`)
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