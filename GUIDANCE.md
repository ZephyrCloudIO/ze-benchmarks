# Benchmark Scenario Design Guidance

This document provides guidance on designing effective benchmark scenarios for the ze-benchmarks suite.

## Table of Contents
- [Coarse-Grained vs Fine-Grained Scenarios](#coarse-grained-vs-fine-grained-scenarios)
- [When to Use Each Approach](#when-to-use-each-approach)
- [Scenario Complexity Levels](#scenario-complexity-levels)
- [Best Practices](#best-practices)
- [Examples](#examples)

## Coarse-Grained vs Fine-Grained Scenarios

### Coarse-Grained Scenarios

**Definition**: Scenarios that test complete workflows, features, or systems rather than individual functions or components.

**Characteristics**:
- Test end-to-end functionality
- Exercise multiple components working together
- Validate integrated systems
- Focus on real-world use cases
- Require broader implementation

**Advantages**:
- More realistic testing of actual usage patterns
- Better evaluate system integration
- Allow for creative problem-solving approaches
- Reduce brittleness from over-specification
- Better match production requirements

**Disadvantages**:
- Harder to debug when failing
- Less precise in identifying specific issues
- May require more setup and infrastructure
- Can take longer to execute

**Example**:
```markdown
# Coarse-Grained: Design Token Extraction Workflow

Build a system that extracts design tokens from Figma and generates
structured token files for use in code.

Requirements:
- Extract colors, typography, spacing, and effects
- Generate multiple output formats (JSON, CSS, SCSS)
- Validate token consistency
- Handle missing or invalid tokens gracefully
```

### Fine-Grained Scenarios

**Definition**: Scenarios that test specific functions, methods, or isolated components.

**Characteristics**:
- Test individual units of functionality
- Focus on specific algorithms or logic
- Provide detailed specifications
- Exercise edge cases explicitly
- Require narrow implementation

**Advantages**:
- Easier to debug failures
- Precise identification of issues
- Faster test execution
- Clearer success criteria
- Better for testing specific algorithms

**Disadvantages**:
- May not reflect real usage patterns
- Can be overly prescriptive
- May miss integration issues
- Can create brittle tests
- May not test system design

**Example**:
```markdown
# Fine-Grained: Parse Figma Color Hex Value

Implement `parseColorHex(colorString: string): RGB` that parses
a hex color string to RGB values.

Requirements:
- Support 3-digit hex (#RGB)
- Support 6-digit hex (#RRGGBB)
- Support 8-digit hex with alpha (#RRGGBBAA)
- Return null for invalid input
- Handle both uppercase and lowercase

Test Cases:
- parseColorHex("#FF0000") → { r: 255, g: 0, b: 0 }
- parseColorHex("#F00") → { r: 255, g: 0, b: 0 }
- parseColorHex("invalid") → null
```

## When to Use Each Approach

### Use Coarse-Grained When:

1. **Testing System Integration**
   - Multiple components need to work together
   - Testing data flow between systems
   - Validating end-to-end workflows

2. **Real-World Use Cases**
   - Scenarios match actual production usage
   - Testing complete features
   - Evaluating user-facing functionality

3. **Allowing Implementation Flexibility**
   - Multiple valid approaches exist
   - Want to test problem-solving ability
   - Architecture should be flexible

4. **Starting New Benchmark Suites**
   - Begin with coarse-grained scenarios
   - Add fine-grained only if coarse scenarios consistently fail
   - Let implementation experience guide refinement

### Use Fine-Grained When:

1. **Testing Specific Algorithms**
   - Complex parsing logic
   - Mathematical calculations
   - Data transformation functions

2. **Debugging Coarse-Grained Failures**
   - Coarse scenario consistently fails
   - Need to isolate specific issue
   - Want to test specific edge case

3. **Performance-Critical Code**
   - Need to benchmark specific operations
   - Optimizing particular functions
   - Testing algorithmic complexity

4. **Well-Defined Specifications**
   - Clear, unambiguous requirements
   - Industry-standard algorithms
   - Specific format parsing (URLs, dates, etc.)

## Scenario Complexity Levels

We use complexity-based naming for prompt files:

### L0-basic.md
**Target**: Minimal viable implementation
- Basic functionality only
- Simple happy-path cases
- Minimal error handling
- Quick proof of concept

**Use When**:
- Testing if basic concept works
- Rapid prototyping
- Learning new domain
- Validating approach

### L1-intermediate.md
**Target**: Production-quality implementation
- Complete core functionality
- Error handling
- Edge cases covered
- Good code quality

**Use When**:
- Building real features
- Standard production code
- Typical development tasks
- Most benchmark scenarios

### L2-advanced.md
**Target**: Production-grade with advanced features
- Comprehensive functionality
- Performance optimization
- Advanced features
- Extensive documentation
- Robust error handling

**Use When**:
- Enterprise-grade systems
- Complex domains
- Performance-critical code
- Showcase capabilities

## Best Practices

### Scenario Design

1. **Start Coarse-Grained**
   - Begin with end-to-end workflows
   - Only add fine-grained if needed
   - Let failures guide refinement

2. **Clear Success Criteria**
   - Define what "passing" means
   - Include objective measurements
   - Specify expected outputs

3. **Realistic Test Data**
   - Use production-like data
   - Include edge cases naturally
   - Avoid contrived examples

4. **Balanced Complexity**
   - L0: Can complete in 15-30 minutes
   - L1: Can complete in 1-2 hours
   - L2: Can complete in 3-4 hours

### Prompt Writing

1. **Context First**
   - Explain the problem domain
   - Provide necessary background
   - Reference related systems

2. **Requirements, Not Implementation**
   - Describe WHAT, not HOW
   - Allow multiple valid approaches
   - Focus on outcomes

3. **Progressive Disclosure**
   - L0: Minimal requirements
   - L1: Add real-world concerns
   - L2: Add advanced features

4. **Clear Examples**
   - Show expected inputs/outputs
   - Demonstrate edge cases
   - Clarify ambiguities

### Oracle Answers

1. **Behavioral Expectations**
   ```json
   {
     "expectedBehavior": {
       "testsPass": true,
       "typescriptCompiles": true,
       "lintPasses": true,
       "handlesErrors": true,
       "hasDocumentation": true
     }
   }
   ```

2. **Not Implementation Details**
   - Don't specify function names
   - Don't dictate file structure
   - Allow architectural flexibility

3. **Measurable Criteria**
   - Tests pass
   - Code compiles
   - Linting succeeds
   - Performance meets threshold

## Examples

### Good Coarse-Grained Scenario

```markdown
# Component Classification System

Build a system that analyzes Figma components and classifies them
into semantic types for code generation.

## Requirements
- Classify components into standard UI types (Button, Input, Card, etc.)
- Handle component variants and properties
- Generate confidence scores for classifications
- Provide alternative classifications when ambiguous

## Testing
- Test classification accuracy across component types
- Verify variant detection
- Test with ambiguous components
```

**Why It's Good**:
- Tests complete workflow
- Allows implementation flexibility
- Focuses on real-world use case
- Clear success criteria without over-specification

### Poor Fine-Grained Scenario (for this use case)

```markdown
# Extract Button Component Name

Implement `extractButtonName(node: FigmaNode): string` that
extracts the button's display name.

## Requirements
- Return node.name if node.type === "COMPONENT"
- Return null if not a component
- Trim whitespace
- Convert to PascalCase

## Test Cases
- extractButtonName({ type: "COMPONENT", name: " Primary Button " }) → "PrimaryButton"
- extractButtonName({ type: "FRAME", name: "Button" }) → null
```

**Why It's Poor**:
- Too specific and prescriptive
- Doesn't test real workflow
- Over-specifies implementation
- Misses broader context
- Would be better as part of larger scenario

### Good Fine-Grained Scenario (when appropriate)

```markdown
# Figma URL Parser

Parse Figma URLs and extract file keys, node IDs, and resource types.

## URL Formats
- https://www.figma.com/file/{fileKey}/{fileName}?node-id={nodeId}
- https://www.figma.com/design/{fileKey}/{fileName}
- figma://file/{fileKey}?node-id={nodeId}

## Requirements
- Extract fileKey, resource type, fileName
- Parse query parameters
- Handle invalid URLs gracefully
- Support both HTTPS and figma:// protocols

## Test Cases
[Specific test cases with inputs and expected outputs]
```

**Why It's Good**:
- Well-defined specification (URL parsing)
- Clear, unambiguous requirements
- Specific enough to be testable
- Flexible enough to allow different approaches
- Matches a real, isolated need

## Migration Strategy

If you have existing fine-grained scenarios:

1. **Evaluate Current Scenarios**
   - Are they testing real workflows?
   - Do they allow implementation flexibility?
   - Are they consistently passing or failing?

2. **Consolidate Related Scenarios**
   - Combine related fine-grained scenarios
   - Create end-to-end workflows
   - Keep fine-grained only for specific algorithms

3. **Rewrite Prompts**
   - Remove implementation details
   - Focus on outcomes
   - Add context and use cases

4. **Update Gradually**
   - Start with new scenarios as coarse-grained
   - Refine existing scenarios over time
   - Learn from what works

## Conclusion

**Default to coarse-grained scenarios** that test real workflows and allow implementation flexibility. Use fine-grained scenarios only when:
- Testing specific, well-defined algorithms
- Debugging persistent coarse-grained failures
- Performance testing specific operations

This approach creates more realistic, maintainable benchmarks that better evaluate real-world capabilities.
