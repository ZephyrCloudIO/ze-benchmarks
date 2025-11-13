import { config } from 'dotenv';
import Anthropic from "@anthropic-ai/sdk";
import type { MessageCreateParams, ContentBlock, TextBlock, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
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
  content: ContentBlock[] | ToolResult[];
}

export class AnthropicAdapter implements AgentAdapter {
  name = "anthropic";
  private readonly client: Anthropic;
  private readonly DEFAULT_MAX_ITERATIONS = 50;
  private readonly DEFAULT_MAX_TOKENS = 8192;
  private readonly DEFAULT_MODEL = "claude-3-5-sonnet-20241022";
  
  constructor(apiKey = process.env.ANTHROPIC_API_KEY!) {
    // Debug: Log relevant environment variables
    console.log('[env] Anthropic Adapter - Environment variables:');
    console.log(`  ANTHROPIC_API_KEY=${process.env.ANTHROPIC_API_KEY ? '***set***' : '(not set)'}`);
    
    if (!apiKey) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY environment variable. " +
        "Get your API key from: https://console.anthropic.com/settings/keys"
      );
    }
    this.client = new Anthropic({ apiKey });
  }
  
  async send(request: AgentRequest): Promise<AgentResponse> {
    const apiRequest = this.buildInitialRequest(request);
    const maxIterations = this.DEFAULT_MAX_ITERATIONS;

    let totalToolCalls = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const conversationHistory: ConversationTurn[] = [];

    // Multi-turn conversation loop
    for (let turn = 0; turn < maxIterations; turn++) {
      const response = await this.client.messages.create(apiRequest);
      
      // Type guard: ensure we got a Message, not a Stream
      if (!('content' in response)) {
        throw new Error('Unexpected streaming response');
      }
      
      
      totalInputTokens += response.usage.input_tokens;
      totalOutputTokens += response.usage.output_tokens;

      // Extract tool uses from response
      const toolUses = this.extractToolUses(response.content);
      
      // If no tools requested, we're done
      if (toolUses.length === 0) {
        const content = this.extractTextContent(response.content);
        return this.buildResponse(content, totalInputTokens, totalOutputTokens, totalToolCalls);
      }

      // Process all tool calls
      totalToolCalls += toolUses.length;
      const toolResults = await this.executeTools(toolUses, request.toolHandlers);

      // Add to conversation history
      conversationHistory.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      );

      // Update request for next turn
      apiRequest.messages = [
        apiRequest.messages[0], // Keep original user message
        ...conversationHistory
      ];
    }

    // Max turns reached
    const finalContent = this.extractFinalContent(conversationHistory);
    return this.buildResponse(finalContent, totalInputTokens, totalOutputTokens, totalToolCalls);
  }
  
  /**
   * Build the initial API request from agent request
   */
  private buildInitialRequest(request: AgentRequest): MessageCreateParams {
    const system = request.messages.find(m => m.role === "system")?.content;
    const userMessages = request.messages
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({
        type: "text" as const,
        text: m.role === "user" ? m.content : `Assistant: ${m.content}`
      }));

    const params: MessageCreateParams = {
      model: process.env.CLAUDE_MODEL || this.DEFAULT_MODEL,
      max_tokens: this.DEFAULT_MAX_TOKENS,
      messages: [{
        role: "user",
        content: userMessages.length > 0 ? userMessages : [{ type: "text", text: "" }]
      }],
      stream: false // Explicitly disable streaming for type safety
    };

    if (system) {
      params.system = system;
    }

    if (request.tools && request.tools.length > 0) {
      params.tools = request.tools as MessageCreateParams['tools'];
      params.tool_choice = { type: "auto" };
    }

    return params;
  }

  
  private extractToolUses(content: ContentBlock[]): ToolUseBlock[] {
    return content.filter((block): block is ToolUseBlock => block.type === 'tool_use');
  }


  private extractTextContent(content: ContentBlock[]): string {
    const textBlock = content.find((block): block is TextBlock => block.type === 'text');
    return textBlock?.text || '';
  }

  
  private async executeTools(
    toolUses: ToolUseBlock[],
    toolHandlers?: Map<string, (input: unknown) => Promise<string> | string>
  ): Promise<ToolResult[]> {

    const results: ToolResult[] = [];

    for (const toolUse of toolUses) {
      
      const handler = toolHandlers?.get(toolUse.name);
      let resultContent: string;

      if (handler) {
        try {
          resultContent = await handler(toolUse.input);
        } catch (error) {
          resultContent = `Error: ${error instanceof Error ? error.message : String(error)}`;
        }
      } else {
        resultContent = `Tool '${toolUse.name}' is not available`;
      }

      results.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
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
      const content = lastAssistantTurn.content as ContentBlock[];
      return this.extractTextContent(content);
    }

    return 'Max tool calling iterations reached';
  }

 
  private buildResponse(
    content: string,
    tokensIn: number,
    tokensOut: number,
    toolCalls: number
  ): AgentResponse {
    return {
      content,
      tokensIn,
      tokensOut,
      costUsd: this.estimateCost(tokensIn, tokensOut),
      toolCalls
    };
  }

  // TODO: Impplement this as a seperate module so that it's easier to update the pricing model
  // use the openrouter api to get the pricing model for the model
  private estimateCost(inputTokens: number, outputTokens: number): number {
    // Claude 3.7 Sonnet pricing: $3/1M input, $15/1M output
    const inputCost = (inputTokens / 1_000_000) * 3;
    const outputCost = (outputTokens / 1_000_000) * 15;
    return inputCost + outputCost;
  }
}
