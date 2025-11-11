import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import JSON5 from 'json5';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";
import type { SpecialistTemplate } from 'agency-prompt-creator';
import { createPrompt } from 'agency-prompt-creator';

/**
 * SpecialistAdapter
 *
 * Decorator adapter that wraps an underlying AgentAdapter (Anthropic, OpenRouter, etc.)
 * and enhances it with specialist template-based prompt transformation.
 *
 * This adapter:
 * 1. Loads a specialist template from the filesystem
 * 2. Uses agency-prompt-creator to transform user prompts based on:
 *    - Detected task type
 *    - Model-specific prompts
 *    - Mustache template substitution
 * 3. Delegates actual model communication to the underlying adapter
 *
 * Usage:
 *   const anthropic = new AnthropicAdapter();
 *   const specialist = new SpecialistAdapter(
 *     anthropic,
 *     'agency-specialist-mint/snapshots/shadcn-specialist/1.0.0/snapshot-001.json5'
 *   );
 *   const response = await specialist.send(request);
 */
export class SpecialistAdapter implements AgentAdapter {
  name: string;
  private readonly underlyingAdapter: AgentAdapter;
  private readonly template: SpecialistTemplate;
  private readonly templatePath: string;

  /**
   * Create a new specialist adapter
   *
   * @param underlyingAdapter - The base adapter to wrap (AnthropicAdapter, OpenRouterAdapter, etc.)
   * @param templatePath - Path to specialist template or snapshot JSON5 file (relative to project root)
   */
  constructor(underlyingAdapter: AgentAdapter, templatePath: string) {
    this.underlyingAdapter = underlyingAdapter;
    this.templatePath = templatePath;
    this.template = this.loadTemplate(templatePath);
    this.name = `specialist:${this.template.name}:${underlyingAdapter.name}`;
  }

  /**
   * Load and parse specialist template from filesystem
   *
   * @param templatePath - Path to JSON5 template file
   * @returns Parsed specialist template
   * @throws Error if file not found or invalid JSON5
   */
  private loadTemplate(templatePath: string): SpecialistTemplate {
    try {
      // Resolve path relative to project root
      const absolutePath = resolve(process.cwd(), templatePath);
      const contents = readFileSync(absolutePath, 'utf-8');
      const template = JSON5.parse(contents) as SpecialistTemplate;

      // Basic validation
      if (!template.name || !template.prompts) {
        throw new Error(
          `Invalid specialist template: missing required fields 'name' or 'prompts'`
        );
      }

      return template;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('ENOENT')) {
          throw new Error(
            `Specialist template not found: ${templatePath}\n` +
            `Make sure the path is relative to project root and the file exists.`
          );
        }
        throw new Error(`Failed to load specialist template: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Send a request with specialist prompt transformation
   *
   * This method:
   * 1. Extracts the user prompt from the request
   * 2. Uses agency-prompt-creator to transform it based on the specialist template
   * 3. Replaces/enhances the system message with the transformed prompt
   * 4. Delegates to the underlying adapter
   *
   * @param request - Agent request with messages, tools, etc.
   * @returns Agent response from underlying adapter
   */
  async send(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Extract user prompt (last user message)
      const userMessage = this.extractUserPrompt(request);

      if (!userMessage) {
        throw new Error('No user message found in request');
      }

      // Transform prompt using agency-prompt-creator
      const result = createPrompt(this.template, userMessage, {
        // Extract model from environment or use default
        model: this.getModelName(),
        // Pass any additional context from the request
        context: this.buildTemplateContext(request)
      });

      // Create modified request with transformed system prompt
      const modifiedRequest: AgentRequest = {
        ...request,
        messages: this.injectSystemPrompt(request.messages, result.finalPrompt)
      };

      // Delegate to underlying adapter
      return this.underlyingAdapter.send(modifiedRequest);
    } catch (error) {
      // Re-throw with more context about specialist adapter
      if (error instanceof Error) {
        throw new Error(
          `SpecialistAdapter (${this.template.name}) error: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Extract the primary user prompt from the request
   * Uses the last user message as the primary prompt
   */
  private extractUserPrompt(request: AgentRequest): string {
    // Find last user message
    const userMessages = request.messages.filter(m => m.role === 'user');
    const lastUserMessage = userMessages[userMessages.length - 1];

    return lastUserMessage?.content || '';
  }

  /**
   * Get the model name being used
   * Tries to extract from environment variables based on adapter type
   */
  private getModelName(): string | undefined {
    // Try to get model from environment based on underlying adapter
    if (this.underlyingAdapter.name === 'anthropic') {
      return process.env.CLAUDE_MODEL;
    } else if (this.underlyingAdapter.name === 'openrouter') {
      return process.env.OPENROUTER_MODEL;
    }
    return undefined;
  }

  /**
   * Build template context for mustache substitution
   * Extracts useful metadata from the request
   */
  private buildTemplateContext(request: AgentRequest): Record<string, any> {
    return {
      workspaceDir: request.workspaceDir,
      hasTools: request.tools && request.tools.length > 0,
      toolCount: request.tools?.length || 0,
      // Add other useful context as needed
    };
  }

  /**
   * Inject or replace system prompt in message list
   * If a system message exists, replace it. Otherwise, add one.
   */
  private injectSystemPrompt(
    messages: AgentRequest['messages'],
    systemPrompt: string
  ): AgentRequest['messages'] {
    const systemIndex = messages.findIndex(m => m.role === 'system');

    if (systemIndex >= 0) {
      // Replace existing system message
      return [
        ...messages.slice(0, systemIndex),
        { role: 'system', content: systemPrompt },
        ...messages.slice(systemIndex + 1)
      ];
    } else {
      // Add system message at the beginning
      return [
        { role: 'system', content: systemPrompt },
        ...messages
      ];
    }
  }
}
