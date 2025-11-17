import { config } from 'dotenv';
import { OpenAI } from 'openai';
import chalk from 'chalk';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';

// Load environment variables from .env file in project root
// Find workspace root by looking for pnpm-workspace.yaml (topmost one)
function findWorkspaceRoot(startDir: string): string {
  let currentDir = startDir;
  let lastWorkspaceRoot = startDir;

  while (currentDir !== resolve(currentDir, '..')) {
    if (existsSync(join(currentDir, 'pnpm-workspace.yaml'))) {
      lastWorkspaceRoot = currentDir;
    }
    currentDir = resolve(currentDir, '..');
  }

  return lastWorkspaceRoot;
}

const workspaceRoot = findWorkspaceRoot(process.cwd());
const envPath = resolve(workspaceRoot, '.env');
config({ path: envPath });

interface ToolResult {
  tool_call_id: string;
  content: string;
}

interface ModelPricing {
  prompt: number;    // Cost per token for input
  completion: number; // Cost per token for output
}

export class OpenRouterAdapter implements AgentAdapter {
  name = "openrouter";
  private readonly client: OpenAI;
  private readonly DEFAULT_MAX_ITERATIONS = 50;
  private readonly DEFAULT_MAX_TOKENS = 8192;
  private readonly DEFAULT_MODEL = "minimax/minimax-m2:free";
  private readonly model: string;
  private readonly modelSource: 'parameter' | 'environment' | 'default';
  private pricingCache: Map<string, ModelPricing> = new Map();
  
  constructor(apiKey = process.env.OPENROUTER_API_KEY!, model?: string) {
    // Debug: Log relevant environment variables
    console.log('[env] OpenRouter Adapter - Environment variables:');
    console.log(`  OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ? '***set***' : '(not set)'}`);
    console.log(`  OPENROUTER_MODEL=${process.env.OPENROUTER_MODEL || '(not set)'}`);
    
    if (!apiKey) {
      throw new Error(
        "Missing OPENROUTER_API_KEY environment variable. " +
        "Get your API key from: https://openrouter.ai/keys"
      );
    }
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
    });
    
    // Determine model source and log appropriately
    if (model) {
      this.model = model;
      this.modelSource = 'parameter';
      console.log(`✅ OpenRouter: Using model from parameter: ${this.model}`);
    } else if (process.env.OPENROUTER_MODEL) {
      this.model = process.env.OPENROUTER_MODEL;
      this.modelSource = 'environment';
      console.log(`✅ OpenRouter: Using model from environment: ${this.model}`);
    } else {
      this.model = this.DEFAULT_MODEL;
      this.modelSource = 'default';
      console.log(`⚠️  OpenRouter: No model specified, using default: ${this.model}`);
      console.log(`   Specify with --model flag or set OPENROUTER_MODEL environment variable`);
    }
    
    if (this.model.includes('llama')) {
      console.log(`⚠️  Note: Some Llama models may return JSON descriptions instead of native tool calls`);
      console.log(`   Fallback JSON parser is active`);
    }
    
    // Preload pricing for the current model
    this.loadModelPricing(this.model);
  }
  
  getModel(): string {
    return this.model;
  }
  
  getModelSource(): string {
    return this.modelSource;
  }
  
  /**
   * Calculate cost based on token usage and model pricing
   */
  private calculateCost(tokensIn: number, tokensOut: number, modelId: string): number {
    const pricing = this.getModelPricing(modelId);
    const inputCost = tokensIn * pricing.prompt;
    const outputCost = tokensOut * pricing.completion;
    return inputCost + outputCost;
  }
  
  /**
   * Get pricing for a model, with fallback for unknown models
   */
  private getModelPricing(modelId: string): ModelPricing {
    // Check cache first
    if (this.pricingCache.has(modelId)) {
      return this.pricingCache.get(modelId)!;
    }
    
    // Return fallback pricing immediately (async loading happens in background)
    const fallbackPricing = this.getFallbackPricing(modelId);
    
    // Load pricing asynchronously for future use
    this.loadModelPricing(modelId);
    
    return fallbackPricing;
  }
  
  /**
   * Load pricing for a specific model from OpenRouter API
   */
  private async loadModelPricing(modelId: string): Promise<void> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      });
      
      const data = await response.json();
      const model = data.data.find((m: any) => m.id === modelId);
      
      if (model && model.pricing) {
        this.pricingCache.set(modelId, {
          prompt: parseFloat(model.pricing.prompt),
          completion: parseFloat(model.pricing.completion)
        });
      }
    } catch (error) {
      // Silently fail - will use fallback pricing
    }
  }
  
  /**
   * Get fallback pricing for unknown models
   */
  private getFallbackPricing(modelId: string): ModelPricing {
    // Common pricing patterns for popular models
    if (modelId.includes('gpt-4o')) {
      return { prompt: 0.000005, completion: 0.000015 }; // GPT-4o pricing
    } else if (modelId.includes('gpt-4')) {
      return { prompt: 0.00003, completion: 0.00006 }; // GPT-4 pricing
    } else if (modelId.includes('gpt-3.5')) {
      return { prompt: 0.0000015, completion: 0.000002 }; // GPT-3.5 pricing
    } else if (modelId.includes('llama')) {
      return { prompt: 0.0000008, completion: 0.0000008 }; // Llama pricing
    } else if (modelId.includes('claude')) {
      return { prompt: 0.000003, completion: 0.000015 }; // Claude pricing
    } else if (modelId.includes('gemma')) {
      return { prompt: 0.0000005, completion: 0.0000005 }; // Gemma pricing
    } else {
      // Generic fallback - assume free tier pricing
      return { prompt: 0, completion: 0 };
    }
  }
  
  async send(request: AgentRequest): Promise<AgentResponse> {
    const apiRequest = this.buildInitialRequest(request);
    const maxIterations = this.DEFAULT_MAX_ITERATIONS;

    // Log tools configuration on first call
    console.log(chalk.blue(`[OpenRouterAdapter] Tools available: ${request.tools?.length || 0}`));
    if (request.tools && request.tools.length > 0) {
      console.log(chalk.gray(`[OpenRouterAdapter] Tool names: ${request.tools.map((t: any) => t.name || t.function?.name).join(', ')}`));
      console.log(chalk.gray(`[OpenRouterAdapter] Tools in API request: ${apiRequest.tools ? 'YES' : 'NO'}`));
      console.log(chalk.gray(`[OpenRouterAdapter] Tool choice: ${apiRequest.tool_choice || 'not set'}`));
    }

    // Store the transformed tools so we can reuse them on subsequent turns
    const transformedTools = apiRequest.tools;

    let totalToolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Multi-turn conversation loop
    for (let turn = 0; turn < maxIterations; turn++) {
      console.log(chalk.blue(`[OpenRouterAdapter] Turn ${turn + 1}/${maxIterations}`));
      console.log(chalk.gray(`[OpenRouterAdapter] Sending ${apiRequest.messages.length} messages to API`));
      if (turn > 0) {
        // Log last 2 messages to see conversation history
        const lastMessages = apiRequest.messages.slice(-2);
        lastMessages.forEach((msg: any, idx: number) => {
          const role = msg.role;
          const preview = msg.content ? msg.content.substring(0, 100) : (msg.tool_calls ? `[${msg.tool_calls.length} tool calls]` : '[no content]');
          console.log(chalk.gray(`  Message ${apiRequest.messages.length - 2 + idx + 1}: ${role} - ${preview}`));
        });
      }

      try {
        const response = await this.client.chat.completions.create(apiRequest);

        const message = response.choices[0]?.message;
        if (!message) {
          throw new Error('No message in response');
        }

        // Log the full response for debugging
        console.log(chalk.gray(`[OpenRouterAdapter] Response finish_reason: ${response.choices[0]?.finish_reason}`));
        console.log(chalk.gray(`[OpenRouterAdapter] Message content: ${message.content ? `${message.content.length} chars` : 'null/empty'}`));
        if (message.content) {
          console.log(chalk.gray(`[OpenRouterAdapter] Full content:\n${message.content}`));
        } else {
          console.log(chalk.yellow(`[OpenRouterAdapter] ⚠️  Agent returned empty content with finish_reason=${response.choices[0]?.finish_reason}`));
        }
        console.log(chalk.gray(`[OpenRouterAdapter] Tool calls present: ${!!message.tool_calls}`));
        if (message.tool_calls) {
          console.log(chalk.gray(`[OpenRouterAdapter] Number of tool calls: ${message.tool_calls.length}`));
        }

        totalInputTokens += response.usage?.prompt_tokens || 0;
        totalOutputTokens += response.usage?.completion_tokens || 0;

        // Extract tool calls from response
        const toolCalls = message.tool_calls || [];
        
        // Fallback: Parse JSON tool descriptions from content if no tool_calls
        if (toolCalls.length === 0 && message.content) {
          try {
            const content = message.content.trim();
            const parsed = JSON.parse(content);

            // Handle array of tool calls
            const toolDescriptions = Array.isArray(parsed) ? parsed : [parsed];

            for (const desc of toolDescriptions) {
              if (desc.name && (desc.parameters || desc.arguments)) {
                toolCalls.push({
                  id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  type: 'function',
                  function: {
                    name: desc.name,
                    arguments: JSON.stringify(desc.parameters || desc.arguments || {})
                  }
                });
              }
            }
          } catch (e) {
            // Not JSON or not a tool description - treat as final response
          }
        }

        // Log response type
        if (toolCalls.length > 0) {
          console.log(chalk.green(`[OpenRouterAdapter] Agent requested ${toolCalls.length} tool(s):`));
          toolCalls.forEach((tc: any, idx: number) => {
            console.log(chalk.gray(`  ${idx + 1}. ${tc.function.name}`));
          });
        } else if (message.content) {
          console.log(chalk.yellow(`[OpenRouterAdapter] Agent returned text response (no tools)`));
          const preview = message.content.substring(0, 80).replace(/\n/g, ' ');
          console.log(chalk.gray(`  Content preview: ${preview}${message.content.length > 80 ? '...' : ''}`));
          console.log(chalk.gray(`  Full content:\n${message.content}`));
        }

        // If no tools requested, we're done
        if (toolCalls.length === 0) {
          const content = message.content || '';
          const modelId = apiRequest.model;
          console.log(chalk.blue(`[OpenRouterAdapter] Stopping: No tools requested (after ${turn + 1} turns)`));
          console.log(chalk.blue(`[OpenRouterAdapter] Total tool calls made: ${totalToolCalls}`));
          return this.buildResponse(content, totalInputTokens, totalOutputTokens, totalToolCalls, modelId);
        }

        // Process all tool calls
        console.log(chalk.blue(`[OpenRouterAdapter] Executing ${toolCalls.length} tool(s)...`));
        totalToolCalls += toolCalls.length;

        const toolResults = await this.executeTools(toolCalls, request.toolHandlers);
        console.log(chalk.green(`[OpenRouterAdapter] ✓ All tools executed`));

        // Update request for next turn
        const assistantMessage = { 
          role: 'assistant', 
          content: message.content || null, 
          tool_calls: toolCalls 
        };
        
        const toolMessages = toolResults.map((result) => ({
          role: 'tool',
          tool_call_id: result.tool_call_id,
          content: result.content
        }));
        
        apiRequest.messages = [
          ...apiRequest.messages,
          assistantMessage,
          ...toolMessages
        ];
        
        // Ensure tools are included in every request (use transformed tools)
        if (transformedTools && transformedTools.length > 0) {
          apiRequest.tools = transformedTools;
          apiRequest.tool_choice = "auto";
        }
        
      } catch (error) {
        if (error instanceof Error) {
          // Handle specific OpenRouter errors
          if (error.message.includes('No allowed providers are available')) {
            console.error('🚨 Model availability issue!');
            console.error('💡 Try these alternatives:');
            console.error('   - openai/gpt-4o-mini');
            console.error('   - meta-llama/llama-3.1-70b-instruct');
            console.error('   - Check your OpenRouter account credits');
          } else if (error.message.includes('timeout')) {
            console.error('🚨 Request timeout!');
            console.error('💡 Try a different model or retry later');
          } else if (error.message.includes('rate limit')) {
            console.error('🚨 Rate limit exceeded!');
            console.error('💡 Wait a moment and try again');
          }
        }
        
        throw error;
      }
    }

    // Max turns reached
    console.log(chalk.red(`[OpenRouterAdapter] Stopping: Max iterations (${maxIterations}) reached`));
    console.log(chalk.blue(`[OpenRouterAdapter] Total tool calls made: ${totalToolCalls}`));
    const modelId = apiRequest.model;
    return this.buildResponse('Max tool calling iterations reached', totalInputTokens, totalOutputTokens, totalToolCalls, modelId);
  }
  
  /**
   * Build the initial API request from agent request
   */
  private buildInitialRequest(request: AgentRequest): any {
    const system = request.messages.find(m => m.role === "system")?.content;
    const userMessages = request.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content
      }));

    const params: any = {
      model: this.model,
      max_tokens: this.DEFAULT_MAX_TOKENS,
      messages: userMessages.length > 0 ? userMessages : [{ role: "user", content: "" }],
      temperature: 0.1
    };

    // Add provider restriction for Anthropic models
    if (this.model.startsWith('anthropic/')) {
      params.provider = {
        only: ['anthropic']
      };
    }

    if (system) {
      params.messages = [
        { role: "system", content: system },
        ...params.messages
      ];
    }

    if (request.tools && request.tools.length > 0) {
      // Check if tools are already in OpenRouter format (have .function property)
      // or still in Anthropic format (have .input_schema property)
      const firstTool = request.tools[0] as any;
      const alreadyTransformed = firstTool.type === 'function' && firstTool.function;

      if (alreadyTransformed) {
        // Tools already in OpenRouter format, use as-is
        params.tools = request.tools;
        console.log(chalk.gray(`[OpenRouterAdapter] Tools already in OpenRouter format`));
      } else {
        // Transform tools from Anthropic format (input_schema) to OpenAI format (function.parameters)
        params.tools = request.tools.map((tool: any) => ({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.input_schema || tool.parameters
          }
        }));
        console.log(chalk.gray(`[OpenRouterAdapter] Transformed tools from Anthropic to OpenRouter format`));
      }
      params.tool_choice = "auto";
    }

    return params;
  }

  private async executeTools(
    toolCalls: any[],
    toolHandlers?: Map<string, (input: unknown) => Promise<string> | string>
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const toolName = toolCall.function.name;
      const handler = toolHandlers?.get(toolName);
      let resultContent: string;

      if (handler) {
        console.log(chalk.blue(`[OpenRouterAdapter] Executing tool: ${toolName}`));
        try {
          const input = JSON.parse(toolCall.function.arguments || '{}');
          resultContent = await handler(input);
          console.log(chalk.green(`[OpenRouterAdapter] ✓ ${toolName} completed`));
        } catch (error) {
          console.error(chalk.red(`[OpenRouterAdapter] ❌ Error in ${toolName}:`), error);
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        console.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  No handler found for tool: ${toolName}`));
        resultContent = `Tool '${toolName}' is not available`;
      }

      results.push({
        tool_call_id: toolCall.id,
        content: resultContent
      });
    }

    return results;
  }

  private buildResponse(
    content: string,
    tokensIn: number,
    tokensOut: number,
    toolCalls: number,
    modelId?: string
  ): AgentResponse {
    const costUsd = modelId ? this.calculateCost(tokensIn, tokensOut, modelId) : 0;
    return {
      content,
      tokensIn,
      tokensOut,
      costUsd,
      toolCalls
    };
  }
}
