import { config } from 'dotenv';
import { OpenAI } from 'openai';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";
import { resolve } from 'node:path';

// Load environment variables from .env file in project root
config({ path: resolve(process.cwd(), '.env') });

interface ToolResult {
  type: 'tool_result';
  tool_use_id: string;
  content: string;
}

interface ConversationTurn {
  role: 'assistant' | 'user';
  content: string | ToolResult[];
}

interface ModelPricing {
  prompt: string;
  completion: string;
  request: string;
  image: string;
  web_search: string;
  internal_reasoning: string;
  input_cache_read: string;
  input_cache_write: string;
}

interface ModelData {
  id: string;
  name: string;
  pricing: ModelPricing;
}

interface ModelsResponse {
  data: ModelData[];
}

export class OpenRouterAdapter implements AgentAdapter {
  name = "openrouter";
  private readonly client: OpenAI;
  private readonly DEFAULT_MAX_ITERATIONS = 50;
  private readonly DEFAULT_MAX_TOKENS = 8192;
  private readonly DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";
  private modelPricing: Map<string, ModelPricing> = new Map();
  
  constructor(apiKey = process.env.OPENROUTER_API_KEY!) {
    console.log('🔧 Initializing OpenRouter adapter...');
    
    if (!apiKey) {
      console.error('❌ Missing OPENROUTER_API_KEY environment variable');
      throw new Error(
        "Missing OPENROUTER_API_KEY environment variable. " +
        "Get your API key from: https://openrouter.ai/keys"
      );
    }
    
    console.log(`✅ API key found: ${apiKey.substring(0, 8)}...`);
    console.log(`🔧 Using model: ${process.env.OPENROUTER_MODEL || this.DEFAULT_MODEL}`);
    
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
    });

    // Load model pricing data
    this.loadModelPricing();
    console.log('✅ OpenRouter adapter initialized');
  }
  
  async send(request: AgentRequest): Promise<AgentResponse> {
    console.log('📤 Sending request to OpenRouter...');
    const apiRequest = this.buildInitialRequest(request);
    const maxIterations = this.DEFAULT_MAX_ITERATIONS;
    console.log(`🔧 Using model: ${apiRequest.model}`);
    console.log(`🔧 Max iterations: ${maxIterations}`);
    console.log(`🔧 Messages: ${apiRequest.messages.length} messages`);

    let totalToolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const conversationHistory: ConversationTurn[] = [];

    // Multi-turn conversation loop
    for (let turn = 0; turn < maxIterations; turn++) {
      const response = await this.client.chat.completions.create(apiRequest);
      
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error('No message in response');
      }
      
      totalInputTokens += response.usage?.prompt_tokens || 0;
      totalOutputTokens += response.usage?.completion_tokens || 0;

      // Extract tool calls from response
      const toolCalls = message.tool_calls || [];
      
      // If no tools requested, we're done
      if (toolCalls.length === 0) {
        const content = message.content || '';
        const modelId = apiRequest.model;
        return this.buildResponse(content, totalInputTokens, totalOutputTokens, totalToolCalls, modelId);
      }

      // Process all tool calls
      totalToolCalls += toolCalls.length;
      const toolResults = await this.executeTools(toolCalls, request.toolHandlers);

      // Add to conversation history
      conversationHistory.push(
        { role: 'assistant', content: message.content || '' },
        { role: 'user', content: toolResults }
      );

      // Update request for next turn
      apiRequest.messages = [
        ...apiRequest.messages,
        { role: 'assistant', content: message.content || '', tool_calls: toolCalls },
        { role: 'user', content: toolResults }
      ];
    }

    // Max turns reached
    const finalContent = this.extractFinalContent(conversationHistory);
    const modelId = apiRequest.model;
    return this.buildResponse(finalContent, totalInputTokens, totalOutputTokens, totalToolCalls, modelId);
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
      model: process.env.OPENROUTER_MODEL || this.DEFAULT_MODEL,
      max_tokens: this.DEFAULT_MAX_TOKENS,
      messages: userMessages.length > 0 ? userMessages : [{ role: "user", content: "" }],
      temperature: 0.1
    };

    if (system) {
      params.messages = [
        { role: "system", content: system },
        ...params.messages
      ];
    }

    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools;
      params.tool_choice = "auto";
    }

    // Add model routing support
    if (process.env.OPENROUTER_FALLBACK_MODELS) {
      const fallbackModels = process.env.OPENROUTER_FALLBACK_MODELS.split(',').map(m => m.trim());
      params.models = fallbackModels;
    }

    return params;
  }

  private async executeTools(
    toolCalls: any[],
    toolHandlers?: Map<string, (input: unknown) => Promise<string> | string>
  ): Promise<ToolResult[]> {
    const results: ToolResult[] = [];

    for (const toolCall of toolCalls) {
      const handler = toolHandlers?.get(toolCall.function.name);
      let resultContent: string;

      if (handler) {
        try {
          const input = JSON.parse(toolCall.function.arguments || '{}');
          resultContent = await handler(input);
        } catch (error) {
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        resultContent = `Tool '${toolCall.function.name}' is not available`;
      }

      results.push({
        type: 'tool_result',
        tool_use_id: toolCall.id,
        content: resultContent
      });
    }

    return results;
  }

  private extractFinalContent(history: ConversationTurn[]): string {
    if (history.length < 2) {
      return 'Max tool calling iterations reached';
    }

    const lastAssistantTurn = history[history.length - 2];
    if (lastAssistantTurn && lastAssistantTurn.role === 'assistant') {
      return lastAssistantTurn.content as string;
    }

    return 'Max tool calling iterations reached';
  }

  private buildResponse(
    content: string,
    tokensIn: number,
    tokensOut: number,
    toolCalls: number,
    modelId?: string
  ): AgentResponse {
    return {
      content,
      tokensIn,
      tokensOut,
      costUsd: this.estimateCost(tokensIn, tokensOut, modelId),
      toolCalls
    };
  }

  /**
   * Load model pricing data from OpenRouter's Models API
   */
  private async loadModelPricing(): Promise<void> {
    try {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      const data: ModelsResponse = await response.json();
      
      for (const model of data.data) {
        this.modelPricing.set(model.id, model.pricing);
      }
    } catch (error) {
      console.warn('Failed to load model pricing from OpenRouter API:', error);
    }
  }

  /**
   * Estimate cost based on real-time pricing from OpenRouter Models API
   */
  private estimateCost(inputTokens: number, outputTokens: number, modelId?: string): number {
    const model = modelId || this.DEFAULT_MODEL;
    const pricing = this.modelPricing.get(model);
    
    if (!pricing) {
      // Fallback to default pricing if model not found
      console.warn(`Using fallback pricing for model ${model} - $3/M tokens input, $15/M tokens output`);
      const inputCost = (inputTokens / 1_000_000) * 3;
      const outputCost = (outputTokens / 1_000_000) * 15;
      return inputCost + outputCost;
    }
    
    // Convert string prices to numbers (they come as strings from API)
    const promptCost = parseFloat(pricing.prompt) || 0;
    const completionCost = parseFloat(pricing.completion) || 0;
    const requestCost = parseFloat(pricing.request) || 0;
    
    // Calculate costs
    const inputCost = (inputTokens * promptCost);
    const outputCost = (outputTokens * completionCost);
    
    return inputCost + outputCost + requestCost;
  }
}
