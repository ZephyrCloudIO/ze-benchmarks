# Prompt Tiers

This guide explains the different prompt tiers used in ze-benchmarks and how to write effective prompts for each tier.

## Overview

Prompt tiers test different aspects of agent capabilities by varying the amount of context and guidance provided. Each tier serves a specific purpose in evaluating agent performance.

## Tier System

### L0 - Minimal Context
**Purpose**: Tests agent's ability to discover requirements and make decisions independently.

**Characteristics**:
- Bare minimum context
- No specific instructions
- Tests discovery and inference skills
- Most challenging for agents

**Example**:
```markdown
Update the dependencies in this project.
```

**When to use**:
- Testing agent's ability to understand context
- Evaluating decision-making skills
- Assessing requirement discovery
- Real-world scenarios where users provide minimal input

### L1 - Basic Context
**Purpose**: Standard user scenario with reasonable context.

**Characteristics**:
- Typical user request
- Basic context provided
- Clear but not detailed instructions
- Tests standard problem-solving

**Example**:
```markdown
This project needs its dependencies updated. Please update React and related packages to their latest compatible versions while ensuring the project still builds and tests pass.
```

**When to use**:
- Standard user scenarios
- Testing basic competency
- Evaluating context understanding
- Most common tier for general testing

### L2 - Directed Guidance
**Purpose**: Detailed guidance for complex tasks.

**Characteristics**:
- Explicit instructions
- Step-by-step guidance
- Detailed requirements
- Tests execution of specific tasks

**Example**:
```markdown
Update the dependencies in this React monorepo:

1. Update React to the latest 18.x version
2. Update @types/react to match React version
3. Update other React-related packages
4. Ensure all tests pass
5. Maintain workspace structure

Constraints:
- Keep React on 18.x (not 19.x)
- Maintain TypeScript compatibility
- Preserve workspace configuration
```

**When to use**:
- Complex tasks requiring guidance
- Testing specific skill execution
- Evaluating detailed instruction following
- Scenarios where users provide specific requirements

### L3 - Migration Specific
**Purpose**: Specific migration or upgrade scenarios.

**Characteristics**:
- Migration-focused context
- Specific technology transitions
- Detailed migration requirements
- Tests specialized knowledge

**Example**:
```markdown
Migrate this React 17 project to React 18:

1. Update React to 18.x and React DOM to 18.x
2. Update @types/react and @types/react-dom to 18.x
3. Handle React 18 breaking changes:
   - Remove ReactDOM.render (use createRoot)
   - Update StrictMode behavior
   - Handle automatic batching changes
4. Update tests for new React 18 APIs
5. Ensure all components work with new version

Migration checklist:
- [ ] Update package.json dependencies
- [ ] Replace ReactDOM.render with createRoot
- [ ] Update test files for new APIs
- [ ] Verify StrictMode compatibility
- [ ] Test all user interactions
```

**When to use**:
- Technology migrations
- Framework upgrades
- Breaking change handling
- Specialized domain knowledge

### Lx - Adversarial
**Purpose**: Edge cases and tricky scenarios.

**Characteristics**:
- Intentionally challenging
- Edge cases and corner cases
- Potential pitfalls highlighted
- Tests robust problem-solving

**Example**:
```markdown
Update dependencies in this problematic project:

WARNING: This project has several issues:
- Circular dependencies between packages
- Conflicting peer dependencies
- Outdated lockfile with security vulnerabilities
- Mixed package managers (some npm, some pnpm)
- Inconsistent workspace configuration

Your task:
1. Resolve all dependency conflicts
2. Standardize on one package manager
3. Fix circular dependencies
4. Update security vulnerabilities
5. Ensure everything still works

Constraints:
- Cannot break existing functionality
- Must maintain workspace structure
- All tests must pass
- No manual file editing (use package manager commands only)
```

**When to use**:
- Testing edge case handling
- Evaluating robust problem-solving
- Assessing conflict resolution
- Stress testing agent capabilities

## Writing Effective Prompts

### General Guidelines

1. **Be Specific**: Each tier should have a clear purpose and appropriate level of detail
2. **Be Realistic**: Use scenarios that developers actually encounter
3. **Be Consistent**: Maintain consistent tone and style across tiers
4. **Be Testable**: Ensure success criteria are clear and measurable

### L0 Writing Tips
- Keep it minimal but not ambiguous
- Provide just enough context to understand the task
- Avoid specific instructions or guidance
- Focus on the core request

### L1 Writing Tips
- Provide reasonable context
- Include basic requirements
- Avoid over-specification
- Use natural language

### L2 Writing Tips
- Be explicit about requirements
- Provide step-by-step guidance
- Include constraints and limitations
- Specify success criteria

### L3 Writing Tips
- Focus on specific technology transitions
- Include migration-specific knowledge
- Provide detailed requirements
- Include validation steps

### Lx Writing Tips
- Highlight potential problems
- Include edge cases and conflicts
- Make challenges explicit
- Test robust problem-solving

## Tier Selection Strategy

### For Benchmark Designers
Choose tiers based on what you want to test:

- **L0**: Discovery and inference skills
- **L1**: Standard competency
- **L2**: Detailed execution
- **L3**: Specialized knowledge
- **Lx**: Robust problem-solving

### For Agent Evaluation
Use multiple tiers to get comprehensive evaluation:

- **L0 + L1**: Basic competency range
- **L1 + L2**: Standard to detailed execution
- **L2 + L3**: Detailed to specialized knowledge
- **L3 + Lx**: Specialized to robust problem-solving

## Common Patterns

### Dependency Management
- **L0**: "Update dependencies"
- **L1**: "Update React and related packages"
- **L2**: "Update React to 18.x, handle breaking changes"
- **L3**: "Migrate from React 17 to 18 with specific steps"
- **Lx**: "Update dependencies with circular dependency conflicts"

### Code Migration
- **L0**: "Migrate this code"
- **L1**: "Migrate from framework A to B"
- **L2**: "Migrate with specific steps and constraints"
- **L3**: "Migrate with breaking change handling"
- **Lx**: "Migrate with conflicting dependencies and constraints"

### Testing
- **L0**: "Add tests"
- **L1**: "Add tests for this component"
- **L2**: "Add unit tests with specific coverage"
- **L3**: "Add tests for React 18 migration"
- **Lx**: "Add tests for complex state management"

## Best Practices

### Prompt Quality
- **Clear**: Unambiguous instructions
- **Complete**: All necessary context
- **Consistent**: Similar structure across tiers
- **Realistic**: Real-world scenarios

### Testing Strategy
- **Multiple Tiers**: Test different skill levels
- **Progressive Difficulty**: L0 → L1 → L2 → L3 → Lx
- **Comprehensive Coverage**: All major skill areas
- **Realistic Scenarios**: Real developer tasks

### Evaluation
- **Tier-Appropriate Scoring**: Different expectations per tier
- **Skill-Specific Metrics**: What each tier tests
- **Progressive Expectations**: Higher tiers = higher expectations
- **Comprehensive Assessment**: All tiers together

## Examples by Domain

### Dependency Management
```markdown
# L0
Update dependencies.

# L1
Update the project dependencies to their latest versions.

# L2
Update React to 18.x, handle breaking changes, ensure tests pass.

# L3
Migrate from React 17 to 18, handle StrictMode changes, update tests.

# Lx
Update dependencies with circular dependency conflicts and security vulnerabilities.
```

### Code Migration
```markdown
# L0
Migrate this code.

# L1
Migrate from JavaScript to TypeScript.

# L2
Migrate with strict type checking, handle implicit any types.

# L3
Migrate with strict type checking, handle complex generic types.

# Lx
Migrate with conflicting type definitions and circular references.
```

### Testing
```markdown
# L0
Add tests.

# L1
Add unit tests for this component.

# L2
Add unit tests with 80% coverage, mock external dependencies.

# L3
Add tests for React 18 migration, handle new APIs.

# Lx
Add tests for complex state management with async operations.
```

## Conclusion

The tier system provides a comprehensive way to evaluate agent capabilities across different skill levels and scenarios. By using multiple tiers, you can get a complete picture of an agent's strengths and weaknesses, from basic competency to specialized knowledge and robust problem-solving.
