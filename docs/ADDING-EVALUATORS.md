# Adding Evaluators

This guide explains how to create and contribute new evaluators to the ze-benchmarks system.

## Overview

Evaluators are automated scoring mechanisms that assess agent performance on benchmark tasks. They analyze the agent's actions, outputs, and results to provide objective scores and detailed feedback.

## Types of Evaluators

### Heuristic Evaluators
Rule-based evaluators that check specific criteria using deterministic logic.

**Characteristics**:
- Fast execution
- Deterministic results
- No external dependencies
- Easy to debug and maintain

**Examples**:
- Install success checker
- Test pass/fail validator
- Dependency update verifier
- File change analyzer

### LLM-Based Evaluators
AI-powered evaluators that use language models for subjective assessment.

**Characteristics**:
- Human-like judgment
- Contextual understanding
- Subjective quality assessment
- External API dependencies

**Examples**:
- Code quality assessor
- Approach evaluation
- Efficiency analysis
- Maintainability scoring

## Architecture

### Evaluation Flow
1. **Context Collection**: Gather agent actions, outputs, and results
2. **Evaluation Execution**: Run evaluators with collected context
3. **Score Calculation**: Compute scores (0-1 scale) and details
4. **Result Aggregation**: Combine scores with weights for final score

### Integration Points
- **Scenario Configuration**: Link evaluators to specific scenarios
- **Weight Assignment**: Control evaluator influence on final score
- **Context Access**: Use available data for evaluation
- **Result Storage**: Store scores and details in database

## Creating Heuristic Evaluators

### Step 1: Implement the Evaluator Interface

```typescript
import type { EvaluationContext, Evaluator, EvaluatorResult } from '@ze/evaluators';

export class MyCustomEvaluator implements Evaluator {
  meta = { name: 'MyCustomEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    // Implementation here
  }
}
```

### Step 2: Access Evaluation Context

The `EvaluationContext` provides all available data:

```typescript
async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
  const {
    scenario,        // Scenario configuration
    workspaceDir,    // Workspace directory path
    agentResponse,   // Agent's text response
    diffSummary,    // File changes made
    depsDelta,      // Dependency changes
    commandLog      // Commands executed
  } = ctx;
  
  // Use this data for evaluation
}
```

### Step 3: Implement Evaluation Logic

```typescript
async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
  // Extract relevant data
  const { commandLog, diffSummary, depsDelta } = ctx;
  
  // Perform evaluation
  let score = 0;
  let details = '';
  
  // Example: Check if install succeeded
  const installCmd = commandLog?.find(cmd => cmd.type === 'install');
  if (installCmd?.exitCode === 0) {
    score = 1;
    details = 'Install succeeded';
  } else {
    score = 0;
    details = `Install failed: exit code ${installCmd?.exitCode}`;
  }
  
  // Return result
  return {
    name: this.meta.name,
    score,    // 0-1 scale
    details   // Optional detailed explanation
  };
}
```

### Step 4: Handle Edge Cases

```typescript
async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
  try {
    // Main evaluation logic
    const result = await this.performEvaluation(ctx);
    return result;
  } catch (error) {
    // Handle errors gracefully
    return {
      name: this.meta.name,
      score: 0,
      details: `Evaluation failed: ${error.message}`
    };
  }
}
```

## Creating LLM-Based Evaluators

### Step 1: Set Up LLM Integration

```typescript
import { OpenRouterClient } from '@ze/evaluators';

export class MyLLMEvaluator implements Evaluator {
  meta = { name: 'MyLLMEvaluator' } as const;
  private client: OpenRouterClient;

  constructor() {
    this.client = new OpenRouterClient({
      apiKey: process.env.OPENROUTER_API_KEY,
      model: 'anthropic/claude-3.5-sonnet'
    });
  }
}
```

### Step 2: Design Evaluation Prompt

```typescript
private createEvaluationPrompt(ctx: EvaluationContext): string {
  return `
Evaluate the agent's performance on this task:

Task: ${ctx.scenario.description}
Agent Response: ${ctx.agentResponse}
File Changes: ${JSON.stringify(ctx.diffSummary, null, 2)}
Dependency Changes: ${JSON.stringify(ctx.depsDelta, null, 2)}

Rate the agent on these criteria (1-5 scale):
1. Code Quality: How well-written is the code?
2. Correctness: Did the agent solve the problem correctly?
3. Efficiency: Was the solution efficient?
4. Maintainability: Is the code maintainable?

Provide scores and reasoning for each criterion.
`;
}
```

### Step 3: Parse LLM Response

```typescript
private parseLLMResponse(response: string): { scores: number[], reasoning: string } {
  try {
    // Parse structured response from LLM
    const parsed = JSON.parse(response);
    return {
      scores: parsed.scores,
      reasoning: parsed.reasoning
    };
  } catch (error) {
    // Fallback parsing or error handling
    return {
      scores: [0, 0, 0, 0],
      reasoning: 'Failed to parse LLM response'
    };
  }
}
```

### Step 4: Implement Evaluation

```typescript
async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
  try {
    // Create evaluation prompt
    const prompt = this.createEvaluationPrompt(ctx);
    
    // Get LLM response
    const response = await this.client.generate(prompt);
    
    // Parse response
    const { scores, reasoning } = this.parseLLMResponse(response);
    
    // Calculate average score (0-1 scale)
    const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length / 5;
    
    return {
      name: this.meta.name,
      score: avgScore,
      details: JSON.stringify({ scores, reasoning })
    };
  } catch (error) {
    return {
      name: this.meta.name,
      score: 0,
      details: `LLM evaluation failed: ${error.message}`
    };
  }
}
```

## Evaluation Context Reference

### Available Data

```typescript
interface EvaluationContext {
  scenario: ScenarioConfig;        // Scenario configuration
  workspaceDir: string;            // Workspace directory path
  agentResponse?: string;          // Agent's text response
  diffSummary?: FileDiff[];        // File changes made
  depsDelta?: DepChange[];        // Dependency changes
  commandLog?: ExecutedCommand[];  // Commands executed
}
```

### FileDiff Structure

```typescript
interface FileDiff {
  file: string;                    // File path
  changeType: 'added' | 'modified' | 'deleted';
  textPatch?: string;              // Diff content
}
```

### DepChange Structure

```typescript
interface DepChange {
  packagePath: string;             // Package.json path
  section: string;                 // Dependencies section
  name: string;                    // Package name
  from?: string;                   // Previous version
  to?: string;                     // New version
}
```

### ExecutedCommand Structure

```typescript
interface ExecutedCommand {
  tool: string;                    // Tool used
  raw: string;                     // Raw command
  type?: string;                   // Command type
  exitCode?: number;               // Exit code
  stdout?: string;                 // Standard output
  stderr?: string;                 // Error output
  durationMs?: number;             // Execution time
}
```

## Scoring Guidelines

### Score Scale
- **0.0**: Complete failure
- **0.5**: Partial success
- **1.0**: Complete success

### Score Calculation
```typescript
// Binary scoring (pass/fail)
const score = condition ? 1 : 0;

// Graduated scoring (0-1 scale)
const score = Math.min(1, Math.max(0, calculatedValue));

// Weighted scoring (multiple criteria)
const score = (criteria1 * weight1 + criteria2 * weight2) / totalWeight;
```

### Details Field
Provide meaningful feedback:

```typescript
// Good details
details: "Install succeeded, all tests pass, dependencies updated correctly"

// Better details
details: "Install succeeded (exit code 0), 15/15 tests pass, updated React from 17.0.2 to 18.3.1"

// Best details
details: JSON.stringify({
  install: { success: true, exitCode: 0 },
  tests: { passed: 15, total: 15, duration: "2.3s" },
  dependencies: { updated: 3, added: 1, removed: 0 }
})
```

## Testing Evaluators

### Unit Testing

```typescript
import { MyCustomEvaluator } from './my-evaluator';

describe('MyCustomEvaluator', () => {
  it('should score 1 for successful install', async () => {
    const evaluator = new MyCustomEvaluator();
    const ctx = {
      commandLog: [{ type: 'install', exitCode: 0 }],
      // ... other context
    };
    
    const result = await evaluator.evaluate(ctx);
    
    expect(result.score).toBe(1);
    expect(result.details).toContain('Install succeeded');
  });
});
```

### Integration Testing

```typescript
it('should work with real benchmark data', async () => {
  const evaluator = new MyCustomEvaluator();
  const ctx = await loadRealBenchmarkContext();
  
  const result = await evaluator.evaluate(ctx);
  
  expect(result.score).toBeGreaterThanOrEqual(0);
  expect(result.score).toBeLessThanOrEqual(1);
  expect(result.details).toBeDefined();
});
```

## Registration and Discovery

### File Location
Place evaluator files in:
```
packages/evaluators/src/evaluators/
  my-custom-evaluator.ts
  another-evaluator.ts
```

### Export Requirements
```typescript
// Export the evaluator class
export class MyCustomEvaluator implements Evaluator {
  // Implementation
}

// Export as default (optional)
export default MyCustomEvaluator;
```

### Naming Conventions
- Use kebab-case for filenames: `my-custom-evaluator.ts`
- Use PascalCase for class names: `MyCustomEvaluator`
- Use descriptive names that indicate purpose

## Configuration

### Scenario Integration
Link evaluators to scenarios in `scenario.yaml`:

```yaml
rubric_overrides:
  weights:
    my_custom_evaluator: 1.0
    another_evaluator: 0.8
```

### Environment Variables
For LLM evaluators:

```bash
# Required
OPENROUTER_API_KEY=sk-or-v1-your_key_here

# Optional
LLM_JUDGE_MODEL=anthropic/claude-3.5-sonnet
LLM_JUDGE_TEMPERATURE=0.1
LLM_JUDGE_MAX_TOKENS=2000
```

## Best Practices

### Performance
- **Fast Execution**: Keep evaluation time under 1 second
- **Efficient Logic**: Use optimized algorithms and data structures
- **Caching**: Cache expensive computations when possible
- **Async Operations**: Use async/await for I/O operations

### Reliability
- **Error Handling**: Handle all possible error conditions
- **Graceful Degradation**: Provide fallback behavior
- **Input Validation**: Validate all inputs before processing
- **Logging**: Log important events for debugging

### Maintainability
- **Clear Code**: Write readable, well-documented code
- **Single Responsibility**: Each evaluator should have one purpose
- **Testability**: Write comprehensive tests
- **Documentation**: Document purpose, usage, and examples

### Scoring
- **Consistent Scale**: Always use 0-1 scale
- **Meaningful Scores**: Scores should reflect actual performance
- **Detailed Feedback**: Provide useful details for debugging
- **Fair Assessment**: Avoid bias in scoring logic

## Common Patterns

### Install Success Checker
```typescript
const installCmd = commandLog?.find(cmd => cmd.type === 'install');
const score = installCmd?.exitCode === 0 ? 1 : 0;
```

### Test Pass/Fail Validator
```typescript
const testCmd = commandLog?.find(cmd => cmd.type === 'test');
const score = testCmd?.exitCode === 0 ? 1 : 0;
```

### Dependency Update Verifier
```typescript
const requiredUpdates = scenario.targets?.required || [];
const updatedDeps = depsDelta?.filter(dep => 
  requiredUpdates.some(target => target.name === dep.name)
);
const score = updatedDeps.length / requiredUpdates.length;
```

### File Change Analyzer
```typescript
const relevantChanges = diffSummary?.filter(diff => 
  diff.file.endsWith('.ts') || diff.file.endsWith('.tsx')
);
const score = relevantChanges.length > 0 ? 1 : 0;
```

## Troubleshooting

### Common Issues
- **Missing Context**: Check that required context data is available
- **Score Out of Range**: Ensure scores are between 0 and 1
- **Performance Issues**: Optimize evaluation logic
- **LLM Failures**: Handle API errors gracefully

### Debugging
- **Log Context**: Log evaluation context for debugging
- **Test Edge Cases**: Test with minimal and maximal data
- **Validate Scores**: Ensure scores are reasonable
- **Check Details**: Verify details field is informative

## Next Steps

1. **Choose Evaluator Type**: Heuristic or LLM-based
2. **Implement Interface**: Follow the Evaluator interface
3. **Test Thoroughly**: Unit and integration tests
4. **Document Usage**: Clear documentation and examples
5. **Submit for Review**: Create pull request with evaluator

Remember: Good evaluators are fast, reliable, and provide meaningful feedback for agent performance assessment.
