/**
 * Heuristic Evaluator Template
 * 
 * This template provides a comprehensive starting point for creating
 * heuristic (rule-based) evaluators for the ze-benchmarks system.
 * 
 * Copy this file and customize it for your specific evaluation needs.
 */

import type { EvaluationContext, Evaluator, EvaluatorResult } from '@ze/evaluators';

/**
 * MyCustomEvaluator - Brief description of what this evaluator does
 * 
 * Purpose: What this evaluator checks (e.g., "Validates that dependencies were updated correctly")
 * Scoring: How scores are calculated (e.g., "1.0 if all required dependencies updated, 0.0 otherwise")
 * Context Used: What data from EvaluationContext is used (e.g., "depsDelta, commandLog")
 * 
 * @example
 * ```typescript
 * const evaluator = new MyCustomEvaluator();
 * const result = await evaluator.evaluate(context);
 * console.log(result.score); // 0.0 to 1.0
 * ```
 */
export class MyCustomEvaluator implements Evaluator {
  meta = { name: 'MyCustomEvaluator' } as const;

  /**
   * Evaluate the agent's performance based on the provided context
   * 
   * @param ctx - The evaluation context containing all available data
   * @returns Promise<EvaluatorResult> - The evaluation result with score and details
   */
  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    try {
      // 1. Extract relevant data from context
      const { scenario, workspaceDir, diffSummary, depsDelta, commandLog, agentResponse } = ctx;
      
      // 2. Validate required context data
      if (!this.hasRequiredContext(ctx)) {
        return this.createErrorResult('Missing required context data');
      }
      
      // 3. Perform evaluation logic
      const evaluationResult = await this.performEvaluation(ctx);
      
      // 4. Return result
      return {
        name: this.meta.name,
        score: evaluationResult.score,    // 0-1 scale
        details: evaluationResult.details // Optional detailed explanation
      };
      
    } catch (error) {
      // Handle any errors gracefully
      return this.createErrorResult(`Evaluation failed: ${error.message}`);
    }
  }

  /**
   * Check if the context contains all required data for evaluation
   */
  private hasRequiredContext(ctx: EvaluationContext): boolean {
    // Example: Check for required data
    // return !!(ctx.depsDelta && ctx.commandLog);
    
    // For this template, we'll be lenient
    return true;
  }

  /**
   * Perform the main evaluation logic
   */
  private async performEvaluation(ctx: EvaluationContext): Promise<{ score: number; details: string }> {
    const { scenario, depsDelta, commandLog, diffSummary } = ctx;
    
    // Example 1: Check if install succeeded
    const installSuccess = this.checkInstallSuccess(commandLog);
    
    // Example 2: Check if tests passed
    const testSuccess = this.checkTestSuccess(commandLog);
    
    // Example 3: Check if required dependencies were updated
    const dependencyUpdates = this.checkDependencyUpdates(scenario, depsDelta);
    
    // Example 4: Check if relevant files were modified
    const fileChanges = this.checkFileChanges(diffSummary);
    
    // Calculate composite score
    const score = this.calculateCompositeScore({
      installSuccess,
      testSuccess,
      dependencyUpdates,
      fileChanges
    });
    
    // Generate detailed feedback
    const details = this.generateDetails({
      installSuccess,
      testSuccess,
      dependencyUpdates,
      fileChanges,
      score
    });
    
    return { score, details };
  }

  /**
   * Check if the install command succeeded
   */
  private checkInstallSuccess(commandLog?: any[]): boolean {
    if (!commandLog) return false;
    
    const installCmd = commandLog.find(cmd => cmd.type === 'install');
    return installCmd?.exitCode === 0;
  }

  /**
   * Check if the test command succeeded
   */
  private checkTestSuccess(commandLog?: any[]): boolean {
    if (!commandLog) return false;
    
    const testCmd = commandLog.find(cmd => cmd.type === 'test');
    return testCmd?.exitCode === 0;
  }

  /**
   * Check if required dependencies were updated
   */
  private checkDependencyUpdates(scenario: any, depsDelta?: any[]): number {
    if (!scenario.targets?.required || !depsDelta) return 0;
    
    const requiredDeps = scenario.targets.required;
    const updatedDeps = depsDelta.filter(dep => 
      requiredDeps.some((target: any) => target.name === dep.name)
    );
    
    return updatedDeps.length / requiredDeps.length;
  }

  /**
   * Check if relevant files were modified
   */
  private checkFileChanges(diffSummary?: any[]): number {
    if (!diffSummary) return 0;
    
    // Example: Check for TypeScript/JavaScript file changes
    const relevantChanges = diffSummary.filter(diff => 
      diff.file.endsWith('.ts') || 
      diff.file.endsWith('.tsx') || 
      diff.file.endsWith('.js') || 
      diff.file.endsWith('.jsx')
    );
    
    return relevantChanges.length > 0 ? 1 : 0;
  }

  /**
   * Calculate composite score from individual checks
   */
  private calculateCompositeScore(checks: {
    installSuccess: boolean;
    testSuccess: boolean;
    dependencyUpdates: number;
    fileChanges: number;
  }): number {
    // Example: Weighted scoring
    const weights = {
      installSuccess: 0.3,
      testSuccess: 0.3,
      dependencyUpdates: 0.3,
      fileChanges: 0.1
    };
    
    const score = 
      (checks.installSuccess ? weights.installSuccess : 0) +
      (checks.testSuccess ? weights.testSuccess : 0) +
      (checks.dependencyUpdates * weights.dependencyUpdates) +
      (checks.fileChanges * weights.fileChanges);
    
    // Ensure score is between 0 and 1
    return Math.min(1, Math.max(0, score));
  }

  /**
   * Generate detailed feedback about the evaluation
   */
  private generateDetails(checks: {
    installSuccess: boolean;
    testSuccess: boolean;
    dependencyUpdates: number;
    fileChanges: number;
    score: number;
  }): string {
    const details = [];
    
    // Install status
    details.push(`Install: ${checks.installSuccess ? 'SUCCESS' : 'FAILED'}`);
    
    // Test status
    details.push(`Tests: ${checks.testSuccess ? 'PASSED' : 'FAILED'}`);
    
    // Dependency updates
    const depPercent = Math.round(checks.dependencyUpdates * 100);
    details.push(`Dependencies: ${depPercent}% updated`);
    
    // File changes
    details.push(`File Changes: ${checks.fileChanges > 0 ? 'DETECTED' : 'NONE'}`);
    
    // Overall score
    const scorePercent = Math.round(checks.score * 100);
    details.push(`Overall Score: ${scorePercent}%`);
    
    return details.join(', ');
  }

  /**
   * Create an error result when evaluation fails
   */
  private createErrorResult(message: string): EvaluatorResult {
    return {
      name: this.meta.name,
      score: 0,
      details: `ERROR: ${message}`
    };
  }
}

// Export as default for convenience
export default MyCustomEvaluator;

/**
 * USAGE EXAMPLES:
 * 
 * 1. Basic Usage:
 * ```typescript
 * const evaluator = new MyCustomEvaluator();
 * const result = await evaluator.evaluate(context);
 * ```
 * 
 * 2. With Error Handling:
 * ```typescript
 * try {
 *   const result = await evaluator.evaluate(context);
 *   console.log(`Score: ${result.score}, Details: ${result.details}`);
 * } catch (error) {
 *   console.error('Evaluation failed:', error);
 * }
 * ```
 * 
 * 3. Testing:
 * ```typescript
 * describe('MyCustomEvaluator', () => {
 *   it('should score 1 for perfect execution', async () => {
 *     const evaluator = new MyCustomEvaluator();
 *     const ctx = createMockContext();
 *     const result = await evaluator.evaluate(ctx);
 *     expect(result.score).toBe(1);
 *   });
 * });
 * ```
 * 
 * CUSTOMIZATION CHECKLIST:
 * 
 * 1. [ ] Update class name and meta.name
 * 2. [ ] Update purpose and scoring description
 * 3. [ ] Implement hasRequiredContext() for your needs
 * 4. [ ] Customize performEvaluation() logic
 * 5. [ ] Add/remove specific checks as needed
 * 6. [ ] Adjust calculateCompositeScore() weights
 * 7. [ ] Update generateDetails() for your feedback
 * 8. [ ] Add unit tests
 * 9. [ ] Update documentation
 * 10. [ ] Test with real benchmark data
 */
