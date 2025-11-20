import { config } from 'dotenv';
import { OpenAI } from 'openai';
import chalk from 'chalk';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";
import { resolve, join } from 'node:path';
import { existsSync } from 'node:fs';
import { logger } from '@ze/logger';

const log = logger.openrouter;

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
  private readonly DEFAULT_MODEL = "openai/gpt-5";
  private readonly model: string;
  private readonly modelSource: 'parameter' | 'environment' | 'default';
  private pricingCache: Map<string, ModelPricing> = new Map();
  
  constructor(apiKey = process.env.OPENROUTER_API_KEY!, model?: string) {
    // Debug: Log relevant environment variables
    log.debug('[env] OpenRouter Adapter - Environment variables:');
    log.debug(`  OPENROUTER_API_KEY=${process.env.OPENROUTER_API_KEY ? '***set***' : '(not set)'}`);
    log.debug(`  OPENROUTER_MODEL=${process.env.OPENROUTER_MODEL || '(not set)'}`);

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
      log.success(`OpenRouter: Using model from parameter: ${this.model}`);
    } else if (process.env.OPENROUTER_MODEL) {
      this.model = process.env.OPENROUTER_MODEL;
      this.modelSource = 'environment';
      log.success(`OpenRouter: Using model from environment: ${this.model}`);
    } else {
      this.model = this.DEFAULT_MODEL;
      this.modelSource = 'default';
      log.warn(`OpenRouter: No model specified, using default: ${this.model}`);
      log.warn(`Specify with --model flag or set OPENROUTER_MODEL environment variable`);
    }

    if (this.model.includes('llama')) {
      log.warn(`Note: Some Llama models may return JSON descriptions instead of native tool calls`);
      log.warn(`Fallback JSON parser is active`);
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
    log.info(chalk.blue(`[OpenRouterAdapter] Tools available: ${request.tools?.length || 0}`));
    if (request.tools && request.tools.length > 0) {
      log.debug(chalk.gray(`[OpenRouterAdapter] Tool names: ${request.tools.map((t: any) => t.name || t.function?.name).join(', ')}`));
      log.debug(chalk.gray(`[OpenRouterAdapter] Tools in API request: ${apiRequest.tools ? 'YES' : 'NO'}`));
      log.debug(chalk.gray(`[OpenRouterAdapter] Tool choice: ${apiRequest.tool_choice || 'not set'}`));
    }

    // Store the transformed tools so we can reuse them on subsequent turns
    const transformedTools = apiRequest.tools;

    let totalToolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastRequestSnapshot = '';

    // Multi-turn conversation loop
    for (let turn = 0; turn < maxIterations; turn++) {
      log.info(chalk.blue(`[OpenRouterAdapter] Turn ${turn + 1}/${maxIterations}`));
      log.debug(chalk.gray(`[OpenRouterAdapter] Sending ${apiRequest.messages.length} messages to API`));
      if (turn > 0) {
        // Log last 2 messages to see conversation history
        const lastMessages = apiRequest.messages.slice(-2);
        lastMessages.forEach((msg: any, idx: number) => {
          const role = msg.role;
          const preview = msg.content ? msg.content.substring(0, 100) : (msg.tool_calls ? `[${msg.tool_calls.length} tool calls]` : '[no content]');
          log.debug(chalk.gray(`  Message ${apiRequest.messages.length - 2 + idx + 1}: ${role} - ${preview}`));
        });
      }

      // Log tools being sent to the API
      if (apiRequest.tools && apiRequest.tools.length > 0) {
        log.info(chalk.cyan(`[OpenRouterAdapter] ========== TOOLS SENT TO API ==========`));
        log.info(chalk.cyan(`[OpenRouterAdapter] Number of tools: ${apiRequest.tools.length}`));

        // Calculate approximate request size
        const requestSize = JSON.stringify(apiRequest).length;
        log.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  Approximate request size: ${(requestSize / 1024).toFixed(2)} KB`));
        if (requestSize > 100000) {
          log.error(chalk.red(`[OpenRouterAdapter] ⚠️  Request size is large (>100KB), this might cause issues`));
        }

        apiRequest.tools.forEach((tool: any, idx: number) => {
          const toolName = tool.function?.name || tool.name || 'unknown';
          log.info(chalk.cyan(`[OpenRouterAdapter]   ${idx + 1}. ${toolName}`));
          if (tool.function?.description) {
            log.debug(chalk.gray(`[OpenRouterAdapter]      Description: ${tool.function.description.substring(0, 80)}...`));
          }
        });
        log.info(chalk.cyan(`[OpenRouterAdapter] ======================================`));
      } else {
        log.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  No tools provided in API request`));
      }

      try {
        lastRequestSnapshot = JSON.stringify(apiRequest, null, 2);
        log.debug(chalk.gray(`[OpenRouterAdapter] Request payload size: ${(lastRequestSnapshot.length / 1024).toFixed(2)} KB`));
        const payloadPreviewLimit = 4000;
        const payloadPreview =
          lastRequestSnapshot.length > payloadPreviewLimit
            ? `${lastRequestSnapshot.substring(0, payloadPreviewLimit)}... [truncated]`
            : lastRequestSnapshot;
        log.debug(chalk.gray(`[OpenRouterAdapter] Request payload preview:\n${payloadPreview}`));

        const response = await this.client.chat.completions.create(apiRequest);
        const fullResponseString = JSON.stringify(response, null, 2);

        const message = response.choices[0]?.message;
        if (!message) {
          throw new Error('No message in response');
        }

        // Log the full response for debugging
        log.info(chalk.cyan(`[OpenRouterAdapter] ========== API RESPONSE ==========`));
        log.debug(chalk.gray(`[OpenRouterAdapter] Response finish_reason: ${response.choices[0]?.finish_reason}`));
        log.debug(chalk.gray(`[OpenRouterAdapter] Message content: ${message.content ? `${message.content.length} chars` : 'null/empty'}`));
        if (message.content) {
          log.debug(chalk.gray(`[OpenRouterAdapter] Content preview: ${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}`));
        } else {
          log.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  Agent returned empty content with finish_reason=${response.choices[0]?.finish_reason}`));
        }
        log.debug(chalk.gray(`[OpenRouterAdapter] Tool calls present: ${!!message.tool_calls}`));
        if (message.tool_calls) {
          log.success(chalk.green(`[OpenRouterAdapter] ✓ Agent requested ${message.tool_calls.length} tool call(s):`));
          message.tool_calls.forEach((tc: any, idx: number) => {
            log.success(chalk.green(`[OpenRouterAdapter]   ${idx + 1}. ${tc.function?.name || 'unknown'}`));
            log.debug(chalk.gray(`[OpenRouterAdapter]      Arguments: ${tc.function?.arguments || 'none'}`));
          });
        } else {
          log.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  No tool calls in response`));
        }
        log.info(chalk.cyan(`[OpenRouterAdapter] ====================================`));
        log.debug(chalk.gray(`[OpenRouterAdapter] Full response payload:\n${fullResponseString}`));

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
          log.success(chalk.green(`[OpenRouterAdapter] Agent requested ${toolCalls.length} tool(s):`));
          toolCalls.forEach((tc: any, idx: number) => {
            log.debug(chalk.gray(`  ${idx + 1}. ${tc.function.name}`));
          });
        } else if (message.content) {
          log.warn(chalk.yellow(`[OpenRouterAdapter] Agent returned text response (no tools)`));
          const preview = message.content.substring(0, 80).replace(/\n/g, ' ');
          log.debug(chalk.gray(`  Content preview: ${preview}${message.content.length > 80 ? '...' : ''}`));
          log.debug(chalk.gray(`  Full content:\n${message.content}`));
        }

        // If no tools requested, we're done
        if (toolCalls.length === 0) {
          const content = message.content || '';
          const modelId = apiRequest.model;
          log.info(chalk.blue(`[OpenRouterAdapter] Stopping: No tools requested (after ${turn + 1} turns)`));
          log.info(chalk.blue(`[OpenRouterAdapter] Total tool calls made: ${totalToolCalls}`));
          return this.buildResponse(content, totalInputTokens, totalOutputTokens, totalToolCalls, modelId);
        }

        // Process all tool calls
        log.info(chalk.blue(`[OpenRouterAdapter] Executing ${toolCalls.length} tool(s)...`));
        totalToolCalls += toolCalls.length;

        const toolResults = await this.executeTools(toolCalls, request.toolHandlers);
        log.success(chalk.green(`[OpenRouterAdapter] ✓ All tools executed`));

        // Log tool results for debugging
        log.info(chalk.cyan(`[OpenRouterAdapter] Tool results:`));
        toolResults.forEach((result, idx) => {
          const contentLength = result.content?.length || 0;
          const contentPreview = result.content?.substring(0, 200) || 'null';
          log.debug(chalk.gray(`  ${idx + 1}. tool_call_id: ${result.tool_call_id}, content length: ${contentLength}`));
          log.debug(chalk.gray(`     Preview: ${contentPreview}${contentLength > 200 ? '...' : ''}`));
          // Check if content is valid JSON
          if (result.content) {
            try {
              JSON.parse(result.content);
              log.debug(chalk.gray(`     ✓ Content is valid JSON`));
            } catch (e) {
              log.debug(chalk.gray(`     ⚠️  Content is not valid JSON (might be intentional)`));
            }
          }
        });

        // Update request for next turn
        // Log tool_calls structure for debugging
        if (toolCalls.length > 0) {
          log.debug(chalk.gray(`[OpenRouterAdapter] Tool calls structure check:`));
          log.debug(chalk.gray(`  Number of tool calls: ${toolCalls.length}`));
          const firstToolCall = toolCalls[0];
          log.debug(chalk.gray(`  First tool call keys: ${Object.keys(firstToolCall || {}).join(', ')}`));
          if (firstToolCall?.function) {
            log.debug(chalk.gray(`  Function keys: ${Object.keys(firstToolCall.function || {}).join(', ')}`));
          }
        }

        const assistantMessage = {
          role: 'assistant' as const,
          content: message.content || null,
          tool_calls: toolCalls
        };

        const toolMessages = toolResults.map((result) => ({
          role: 'tool' as const,
          tool_call_id: result.tool_call_id,
          content: result.content
        }));

        // Log the messages being added
        log.debug(chalk.gray(`[OpenRouterAdapter] Adding to conversation:`));
        log.debug(chalk.gray(`  Assistant message: content=${assistantMessage.content?.length || 0} chars, tool_calls=${assistantMessage.tool_calls?.length || 0}`));
        log.debug(chalk.gray(`  Tool messages: ${toolMessages.length}`));

        // Log tool message sizes
        toolMessages.forEach((msg, idx) => {
          const contentSize = msg.content?.length || 0;
          log.debug(chalk.gray(`    Tool message ${idx + 1}: ${contentSize} chars (${(contentSize / 1024).toFixed(2)} KB)`));
          if (contentSize > 100000) {
            log.warn(chalk.yellow(`      ⚠️  Large tool result detected!`));
          }
        });

        apiRequest.messages = [
          ...apiRequest.messages,
          assistantMessage,
          ...toolMessages
        ];

        // Log total request size after adding messages
        const requestSizeAfter = JSON.stringify(apiRequest).length;
        log.debug(chalk.gray(`[OpenRouterAdapter] Request size after adding messages: ${(requestSizeAfter / 1024).toFixed(2)} KB`));
        if (requestSizeAfter > 100000) {
          log.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  Request is large (${(requestSizeAfter / 1024).toFixed(2)} KB), this might cause issues`));
        }

        // Include tool definitions only on the first turn to reduce payload size
        if (transformedTools && transformedTools.length > 0) {
          if (turn === 0) {
            apiRequest.tools = transformedTools;
            apiRequest.tool_choice = "auto";
          } else if (turn === 1) {
            delete apiRequest.tools;
            delete apiRequest.tool_choice;
            log.debug(chalk.gray(`[OpenRouterAdapter] Tools removed from subsequent requests to avoid repeated payload`));
          }
        }
        
      } catch (error: any) {
        // Log detailed error information
        log.error(chalk.red(`[OpenRouterAdapter] ❌ API Error occurred:`));
        log.error(chalk.red(`  Error type: ${error?.constructor?.name || 'Unknown'}`));
        log.error(chalk.red(`  Error message: ${error?.message || String(error)}`));

        // Log API error details if available (OpenAI SDK structure)
        if (error?.status) {
          log.error(chalk.red(`  API Status: ${error.status}`));
        }
        if (error?.error) {
          log.error(chalk.red(`  API Error Object: ${JSON.stringify(error.error, null, 2).substring(0, 1000)}`));
        }
        if (error?.response) {
          log.error(chalk.red(`  API Status: ${error.response.status}`));
          log.error(chalk.red(`  API Status Text: ${error.response.statusText}`));
          try {
            const errorBody = await error.response.text();
            log.error(chalk.red(`  API Error Body: ${errorBody.substring(0, 1000)}`));
          } catch (e) {
            log.error(chalk.red(`  Could not read error body`));
          }
        }
        if (lastRequestSnapshot) {
          const snapshotLimit = 8000;
          const requestPreview =
            lastRequestSnapshot.length > snapshotLimit
              ? `${lastRequestSnapshot.substring(0, snapshotLimit)}... [truncated]`
              : lastRequestSnapshot;
          log.warn(chalk.yellow(`[OpenRouterAdapter] Request payload snapshot:\n${requestPreview}`));
        }
        if ((error as any)?.responseBody) {
          log.error(chalk.red(`[OpenRouterAdapter] Response body:\n${(error as any).responseBody}`));
        }
        // Log all error properties for debugging
        if (error && typeof error === 'object') {
          log.warn(chalk.yellow(`  Error properties: ${Object.keys(error).join(', ')}`));
          if (error.status) log.warn(chalk.yellow(`  error.status: ${error.status}`));
          if (error.code) log.warn(chalk.yellow(`  error.code: ${error.code}`));
          if (error.type) log.warn(chalk.yellow(`  error.type: ${error.type}`));
        }

        // Log request details for debugging
        if (apiRequest.messages) {
          const lastMessages = apiRequest.messages.slice(-3);
          log.warn(chalk.yellow(`  Last ${lastMessages.length} messages in request:`));
          lastMessages.forEach((msg: any, idx: number) => {
            const role = msg.role;
            const contentLength = msg.content ? msg.content.length : (msg.tool_calls ? `[${msg.tool_calls.length} tool calls]` : 0);
            log.warn(chalk.yellow(`    ${idx + 1}. ${role} - ${contentLength} chars`));
            if (msg.content && msg.content.length > 500) {
              log.warn(chalk.yellow(`       Content too large: ${msg.content.length} chars (first 200: ${msg.content.substring(0, 200)}...)`));
            }
            if (msg.tool_calls) {
              log.warn(chalk.yellow(`       Tool calls: ${msg.tool_calls.length}`));
            }
          });
        }

        if (error instanceof Error) {
          // Handle specific OpenRouter errors
          if (error.message.includes('No allowed providers are available')) {
            log.error('Model availability issue!');
            log.error('Try these alternatives:');
            log.error('   - openai/gpt-4o-mini');
            log.error('   - meta-llama/llama-3.1-70b-instruct');
            log.error('   - Check your OpenRouter account credits');
          } else if (error.message.includes('timeout')) {
            log.error('Request timeout!');
            log.error('Try a different model or retry later');
          } else if (error.message.includes('rate limit')) {
            log.error('Rate limit exceeded!');
            log.error('Wait a moment and try again');
          } else if (error.message.includes('500')) {
            log.error('OpenRouter API returned 500 error!');
            log.error('This might be due to:');
            log.error('   - Request payload too large');
            log.error('   - Tool result content too large');
            log.error('   - Malformed request');
            log.error('   - Temporary OpenRouter API issue');
          }
        }

        throw error;
      }
    }

    // Max turns reached
    log.error(chalk.red(`[OpenRouterAdapter] Stopping: Max iterations (${maxIterations}) reached`));
    log.info(chalk.blue(`[OpenRouterAdapter] Total tool calls made: ${totalToolCalls}`));
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
      const simplifyTool = (tool: any) => ({
        type: 'function',
        function: {
          name: (tool.function?.name ?? tool.name) || 'unnamed_tool',
          description: tool.function?.description ?? tool.description ?? 'No description provided',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      });

      if (alreadyTransformed) {
        // Tools already in OpenRouter format, but strip schemas to reduce payload size
        params.tools = request.tools.map((tool: any) => simplifyTool(tool));
        log.debug(chalk.gray(`[OpenRouterAdapter] Tools already in OpenRouter format (schemas stripped)`));
      } else {
        // Transform tools from Anthropic format (input_schema) to OpenAI format (function.parameters)
        params.tools = request.tools.map((tool: any) => simplifyTool(tool));
        log.debug(chalk.gray(`[OpenRouterAdapter] Transformed tools from Anthropic to OpenRouter format (schemas stripped)`));
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
        log.info(chalk.blue(`[OpenRouterAdapter] Executing tool: ${toolName}`));
        try {
          const rawArguments = toolCall.function.arguments || '{}';
          log.debug(chalk.cyan(`[OpenRouterAdapter] Tool arguments (raw): ${rawArguments}`));
          const input = JSON.parse(rawArguments);
          log.debug(chalk.cyan(`[OpenRouterAdapter] Tool arguments (parsed): ${JSON.stringify(input, null, 2)}`));
          resultContent = await handler(input);
          log.success(chalk.green(`[OpenRouterAdapter] ✓ ${toolName} completed`));
        } catch (error) {
          log.error(chalk.red(`[OpenRouterAdapter] ❌ Error in ${toolName}:`), error);
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        log.warn(chalk.yellow(`[OpenRouterAdapter] ⚠️  No handler found for tool: ${toolName}`));
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
