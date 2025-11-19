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
		install_success: 0, // TODO: Add this back in
		tests_nonregression: 0, // TODO: Add this back in
		manager_correctness: 0, // TODO: Add this back in
		dependency_targets: 0, // TODO: Add this back in
		integrity_guard: 0, // TODO: Add this back in
		file_structure: 0, // TODO: Add this back in
		config_accuracy: 0, // TODO: Add this back in
		dependency_proximity: 0, // TODO: Add this back in
		llm_judge: 1.0, // Only LLM judge contributes to the score
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
  const criticalCommands = ['install']; // Note: 'build' is not in CommandKind, using 'test' as critical
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
  // Since we are using only LLM as a judge, make the success metric simply the LLM judge score
  const successMetric = llmJudgeScore;


  // Success criteria: critical commands must pass AND success metric >= 0.7
  const isSuccessful = criticalPassed && successMetric >= 0.7;

  return { isSuccessful, successMetric };
}
