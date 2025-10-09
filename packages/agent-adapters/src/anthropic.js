import Anthropic from "@anthropic-ai/sdk";
export class AnthropicAdapter {
    constructor(apiKey = process.env.ANTHROPIC_API_KEY) {
        this.name = "anthropic";
        if (!apiKey)
            throw new Error("Missing ANTHROPIC_API_KEY");
        this.client = new Anthropic({ apiKey });
    }
    async send(request) {
        const system = request.messages.find(m => m.role === "system")?.content;
        const userMessages = request.messages.filter(m => m.role === "user" || m.role === "assistant")
            .map(m => (m.role === "user" ? { type: "text", text: m.content } : { type: "text", text: `Assistant: ${m.content}` }));
        // Build API request with tools if provided
        const apiRequest = {
            model: process.env.CLAUDE_MODEL || "claude-3-7-sonnet-20250219",
            system,
            messages: [{ role: "user", content: userMessages.length ? userMessages : [{ type: "text", text: "" }] }],
            max_tokens: 4096
        };
        // Add tools if provided
        if (request.tools && request.tools.length > 0) {
            apiRequest.tools = request.tools;
        }
        let totalToolCalls = 0;
        let totalInputTokens = 0;
        let totalOutputTokens = 0;
        const conversationHistory = [];
        // Multi-turn conversation with tool calling
        for (let turn = 0; turn < 10; turn++) {
            const resp = await this.client.messages.create(apiRequest);
            totalInputTokens += resp.usage.input_tokens;
            totalOutputTokens += resp.usage.output_tokens;
            // Check if Claude wants to use tools
            const toolUses = resp.content.filter((block) => block.type === 'tool_use');
            if (toolUses.length === 0) {
                // No tools used, return final response
                const textContent = resp.content.find((block) => block.type === 'text');
                const content = textContent ? textContent.text : JSON.stringify(resp);
                return {
                    content,
                    tokensIn: totalInputTokens,
                    tokensOut: totalOutputTokens,
                    costUsd: this.estimateCost(totalInputTokens, totalOutputTokens),
                    toolCalls: totalToolCalls
                };
            }
            // Process tool calls
            totalToolCalls += toolUses.length;
            const toolResults = [];
            for (const toolUse of toolUses) {
                const handler = request.toolHandlers?.get(toolUse.name);
                let result;
                if (handler) {
                    try {
                        result = await handler(toolUse.input);
                    }
                    catch (error) {
                        result = `Error: ${error instanceof Error ? error.message : String(error)}`;
                    }
                }
                else {
                    result = `Tool '${toolUse.name}' is not available`;
                }
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolUse.id,
                    content: result
                });
            }
            // Continue conversation with tool results
            conversationHistory.push({
                role: 'assistant',
                content: resp.content
            });
            conversationHistory.push({
                role: 'user',
                content: toolResults
            });
            // Update messages for next turn
            apiRequest.messages = [
                apiRequest.messages[0], // Original user message
                ...conversationHistory
            ];
        }
        // If we exhausted turns, return last response
        const lastResponse = conversationHistory[conversationHistory.length - 2]?.content || [];
        const textContent = lastResponse.find((block) => block.type === 'text');
        const content = textContent ? textContent.text : 'Max tool calling iterations reached';
        return {
            content,
            tokensIn: totalInputTokens,
            tokensOut: totalOutputTokens,
            costUsd: this.estimateCost(totalInputTokens, totalOutputTokens),
            toolCalls: totalToolCalls
        };
    }
    estimateCost(inputTokens, outputTokens) {
        if (!inputTokens || !outputTokens)
            return 0;
        // Claude 3.5 Sonnet pricing (as of 2024): $3/1M input, $15/1M output
        const inputCost = (inputTokens / 1000000) * 3;
        const outputCost = (outputTokens / 1000000) * 15;
        return inputCost + outputCost;
        // need to find costs API for create one for all of this so that when we work with southern glazers it won't be an issue.
    }
}
