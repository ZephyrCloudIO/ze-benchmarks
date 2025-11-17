// ============================================================================
// SCORING UTILITIES
// ============================================================================

export interface SuccessCalculationResult {
  isSuccessful: boolean;
  successMetric: number;
}

export interface CommandResult {
  type: string;
  exitCode: number;
}

export function computeWeightedTotals(
	scores: Record<string, number>,
	scenarioCfg: { rubric_overrides?: { weights?: Record<string, number> } },
) {
	const baseWeights: Record<string, number> = {
		install_success: 1.5,
		tests_nonregression: 2.5,
		manager_correctness: 1,
		dependency_targets: 2,
		integrity_guard: 1.5,
	};

	const overrideWeights = scenarioCfg.rubric_overrides?.weights ?? {};

	let totalWeight = 0;
	let achieved = 0;

	for (const [metric, score] of Object.entries(scores || {})) {
		const weight = overrideWeights[metric] ?? baseWeights[metric] ?? 1;
		if (weight <= 0) continue;
		totalWeight += weight;
		achieved += (typeof score === 'number' ? score : 0) * weight;
	}

	const weighted = totalWeight > 0 ? (achieved / totalWeight) * 10 : 0;
	return { weighted: Number(weighted.toFixed(4)), max: 10 };
}

export function calculateSuccess(
  commandLog: CommandResult[],
  scores: Record<string, number>,
  scenario: any
): SuccessCalculationResult {

  // Validation score (commands passed / total commands)
  const passedCommands = commandLog.filter(cmd => cmd.exitCode === 0).length;
  const validationScore = commandLog.length > 0
    ? passedCommands / commandLog.length
    : 0;

  // Critical commands (install, build, test must pass)
  const criticalCommands = ['install', 'test']; // Note: 'build' is not in CommandKind, using 'test' as critical
  const criticalPassed = criticalCommands.every(cmd => {
    const result = commandLog.find(c => c.type === cmd);
    return result && result.exitCode === 0;
  });

  // Evaluator average score
  const evaluatorScore = Object.values(scores).length > 0
    ? Object.values(scores).reduce((sum, s) => sum + s, 0) / Object.values(scores).length
    : 0;

  // LLM judge score (if available)
  const llmJudgeScore = scores.llm_judge || 0;

  // Weighted metric (from scenario.yaml or default)
  const weights = scenario.success_weights || {
    validation: 0.4,
    evaluators: 0.3,
    llm_judge: 0.3
  };

  const successMetric = (
    validationScore * weights.validation +
    evaluatorScore * weights.evaluators +
    llmJudgeScore * weights.llm_judge
  );

  // Success criteria: critical commands must pass AND success metric >= 0.7
  const isSuccessful = criticalPassed && successMetric >= 0.7;

  return { isSuccessful, successMetric };
}
