# Contributing to ze-benchmarks

Thank you for your interest in contributing to ze-benchmarks! This guide will help you get started with contributing benchmarks and evaluators.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment for all contributors. Please:

- Be respectful and constructive in all interactions
- Focus on what is best for the community
- Show empathy towards other community members
- Accept constructive criticism gracefully
- Help create a positive environment for everyone

## How to Contribute

## Creating New Benchmarks

### Overview
Benchmarks are the core of ze-benchmarks. They test how well AI agents can perform real-world coding tasks. Each benchmark consists of:

- **Suite**: A collection of related benchmarks
- **Scenario**: Individual test cases within a suite
- **Prompts**: Difficulty tiers (L0-L3, Lx) for each scenario
- **Repository Fixture**: Real codebase with intentional issues
- **Oracle Answers**: Expected outcomes for validation

### File Structure
Every benchmark must follow this exact structure:

```
suites/YOUR-SUITE/
├── prompts/YOUR-SCENARIO/
│   ├── L0-minimal.md
│   ├── L1-basic.md
│   ├── L2-directed.md
│   ├── L3-migration.md (optional)
│   └── Lx-adversarial.md (optional)
└── scenarios/YOUR-SCENARIO/
    ├── scenario.yaml
    ├── oracle-answers.json
    └── repo-fixture/
        ├── package.json
        ├── [source files]
        └── [config files]
```

### Step-by-Step Creation

#### Step 1: Create Suite Structure
```bash
# Create new suite directory
mkdir -p suites/my-new-suite/prompts/my-scenario
mkdir -p suites/my-new-suite/scenarios/my-scenario/repo-fixture
```

#### Step 2: Create Scenario Configuration (`scenario.yaml`)
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
    lint: "npm run lint"
    typecheck: "tsc --noEmit"
```

#### Step 3: Create Repository Fixture
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

#### Step 4: Create Prompts
Create different difficulty tiers:

**L0 - Minimal context:**
```bash
echo "Update the dependencies in this project." > suites/my-new-suite/prompts/my-scenario/L0-minimal.md
```

**L1 - Basic context:**
```bash
echo "This React project needs its dependencies updated. Please update React and related packages to their latest compatible versions while ensuring the project still builds and tests pass." > suites/my-new-suite/prompts/my-scenario/L1-basic.md
```

**L2 - Directed guidance:**
```bash
echo "Update the dependencies in this React project:
1. Update React to the latest 18.x version
2. Update @types/react to match React version  
3. Update TypeScript to latest 5.x version
4. Ensure all tests pass
5. Maintain TypeScript compatibility" > suites/my-new-suite/prompts/my-scenario/L2-directed.md
```

#### Step 5: Create Oracle Answers (`oracle-answers.json`)
```bash
cat > suites/my-new-suite/scenarios/my-scenario/oracle-answers.json << 'EOF'
{
  "react": "^18.0.0",
  "@types/react": "^18.0.0", 
  "typescript": "^5.0.0"
}
EOF
```

#### Step 6: Test Your Scenario
```bash
# Test with specific agent and tier
pnpm bench my-new-suite my-scenario L1 anthropic

# Test all tiers
pnpm bench my-new-suite my-scenario --batch anthropic
```

### Quality Checklist
Before submitting your benchmark:

- [ ] Repository fixture is realistic and complete
- [ ] Dependencies have intentional version mismatches
- [ ] Prompts are clear and appropriately detailed for each tier
- [ ] Validation commands match the project setup
- [ ] Oracle answers are correct
- [ ] Benchmark runs successfully with different agents
- [ ] All tiers provide appropriate challenge levels
- [ ] Documentation is clear and complete

### Proposing New Benchmarks
Use our GitHub issue template to propose new benchmarks:
1. Go to [GitHub Issues](https://github.com/your-org/ze-benchmarks/issues)
2. Click "New Issue" → "New Benchmark Proposal"
3. Fill out the template with your benchmark idea
4. We'll review and help you implement it!

### 2. Adding Evaluators
- Implement the Evaluator interface correctly
- Provide meaningful scores and feedback
- Handle edge cases gracefully
- Include comprehensive tests

### 3. Improving Documentation
- Fix typos and improve clarity
- Add missing information
- Update examples and templates
- Improve organization and structure

### 4. Bug Reports and Feature Requests
- Use GitHub issues for bug reports
- Use GitHub discussions for feature requests
- Provide clear reproduction steps
- Include relevant context and examples

## Submission Process

### Step 1: Fork and Clone
```bash
# Fork the repository on GitHub
# Clone your fork
git clone https://github.com/your-username/ze-benchmarks.git
cd ze-benchmarks

# Add upstream remote
git remote add upstream https://github.com/your-org/ze-benchmarks.git
```

### Step 2: Create a Branch
```bash
# Create a new branch for your contribution
git checkout -b feature/my-contribution

# Or for bug fixes
git checkout -b fix/issue-description
```

### Step 3: Make Your Changes
```bash
# Make your changes
# Follow the coding standards and guidelines
# Test thoroughly
# Update documentation as needed
```

### Step 4: Test Your Changes
```bash
# Run tests
pnpm test

# Test your benchmark/evaluator
pnpm bench your-suite your-scenario --agent anthropic

# Check for linting issues
pnpm lint

# Build packages
pnpm build
```

### Step 5: Commit Your Changes
```bash
# Add your changes
git add .

# Commit with a clear message
git commit -m "Add my-suite benchmark with dependency update scenario"

# Push to your fork
git push origin feature/my-contribution
```

### Step 6: Create Pull Request
1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Fill out the PR template
4. Request review from maintainers
5. Address feedback and make changes

## Review Criteria

### For Benchmarks
- [ ] **Realistic**: Uses real-world scenarios developers face
- [ ] **Challenging**: Tests agent capabilities appropriately
- [ ] **Complete**: All required files present and correct
- [ ] **Tested**: Works with multiple agents and tiers
- [ ] **Documented**: Clear documentation and examples
- [ ] **Validated**: Repository fixture builds and tests pass

### For Evaluators
- [ ] **Correct**: Implements Evaluator interface properly
- [ ] **Reliable**: Handles edge cases and errors gracefully
- [ ] **Fast**: Executes efficiently (under 1 second)
- [ ] **Meaningful**: Provides useful scores and feedback
- [ ] **Tested**: Comprehensive unit and integration tests
- [ ] **Documented**: Clear purpose, usage, and examples

### For Documentation
- [ ] **Accurate**: Information is correct and up-to-date
- [ ] **Clear**: Easy to understand and follow
- [ ] **Complete**: Covers all necessary information
- [ ] **Organized**: Well-structured and easy to navigate
- [ ] **Examples**: Includes practical examples
- [ ] **Consistent**: Follows established style and format

## Testing Requirements

### Benchmarks
- [ ] Test with at least 2 different agents
- [ ] Test with multiple prompt tiers (L0, L1, L2)
- [ ] Verify repository fixture builds successfully
- [ ] Confirm validation commands work
- [ ] Test edge cases and error conditions

### Evaluators
- [ ] Unit tests for all methods
- [ ] Integration tests with real data
- [ ] Performance tests (execution time)
- [ ] Edge case testing (missing data, errors)
- [ ] Score validation (0-1 range)

### Documentation
- [ ] All examples work as written
- [ ] Links are valid and accessible
- [ ] Code snippets are syntactically correct
- [ ] Instructions are complete and accurate

## Coding Standards

### TypeScript
- Use strict typing
- Prefer interfaces over types
- Use meaningful variable names
- Add JSDoc comments for public methods
- Follow ESLint configuration

### File Organization
- Place benchmarks in `suites/` directory
- Place evaluators in `packages/evaluators/src/evaluators/`
- Use kebab-case for file names
- Group related files together

### Documentation
- Use clear, concise language
- Include code examples
- Provide context and explanations
- Update related documentation
- Follow markdown best practices

## Quality Checklists

### Before Submitting
- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation is updated
- [ ] Examples work correctly
- [ ] Performance is acceptable
- [ ] Edge cases are handled
- [ ] Error handling is robust

### Benchmark Checklist
- [ ] All required files present
- [ ] scenario.yaml validates
- [ ] Repository fixture minimal but complete
- [ ] Prompts are clear and appropriate
- [ ] Oracle answers are comprehensive
- [ ] Validation commands work
- [ ] Tested with multiple agents
- [ ] Tested with multiple tiers

### Evaluator Checklist
- [ ] Implements Evaluator interface
- [ ] Returns scores in 0-1 range
- [ ] Handles missing context gracefully
- [ ] Provides meaningful details
- [ ] Tested with sample data
- [ ] Performance is acceptable
- [ ] Error handling is robust

## Licensing

### Intellectual Property
- All contributions must be your original work
- You must have the right to contribute the code
- Contributions will be licensed under the project license
- You retain copyright to your contributions

### License Agreement
By contributing to this project, you agree that your contributions will be licensed under the same license as the project.

## Getting Help

### Documentation
- [Quick Start Guide](docs/QUICK-START.md) - Get started in 30 minutes
- [Adding Benchmarks](docs/ADDING-BENCHMARKS.md) - Comprehensive benchmark guide
- [Adding Evaluators](docs/ADDING-EVALUATORS.md) - Detailed evaluator guide
- [Configuration Reference](docs/CONFIGURATION-REFERENCE.md) - Complete config guide

### Examples and Templates
- [Template Files](templates/) - Ready-to-use templates
- [Example Benchmarks](examples/) - Working examples
- [Example Evaluators](examples/evaluators/) - Various evaluator types

### Support
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Pull Request Comments**: For specific feedback on your contribution
- **Documentation**: Check existing docs for answers

## Review Process

### What to Expect
1. **Initial Review**: Maintainers will review your PR within 1-2 business days
2. **Feedback**: You may receive feedback on code quality, testing, or documentation
3. **Iteration**: Address feedback and make requested changes
4. **Final Review**: Once all feedback is addressed, your PR will be approved
5. **Merge**: Your contribution will be merged into the main branch

### Common Feedback
- **Testing**: Add more comprehensive tests
- **Documentation**: Improve documentation and examples
- **Performance**: Optimize for better performance
- **Edge Cases**: Handle more edge cases and error conditions
- **Code Quality**: Improve code organization and readability

### Timeline
- **Initial Review**: 1-2 business days
- **Feedback Response**: 1-2 business days
- **Final Review**: 1-2 business days
- **Total**: 3-6 business days typically

## Recognition

### Contributors
- All contributors are recognized in the project README
- Significant contributors may be invited to join the maintainer team
- Contributors are acknowledged in release notes

### Maintainers
- Maintainers are responsible for reviewing and merging contributions
- They help guide the project direction and maintain quality
- They are available to help contributors and answer questions

## Best Practices

### For Contributors
- Start small and build up complexity
- Ask questions early and often
- Test thoroughly before submitting
- Be responsive to feedback
- Help others when you can

### For Maintainers
- Be welcoming and constructive
- Provide clear, actionable feedback
- Help contributors succeed
- Maintain high quality standards
- Foster a positive community

## Thank You

Thank you for contributing to ze-benchmarks! Your contributions help make AI agent evaluation more comprehensive, fair, and useful for the entire community.

Every contribution, no matter how small, makes a difference. Whether you're adding a new benchmark, fixing a bug, or improving documentation, you're helping advance the field of AI agent evaluation.

We appreciate your time, effort, and expertise. Together, we can build better tools for evaluating AI agents and advancing the state of the art.

Happy contributing! 🚀
