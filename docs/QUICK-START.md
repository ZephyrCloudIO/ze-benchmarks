# Quick Start Guide

Get up and running with ze-benchmarks in 30 minutes or less.

## Prerequisites

- Node.js 18+ 
- pnpm (recommended) or npm
- Git

## Installation

```bash
# Clone the repository
git clone https://github.com/your-org/ze-benchmarks.git
cd ze-benchmarks

# Install dependencies
pnpm install

# Build packages
pnpm build
```

## Adding Your First Benchmark (15 minutes)

### Step 1: Create Directory Structure
```bash
mkdir -p suites/my-suite/prompts/simple-update
mkdir -p suites/my-suite/scenarios/simple-update
```

### Step 2: Create scenario.yaml
```bash
# Copy the template
cp docs/templates/scenario.yaml suites/my-suite/scenarios/simple-update/scenario.yaml

# Edit the file
# Update id, suite, title, description, and other fields
```

### Step 3: Create Oracle Answers
```bash
# Create oracle-answers.json
cat > suites/my-suite/scenarios/simple-update/oracle-answers.json << 'EOF'
{
  "should_i_update_to_latest": "Yes, update to latest compatible versions",
  "how_to_handle_breaking_changes": "Update incrementally and test thoroughly"
}
EOF
```

### Step 4: Create Repository Fixture
```bash
# Create minimal package.json
mkdir -p suites/my-suite/scenarios/simple-update/repo-fixture
cat > suites/my-suite/scenarios/simple-update/repo-fixture/package.json << 'EOF'
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

### Step 5: Create Prompts
```bash
# L0 - Minimal
cat > suites/my-suite/prompts/simple-update/L0-minimal.md << 'EOF'
Update the dependencies in this project.
EOF

# L1 - Basic
cat > suites/my-suite/prompts/simple-update/L1-basic.md << 'EOF'
This project needs its dependencies updated. Please update React and related packages to their latest compatible versions while ensuring the project still builds and tests pass.
EOF

# L2 - Directed
cat > suites/my-suite/prompts/simple-update/L2-directed.md << 'EOF'
Update the dependencies in this React project:

1. Update React to the latest 18.x version
2. Update @types/react to match React version
3. Ensure all tests pass
4. Maintain TypeScript compatibility

Constraints:
- Keep React on 18.x (not 19.x)
- Maintain existing functionality
EOF
```

### Step 6: Test Your Benchmark
```bash
# Test with a specific agent
pnpm bench my-suite simple-update --tier L1 --agent anthropic

# Test all tiers
pnpm bench my-suite simple-update --tier L0,L1,L2 --agent anthropic
```

## Adding Your First Evaluator (10 minutes)

### Step 1: Create Evaluator File
```bash
# Copy the template
cp docs/templates/heuristic-evaluator.ts packages/evaluators/src/evaluators/my-custom-evaluator.ts
```

### Step 2: Customize the Evaluator
```typescript
// Edit packages/evaluators/src/evaluators/my-custom-evaluator.ts
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

  private checkSomething(ctx: EvaluationContext): number {
    // Implement your evaluation logic
    return 1.0; // Example: perfect score
  }
}
```

### Step 3: Test Your Evaluator
```typescript
// Create a test file
// packages/evaluators/src/evaluators/__tests__/my-custom-evaluator.test.ts
import { MyCustomEvaluator } from '../my-custom-evaluator';

describe('MyCustomEvaluator', () => {
  it('should evaluate correctly', async () => {
    const evaluator = new MyCustomEvaluator();
    const mockContext = {
      // Mock context data
    };
    
    const result = await evaluator.evaluate(mockContext);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });
});
```

## Testing Locally (5 minutes)

### Run a Single Benchmark
```bash
# Test your benchmark
pnpm bench my-suite simple-update --agent anthropic

# Test with different tiers
pnpm bench my-suite simple-update --tier L0,L1,L2 --agent anthropic

# Test with batch execution
pnpm bench my-suite simple-update --batch --agent anthropic
```

### Run the Web UI
```bash
# Start the development server
pnpm dev

# Open http://localhost:3000 in your browser
```

### Check Results
```bash
# View results in CLI
pnpm bench --stats

# View results in web UI
# Navigate to http://localhost:3000
```

## Submitting for Review (5 minutes)

### Step 1: Create Pull Request
```bash
# Create a new branch
git checkout -b feature/my-benchmark

# Add your files
git add suites/my-suite/
git add packages/evaluators/src/evaluators/my-custom-evaluator.ts

# Commit changes
git commit -m "Add my-suite benchmark and custom evaluator"

# Push to remote
git push origin feature/my-benchmark

# Create pull request on GitHub
```

### Step 2: Fill Out PR Template
- [ ] Benchmark follows directory structure
- [ ] All required files present
- [ ] scenario.yaml validates
- [ ] Repository fixture builds
- [ ] Prompts are clear and appropriate
- [ ] Oracle answers are comprehensive
- [ ] Evaluator follows interface
- [ ] Tests pass
- [ ] Documentation updated

### Step 3: Respond to Feedback
- Address review comments
- Make requested changes
- Test thoroughly
- Update documentation

## Common Issues and Solutions

### Benchmark Not Loading
```bash
# Check YAML syntax
pnpm bench --validate my-suite simple-update

# Check file structure
ls -la suites/my-suite/scenarios/simple-update/
```

### Evaluator Not Running
```bash
# Check evaluator file location
ls -la packages/evaluators/src/evaluators/

# Check export format
grep -n "export" packages/evaluators/src/evaluators/my-custom-evaluator.ts
```

### Repository Fixture Issues
```bash
# Test fixture manually
cd suites/my-suite/scenarios/simple-update/repo-fixture
npm install
npm test
```

### Validation Failures
```bash
# Check validation commands
pnpm bench my-suite simple-update --dry-run

# Test commands manually
cd suites/my-suite/scenarios/simple-update/repo-fixture
pnpm install
pnpm test
```

## Next Steps

### Learn More
- [Adding Benchmarks](ADDING-BENCHMARKS.md) - Comprehensive benchmark guide
- [Adding Evaluators](ADDING-EVALUATORS.md) - Detailed evaluator guide
- [Prompt Tiers](PROMPT-TIERS.md) - Understanding prompt levels
- [Configuration Reference](CONFIGURATION-REFERENCE.md) - Complete config guide

### Explore Examples
- [Complete Example Suite](examples/complete-suite/) - Full working example
- [Evaluator Examples](examples/evaluators/) - Various evaluator types
- [Template Files](templates/) - Ready-to-use templates

### Get Help
- [Troubleshooting](TROUBLESHOOTING.md) - Common issues and solutions
- [Contributing](CONTRIBUTING.md) - Contribution guidelines
- [Quality Checklists](BENCHMARK-CHECKLIST.md) - Pre-submission checklist

## Tips for Success

### Benchmark Design
- Start simple, add complexity gradually
- Use realistic scenarios
- Test with multiple agents
- Get feedback early

### Evaluator Development
- Focus on one specific aspect
- Test with edge cases
- Provide meaningful feedback
- Keep performance in mind

### Testing Strategy
- Test locally first
- Use multiple agents
- Test different tiers
- Validate thoroughly

### Documentation
- Document your decisions
- Include examples
- Explain constraints
- Update as needed

## Time Estimates

| Task | Time | Difficulty |
|------|------|------------|
| First Benchmark | 15 min | Easy |
| First Evaluator | 10 min | Easy |
| Local Testing | 5 min | Easy |
| PR Submission | 5 min | Easy |
| **Total** | **35 min** | **Beginner** |

## Support

- **Documentation**: Check the docs/ directory
- **Examples**: Look at existing benchmarks
- **Issues**: Create GitHub issues for bugs
- **Discussions**: Use GitHub discussions for questions

Happy benchmarking! 🚀
