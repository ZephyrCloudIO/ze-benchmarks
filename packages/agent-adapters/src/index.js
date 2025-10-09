export class EchoAgent {
    constructor() {
        this.name = 'echo';
    }
    async send(request) {
        const last = request.messages[request.messages.length - 1]?.content ?? '';
        return { content: last };
    }
}
export { ClaudeCodeAdapter } from './claude-code.js';
export { AnthropicAdapter } from './anthropic.js';
