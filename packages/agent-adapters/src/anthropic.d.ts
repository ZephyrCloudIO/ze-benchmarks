import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.js";
export declare class AnthropicAdapter implements AgentAdapter {
    name: string;
    private client;
    constructor(apiKey?: string);
    send(request: AgentRequest): Promise<AgentResponse>;
    private estimateCost;
}
