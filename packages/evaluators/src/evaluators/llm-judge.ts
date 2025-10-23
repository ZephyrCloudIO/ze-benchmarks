import type { EvaluationContext, Evaluator, EvaluatorResult } from '../types.ts';
import { OpenAI } from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

// Simple token counting function (approximation)
function countTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simplified approach - for production, consider using tiktoken or similar
  return Math.ceil(text.length / 4);
}

// Types for judge response
interface JudgeScore {
  category: string;
  score: number;  // 1-5
  reasoning: string;
}

interface JudgeResponse {
  scores: JudgeScore[];
  overall_assessment: string;
}

export class LLMJudgeEvaluator implements Evaluator {
  meta = { name: 'LLMJudgeEvaluator' } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    // Check if LLM judge is enabled for this scenario
    if (!ctx.scenario.llm_judge?.enabled) {
      return {
        name: this.meta.name,
        score: 0,
        details: 'LLM judge disabled for this scenario'
      };
    }

    // Initialize OpenAI client
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return {
        name: this.meta.name,
        score: 0,
        details: 'OpenRouter API key not configured (OPENROUTER_API_KEY)'
      };
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1/",
    });

    try {
      // Build the evaluation prompt
      const prompt = this.buildPrompt(ctx);
      
      
      // Count tokens in the prompt
      const tokenCount = this.countPromptTokens(prompt);
      
      // Call OpenAI API through OpenRouter
      const response = await this.callOpenAI(openai, prompt);
      
      // Normalize scores (convert 1-5 scale to 0-1 scale)
      const normalizedScore = this.normalizeScore(response);
      
      // Format detailed results with token count
      const details = this.formatDetails(response, tokenCount);
      
      return {
        name: this.meta.name,
        score: normalizedScore,
        details
      };

    } catch (error) {
      return {
        name: this.meta.name,
        score: 0,
        details: `LLM judge evaluation failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  private async callOpenAI(openai: OpenAI, prompt: string): Promise<JudgeResponse> {
    const model = process.env.LLM_JUDGE_MODEL || 'meta-llama/llama-3.1-8b-instruct';
    const temperature = parseFloat(process.env.LLM_JUDGE_TEMPERATURE || '0.1');
    const maxTokens = parseInt(process.env.LLM_JUDGE_MAX_TOKENS || '2000', 10);

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert code reviewer. Analyze the provided code changes and agent response, then provide structured scores (1-5) across multiple categories. Always respond with valid JSON.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: {
        type: 'json_object'
      }
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response content from OpenAI');
    }

    const parsed = JSON.parse(content) as JudgeResponse;

    // Validate response structure
    if (!parsed.scores || !Array.isArray(parsed.scores)) {
      throw new Error('Invalid response format: missing or invalid scores array');
    }

    // Validate each score
    for (const score of parsed.scores) {
      if (!score.category || typeof score.score !== 'number' || score.score < 1 || score.score > 5) {
        throw new Error(`Invalid score format: ${JSON.stringify(score)}`);
      }
    }

    return parsed;
  }

  private buildPrompt(ctx: EvaluationContext): string {
    const { scenario, agentResponse, diffSummary, depsDelta, commandLog } = ctx;
    
    // Build context sections
    const taskDescription = this.buildTaskDescription(scenario);
    const agentResponseSection = this.buildAgentResponseSection(agentResponse);
    const changesSection = this.buildChangesSection(diffSummary, depsDelta);
    const commandResultsSection = this.buildCommandResultsSection(commandLog);
    
    // Combine into full prompt
    const prompt = `
${taskDescription}

## Agent Response
${agentResponseSection}

## Changes Made
${changesSection}

## Command Results
${commandResultsSection}

## Evaluation Instructions

You are an expert code reviewer evaluating an AI agent's performance in dependency management for a monorepo. Evaluate the agent across these 8 critical categories:

### 1. Dependency Quality & Version Management (Weight: 25%)
- Correctness of version updates and semantic versioning adherence
- Proper handling of major/minor/patch updates
- Appropriate constraint management and version pinning
- Score 1-5: 1=incorrect versions, 5=optimal version selection

### 2. Safety & Stability Preservation (Weight: 20%)
- Risk assessment and compatibility preservation
- Breaking change handling and migration strategies
- Regression prevention and rollback considerations
- Score 1-5: 1=introduces instability, 5=maintains full stability

### 3. Best Practices Adherence (Weight: 15%)
- Following semantic versioning principles
- Proper dependency categorization (dependencies vs devDependencies)
- Security and vulnerability considerations
- Score 1-5: 1=violates best practices, 5=exemplary adherence

### 4. Monorepo Coordination (Weight: 15%)
- Workspace-level dependency management
- Cross-package dependency alignment
- Build system compatibility (Nx, pnpm workspace handling)
- Score 1-5: 1=poor coordination, 5=seamless monorepo management

### 5. Technical Execution & Automation (Weight: 10%)
- Correctness of commands used (nx migrate, pnpm install, etc.)
- Error handling and recovery procedures
- Validation through automated checks (build/test/lint)
- Score 1-5: 1=incorrect execution, 5=robust technical flow

### 6. Communication & Decision Transparency (Weight: 10%)
- Clarity of explanations and reasoning
- Identification of risks, benefits, and assumptions
- Justification for decisions and skipped updates
- Score 1-5: 1=opaque reasoning, 5=clear, structured communication

### 7. Long-Term Maintainability (Weight: 5%)
- Future compatibility and modernization
- Removal of deprecated/unused dependencies
- Facilitation of ongoing stability and upgradeability
- Score 1-5: 1=creates technical debt, 5=modernized landscape

### 8. Overall Execution Integrity (Weight: 0% - calculated from others)
- Holistic performance combining all categories
- Weighted average of all other scores
- Final assessment of practical success

**Scoring Guidelines:**
- 1: Poor/Incorrect - Significant issues, violations, or failures
- 2: Below Average - Some issues, partial compliance
- 3: Average - Functional but not optimal
- 4: Good - Solid performance with minor issues
- 5: Excellent - Exemplary performance, best practices

**Output JSON format:**
{
  "scores": [
    {"category": "dependency_quality", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "safety_stability", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "best_practices", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "monorepo_coordination", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "technical_execution", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "communication_transparency", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "long_term_maintainability", "score": 1-5, "reasoning": "detailed explanation"},
    {"category": "overall_integrity", "score": 1-5, "reasoning": "weighted assessment"}
  ],
  "overall_assessment": "comprehensive summary of performance across all categories"
}
`;

    return prompt.trim();
  }

  private buildTaskDescription(scenario: any): string {
    return `## Task Description
**Scenario**: ${scenario.id || 'Unknown'}
**Title**: ${scenario.title || 'No title provided'}
**Description**: ${scenario.description || 'No description provided'}

**Constraints**: ${scenario.constraints ? JSON.stringify(scenario.constraints, null, 2) : 'None specified'}
**Targets**: ${scenario.targets ? JSON.stringify(scenario.targets, null, 2) : 'None specified'}`;
  }

  private buildAgentResponseSection(agentResponse?: string): string {
    if (!agentResponse || agentResponse.trim() === '') {
      return 'No agent response provided';
    }
    
    return `\`\`\`
${agentResponse}
\`\`\``;
  }

  private buildChangesSection(diffSummary?: any[], depsDelta?: any[]): string {
    let section = '## File Changes\n';
    
    if (!diffSummary || diffSummary.length === 0) {
      section += 'No file changes detected\n';
    } else {
      section += `Found ${diffSummary.length} file changes:\n`;
      for (const diff of diffSummary.slice(0, 10)) { // Limit to first 10 files
        section += `- ${diff.file} (${diff.changeType})\n`;
      }
      if (diffSummary.length > 10) {
        section += `... and ${diffSummary.length - 10} more files\n`;
      }
    }

    section += '\n## Dependency Changes\n';
    if (!depsDelta || depsDelta.length === 0) {
      section += 'No dependency changes detected\n';
    } else {
      section += `Found ${depsDelta.length} dependency changes:\n`;
      for (const dep of depsDelta.slice(0, 10)) { // Limit to first 10 deps
        section += `- ${dep.name}: ${dep.from || 'added'} → ${dep.to || 'removed'}\n`;
      }
      if (depsDelta.length > 10) {
        section += `... and ${depsDelta.length - 10} more dependencies\n`;
      }
    }

    return section;
  }

  private buildCommandResultsSection(commandLog?: any[]): string {
    if (!commandLog || commandLog.length === 0) {
      return 'No command execution log available';
    }

    let section = '## Command Execution Results\n';
    for (const cmd of commandLog) {
      const status = cmd.exitCode === 0 ? '✅ SUCCESS' : '❌ FAILED';
      section += `- **${cmd.tool}**: ${status} (exit code: ${cmd.exitCode})\n`;
      if (cmd.stderr && cmd.stderr.trim()) {
        section += `  Error: ${cmd.stderr.substring(0, 200)}${cmd.stderr.length > 200 ? '...' : ''}\n`;
      }
    }

    return section;
  }

  private normalizeScore(response: JudgeResponse): number {
    if (!response.scores || response.scores.length === 0) {
      return 0;
    }

    // Define weights for each category (matching the prompt weights)
    const weights: Record<string, number> = {
      'dependency_quality': 0.25,
      'safety_stability': 0.20,
      'best_practices': 0.15,
      'monorepo_coordination': 0.15,
      'technical_execution': 0.10,
      'communication_transparency': 0.10,
      'long_term_maintainability': 0.05,
      'overall_integrity': 0.00 // This is calculated from others, not weighted
    };

    // Calculate weighted average score
    let weightedSum = 0;
    let totalWeight = 0;

    for (const score of response.scores) {
      const weight = weights[score.category] || 0;
      if (weight > 0) { // Skip overall_integrity as it's calculated from others
        weightedSum += score.score * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) {
      return 0;
    }

    const weightedAverage = weightedSum / totalWeight;
    
    // Convert from 1-5 scale to 0-1 scale: (score - 1) / 4
    return Math.max(0, Math.min(1, (weightedAverage - 1) / 4));
  }

  private countPromptTokens(prompt: string): number {
    // Count tokens in the full prompt including system message
    const systemMessage = 'You are an expert code reviewer. Analyze the provided code changes and agent response, then provide structured scores (1-5) across multiple categories. Always respond with valid JSON.';
    const fullPrompt = systemMessage + '\n\n' + prompt;
    return countTokens(fullPrompt);
  }


  private formatDetails(response: JudgeResponse, tokenCount?: number): string {
    const details = {
      scores: response.scores,
      overall_assessment: response.overall_assessment,
      normalized_score: this.normalizeScore(response),
      ...(tokenCount && { input_tokens: tokenCount })
    };

    return JSON.stringify(details, null, 2);
  }
}
