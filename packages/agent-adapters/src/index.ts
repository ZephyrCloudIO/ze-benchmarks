export type AgentRequest = {
	messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
	workspaceDir?: string;
	maxTurns?: number;
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

export class EchoAgent implements AgentAdapter {
	name = 'echo';
	async send(request: AgentRequest): Promise<AgentResponse> {
		const last = request.messages[request.messages.length - 1]?.content ?? '';
		return { content: last };
	}
}

export { ClaudeCodeAdapter } from './claude-code.js';
export { AnthropicAdapter } from './anthropic.js';
