export type ToolDefinition = {
    name: string;
    description: string;
    input_schema: {
        type: 'object';
        properties: Record<string, any>;
        required?: string[];
    };
};
export type ToolHandler = (input: any) => Promise<string> | string;
export type AgentRequest = {
    messages: {
        role: 'system' | 'user' | 'assistant';
        content: string;
    }[];
    workspaceDir?: string;
    maxTurns?: number;
    tools?: ToolDefinition[];
    toolHandlers?: Map<string, ToolHandler>;
};
export type AgentResponse = {
    content: string;
    tokensIn?: number;
    tokensOut?: number;
    costUsd?: number;
    toolCalls?: number;
};
export interface AgentAdapter {
    name: string;
    send(request: AgentRequest): Promise<AgentResponse>;
}
export declare class EchoAgent implements AgentAdapter {
    name: string;
    send(request: AgentRequest): Promise<AgentResponse>;
}
export { ClaudeCodeAdapter } from './claude-code.js';
export { AnthropicAdapter } from './anthropic.js';
