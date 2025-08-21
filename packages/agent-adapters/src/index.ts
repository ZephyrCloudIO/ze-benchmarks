export type AgentRequest = { messages: { role: 'system' | 'user' | 'assistant'; content: string }[] };
export type AgentResponse = { content: string; tokensIn?: number; tokensOut?: number; costUsd?: number };

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
