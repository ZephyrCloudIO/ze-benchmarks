# Zephyr Bench – Real-world LLM & Tool Benchmark Suite

Zephyr Bench is a comprehensive benchmark for evaluating coding agents on real software tasks with dynamic tier loading, multiple agent adapters, and detailed evaluation metrics.

## 🚀 What's Working

### Core System
- **✅ Interactive CLI**: Full-featured command-line interface with dynamic model/tier loading
- **✅ Multi-Agent Support**: Echo, Anthropic Claude, OpenRouter, Claude Code agents
- **✅ Dynamic Tier System**: Automatic scanning of L0-L3 and Lx difficulty tiers
- **✅ Batch Execution**: Run multiple combinations with progress tracking
- **✅ SQLite Database**: Persistent storage with comprehensive schema
- **✅ Web Dashboard**: Real-time results viewing with React + Rsbuild
- **✅ Evaluation System**: Automated tests, LLM Judge, dependency analysis
- **✅ Failure Detection**: Comprehensive run failure logging and analysis

### Features
- **✅ Real-time Statistics**: Performance metrics, evaluator scores, LLM Judge analysis
- **✅ Batch Analytics**: Comprehensive batch-level statistics and trends
- **✅ Auto-refresh**: Database synchronization with timestamp-based polling
- **✅ Documentation**: Comprehensive guides for contributors

## 📋 What's Needed

### Documentation (In Progress)
- **🔄 Example Benchmarks**: Complete working examples in `docs/examples/`
- **🔄 LLM Evaluator Guide**: Advanced LLM evaluator documentation
- **🔄 API Reference**: Complete interface documentation
- **🔄 Troubleshooting Guide**: Common issues and solutions

### System Enhancements
- **📝 More Agent Adapters**: Additional LLM providers and tools
- **📝 Advanced Evaluators**: More sophisticated evaluation metrics
- **📝 Benchmark Suites**: Additional domain-specific scenarios
- **📝 Performance Optimization**: Faster execution and better resource usage

## 🗺️ Roadmap

### Phase 1: Documentation Completion (Current)
- [ ] Complete example benchmarks with full documentation
- [ ] Advanced LLM evaluator guide with custom categories
- [ ] Comprehensive API reference for all interfaces
- [ ] Troubleshooting guide with common issues and solutions

### Phase 2: System Enhancements
- [ ] Additional agent adapters (GPT-4, Gemini, etc.)
- [ ] Advanced evaluators (code quality, security, performance)
- [ ] More benchmark suites (testing, deployment, migration)
- [ ] Performance optimizations and caching

### Phase 3: Community Features
- [ ] Benchmark sharing and discovery
- [ ] Community-contributed evaluators
- [ ] Benchmark marketplace
- [ ] Collaborative evaluation

## 🚀 Quick Start

### Installation
```bash
# Clone the repository
git clone https://github.com/your-org/ze-benchmarks.git
cd ze-benchmarks

# Install dependencies
pnpm install

# Build packages
pnpm build
```

### Environment Setup
```bash
# Required for Anthropic Claude
export ANTHROPIC_API_KEY=your_key_here

# Optional for OpenRouter models
export OPENROUTER_API_KEY=your_key_here

# Optional model overrides
export CLAUDE_MODEL=claude-3-5-sonnet-20241022
export LLM_JUDGE_MODEL=anthropic/claude-3.5-sonnet
```

### Run Interactive CLI
```bash
# Start the interactive CLI
pnpm -w packages/harness run dev

# Or run directly
npx tsx packages/harness/src/cli.ts
```

### Start Web Dashboard
```bash
# Start the development server
pnpm dev

# Open http://localhost:3000 in your browser
```

## 🎯 Available Agents

| Agent | Description | API Key Required |
|-------|-------------|------------------|
| **Echo** | Test agent that echoes the prompt | No |
| **Anthropic Claude** | Direct Claude API integration | `ANTHROPIC_API_KEY` |
| **OpenRouter** | Multiple LLM providers via OpenRouter | `OPENROUTER_API_KEY` |
| **Claude Code** | Claude Code CLI tool integration | `ANTHROPIC_API_KEY` |

## 📊 Dynamic Tier System

The system automatically scans available difficulty tiers for each scenario:

| Tier | Description | Use Case |
|------|-------------|----------|
| **L0** | Minimal context | Tests discovery and inference skills |
| **L1** | Basic context | Standard user scenarios |
| **L2** | Directed guidance | Complex tasks with detailed instructions |
| **L3** | Migration specific | Technology transitions and upgrades |
| **Lx** | Adversarial | Edge cases and challenging scenarios |

## 🔍 Evaluation System

### Automated Evaluators
- **Install Success**: Dependency installation validation
- **Test Regression**: Test suite execution and validation
- **Dependency Targets**: Required dependency updates
- **Integrity Guard**: Security vulnerability checks
- **Manager Correctness**: Package manager usage validation

### LLM Judge
- **AI-Powered Assessment**: Quality evaluation using language models
- **Weighted Scoring**: Configurable evaluation weights
- **Detailed Feedback**: Comprehensive reasoning and suggestions
- **Custom Categories**: Domain-specific evaluation criteria

## 📈 Web Dashboard Features

- **Real-time Results**: Live updates as benchmarks run
- **Interactive Charts**: Performance visualization and trends
- **Batch Analytics**: Comprehensive batch-level statistics
- **Run Details**: Individual run analysis and debugging
- **Model Comparison**: Side-by-side agent performance
- **Failure Analysis**: Detailed failure reasons and patterns

## 🏗️ Project Structure

```
ze-benchmarks/
├── packages/
│   ├── harness/              # CLI and execution engine
│   ├── agent-adapters/        # Agent implementations
│   ├── evaluators/           # Evaluation logic and LLM Judge
│   └── database/             # SQLite database management
├── suites/                   # Benchmark scenarios
│   ├── update-deps/          # Dependency update scenarios
│   └── test-suite/           # Test scenarios with limited tiers
├── results/                  # Benchmark results and database
├── benchmark-report/         # Web dashboard (React + Rsbuild)
└── docs/                     # Comprehensive documentation
    ├── ADDING-BENCHMARKS.md  # Guide for creating benchmarks
    ├── ADDING-EVALUATORS.md  # Guide for creating evaluators
    ├── PROMPT-TIERS.md      # Prompt tier system documentation
    ├── QUICK-START.md       # Fast-track onboarding guide
    └── templates/            # Ready-to-use templates
```

## 🛠️ CLI Commands

### Interactive Mode (Recommended)
```bash
# Start interactive CLI
npx tsx packages/harness/src/cli.ts

# Available options:
# - Run benchmarks with different agents
# - View statistics and history
# - Compare model performance
# - Analyze batch results
```

### Direct Execution
```bash
# Run specific benchmark
npx tsx packages/harness/src/cli.ts run update-deps nx-pnpm-monorepo --tier L1 --agent anthropic

# Batch execution
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

## 📚 Documentation

### For Contributors
- **[Quick Start Guide](docs/QUICK-START.md)** - Get up and running in 30 minutes
- **[Adding Benchmarks](docs/ADDING-BENCHMARKS.md)** - Comprehensive benchmark creation guide
- **[Adding Evaluators](docs/ADDING-EVALUATORS.md)** - Detailed evaluator development guide
- **[Prompt Tiers](docs/PROMPT-TIERS.md)** - Understanding the tier system
- **[Contributing](docs/CONTRIBUTING.md)** - Contribution guidelines and process

### Templates and Examples
- **[Scenario Template](docs/templates/scenario.yaml)** - Annotated configuration template
- **[Evaluator Template](docs/templates/heuristic-evaluator.ts)** - Complete evaluator template
- **[Quality Checklists](docs/BENCHMARK-CHECKLIST.md)** - Pre-submission validation

### Reference Documentation
- **[Configuration Reference](docs/CONFIGURATION-REFERENCE.md)** - Complete config documentation
- **[API Reference](docs/API-REFERENCE.md)** - Interface documentation
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues and solutions


## 🔧 Adding New Scenarios

### 1. Create Directory Structure
```bash
mkdir -p suites/my-suite/prompts/my-scenario
mkdir -p suites/my-suite/scenarios/my-scenario
```

### 2. Add Configuration
```bash
# Copy template
cp docs/templates/scenario.yaml suites/my-suite/scenarios/my-scenario/scenario.yaml

# Edit configuration
# Update id, suite, title, description, and other fields
```

### 3. Create Prompts
```bash
# L0 - Minimal context
echo "Update the dependencies in this project." > suites/my-suite/prompts/my-scenario/L0-minimal.md

# L1 - Basic context
echo "This project needs its dependencies updated. Please update React and related packages to their latest compatible versions while ensuring the project still builds and tests pass." > suites/my-suite/prompts/my-scenario/L1-basic.md

# L2 - Directed guidance
echo "Update the dependencies in this React project:
1. Update React to the latest 18.x version
2. Update @types/react to match React version
3. Ensure all tests pass
4. Maintain TypeScript compatibility" > suites/my-suite/prompts/my-scenario/L2-directed.md
```

### 4. Add Repository Fixture
```bash
# Create minimal package.json
mkdir -p suites/my-suite/scenarios/my-scenario/repo-fixture
cat > suites/my-suite/scenarios/my-scenario/repo-fixture/package.json << 'EOF'
{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^17.0.0",
    "@types/react": "^17.0.0"
  },
  "scripts": {
    "test": "echo 'Tests pass'"
  }
}
EOF
```

### 5. Test Your Benchmark
```bash
# Test with a specific agent
pnpm bench my-suite my-scenario --tier L1 --agent anthropic

# Test all tiers
pnpm bench my-suite my-scenario --tier L0,L1,L2 --agent anthropic
```

## 🧪 Adding New Evaluators

### 1. Create Evaluator File
```bash
# Copy template
cp docs/templates/heuristic-evaluator.ts packages/evaluators/src/evaluators/my-custom-evaluator.ts
```

### 2. Implement Evaluation Logic
```typescript
export class MyCustomEvaluator implements Evaluator {
  meta = { name: 'MyCustomEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    // Your custom evaluation logic here
    const score = this.checkSomething(ctx);
    return {
      name: this.meta.name,
      score,
      details: `Custom evaluation: ${score}`
    };
  }
}
```

### 3. Test Your Evaluator
```typescript
// Create test file
describe('MyCustomEvaluator', () => {
  it('should evaluate correctly', async () => {
    const evaluator = new MyCustomEvaluator();
    const result = await evaluator.evaluate(mockContext);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
```

## 🤝 Contributing

We welcome contributions! Here's how to get started:

### 1. Fork and Clone
```bash
git clone https://github.com/your-username/ze-benchmarks.git
cd ze-benchmarks
```

### 2. Create a Branch
```bash
git checkout -b feature/my-contribution
```

### 3. Make Your Changes
- Follow the coding standards and guidelines
- Test thoroughly
- Update documentation as needed

### 4. Submit a Pull Request
- Fill out the PR template
- Request review from maintainers
- Address feedback and make changes

### Quality Standards
- **Benchmarks**: Realistic, challenging, well-documented
- **Evaluators**: Fast, reliable, meaningful feedback
- **Documentation**: Clear, complete, examples included
- **Testing**: Comprehensive test coverage

## 📊 Current Status

### ✅ Completed Features
- Interactive CLI with dynamic tier loading
- Multi-agent support (Echo, Anthropic, OpenRouter, Claude Code)
- Comprehensive evaluation system
- SQLite database with persistent storage
- Web dashboard with real-time updates
- Batch execution and analytics
- Failure detection and logging
- Docker support
- Comprehensive documentation

### 🔄 In Progress
- Example benchmarks and templates
- Advanced LLM evaluator documentation
- API reference documentation
- Troubleshooting guide

### 📝 Planned Features
- Additional agent adapters
- Advanced evaluators
- More benchmark suites
- Performance optimizations
- Community features

## 🆘 Getting Help

### Documentation
- Check the `docs/` directory for comprehensive guides
- Use the quick start guide for fast onboarding
- Review templates and examples

### Support
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For specific feedback on contributions

### Common Issues
- **Benchmark not loading**: Check YAML syntax and file structure
- **Evaluator not running**: Verify interface implementation
- **Database issues**: Check file permissions and paths
- **Agent failures**: Verify API keys and network connectivity

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Contributors**: Thank you to all contributors who help improve the project
- **Community**: Thanks to the AI agent evaluation community for feedback and suggestions
- **Open Source**: Built on top of many excellent open source projects

---

**Ready to get started?** Check out the [Quick Start Guide](docs/QUICK-START.md) to begin contributing in just 30 minutes!