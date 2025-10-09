import Anthropic from "@anthropic-ai/sdk";
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.js";

export class AnthropicAdapter implements AgentAdapter {
  name = "anthropic";
  private client: Anthropic;
  
  constructor(apiKey = process.env.ANTHROPIC_API_KEY!) {
    if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");
    this.client = new Anthropic({ apiKey });
  }
  
  async send(request: AgentRequest): Promise<AgentResponse> {
    const system = request.messages.find(m => m.role === "system")?.content;
    const user = request.messages.filter(m => m.role === "user" || m.role === "assistant")
      .map(m => (m.role === "user" ? { type: "text", text: m.content } : { type: "text", text: `Assistant: ${m.content}` })) as any[];
    
    const resp = await this.client.messages.create({
      model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219",
      system,
      messages: [{ role: "user", content: user.length ? user : [{ type: "text", text: "" }] }],
      max_tokens: 2048
    });
    
    const content = resp.content?.[0]?.type === "text" ? resp.content[0].text : JSON.stringify(resp);
    
    return { 
      content,
      tokensIn: resp.usage?.input_tokens,
      tokensOut: resp.usage?.output_tokens,
      costUsd: this.estimateCost(resp.usage?.input_tokens, resp.usage?.output_tokens)
    };
  }
  
  private estimateCost(inputTokens?: number, outputTokens?: number): number {
    if (!inputTokens || !outputTokens) return 0;
    // Claude 3.5 Sonnet pricing (as of 2024): $3/1M input, $15/1M output
    const inputCost = (inputTokens / 1000000) * 3;
    const outputCost = (outputTokens / 1000000) * 15;
    return inputCost + outputCost;
    // need to find costs API for create one for all of this so that when we work with southern glazers it won't be an issue.
  }
}
