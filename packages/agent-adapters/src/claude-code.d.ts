import type { AgentAdapter, AgentRequest, AgentResponse } from './index.js';
export declare class ClaudeCodeAdapter implements AgentAdapter {
    name: string;
    private model?;
    private defaultMaxTurns;
    private permissionMode?;
    constructor(model?: string, defaultMaxTurns?: number, permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan');
    send(request: AgentRequest): Promise<AgentResponse>;
    private executeClaudeCommand;
    private convertMessagesToPrompt;
    private parseClaudeOutput;
}
