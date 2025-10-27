import { OpenAI } from 'openai';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";

interface ToolResult {
  tool_call_id: string;
  content: string;
}

export class OpenRouterAdapter implements AgentAdapter {
  name = "openrouter";
  private readonly client: OpenAI;
  private readonly DEFAULT_MAX_ITERATIONS = 50;
  private readonly DEFAULT_MAX_TOKENS = 8192;
  private readonly DEFAULT_MODEL = "minimax/minimax-m2:free";
  private readonly model: string;
  private readonly modelSource: 'parameter' | 'environment' | 'default';
  
  constructor(apiKey = process.env.OPENROUTER_API_KEY!, model?: string) {
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
  }
  
  getModel(): string {
    return this.model;
  }
  
  getModelSource(): string {
    return this.modelSource;
  }
  
  async send(request: AgentRequest): Promise<AgentResponse> {
    const apiRequest = this.buildInitialRequest(request);
    const maxIterations = this.DEFAULT_MAX_ITERATIONS;

    console.log(`🔧 Messages: ${apiRequest.messages.length} messages`);
    console.log(`🔧 Tools: ${apiRequest.tools?.length || 0} tools`);

    let totalToolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    // Multi-turn conversation loop
    for (let turn = 0; turn < maxIterations; turn++) {
      console.log(`  Turn ${turn + 1}: Sending request...`);
      
      // Debug: Show what we're sending
      if (turn === 0) {
        console.log(`  🔧 Tools: ${apiRequest.tools?.length || 0} tools`);
        console.log(`  🔧 Tool choice: ${apiRequest.tool_choice || 'none'}`);
        if (apiRequest.tools && apiRequest.tools.length > 0) {
          apiRequest.tools.forEach((tool: any, index: number) => {
            console.log(`    ${index + 1}. ${tool.function?.name || tool.name || 'unknown'}`);
          });
        }
      }
      
      try {
        const response = await this.client.chat.completions.create(apiRequest);
        
        const message = response.choices[0]?.message;
        if (!message) {
          console.error('❌ No message in response');
          console.error('🔍 Response:', JSON.stringify(response, null, 2));
          throw new Error('No message in response');
        }
        
        totalInputTokens += response.usage?.prompt_tokens || 0;
        totalOutputTokens += response.usage?.completion_tokens || 0;

        // Extract tool calls from response
        const toolCalls = message.tool_calls || [];
        
        // Debug: Show raw response structure
        console.log(`  🔍 Raw message:`, JSON.stringify({
          has_tool_calls: !!message.tool_calls,
          tool_calls_length: toolCalls.length,
          has_content: !!message.content,
          content_type: typeof message.content
        }, null, 2));
        
        // Debug: Show what we received
        console.log(`  📥 Received: ${toolCalls.length} tool calls, content: ${message.content ? 'yes' : 'no'}`);
        if (toolCalls.length === 0 && message.content) {
          console.log(`  📝 Content preview: ${message.content.substring(0, 100)}${message.content.length > 100 ? '...' : ''}`);
        }
        
        // Fallback: Parse JSON tool descriptions from content if no tool_calls
        if (toolCalls.length === 0 && message.content) {
          try {
            const content = message.content.trim();
            const parsed = JSON.parse(content);
            
            // Handle array of tool calls
            const toolDescriptions = Array.isArray(parsed) ? parsed : [parsed];
            
            for (const desc of toolDescriptions) {
              if (desc.name && (desc.parameters || desc.arguments)) {
                console.log(`  🔄 Converting JSON description to tool call: ${desc.name}`);
                
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
            
            if (toolCalls.length > 0) {
              console.log(`  ✅ Created ${toolCalls.length} synthetic tool call(s)`);
            }
          } catch (e) {
            // Not JSON or not a tool description - treat as final response
            console.log(`  ℹ️ Content is not a tool description, treating as final response`);
          }
        }
        
        // If no tools requested, we're done
        if (toolCalls.length === 0) {
          const content = message.content || '';
          console.log(`  ✓ Complete: ${totalInputTokens} tokens in, ${totalOutputTokens} tokens out`);
          console.log(`  📝 Response: ${content.substring(0, 200)}${content.length > 200 ? '...' : ''}`);
          const modelId = apiRequest.model;
          return this.buildResponse(content, totalInputTokens, totalOutputTokens, totalToolCalls, modelId);
        }

        // Process all tool calls
        totalToolCalls += toolCalls.length;
        console.log(`  🔧 Tool calls: ${toolCalls.length}`);
        toolCalls.forEach((call: any, index: number) => {
          console.log(`    ${index + 1}. ${call.function?.name}(${call.function?.arguments || '{}'})`);
        });
        
        const toolResults = await this.executeTools(toolCalls, request.toolHandlers);
        console.log(`  ✅ Executed ${toolCalls.length} tools`);
        
        // Show tool results
        toolResults.forEach((result, index) => {
          console.log(`    ${index + 1}. Result: ${result.content.substring(0, 100)}${result.content.length > 100 ? '...' : ''}`);
        });

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
        
        console.log(`  📝 Updated messages: ${apiRequest.messages.length} total`);
        
        // Ensure tools are included in every request
        if (request.tools && request.tools.length > 0) {
          apiRequest.tools = request.tools;
          apiRequest.tool_choice = "auto";
        }
        
      } catch (error) {
        console.error(`❌ Error on turn ${turn + 1}:`);
        console.error(`🔍 Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
        console.error(`🔍 Error message: ${error instanceof Error ? error.message : String(error)}`);
        
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
          
          // Show stack trace for debugging
          if (error.stack) {
            console.error('🔍 Stack trace:');
            console.error(error.stack);
          }
        }
        
        throw error;
      }
    }

    // Max turns reached
    console.log(`⚠️ Max turns reached (${maxIterations})`);
    console.log(`  ✓ Complete: ${totalInputTokens} tokens in, ${totalOutputTokens} tokens out`);
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
          console.log(`    🔧 Executing ${toolCall.function.name} with:`, JSON.stringify(input, null, 2));
          resultContent = await handler(input);
          console.log(`    ✅ ${toolCall.function.name} completed`);
        } catch (error) {
          console.error(`    ❌ Error in ${toolCall.function.name}:`, error);
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        console.warn(`    ⚠️ No handler found for tool: ${toolCall.function.name}`);
        resultContent = `Tool '${toolCall.function.name}' is not available`;
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
    return {
      content,
      tokensIn,
      tokensOut,
      costUsd: 0, // Simplified - no cost calculation
      toolCalls
    };
  }
}
