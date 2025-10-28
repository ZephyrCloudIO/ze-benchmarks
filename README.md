# Zephyr Bench – Real-world LLM & Tool Benchmark Suite

Zephyr Bench is a comprehensive benchmark for evaluating coding agents on real software tasks. This system allows you to create realistic coding scenarios, test different AI agents, and measure their performance across multiple evaluation criteria.

> **Environment Setup**: Create a `.env` file in the **project root directory** (`ze-benchmarks/.env`) with your API keys. See [Environment Variables](#environment-variables) section below for details.

## How the System Works

### Architecture Overview
The system consists of four main components:

1. **Harness** (`packages/harness/`) - CLI interface and execution engine
2. **Agent Adapters** (`packages/agent-adapters/`) - Integration with different AI providers
3. **Evaluators** (`packages/evaluators/`) - Automated testing and evaluation logic
4. **Database** (`packages/database/`) - SQLite storage for results and metadata

### Execution Flow
1. **CLI** scans available suites and scenarios
2. **Agent** receives prompt and workspace context
3. **Agent** performs the requested task (e.g., update dependencies)
4. **Evaluators** test the result (build, lint, tests, etc.)
5. **Database** stores results with detailed metadata
6. **Web Dashboard** displays results in real-time

### Current Working Features
- **Interactive CLI**: Dynamic suite/scenario loading with progress tracking
- **Multi-Agent Support**: Echo, Anthropic Claude, OpenRouter, Claude Code
- **Dynamic Tier System**: Automatic L0-L3 and Lx difficulty scanning
- **Batch Execution**: Run multiple agent/tier combinations
- **Real-time Database**: SQLite with timestamp-based auto-refresh
- **Web Dashboard**: React-based results viewer at `localhost:3000`
- **Comprehensive Evaluators**: Build, lint, typecheck, dependency analysis
- **Failure Detection**: Detailed error logging and categorization

## Quick Setup

### 1. Installation
```bash
# Clone and install
git clone https://github.com/your-org/ze-benchmarks.git
cd ze-benchmarks
pnpm install

```

### 2. Environment Setup
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env and add your API keys
# Required for Anthropic Claude
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional for OpenRouter models  
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Get API Keys:**
- **Anthropic Claude**: https://console.anthropic.com/settings/keys
- **OpenRouter**: https://openrouter.ai/keys

### 3. Run Your First Benchmark
```bash
# Start interactive CLI
npx tsx packages/harness/src/cli.ts

# Or run a specific benchmark
npx tsx packages/harness/src/cli.ts run update-deps nx-pnpm-monorepo --tier L1 --agent anthropic
```

### 4. View Results
```bash
# Start web dashboard
pnpm dev
# Open http://localhost:3000
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
├── benchmark-report/         # Web dashboard (React + Rsbuild)
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
npx tsx packages/harness/src/cli.ts

# Choose from:
# - Run benchmarks (select suite, scenario, agent, tier)
# - View statistics and history  
# - Compare model performance
# - Analyze batch results
```

### Direct Execution
```bash
# Run specific benchmark
npx tsx packages/harness/src/cli.ts run update-deps nx-pnpm-monorepo --tier L1 --agent anthropic

# Batch execution (all tiers)
npx tsx packages/harness/src/cli.ts run update-deps nx-pnpm-monorepo --batch --agent anthropic

# View results
npx tsx packages/harness/src/cli.ts --stats suite update-deps
npx tsx packages/harness/src/cli.ts --batches
```

### Statistics and Analysis
```bash
# View comprehensive statistics
npx tsx packages/harness/src/cli.ts --stats

# Compare batches
npx tsx packages/harness/src/cli.ts --compare-batches

# View batch details
npx tsx packages/harness/src/cli.ts --batch-details <batch-id>
```

## Creating New Suites and Scenarios

### Step 1: Create Suite Structure
```bash
# Create new suite directory
mkdir -p suites/my-new-suite/prompts/my-scenario
mkdir -p suites/my-new-suite/scenarios/my-scenario/repo-fixture
```

### Step 2: Create Scenario Configuration
```bash
# Copy and customize the template
cp docs/templates/scenario.yaml suites/my-new-suite/scenarios/my-scenario/scenario.yaml
```

Edit `scenario.yaml` with your specific requirements:
```yaml
id: "my-scenario"
suite: "my-new-suite"
title: "My Custom Scenario"
description: "Description of what this scenario tests"

# Define what needs to be updated
targets:
  required:
    - name: "react"
      to: "^18.0.0"
    - name: "@types/react"
      to: "^18.0.0"
  optional:
    - name: "typescript"
      to: "^5.0.0"

# Define validation commands
validation:
  commands:
    install: "npm install"
    build: "npm run build"
    test: "npm test"
```

### Step 3: Create Repository Fixture
Create a complete codebase with intentional issues:

```bash
# Create package.json with outdated dependencies
cat > suites/my-new-suite/scenarios/my-scenario/repo-fixture/package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^17.0.0",
    "@types/react": "^17.0.0"
  },
  "devDependencies": {
    "typescript": "^4.0.0"
  },
  "scripts": {
    "build": "tsc",
    "test": "echo 'Tests pass'"
  }
}
EOF

# Add source files, config files, etc.
```

### Step 4: Create Prompts
Create different difficulty tiers:

```bash
# L0 - Minimal context
echo "Update the dependencies in this project." > suites/my-new-suite/prompts/my-scenario/L0-minimal.md

# L1 - Basic context  
echo "This React project needs its dependencies updated. Please update React and related packages to their latest compatible versions while ensuring the project still builds and tests pass." > suites/my-new-suite/prompts/my-scenario/L1-basic.md

# L2 - Directed guidance
echo "Update the dependencies in this React project:
1. Update React to the latest 18.x version
2. Update @types/react to match React version  
3. Update TypeScript to latest 5.x version
4. Ensure all tests pass
5. Maintain TypeScript compatibility" > suites/my-new-suite/prompts/my-scenario/L2-directed.md
```

### Step 5: Create Oracle Answers
```bash
cat > suites/my-new-suite/scenarios/my-scenario/oracle-answers.json << 'EOF'
{
  "react": "^18.0.0",
  "@types/react": "^18.0.0", 
  "typescript": "^5.0.0"
}
EOF
```

### Step 6: Test Your Scenario
```bash
# Test with specific agent and tier
npx tsx packages/harness/src/cli.ts run my-new-suite my-scenario --tier L1 --agent anthropic

# Test all tiers
npx tsx packages/harness/src/cli.ts run my-new-suite my-scenario --batch --agent anthropic
```

## Documentation

### Comprehensive Guides
- **[Adding Benchmarks](docs/ADDING-BENCHMARKS.md)** - Complete benchmark creation guide
- **[Adding Evaluators](docs/ADDING-EVALUATORS.md)** - Evaluator development guide  
- **[Quick Start](docs/QUICK-START.md)** - Fast-track onboarding
- **[Contributing](docs/CONTRIBUTING.md)** - Contribution guidelines

### Templates
- **[Scenario Template](docs/templates/scenario.yaml)** - Annotated configuration
- **[Evaluator Template](docs/templates/heuristic-evaluator.ts)** - Complete evaluator template
- **[Quality Checklists](docs/BENCHMARK-CHECKLIST.md)** - Pre-submission validation

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
- **`ZE_BENCHMARKS_DB`**: Override database path (default: `benchmark-report/public/benchmarks.db`)
- **`DEBUG`**: Enable debug logging (default: `false`)
- **`PORT`**: Web dashboard port (default: `3000`)

## Database and Results

### Database Location
- **Primary Database**: `benchmark-report/public/benchmarks.db`
- **Auto-refresh**: Timestamp-based polling every 5 seconds
- **Version Tracking**: `benchmark-report/public/db-version.json`

### Result Storage
- **Runs**: Individual benchmark executions with detailed metadata
- **Batches**: Groups of runs with aggregate statistics  
- **Evaluations**: Detailed evaluator results and scores
- **Failures**: Categorized error logging (workspace, prompt, agent, evaluation)

### Web Dashboard Features
- **Real-time Updates**: Automatic refresh when database changes
- **Interactive Charts**: Performance visualization with proper 0-1 scoring
- **Batch Analytics**: Comprehensive batch-level statistics
- **Run Details**: Individual run analysis and debugging
- **Failure Analysis**: Detailed failure reasons and patterns

## Contributing

### Getting Started
1. **Fork and Clone**: `git clone https://github.com/your-username/ze-benchmarks.git`
2. **Create Branch**: `git checkout -b feature/my-contribution`
3. **Make Changes**: Follow coding standards and test thoroughly
4. **Submit PR**: Fill out template and request review

### Quality Standards
- **Benchmarks**: Realistic, challenging, well-documented scenarios
- **Evaluators**: Fast, reliable, meaningful feedback
- **Documentation**: Clear, complete, examples included
- **Testing**: Comprehensive test coverage

## Troubleshooting

### Common Issues
- **Benchmark not loading**: Check YAML syntax and file structure
- **Evaluator not running**: Verify interface implementation  
- **Database issues**: Check file permissions and paths
- **Agent failures**: Verify API keys and network connectivity
- **Web dashboard not updating**: Check database location and permissions

### Getting Help
- **Documentation**: Check `docs/` directory for comprehensive guides
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion

---

**Ready to create benchmarks?** Start with the [Quick Start Guide](docs/QUICK-START.md) or dive into [Adding Benchmarks](docs/ADDING-BENCHMARKS.md)!