# LLM Judge Evaluator

The LLM Judge Evaluator uses OpenRouter API to provide AI-powered assessment of agent performance with hard scores (1-5) across multiple categories.

## Setup

1. **Get OpenRouter API Key**: Sign up at [OpenRouter.ai](https://openrouter.ai) and get your API key
2. **Set Environment Variable**: Add to your `.env` file:
   ```env
   OPENROUTER_API_KEY=sk-or-v1-your_api_key_here
   ```

## Configuration

### Environment Variables
```env
# Required
OPENROUTER_API_KEY=sk-or-v1-your_api_key_here

# Optional
LLM_JUDGE_MODEL=anthropic/claude-3.5-sonnet  # Default model
LLM_JUDGE_TEMPERATURE=0.1                    # Default temperature
LLM_JUDGE_MAX_TOKENS=2000                    # Default max tokens
```

### Scenario Configuration
Add to your `scenario.yaml`:

```yaml
llm_judge:
  enabled: true
  model: "anthropic/claude-3.5-sonnet"  # Override default
  temperature: 0.1
  max_tokens: 2000
  # categories: []  # Will be defined by user later

rubric_overrides:
  weights:
    install_success: 1.5
    tests_nonregression: 2.5
    manager_correctness: 1.0
    dependency_targets: 2.0
    integrity_guard: 1.5
    llm_judge: 1.0  # Weight for LLM judge in total score
```

## How It Works

1. **Context Collection**: The evaluator gathers:
   - Task description from scenario config
   - Agent's response/explanation
   - File changes (diffs)
   - Dependency changes
   - Command execution results

2. **LLM Evaluation**: Sends structured prompt to OpenRouter with:
   - All context information
   - Instructions for scoring (placeholder for user customization)
   - JSON schema for structured response

3. **Score Processing**: 
   - Receives scores (1-5) for multiple categories
   - Normalizes to 0-1 scale for consistency
   - Includes detailed reasoning in results

## Output Format

The evaluator returns a normalized score (0-1) and detailed JSON in the `details` field:

```json
{
  "scores": [
    {"category": "code_quality", "score": 4, "reasoning": "..."},
    {"category": "correctness", "score": 5, "reasoning": "..."},
    {"category": "approach", "score": 3, "reasoning": "..."}
  ],
  "overall_assessment": "The agent performed well overall...",
  "normalized_score": 0.75
}
```

## Error Handling

- **Missing API Key**: Returns score 0 with "OpenRouter API key not configured"
- **API Failure**: Returns score 0 with error details
- **Invalid Response**: Returns score 0 with parsing error details
- **Disabled**: Returns score 0 with "LLM judge disabled for this scenario"

## Next Steps

1. **Customize Prompt**: Replace the placeholder prompt template with your specific evaluation criteria
2. **Define Categories**: Specify the scoring categories you want the LLM to evaluate
3. **Tune Parameters**: Adjust temperature and max_tokens based on response quality
4. **Test & Iterate**: Run evaluations and refine the prompt based on results

## Example Usage

```bash
# Set your API key
export OPENROUTER_API_KEY=sk-or-v1-your_key_here

# Run a benchmark with LLM judge enabled
pnpm bench update-deps nx-pnpm-monorepo --tier L1 --agent anthropic
```

The LLM judge will automatically run if:
- `llm_judge.enabled: true` in scenario config
- `OPENROUTER_API_KEY` environment variable is set
