# Benchmark Quality Checklist

Use this checklist to ensure your benchmark meets quality standards before submitting.

## Pre-Submission Checklist

### Required Files
- [ ] **scenario.yaml** - Main configuration file present and valid
- [ ] **oracle-answers.json** - Expected responses to common questions
- [ ] **repo-fixture/** - Starting repository state
- [ ] **L0-minimal.md** - Minimal context prompt
- [ ] **L1-basic.md** - Basic context prompt
- [ ] **L2-directed.md** - Detailed guidance prompt
- [ ] **L3-migration.md** - (optional) Migration-specific prompt
- [ ] **Lx-adversarial.md** - (optional) Edge case prompt

### File Validation
- [ ] **YAML Syntax** - scenario.yaml parses without errors
- [ ] **Required Fields** - All required fields present in scenario.yaml
- [ ] **JSON Syntax** - oracle-answers.json is valid JSON
- [ ] **File Structure** - Directory structure follows conventions
- [ ] **Naming** - Files use kebab-case naming

### Configuration Quality
- [ ] **Realistic Scenario** - Tests real-world developer tasks
- [ ] **Clear Objectives** - Success criteria are well-defined
- [ ] **Appropriate Constraints** - Constraints are realistic and necessary
- [ ] **Valid Targets** - Dependency targets are achievable
- [ ] **Working Commands** - Validation commands are correct

### Repository Fixture
- [ ] **Minimal** - Includes only necessary files
- [ ] **Realistic** - Uses real package.json structures
- [ ] **Complete** - Can be built and tested
- [ ] **Isolated** - No external dependencies
- [ ] **Working** - All validation commands succeed

### Prompts Quality
- [ ] **L0 Minimal** - Tests discovery and inference skills
- [ ] **L1 Basic** - Standard user scenario with reasonable context
- [ ] **L2 Directed** - Detailed guidance for complex tasks
- [ ] **L3 Migration** - (if applicable) Specific migration scenarios
- [ ] **Lx Adversarial** - (if applicable) Edge cases and challenges

### Oracle Answers
- [ ] **Comprehensive** - Covers common agent questions
- [ ] **Specific** - Provides clear, actionable responses
- [ ] **Realistic** - Uses responses a human expert would give
- [ ] **Consistent** - Aligns with scenario constraints
- [ ] **Complete** - No missing critical questions

## Testing Checklist

### Local Testing
- [ ] **Build Success** - Repository fixture builds without errors
- [ ] **Test Success** - All validation commands work
- [ ] **Agent Testing** - Tested with at least 2 different agents
- [ ] **Tier Testing** - Tested with multiple prompt tiers
- [ ] **Edge Cases** - Tested with various scenarios

### Agent Compatibility
- [ ] **Anthropic** - Works with Anthropic agents
- [ ] **Claude** - Works with Claude agents
- [ ] **OpenAI** - Works with OpenAI agents
- [ ] **Other Agents** - Tested with additional agents if available

### Prompt Tier Testing
- [ ] **L0 Testing** - Minimal prompts work correctly
- [ ] **L1 Testing** - Basic prompts work correctly
- [ ] **L2 Testing** - Directed prompts work correctly
- [ ] **L3 Testing** - (if applicable) Migration prompts work correctly
- [ ] **Lx Testing** - (if applicable) Adversarial prompts work correctly

## Documentation Checklist

### Benchmark Documentation
- [ ] **Clear Description** - scenario.yaml description is comprehensive
- [ ] **Purpose Statement** - Clear explanation of what the benchmark tests
- [ ] **Success Criteria** - Well-defined success conditions
- [ ] **Constraints Explanation** - Clear explanation of constraints
- [ ] **Usage Examples** - Examples of how to use the benchmark

### Code Documentation
- [ ] **Inline Comments** - Code is well-commented
- [ ] **README** - (if applicable) README file explains the benchmark
- [ ] **Examples** - Includes usage examples
- [ ] **Troubleshooting** - Common issues and solutions documented

## Quality Assurance

### Benchmark Design
- [ ] **Challenging** - Tests agent capabilities appropriately
- [ ] **Realistic** - Uses scenarios developers actually face
- [ ] **Specific** - Clear success criteria and constraints
- [ ] **Reproducible** - Consistent results across runs
- [ ] **Valuable** - Provides meaningful evaluation

### Performance
- [ ] **Fast Execution** - Benchmark runs in reasonable time
- [ ] **Efficient Resource Use** - Doesn't consume excessive resources
- [ ] **Scalable** - Works with different agent types
- [ ] **Reliable** - Consistent results across runs

### Maintainability
- [ ] **Clear Structure** - Easy to understand and modify
- [ ] **Well-Organized** - Files are logically organized
- [ ] **Documented** - Clear documentation and examples
- [ ] **Testable** - Easy to test and validate

## Review Preparation

### Self-Review
- [ ] **Code Review** - Review your own code for quality
- [ ] **Documentation Review** - Check documentation for accuracy
- [ ] **Example Testing** - Test all examples and instructions
- [ ] **Edge Case Testing** - Test with various scenarios

### Peer Review
- [ ] **Colleague Review** - Have a colleague review your benchmark
- [ ] **Feedback Incorporation** - Address feedback and make improvements
- [ ] **Final Testing** - Test after incorporating feedback
- [ ] **Documentation Update** - Update documentation based on feedback

## Submission Readiness

### Final Checks
- [ ] **All Tests Pass** - All validation tests pass
- [ ] **Documentation Complete** - All documentation is up-to-date
- [ ] **Examples Work** - All examples work as documented
- [ ] **Performance Acceptable** - Benchmark runs efficiently
- [ ] **Quality Standards Met** - Meets all quality requirements

### PR Preparation
- [ ] **Clear Title** - PR title clearly describes the contribution
- [ ] **Detailed Description** - PR description explains the benchmark
- [ ] **Testing Instructions** - Clear instructions for testing
- [ ] **Documentation Links** - Links to relevant documentation
- [ ] **Reviewer Assignment** - Appropriate reviewers assigned

## Common Issues to Avoid

### Configuration Issues
- [ ] **Missing Required Fields** - Ensure all required fields are present
- [ ] **Invalid YAML** - Check YAML syntax and formatting
- [ ] **Incorrect Paths** - Verify all file paths are correct
- [ ] **Invalid Commands** - Ensure validation commands work

### Repository Fixture Issues
- [ ] **Missing Dependencies** - Include all necessary dependencies
- [ ] **Invalid package.json** - Ensure package.json is valid
- [ ] **Missing Files** - Include all necessary files
- [ ] **Broken Commands** - Ensure all commands work

### Prompt Issues
- [ ] **Unclear Instructions** - Ensure prompts are clear and specific
- [ ] **Missing Context** - Provide appropriate context for each tier
- [ ] **Inconsistent Tone** - Maintain consistent tone across tiers
- [ ] **Missing Constraints** - Include necessary constraints

### Oracle Answer Issues
- [ ] **Missing Questions** - Cover all common agent questions
- [ ] **Vague Responses** - Provide specific, actionable responses
- [ ] **Inconsistent Answers** - Ensure answers align with constraints
- [ ] **Missing Edge Cases** - Cover edge cases and error conditions

## Success Criteria

### Benchmark Acceptance
- [ ] **Meets Requirements** - Satisfies all quality requirements
- [ ] **Passes Testing** - All tests pass successfully
- [ ] **Documentation Complete** - All documentation is complete
- [ ] **Examples Working** - All examples work correctly
- [ ] **Performance Acceptable** - Meets performance requirements

### Contributor Recognition
- [ ] **Quality Contribution** - High-quality benchmark contribution
- [ ] **Documentation Excellence** - Excellent documentation and examples
- [ ] **Testing Thoroughness** - Comprehensive testing and validation
- [ ] **Community Value** - Provides value to the community

## Final Notes

### Before Submitting
- Double-check all requirements
- Test thoroughly with multiple agents
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
- Monitor benchmark performance
- Update based on feedback
- Improve documentation over time
- Add new examples as needed
- Help others with similar benchmarks

Remember: Quality benchmarks are realistic, challenging, and provide clear value for evaluating AI agents. Take the time to ensure your benchmark meets these standards before submitting.
