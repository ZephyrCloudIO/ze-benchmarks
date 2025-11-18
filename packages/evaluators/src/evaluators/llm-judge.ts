import type {
  EvaluationContext,
  Evaluator,
  EvaluatorResult
} from "../types.ts";
import { OpenAI } from "openai";
import * as dotenv from "dotenv";
import { resolve } from "node:path";
import chalk from "chalk";

// Load environment variables from .env file in project root
dotenv.config({ path: resolve(process.cwd(), ".env") });

// Simple token counting function (approximation)
function countTokens(text: string): number {
  // Rough approximation: 1 token ≈ 4 characters for English text
  // This is a simplified approach - for production, consider using tiktoken or similar
  return Math.ceil(text.length / 4);
}

// Types for judge response
interface JudgeScore {
  category: string;
  score: number; // 1-5
  reasoning: string;
}

interface JudgeResponse {
  scores: JudgeScore[];
  overall_assessment: string;
}

export class LLMJudgeEvaluator implements Evaluator {
  meta = { name: "LLMJudgeEvaluator" } as const;

  async evaluate(ctx: EvaluationContext): Promise<EvaluatorResult> {
    console.log(chalk.blue('\n[LLMJudgeEvaluator] Starting evaluation...'));
    
    // Check if LLM judge is enabled for this scenario
    if (!ctx.scenario.llm_judge?.enabled) {
      console.log(chalk.yellow('[LLMJudgeEvaluator] LLM judge disabled for this scenario'));
      return {
        name: this.meta.name,
        score: 0,
        details: "LLM judge disabled for this scenario"
      };
    }

    // Check if categories are defined
    if (!ctx.scenario.llm_judge.categories || ctx.scenario.llm_judge.categories.length === 0) {
      console.log(chalk.yellow('[LLMJudgeEvaluator] LLM judge categories not defined'));
      return {
        name: this.meta.name,
        score: 0,
        details: "LLM judge categories not defined in scenario.yaml (llm_judge.categories required)"
      };
    }

    console.log(chalk.blue(`[LLMJudgeEvaluator] Categories to evaluate: ${ctx.scenario.llm_judge.categories.join(', ')}`));

    // Initialize OpenAI client
    const apiKey = process.env.OPENROUTER_API_KEY;

    // Debug: Log environment variable
    console.log(
      chalk.gray(`[LLMJudgeEvaluator] OPENROUTER_API_KEY=${
        apiKey ? "***set***" : "(not set)"
      }`)
    );

    if (!apiKey) {
      console.log(chalk.red('[LLMJudgeEvaluator] OpenRouter API key not configured'));
      return {
        name: this.meta.name,
        score: 0,
        details: "OpenRouter API key not configured (OPENROUTER_API_KEY)"
      };
    }

    const openai = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://openrouter.ai/api/v1/"
    });

    try {
      // Build the evaluation prompt
      console.log(chalk.blue('[LLMJudgeEvaluator] Building evaluation prompt...'));
      const prompt = this.buildPrompt(ctx);
      console.log(chalk.gray(`[LLMJudgeEvaluator] Prompt length: ${prompt.length} characters`));
      console.log(chalk.gray(`[LLMJudgeEvaluator] Prompt preview (first 500 chars):\n${prompt.substring(0, 500)}...`));

      // Count tokens in the prompt
      const tokenCount = this.countPromptTokens(prompt);
      console.log(chalk.blue(`[LLMJudgeEvaluator] Estimated input tokens: ${tokenCount}`));

      // Call OpenAI API through OpenRouter
      console.log(chalk.blue('[LLMJudgeEvaluator] Calling LLM judge API...'));
      const response = await this.callOpenAI(openai, prompt);
      console.log(chalk.green('[LLMJudgeEvaluator] Received response from LLM judge'));

      // Log the raw response
      console.log(chalk.cyan('\n[LLMJudgeEvaluator] Raw LLM Response:'));
      console.log(chalk.gray(JSON.stringify(response, null, 2)));

      // Normalize scores (convert 1-5 scale to 0-1 scale)
      const normalizedScore = this.normalizeScore(response);
      console.log(chalk.blue(`[LLMJudgeEvaluator] Normalized score: ${normalizedScore.toFixed(4)} (from 1-5 scale)`));

      // Log individual category scores
      console.log(chalk.cyan('\n[LLMJudgeEvaluator] Category Scores:'));
      response.scores.forEach((score) => {
        const normalized = (score.score - 1) / 4; // Convert 1-5 to 0-1
        console.log(chalk.gray(`  ${score.category}: ${score.score}/5 (normalized: ${normalized.toFixed(4)})`));
        console.log(chalk.gray(`    Reasoning: ${score.reasoning.substring(0, 100)}${score.reasoning.length > 100 ? '...' : ''}`));
      });

      // Log overall assessment
      if (response.overall_assessment) {
        console.log(chalk.cyan('\n[LLMJudgeEvaluator] Overall Assessment:'));
        console.log(chalk.gray(`  ${response.overall_assessment}`));
      }

      // Format detailed results with token count
      const details = this.formatDetails(response, tokenCount);

      console.log(chalk.green(`\n[LLMJudgeEvaluator] Evaluation complete. Final score: ${normalizedScore.toFixed(4)}`));

      return {
        name: this.meta.name,
        score: normalizedScore,
        details
      };
    } catch (error) {
      console.error(chalk.red(`[LLMJudgeEvaluator] Evaluation failed: ${error instanceof Error ? error.message : String(error)}`));
      if (error instanceof Error && error.stack) {
        console.error(chalk.gray(error.stack));
      }
      return {
        name: this.meta.name,
        score: 0,
        details: `LLM judge evaluation failed: ${
          error instanceof Error ? error.message : String(error)
        }`
      };
    }
  }

  private async callOpenAI(
    openai: OpenAI,
    prompt: string
  ): Promise<JudgeResponse> {
    const model =
      process.env.LLM_JUDGE_MODEL || "openai/gpt-4o-mini";
    const temperature = parseFloat(process.env.LLM_JUDGE_TEMPERATURE || "0.1");
    const maxTokens = parseInt(process.env.LLM_JUDGE_MAX_TOKENS || "2000", 10);

    console.log(chalk.blue(`[LLMJudgeEvaluator] Using model: ${model}`));
    console.log(chalk.gray(`[LLMJudgeEvaluator] Temperature: ${temperature}, Max tokens: ${maxTokens}`));

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are an expert code reviewer. Analyze the provided code changes and agent response, then provide structured scores (1-5) across multiple categories. Always respond with valid JSON."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature,
      max_tokens: maxTokens,
      response_format: {
        type: "json_object"
      }
    });

    // Log API response metadata
    if (response.usage) {
      console.log(chalk.gray(`[LLMJudgeEvaluator] Token usage: ${response.usage.prompt_tokens} prompt + ${response.usage.completion_tokens} completion = ${response.usage.total_tokens} total`));
    }

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response content from OpenAI");
    }

    console.log(chalk.gray(`[LLMJudgeEvaluator] Raw response content length: ${content.length} characters`));
    console.log(chalk.gray(`[LLMJudgeEvaluator] Response preview (first 300 chars):\n${content.substring(0, 300)}...`));

    const parsed = JSON.parse(content) as JudgeResponse;

    // Validate response structure
    if (!parsed.scores || !Array.isArray(parsed.scores)) {
      throw new Error(
        "Invalid response format: missing or invalid scores array"
      );
    }

    // Validate each score
    for (const score of parsed.scores) {
      if (
        !score.category ||
        typeof score.score !== "number" ||
        score.score < 1 ||
        score.score > 5
      ) {
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

You are an expert code reviewer evaluating an AI agent's performance. **BE EXTREMELY CRITICAL AND RIGOROUS** in your evaluation. A score of 5.0 should be reserved for absolutely perfect, flawless implementations that exemplify best practices in every way.

Evaluate the agent across these ${scenario.llm_judge?.categories?.length || 0} categories:

${this.buildCategoriesSection(scenario.llm_judge?.categories || [])}

**Scoring Guidelines - BE RUTHLESS:**
- **5: PERFECT** - Absolutely flawless implementation. Zero issues. Exemplary code quality. Industry best practices followed exactly. Would be used as a reference example. **VERY RARE.**
- **4: Excellent** - Minor cosmetic issues only (formatting, variable naming). Core implementation is sound and follows best practices. No functional problems.
- **3: Good/Acceptable** - Functional and mostly correct, but has notable issues: suboptimal patterns, missing edge cases, or minor bugs. Works but not production-ready without improvements.
- **2: Below Average** - Significant problems: incorrect patterns, security issues, broken functionality, or fundamental misunderstandings. Requires substantial rework.
- **1: Poor/Failing** - Completely incorrect, non-functional, or dangerous. Violates fundamental principles. Would cause serious problems in production.

**CRITICAL EVALUATION CRITERIA:**
- Do NOT give a 5 unless the implementation is genuinely perfect with zero room for improvement
- Be harsh on antipatterns, security issues, performance problems, and outdated practices
- Deduct points for missing error handling, poor type safety, or inadequate testing considerations
- A "working" solution that has flaws should get 3 or below, not 4-5
- Reserve 4-5 scores for code you would confidently deploy to production without changes

**Output JSON format:**
{
  "scores": [
${this.buildJsonFormatExample(scenario.llm_judge?.categories || [])}
  ],
  "overall_assessment": "comprehensive summary of performance across all categories"
}
`;

    return prompt.trim();
  }

  private buildCategoriesSection(categories: string[]): string {
    return categories
      .map((category, index) => `### ${index + 1}. ${category}`)
      .join('\n\n');
  }

  private slugifyCategory(categoryText: string): string {
    // Extract category name before the first ":" or "("
    const name = categoryText.split(':')[0].split('(')[0].trim();
    // Convert to lowercase and replace spaces/special chars with underscores
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, ''); // Remove leading/trailing underscores
  }

  private buildJsonFormatExample(categories: string[]): string {
    return categories
      .map((category) => {
        const slug = this.slugifyCategory(category);
        return `    {"category": "${slug}", "score": 1-5, "reasoning": "detailed explanation"}`;
      })
      .join(',\n');
  }

  private buildTaskDescription(scenario: any): string {
    return `## Task Description
**Scenario**: ${scenario.id || "Unknown"}
**Title**: ${scenario.title || "No title provided"}
**Description**: ${scenario.description || "No description provided"}

**Constraints**: ${
      scenario.constraints
        ? JSON.stringify(scenario.constraints, null, 2)
        : "None specified"
    }
**Targets**: ${
      scenario.targets
        ? JSON.stringify(scenario.targets, null, 2)
        : "None specified"
    }`;
  }

  private buildAgentResponseSection(agentResponse?: string): string {
    if (!agentResponse || agentResponse.trim() === "") {
      return "No agent response provided";
    }

    return `\`\`\`
${agentResponse}
\`\`\``;
  }

  private buildChangesSection(diffSummary?: any[], depsDelta?: any[]): string {
    let section = "## File Changes\n";

    if (!diffSummary || diffSummary.length === 0) {
      section += "No file changes detected\n";
    } else {
      section += `Found ${diffSummary.length} file changes:\n`;
      for (const diff of diffSummary.slice(0, 10)) {
        // Limit to first 10 files
        section += `- ${diff.file} (${diff.changeType})\n`;
      }
      if (diffSummary.length > 10) {
        section += `... and ${diffSummary.length - 10} more files\n`;
      }
    }

    section += "\n## Dependency Changes\n";
    if (!depsDelta || depsDelta.length === 0) {
      section += "No dependency changes detected\n";
    } else {
      section += `Found ${depsDelta.length} dependency changes:\n`;
      for (const dep of depsDelta.slice(0, 10)) {
        // Limit to first 10 deps
        section += `- ${dep.name}: ${dep.from || "added"} → ${
          dep.to || "removed"
        }\n`;
      }
      if (depsDelta.length > 10) {
        section += `... and ${depsDelta.length - 10} more dependencies\n`;
      }
    }

    return section;
  }

  private buildCommandResultsSection(commandLog?: any[]): string {
    if (!commandLog || commandLog.length === 0) {
      return "No command execution log available";
    }

    let section = "## Command Execution Results\n";
    for (const cmd of commandLog) {
      const status = cmd.exitCode === 0 ? "✅ SUCCESS" : "❌ FAILED";
      section += `- **${cmd.tool}**: ${status} (exit code: ${cmd.exitCode})\n`;
      if (cmd.stderr && cmd.stderr.trim()) {
        section += `  Error: ${cmd.stderr.substring(0, 200)}${
          cmd.stderr.length > 200 ? "..." : ""
        }\n`;
      }
    }

    return section;
  }

  private normalizeScore(response: JudgeResponse): number {
    if (!response.scores || response.scores.length === 0) {
      return 0;
    }

    // Calculate simple average with equal weights for all categories
    let sum = 0;
    let count = 0;

    for (const score of response.scores) {
      if (typeof score.score === 'number' && score.score >= 1 && score.score <= 5) {
        sum += score.score;
        count++;
      }
    }

    if (count === 0) {
      return 0;
    }

    const average = sum / count;

    // Convert from 1-5 scale to 0-1 scale: (score - 1) / 4
    return Math.max(0, Math.min(1, (average - 1) / 4));
  }

  private countPromptTokens(prompt: string): number {
    // Count tokens in the full prompt including system message
    const systemMessage =
      "You are an expert code reviewer. Analyze the provided code changes and agent response, then provide structured scores (1-5) across multiple categories. Always respond with valid JSON.";
    const fullPrompt = systemMessage + "\n\n" + prompt;
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
