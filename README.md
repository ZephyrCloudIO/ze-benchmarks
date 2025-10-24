## Zephyr Bench – Real‑world LLM & Tool Benchmark Suite

Zephyr Bench is a comprehensive benchmark for evaluating coding agents on real software tasks with dynamic tier loading, multiple agent adapters, and detailed evaluation metrics.

- **Harness CLI**: `packages/harness` → Interactive CLI with dynamic model/tier loading
- **Suites**: `suites/` (update-deps, test-suite with dynamic tier scanning)
- **Results**: `results/` with SQLite database and web dashboard
- **Agents**: Echo, Anthropic Claude, OpenRouter, Claude Code
- **Evaluators**: Automated tests, LLM Judge, dependency analysis

### Quick Start
```bash
# Install dependencies
npm install

# Set up environment variables
export ANTHROPIC_API_KEY=your_key_here
export OPENROUTER_API_KEY=your_key_here  # Optional for OpenRouter models

# Run interactive CLI
npm -w packages/harness run dev
# or
npx tsx packages/harness/src/cli.ts
```

### Interactive CLI Features
- **Dynamic Tier Loading**: Automatically scans available difficulty tiers for each scenario
- **Multi-Agent Support**: Echo, Anthropic Claude, OpenRouter, Claude Code
- **Model Selection**: Dynamic loading of available models from APIs
- **Batch Execution**: Run multiple combinations with progress tracking
- **Web Dashboard**: Real-time results viewing at `http://localhost:3000`
- **Comprehensive Statistics**: Performance metrics, evaluator scores, LLM Judge analysis

### Available Agents

The system includes several pre-configured agents:

- **Echo Agent**: Test agent that echoes the prompt (no API calls)
- **Anthropic Claude**: Direct API integration with Claude models
- **OpenRouter**: Access to multiple LLM providers through OpenRouter API
- **Claude Code**: Integration with Claude Code CLI tool

### Dynamic Tier System

The system automatically scans available difficulty tiers for each scenario:

- **L0 - Minimal**: Basic dependency updates
- **L1 - Basic**: Standard updates with some complexity
- **L2 - Directed**: Complex updates with specific requirements
- **L3 - Migration**: Major version migrations
- **Lx - Adversarial**: Challenging edge cases

Tiers are dynamically loaded based on available prompt files in `suites/{suite}/prompts/{scenario}/`.

### Evaluation System

Comprehensive evaluation through multiple metrics:

- **Automated Tests**: Install, test, lint, typecheck validation
- **LLM Judge**: AI-powered code quality assessment with weighted scoring
- **Dependency Analysis**: Correctness, safety, best practices
- **Performance Metrics**: Execution time, success rates, token usage

### Web Dashboard

Real-time results viewing at `http://localhost:3000` with:
- Interactive charts and statistics
- Detailed run analysis
- Model performance comparisons
- Live database updates

### Environment Variables

Required for different agents:
- **ANTHROPIC_API_KEY**: Required for Anthropic Claude agent
- **OPENROUTER_API_KEY**: Required for OpenRouter agent
- **CLAUDE_MODEL**: Optional model override for Anthropic (defaults to claude-3-5-sonnet-20241022)

### CLI Commands

```bash
# Interactive mode (recommended)
npx tsx packages/harness/src/cli.ts

# Direct execution
npx tsx packages/harness/src/cli.ts run update-deps nx-pnpm-monorepo --tier L0 --agent echo

# View results
npx tsx packages/harness/src/cli.ts --history
npx tsx packages/harness/src/cli.ts --stats suite update-deps
```

### Project Structure

```
ze-benchmarks/
├── packages/
│   ├── harness/          # CLI and execution engine
│   ├── agent-adapters/   # Agent implementations
│   ├── evaluators/       # Evaluation logic and LLM Judge
│   └── database/         # SQLite database management
├── suites/
│   ├── update-deps/      # Dependency update scenarios
│   └── test-suite/       # Test scenarios with limited tiers
├── results/              # Benchmark results and database
└── benchmark-report/     # Web dashboard (React + RSbuild)
```

### Docker Support

```bash
# Build Docker image
docker build -f docker/node-lts.Dockerfile -t ze-bench .

# Run with environment variables
docker run --rm \
  -e ANTHROPIC_API_KEY=your_key \
  -e OPENROUTER_API_KEY=your_key \
  ze-bench
```

### Adding New Scenarios

1. Create scenario directory: `suites/{suite}/scenarios/{scenario}/`
2. Add `scenario.yaml` configuration
3. Create prompt files: `suites/{suite}/prompts/{scenario}/L{0-3}-{name}.md`
4. Add repository fixture: `suites/{suite}/scenarios/{scenario}/repo-fixture/`

The system will automatically detect available tiers and scenarios.
