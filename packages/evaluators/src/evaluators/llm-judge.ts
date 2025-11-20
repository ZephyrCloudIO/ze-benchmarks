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
    console.log(chalk.blue('\n[LLMJudgeEvaluator] ========== STARTING EVALUATION =========='));
    console.log(chalk.blue(`[LLMJudgeEvaluator] Scenario: ${ctx.scenario.id || 'unknown'}`));
    console.log(chalk.blue(`[LLMJudgeEvaluator] Suite: ${ctx.scenario.suite || 'unknown'}`));
    
    // Debug: Log evaluation context
    console.log(chalk.cyan('\n[LLMJudgeEvaluator] Evaluation Context:'));
    console.log(chalk.gray(`  - Workspace dir: ${ctx.workspaceDir || 'N/A'}`));
    console.log(chalk.gray(`  - Reference path: ${ctx.referencePath || 'N/A'}`));
    console.log(chalk.gray(`  - Agent response length: ${ctx.agentResponse?.length || 0} chars`));
    console.log(chalk.gray(`  - Command log entries: ${ctx.commandLog?.length || 0}`));
    console.log(chalk.gray(`  - Diff summary: ${ctx.diffSummary ? 'present' : 'missing'}`));
    console.log(chalk.gray(`  - Deps delta: ${ctx.depsDelta ? 'present' : 'missing'}`));
    
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

    console.log(chalk.blue(`[LLMJudgeEvaluator] Categories to evaluate (${ctx.scenario.llm_judge.categories.length}):`));
    ctx.scenario.llm_judge.categories.forEach((cat, idx) => {
      console.log(chalk.gray(`  ${idx + 1}. ${cat}`));
    });

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
      console.log(chalk.blue('\n[LLMJudgeEvaluator] Building evaluation prompt...'));
      const prompt = this.buildPrompt(ctx);
      console.log(chalk.gray(`[LLMJudgeEvaluator] Prompt length: ${prompt.length} characters`));
      console.log(chalk.gray(`[LLMJudgeEvaluator] Prompt preview (first 500 chars):\n${prompt.substring(0, 500)}...`));
      console.log(chalk.gray(`[LLMJudgeEvaluator] Prompt preview (last 500 chars):\n...${prompt.substring(Math.max(0, prompt.length - 500))}`));
      
      // Debug: Log full prompt if it's not too long (or save to file)
      if (prompt.length < 10000) {
        console.log(chalk.cyan('\n[LLMJudgeEvaluator] Full Prompt:'));
        console.log(chalk.gray(prompt));
      } else {
        console.log(chalk.yellow(`[LLMJudgeEvaluator] Prompt too long (${prompt.length} chars), showing sections...`));
        const sections = prompt.split('##');
        sections.forEach((section, idx) => {
          if (section.trim()) {
            const title = section.split('\n')[0].trim();
            console.log(chalk.gray(`  Section ${idx}: ${title || 'Untitled'} (${section.length} chars)`));
          }
        });
      }

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
      console.log(chalk.cyan('\n[LLMJudgeEvaluator] ========== SCORE NORMALIZATION =========='));
      console.log(chalk.blue(`[LLMJudgeEvaluator] Raw scores count: ${response.scores.length}`));
      console.log(chalk.blue(`[LLMJudgeEvaluator] Expected categories: ${ctx.scenario.llm_judge.categories.length}`));
      
      const normalizedScore = this.normalizeScore(response);
      console.log(chalk.blue(`[LLMJudgeEvaluator] Normalized score: ${normalizedScore.toFixed(4)} (from 1-5 scale)`));
      console.log(chalk.blue(`[LLMJudgeEvaluator] Score calculation: average of ${response.scores.length} category scores`));

      // Log individual category scores with detailed breakdown
      console.log(chalk.cyan('\n[LLMJudgeEvaluator] ========== CATEGORY SCORES BREAKDOWN =========='));
      let totalRawScore = 0;
      response.scores.forEach((score, idx) => {
        const normalized = (score.score - 1) / 4; // Convert 1-5 to 0-1
        totalRawScore += score.score;
        console.log(chalk.cyan(`\n[LLMJudgeEvaluator] Category ${idx + 1}: ${score.category}`));
        console.log(chalk.gray(`  Raw score: ${score.score}/5`));
        console.log(chalk.gray(`  Normalized: ${normalized.toFixed(4)}/1.0`));
        console.log(chalk.gray(`  Reasoning (full): ${score.reasoning}`));
        console.log(chalk.gray(`  Reasoning length: ${score.reasoning.length} chars`));
      });
      
      const avgRawScore = totalRawScore / response.scores.length;
      console.log(chalk.cyan(`\n[LLMJudgeEvaluator] Average raw score: ${avgRawScore.toFixed(2)}/5`));
      console.log(chalk.cyan(`[LLMJudgeEvaluator] Average normalized: ${normalizedScore.toFixed(4)}/1.0`));
      
      // Check if score is 0 and why
      if (normalizedScore === 0) {
        console.log(chalk.red('\n[LLMJudgeEvaluator] ⚠️  WARNING: Final score is 0.0000'));
        console.log(chalk.red('[LLMJudgeEvaluator] This could indicate:'));
        console.log(chalk.red('  - All category scores were 1/5 (minimum)'));
        console.log(chalk.red('  - Score normalization issue'));
        console.log(chalk.red('  - Missing or invalid scores in response'));
        console.log(chalk.red(`[LLMJudgeEvaluator] Raw scores received: ${response.scores.map(s => s.score).join(', ')}`));
      }

      // Log overall assessment
      if (response.overall_assessment) {
        console.log(chalk.cyan('\n[LLMJudgeEvaluator] ========== OVERALL ASSESSMENT =========='));
        console.log(chalk.gray(`  ${response.overall_assessment}`));
        console.log(chalk.gray(`  Assessment length: ${response.overall_assessment.length} chars`));
      } else {
        console.log(chalk.yellow('\n[LLMJudgeEvaluator] ⚠️  No overall_assessment in response'));
      }

      // Format detailed results with token count (use already-calculated normalizedScore)
      const details = this.formatDetails(response, normalizedScore, tokenCount);

      console.log(chalk.green(`\n[LLMJudgeEvaluator] ========== EVALUATION COMPLETE ==========`));
      console.log(chalk.green(`[LLMJudgeEvaluator] Final score: ${normalizedScore.toFixed(4)}/1.0`));
      console.log(chalk.green(`[LLMJudgeEvaluator] ===========================================\n`));

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
    const maxTokens = parseInt(process.env.LLM_JUDGE_MAX_TOKENS || "120000", 10);

    console.log(chalk.blue(`[LLMJudgeEvaluator] Using model: ${model}`));
    console.log(chalk.gray(`[LLMJudgeEvaluator] Temperature: ${temperature}, Max tokens: ${maxTokens}`));

    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            " then provide structured scores (1-5) across multiple categories. Always respond with valid JSON."
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
    
    // Try to fix incomplete JSON (common when max_tokens is reached)
    let jsonContent = content.trim();
    
    // If JSON appears incomplete, try to fix it
    if (!jsonContent.endsWith('}')) {
      console.log(chalk.yellow('[LLMJudgeEvaluator] ⚠️  JSON appears incomplete, attempting to fix...'));
      
      // Try to find the last complete object/array and close it
      let braceCount = 0;
      let lastValidIndex = -1;
      
      for (let i = 0; i < jsonContent.length; i++) {
        if (jsonContent[i] === '{') braceCount++;
        if (jsonContent[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            lastValidIndex = i;
          }
        }
      }
      
      // If we found a complete object, use it
      if (lastValidIndex > 0 && braceCount > 0) {
        jsonContent = jsonContent.substring(0, lastValidIndex + 1);
        console.log(chalk.yellow(`[LLMJudgeEvaluator] Truncated to last complete object at position ${lastValidIndex + 1}`));
      } else {
        // Try to close the JSON manually
        const openBraces = (jsonContent.match(/{/g) || []).length;
        const closeBraces = (jsonContent.match(/}/g) || []).length;
        const missingBraces = openBraces - closeBraces;
        
        if (missingBraces > 0) {
          // Close any open strings first
          if (jsonContent.match(/"[^"]*$/)) {
            jsonContent = jsonContent.replace(/"[^"]*$/, '"');
          }
          // Close any open arrays
          const openArrays = (jsonContent.match(/\[/g) || []).length;
          const closeArrays = (jsonContent.match(/\]/g) || []).length;
          if (openArrays > closeArrays) {
            jsonContent += ']'.repeat(openArrays - closeArrays);
          }
          // Close braces
          jsonContent += '}'.repeat(missingBraces);
          console.log(chalk.yellow(`[LLMJudgeEvaluator] Attempted to close ${missingBraces} missing braces`));
        }
      }
    }

    let parsed: JudgeResponse;
    try {
      parsed = JSON.parse(jsonContent) as JudgeResponse;
    } catch (parseError) {
      console.error(chalk.red(`[LLMJudgeEvaluator] JSON parse error: ${parseError instanceof Error ? parseError.message : String(parseError)}`));
      console.error(chalk.red(`[LLMJudgeEvaluator] Full content (last 500 chars):\n${jsonContent.substring(Math.max(0, jsonContent.length - 500))}`));
      throw new Error(`Failed to parse LLM judge response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

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

    console.log(chalk.cyan('[LLMJudgeEvaluator] Building prompt sections...'));
    
    // Build context sections
    const taskDescription = this.buildTaskDescription(scenario);
    console.log(chalk.gray(`  - Task description: ${taskDescription.length} chars`));
    
    const agentResponseSection = this.buildAgentResponseSection(agentResponse);
    console.log(chalk.gray(`  - Agent response section: ${agentResponseSection.length} chars`));
    
    const changesSection = this.buildChangesSection(diffSummary, depsDelta);
    console.log(chalk.gray(`  - Changes section: ${changesSection.length} chars`));
    
    const commandResultsSection = this.buildCommandResultsSection(commandLog);
    console.log(chalk.gray(`  - Command results section: ${commandResultsSection.length} chars`));

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
    console.log(chalk.cyan('[LLMJudgeEvaluator] Normalizing scores...'));
    
    if (!response.scores || response.scores.length === 0) {
      console.log(chalk.red('[LLMJudgeEvaluator] ⚠️  No scores in response, returning 0'));
      return 0;
    }

    console.log(chalk.gray(`[LLMJudgeEvaluator] Processing ${response.scores.length} scores`));
    
    // Calculate simple average with equal weights for all categories
    let sum = 0;
    let count = 0;
    
    response.scores.forEach((score, idx) => {
      const normalized = (score.score - 1) / 4;
      sum += normalized;
      count++;
      console.log(chalk.gray(`  Score ${idx + 1} (${score.category}): ${score.score}/5 → ${normalized.toFixed(4)}/1.0`));
    });
    
    const average = count > 0 ? sum / count : 0;
    console.log(chalk.gray(`[LLMJudgeEvaluator] Sum of normalized scores: ${sum.toFixed(4)}`));
    console.log(chalk.gray(`[LLMJudgeEvaluator] Count: ${count}`));
    console.log(chalk.gray(`[LLMJudgeEvaluator] Average (final score): ${average.toFixed(4)}`));
    
    return average;
  }

  private countPromptTokens(prompt: string): number {
    // Count tokens in the full prompt including system message
    const systemMessage =
      "You are an expert code reviewer. Analyze the provided code changes and agent response, then provide structured scores (1-5) across multiple categories. Always respond with valid JSON.";
    const fullPrompt = systemMessage + "\n\n" + prompt;
    return countTokens(fullPrompt);
  }

  private formatDetails(response: JudgeResponse, normalizedScore: number, tokenCount?: number): string {
    const details = {
      scores: response.scores,
      overall_assessment: response.overall_assessment,
      normalized_score: normalizedScore,
      ...(tokenCount && { input_tokens: tokenCount })
    };

    return JSON.stringify(details, null, 2);
  }
}
