import type { Oracle } from './oracle.js';

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

/**
 * Create the askUser tool definition for Anthropic API
 */
export function createAskUserToolDefinition(): ToolDefinition {
	return {
		name: 'askUser',
		description: 'Ask the user a question when you need clarification or approval for major changes. Use this sparingly - only for important decisions like major version upgrades or ambiguous requirements.',
		input_schema: {
			type: 'object',
			properties: {
				question: {
					type: 'string',
					description: 'The question to ask the user. Be specific and concise.'
				},
				context: {
					type: 'string',
					description: 'Optional context about why you are asking this question.'
				}
			},
			required: ['question']
		}
	};
}

/**
 * Create a tool handler that uses the oracle to answer questions
 */
export function createAskUserHandler(oracle: Oracle): ToolHandler {
	return async (input: { question: string; context?: string }): Promise<string> => {
		console.log(`[Oracle] Agent asked: "${input.question}"`);
		if (input.context) {
			console.log(`[Oracle] Context: ${input.context}`);
		}
		
		const answer = oracle.ask(input.question);
		console.log(`[Oracle] Answered: "${answer}"`);
		
		return answer;
	};
}

