# Evaluator Quality Checklist

Use this checklist to ensure your evaluator meets quality standards before submitting.

## Pre-Submission Checklist

### Interface Implementation
- [ ] **Evaluator Interface** - Implements the Evaluator interface correctly
- [ ] **Meta Property** - Includes meta.name property
- [ ] **Evaluate Method** - Implements evaluate method with correct signature
- [ ] **Return Type** - Returns EvaluatorResult with correct structure
- [ ] **Async Support** - Uses async/await appropriately

### Code Quality
- [ ] **TypeScript Types** - Uses proper TypeScript typing
- [ ] **Error Handling** - Handles errors gracefully
- [ ] **Input Validation** - Validates inputs before processing
- [ ] **Edge Cases** - Handles edge cases appropriately
- [ ] **Performance** - Executes efficiently (under 1 second)

### Scoring Standards
- [ ] **Score Range** - Returns scores between 0.0 and 1.0
- [ ] **Meaningful Scores** - Scores reflect actual performance
- [ ] **Consistent Scale** - Uses consistent scoring methodology
- [ ] **Detailed Feedback** - Provides useful details in details field
- [ ] **Fair Assessment** - Avoids bias in scoring logic

## Testing Checklist

### Unit Testing
- [ ] **Basic Functionality** - Tests core evaluation logic
- [ ] **Edge Cases** - Tests with minimal and maximal data
- [ ] **Error Conditions** - Tests error handling
- [ ] **Score Validation** - Ensures scores are in valid range
- [ ] **Details Validation** - Verifies details field is informative

### Integration Testing
- [ ] **Real Data Testing** - Tests with real benchmark data
- [ ] **Context Validation** - Tests with various context scenarios
- [ ] **Performance Testing** - Measures execution time
- [ ] **Reliability Testing** - Tests consistency across runs
- [ ] **Compatibility Testing** - Tests with different scenarios

### Test Coverage
- [ ] **Method Coverage** - All methods are tested
- [ ] **Branch Coverage** - All code paths are tested
- [ ] **Edge Case Coverage** - Edge cases are covered
- [ ] **Error Coverage** - Error conditions are tested
- [ ] **Integration Coverage** - Integration scenarios are tested

## Documentation Checklist

### Code Documentation
- [ ] **Class Documentation** - Clear description of evaluator purpose
- [ ] **Method Documentation** - JSDoc comments for all public methods
- [ ] **Parameter Documentation** - Clear parameter descriptions
- [ ] **Return Documentation** - Clear return value descriptions
- [ ] **Example Usage** - Code examples for usage

### User Documentation
- [ ] **Purpose Statement** - Clear explanation of what the evaluator does
- [ ] **Usage Instructions** - How to use the evaluator
- [ ] **Configuration Options** - Any configuration options
- [ ] **Examples** - Practical usage examples
- [ ] **Troubleshooting** - Common issues and solutions

## Performance Checklist

### Execution Time
- [ ] **Fast Execution** - Evaluates in under 1 second
- [ ] **Efficient Algorithms** - Uses optimized algorithms
- [ ] **Minimal I/O** - Minimizes file system and network operations
- [ ] **Caching** - Implements caching where appropriate
- [ ] **Resource Usage** - Uses resources efficiently

### Scalability
- [ ] **Large Data Sets** - Handles large context data
- [ ] **Concurrent Execution** - Works with concurrent evaluations
- [ ] **Memory Usage** - Uses memory efficiently
- [ ] **CPU Usage** - Uses CPU efficiently
- [ ] **Network Usage** - (for LLM evaluators) Minimizes API calls

## Reliability Checklist

### Error Handling
- [ ] **Graceful Degradation** - Handles errors without crashing
- [ ] **Error Recovery** - Recovers from errors when possible
- [ ] **Error Reporting** - Provides meaningful error messages
- [ ] **Fallback Behavior** - Provides fallback behavior for failures
- [ ] **Logging** - Logs important events for debugging

### Robustness
- [ ] **Input Validation** - Validates all inputs
- [ ] **Type Safety** - Uses proper TypeScript types
- [ ] **Null Safety** - Handles null/undefined values
- [ ] **Boundary Conditions** - Handles boundary conditions
- [ ] **Resource Cleanup** - Cleans up resources properly

## Maintainability Checklist

### Code Organization
- [ ] **Single Responsibility** - Each method has one purpose
- [ ] **Clear Structure** - Code is well-organized
- [ ] **Logical Flow** - Code follows logical flow
- [ ] **Separation of Concerns** - Concerns are separated appropriately
- [ ] **Modularity** - Code is modular and reusable

### Code Quality
- [ ] **Readable Code** - Code is easy to read and understand
- [ ] **Consistent Style** - Follows consistent coding style
- [ ] **Meaningful Names** - Uses meaningful variable and method names
- [ ] **Appropriate Comments** - Comments explain why, not what
- [ ] **No Duplication** - Avoids code duplication

## Integration Checklist

### System Integration
- [ ] **Interface Compliance** - Follows Evaluator interface exactly
- [ ] **Context Usage** - Uses available context data appropriately
- [ ] **Result Format** - Returns results in expected format
- [ ] **Error Propagation** - Handles errors appropriately
- [ ] **Configuration** - Supports configuration options

### Registration
- [ ] **File Location** - Placed in correct directory
- [ ] **Export Format** - Exported correctly
- [ ] **Naming Convention** - Follows naming conventions
- [ ] **Discovery** - Can be discovered by the system
- [ ] **Loading** - Loads correctly at runtime

## Quality Assurance

### Benchmark Compatibility
- [ ] **Scenario Compatibility** - Works with various scenarios
- [ ] **Agent Compatibility** - Works with different agents
- [ ] **Tier Compatibility** - Works with different prompt tiers
- [ ] **Context Compatibility** - Handles various context scenarios
- [ ] **Result Compatibility** - Results are meaningful for all scenarios

### Evaluation Quality
- [ ] **Objective Assessment** - Provides objective assessment
- [ ] **Consistent Results** - Results are consistent across runs
- [ ] **Meaningful Feedback** - Feedback is useful for debugging
- [ ] **Fair Scoring** - Scoring is fair and unbiased
- [ ] **Comprehensive Coverage** - Covers all relevant aspects

## Review Preparation

### Self-Review
- [ ] **Code Review** - Review your own code for quality
- [ ] **Documentation Review** - Check documentation for accuracy
- [ ] **Example Testing** - Test all examples and instructions
- [ ] **Edge Case Testing** - Test with various scenarios
- [ ] **Performance Testing** - Measure and optimize performance

### Peer Review
- [ ] **Colleague Review** - Have a colleague review your evaluator
- [ ] **Feedback Incorporation** - Address feedback and make improvements
- [ ] **Final Testing** - Test after incorporating feedback
- [ ] **Documentation Update** - Update documentation based on feedback

## Submission Readiness

### Final Checks
- [ ] **All Tests Pass** - All tests pass successfully
- [ ] **Documentation Complete** - All documentation is complete
- [ ] **Examples Work** - All examples work correctly
- [ ] **Performance Acceptable** - Meets performance requirements
- [ ] **Quality Standards Met** - Meets all quality requirements

### PR Preparation
- [ ] **Clear Title** - PR title clearly describes the contribution
- [ ] **Detailed Description** - PR description explains the evaluator
- [ ] **Testing Instructions** - Clear instructions for testing
- [ ] **Documentation Links** - Links to relevant documentation
- [ ] **Reviewer Assignment** - Appropriate reviewers assigned

## Common Issues to Avoid

### Interface Issues
- [ ] **Missing Interface** - Ensure Evaluator interface is implemented
- [ ] **Incorrect Signature** - Ensure method signatures are correct
- [ ] **Wrong Return Type** - Ensure return type is EvaluatorResult
- [ ] **Missing Properties** - Ensure all required properties are present

### Scoring Issues
- [ ] **Score Out of Range** - Ensure scores are between 0 and 1
- [ ] **Inconsistent Scoring** - Ensure scoring is consistent
- [ ] **Meaningless Scores** - Ensure scores reflect actual performance
- [ ] **Bias in Scoring** - Avoid bias in scoring logic

### Performance Issues
- [ ] **Slow Execution** - Optimize for speed
- [ ] **High Resource Usage** - Optimize resource usage
- [ ] **Memory Leaks** - Avoid memory leaks
- [ ] **Inefficient Algorithms** - Use efficient algorithms

### Error Handling Issues
- [ ] **Unhandled Errors** - Handle all possible errors
- [ ] **Poor Error Messages** - Provide meaningful error messages
- [ ] **No Fallback** - Provide fallback behavior
- [ ] **Resource Leaks** - Clean up resources properly

## Success Criteria

### Evaluator Acceptance
- [ ] **Meets Requirements** - Satisfies all quality requirements
- [ ] **Passes Testing** - All tests pass successfully
- [ ] **Documentation Complete** - All documentation is complete
- [ ] **Examples Working** - All examples work correctly
- [ ] **Performance Acceptable** - Meets performance requirements

### Contributor Recognition
- [ ] **Quality Contribution** - High-quality evaluator contribution
- [ ] **Documentation Excellence** - Excellent documentation and examples
- [ ] **Testing Thoroughness** - Comprehensive testing and validation
- [ ] **Community Value** - Provides value to the community

## Final Notes

### Before Submitting
- Double-check all requirements
- Test thoroughly with real data
- Verify all documentation is accurate
- Ensure all examples work
- Get feedback from colleagues if possible

### After Submission
- Respond promptly to feedback
- Make requested changes quickly
- Test changes thoroughly
- Update documentation as needed
- Help with any follow-up questions

### Continuous Improvement
- Monitor evaluator performance
- Update based on feedback
- Improve documentation over time
- Add new examples as needed
- Help others with similar evaluators

Remember: Quality evaluators are fast, reliable, and provide meaningful feedback for agent performance assessment. Take the time to ensure your evaluator meets these standards before submitting.
