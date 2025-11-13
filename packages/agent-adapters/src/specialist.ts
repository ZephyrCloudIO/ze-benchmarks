import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import JSON5 from 'json5';
import { OpenAI } from 'openai';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";
import type { SpecialistTemplate, TaskType } from 'agency-prompt-creator';
import { createPrompt, substituteTemplate, buildTemplateContext as buildPromptCreatorContext } from 'agency-prompt-creator';
import {
  buildPromptSelectionPrompt,
  parsePromptSelectionResponse,
  buildVariableExtractionPrompt,
  parseToolCallResponse,
  validateExtractedVariables,
  applyDefaults,
  createCacheKey,
  VARIABLE_EXTRACTION_TOOL,
  type PromptSelectionResult,
  type ExtractedVariables
} from './llm-prompt-selector.js';
import { LLMCache } from './llm-cache.js';

/**
 * LLM configuration from template or environment
 */
interface LLMConfig {
  enabled: boolean;
  provider: 'openrouter' | 'anthropic';
  selectionModel: string;
  extractionModel: string;
  timeoutMs: number;
  cacheTtlMs: number;
  fallbackToStatic: boolean;
}

/**
 * Telemetry data for LLM operations
 */
interface LLMTelemetry {
  llm_prompt_selection?: {
    enabled: boolean;
    selected_prompt_id: string;
    confidence: string;
    duration_ms: number;
    model: string;
    cache_hit: boolean;
  };
  llm_variable_extraction?: {
    extracted_vars: string[];
    var_values: Record<string, any>;
    duration_ms: number;
    model: string;
    cache_hit: boolean;
  };
}

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
 * 3. Optionally uses LLM-powered prompt selection and variable extraction
 * 4. Delegates actual model communication to the underlying adapter
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
  private lastTransformedMessages?: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>;

  // LLM-powered selection
  private readonly llmConfig: LLMConfig;
  private readonly llmCache: LLMCache;
  private llmClient?: OpenAI;
  private llmTelemetry: LLMTelemetry = {};

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

    // Initialize LLM configuration
    this.llmConfig = this.loadLLMConfig();

    // Initialize cache
    this.llmCache = new LLMCache(this.llmConfig.cacheTtlMs);

    // Initialize LLM client if enabled
    if (this.llmConfig.enabled) {
      this.initializeLLMClient();
    }
  }

  /**
   * Load and parse specialist template from filesystem
   * Automatically uses enriched template if available
   *
   * @param templatePath - Path to JSON5 template file
   * @returns Parsed specialist template
   * @throws Error if file not found or invalid JSON5
   */
  private loadTemplate(templatePath: string): SpecialistTemplate {
    try {
      // Resolve template path (automatically use enriched version if available)
      const resolvedPath = this.resolveTemplatePath(templatePath);

      const contents = readFileSync(resolvedPath, 'utf-8');
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
   * Resolve template path, automatically using latest enriched version if available
   *
   * NEW STRUCTURE:
   * - Original: starting_from_outcome/shadcn-specialist-template.json5
   * - Enriched: starting_from_outcome/enriched/0.0.5/enriched-001.json5
   *             starting_from_outcome/enriched/0.0.5/enriched-002.json5
   *             ... (always use highest number)
   */
  private resolveTemplatePath(templatePath: string): string {
    const absolutePath = resolve(process.cwd(), templatePath);

    // If path is already an enriched template, use it
    if (this.isEnrichedTemplatePath(absolutePath)) {
      console.log(`[SpecialistAdapter] Using explicitly specified enriched template: ${absolutePath}`);
      return absolutePath;
    }

    // Try to find latest enriched version
    try {
      const contents = readFileSync(absolutePath, 'utf-8');
      const template = JSON5.parse(contents) as SpecialistTemplate;
      const latestEnrichedPath = this.getLatestEnrichedTemplatePath(absolutePath, template.version);

      if (latestEnrichedPath) {
        console.log(`[SpecialistAdapter] Using enriched template: ${latestEnrichedPath}`);
        return latestEnrichedPath;
      } else {
        console.warn(`[SpecialistAdapter] No enriched template found for version ${template.version}`);
        console.warn(`[SpecialistAdapter] Expected location: ${this.getEnrichedDir(absolutePath, template.version)}`);
        console.warn(`[SpecialistAdapter] Using original template. Run enrichment to generate enriched template.`);
      }
    } catch (error) {
      // If we can't read the template, fall back to original path
      console.warn(`[SpecialistAdapter] Failed to check for enriched template:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return absolutePath;
  }

  /**
   * Check if a path is an enriched template
   */
  private isEnrichedTemplatePath(path: string): boolean {
    return path.includes('/enriched/') && path.includes('enriched-') && path.endsWith('.json5');
  }

  /**
   * Get enriched directory for a template version
   */
  private getEnrichedDir(templatePath: string, version: string): string {
    const dir = dirname(templatePath);
    return join(dir, 'enriched', version);
  }

  /**
   * Get latest enriched template path for a given template path and version
   * Returns null if no enriched templates exist
   */
  private getLatestEnrichedTemplatePath(templatePath: string, version: string): string | null {
    const enrichedDir = this.getEnrichedDir(templatePath, version);

    if (!existsSync(enrichedDir)) {
      return null;
    }

    try {
      // Find all enriched-NNN.json5 files
      const files = readdirSync(enrichedDir);
      const enrichedFiles = files
        .filter(f => f.match(/^enriched-(\d+)\.json5$/))
        .map(f => {
          const match = f.match(/^enriched-(\d+)\.json5$/);
          return match ? { filename: f, number: parseInt(match[1], 10) } : null;
        })
        .filter((f): f is { filename: string; number: number } => f !== null)
        .sort((a, b) => b.number - a.number); // Sort descending

      if (enrichedFiles.length === 0) {
        return null;
      }

      // Return the highest numbered file
      return join(enrichedDir, enrichedFiles[0].filename);
    } catch {
      return null;
    }
  }

  /**
   * Send a request with specialist prompt transformation
   *
   * This method:
   * 1. Extracts the user prompt from the request
   * 2. Uses LLM-powered selection/extraction if enabled, or falls back to static
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

      let finalPrompt: string;

      // Use LLM-powered approach if enabled
      if (this.llmConfig.enabled) {
        try {
          finalPrompt = await this.createPromptWithLLM(userMessage, this.getModelName(), request);
        } catch (error) {
          if (this.llmConfig.fallbackToStatic) {
            console.warn('[SpecialistAdapter] LLM selection failed, falling back to static:', error instanceof Error ? error.message : 'Unknown error');

            // Fallback to static approach
            const result = createPrompt(this.template, {
              userPrompt: userMessage,
              model: this.getModelName(),
              context: this.buildTemplateContext(request)
            });
            finalPrompt = result.prompt;
          } else {
            throw error;
          }
        }
      } else {
        // Use static approach
        const result = createPrompt(this.template, {
          userPrompt: userMessage,
          model: this.getModelName(),
          context: this.buildTemplateContext(request)
        });
        finalPrompt = result.prompt;
      }

      // Create modified request with transformed system prompt
      const transformedMessages = this.injectSystemPrompt(request.messages, finalPrompt);
      const modifiedRequest: AgentRequest = {
        ...request,
        messages: transformedMessages
      };

      // Store transformed messages for logging/debugging
      this.lastTransformedMessages = transformedMessages;

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

  /**
   * Get the last transformed messages (after specialist prompt was applied)
   * Useful for logging/debugging what was actually sent to the model
   *
   * @returns The transformed messages from the last send() call, or undefined if no send() has been called yet
   */
  getLastTransformedMessages(): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> | undefined {
    return this.lastTransformedMessages;
  }

  /**
   * Get LLM telemetry data from last operation
   */
  getLLMTelemetry(): LLMTelemetry {
    return this.llmTelemetry;
  }

  // =========================================================================
  // LLM-POWERED PROMPT SELECTION AND VARIABLE EXTRACTION
  // =========================================================================

  /**
   * Load LLM configuration from template and environment variables
   */
  private loadLLMConfig(): LLMConfig {
    // Check template llm_config
    const templateConfig = (this.template as any).llm_config;

    return {
      enabled: true, // Always enabled
      provider: templateConfig?.provider || 'openrouter',
      selectionModel: process.env.LLM_SELECTION_MODEL || templateConfig?.selection_model || 'x-ai/grok-beta',
      extractionModel: process.env.LLM_EXTRACTION_MODEL || templateConfig?.extraction_model || 'x-ai/grok-beta',
      timeoutMs: parseInt(process.env.LLM_SELECTION_TIMEOUT || '') || templateConfig?.timeout_ms || 10000,
      cacheTtlMs: templateConfig?.cache_ttl_ms || 3600000, // 1 hour default
      fallbackToStatic: templateConfig?.fallback_to_static ?? true
    };
  }

  /**
   * Initialize LLM client based on configuration
   */
  private initializeLLMClient(): void {
    if (this.llmConfig.provider === 'openrouter') {
      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        console.warn('[SpecialistAdapter] LLM selection enabled but OPENROUTER_API_KEY not found, disabling LLM selection');
        (this.llmConfig as any).enabled = false;
        return;
      }

      this.llmClient = new OpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey
      });
    } else if (this.llmConfig.provider === 'anthropic') {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        console.warn('[SpecialistAdapter] LLM selection enabled but ANTHROPIC_API_KEY not found, disabling LLM selection');
        (this.llmConfig as any).enabled = false;
        return;
      }

      this.llmClient = new OpenAI({
        baseURL: 'https://api.anthropic.com/v1',
        apiKey: apiKey,
        defaultHeaders: {
          'anthropic-version': '2023-06-01'
        }
      });
    }
  }

  /**
   * Create prompt using LLM-powered selection and variable extraction
   *
   * @param userPrompt User's original request
   * @param model Model being used
   * @param request Agent request for context building
   * @returns Final prompt with variables substituted
   */
  private async createPromptWithLLM(userPrompt: string, model?: string, request?: AgentRequest): Promise<string> {
    const cacheKey = createCacheKey(userPrompt);

    // Phase 1: Select best prompt template
    const selectionStart = Date.now();
    let selectionResult: PromptSelectionResult;
    let selectionCacheHit = false;

    const cachedSelection = this.llmCache.getSelection(cacheKey);
    if (cachedSelection) {
      selectionResult = cachedSelection;
      selectionCacheHit = true;
    } else {
      selectionResult = await this.selectPromptWithLLM(userPrompt, model);
      this.llmCache.setSelection(cacheKey, selectionResult);
    }

    const selectionDuration = Date.now() - selectionStart;

    // Phase 2: Extract variables for substitution
    const extractionStart = Date.now();
    let extractedVars: ExtractedVariables;
    let extractionCacheHit = false;

    const cachedVars = this.llmCache.getVariables(cacheKey);
    if (cachedVars) {
      extractedVars = cachedVars;
      extractionCacheHit = true;
    } else {
      extractedVars = await this.extractVariablesWithLLM(userPrompt, selectionResult.selectedPromptId);
      this.llmCache.setVariables(cacheKey, extractedVars);
    }

    const extractionDuration = Date.now() - extractionStart;

    // Store telemetry
    this.llmTelemetry = {
      llm_prompt_selection: {
        enabled: true,
        selected_prompt_id: selectionResult.selectedPromptId,
        confidence: selectionResult.confidence,
        duration_ms: selectionDuration,
        model: this.llmConfig.selectionModel,
        cache_hit: selectionCacheHit
      },
      llm_variable_extraction: {
        extracted_vars: Object.keys(extractedVars),
        var_values: extractedVars,
        duration_ms: extractionDuration,
        model: this.llmConfig.extractionModel,
        cache_hit: extractionCacheHit
      }
    };

    // Phase 3: Get template content
    const templateContent = this.getPromptById(selectionResult.selectedPromptId);
    if (!templateContent) {
      throw new Error(`Template not found for prompt ID: ${selectionResult.selectedPromptId}`);
    }

    // Phase 4: Extract task type from prompt ID and build full context with documentation
    const taskType = this.extractTaskTypeFromPromptId(selectionResult.selectedPromptId);
    const defaultedVars = applyDefaults(extractedVars, selectionResult.selectedPromptId);

    // Build base context from request
    const baseContext = request ? this.buildTemplateContext(request) : {
      workspaceDir: undefined,
      hasTools: false,
      toolCount: 0
    };

    // Build context using agency-prompt-creator (includes documentation filtering)
    const templateContext = buildPromptCreatorContext(
      this.template,
      userPrompt,
      taskType,
      {
        // Merge specialist adapter context
        ...baseContext,
        // Merge LLM-extracted variables
        ...defaultedVars
      }
    );

    // Phase 5: Append documentation section if available
    const promptWithDocs = this.appendDocumentationSection(templateContent, templateContext);

    // Phase 6: Substitute and return
    return substituteTemplate(promptWithDocs, templateContext);
  }

  /**
   * Select best prompt using LLM
   */
  private async selectPromptWithLLM(userPrompt: string, model?: string): Promise<PromptSelectionResult> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const prompt = buildPromptSelectionPrompt(userPrompt, this.template.prompts, model);

    try {
      const response = await Promise.race([
        this.llmClient.chat.completions.create({
          model: this.llmConfig.selectionModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.1,
          max_tokens: 500
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM selection timeout')), this.llmConfig.timeoutMs)
        )
      ]);

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content in LLM response');
      }

      return parsePromptSelectionResponse(content);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`LLM prompt selection failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Extract variables using LLM with tool calling
   */
  private async extractVariablesWithLLM(userPrompt: string, selectedPromptId: string): Promise<ExtractedVariables> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const templateContent = this.getPromptById(selectedPromptId);
    if (!templateContent) {
      return {}; // Return empty if template not found
    }

    const prompt = buildVariableExtractionPrompt(userPrompt, templateContent);

    try {
      const response = await Promise.race([
        this.llmClient.chat.completions.create({
          model: this.llmConfig.extractionModel,
          messages: [{ role: 'user', content: prompt }],
          tools: [VARIABLE_EXTRACTION_TOOL as any],
          tool_choice: { type: 'function', function: { name: 'extract_template_variables' } } as any,
          temperature: 0.1,
          max_tokens: 500
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('LLM extraction timeout')), this.llmConfig.timeoutMs)
        )
      ]);

      const toolCalls = response.choices[0]?.message?.tool_calls;
      if (!toolCalls || toolCalls.length === 0) {
        console.warn('[SpecialistAdapter] No tool calls in extraction response, returning empty variables');
        return {};
      }

      const extracted = parseToolCallResponse(toolCalls[0].function);
      return validateExtractedVariables(extracted);
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`[SpecialistAdapter] LLM variable extraction failed: ${error.message}`);
      }
      return {}; // Return empty on error - will use defaults
    }
  }

  /**
   * Extract task type from prompt ID
   * Examples:
   * - "project_setup.default.systemPrompt" -> "project_setup"
   * - "component_generation.model_specific.claude.systemPrompt" -> "component_generation"
   * - "default.spawnerPrompt" -> "default"
   * - "general.model_specific.claude.spawnerPrompt" -> "default"
   */
  private extractTaskTypeFromPromptId(promptId: string): TaskType {
    const parts = promptId.split('.');

    // If starts with "default" or "general", it's a default task
    if (parts[0] === 'default' || parts[0] === 'general') {
      return 'default';
    }

    // Otherwise, first part is the task type
    const taskType = parts[0];

    // Validate it's a known TaskType, otherwise default
    const validTaskTypes: TaskType[] = [
      'project_setup',
      'component_generation',
      'migration',
      'bug_fix',
      'refactoring',
      'testing',
      'documentation',
      'default'
    ];

    if (validTaskTypes.includes(taskType as TaskType)) {
      return taskType as TaskType;
    }

    console.warn(`[SpecialistAdapter] Unknown task type "${taskType}" in prompt ID "${promptId}", using "default"`);
    return 'default';
  }

  /**
   * Append documentation section to prompt if documentation is available
   * This matches the logic in agency-prompt-creator's createPrompt
   */
  private appendDocumentationSection(prompt: string, context: any): string {
    // Only append if documentation is available in context
    if (!context.documentation || !Array.isArray(context.documentation) || context.documentation.length === 0) {
      return prompt;
    }

    // Documentation template section (matches agency-prompt-creator)
    const docSection = `

## Relevant Documentation

The following documentation resources are most relevant to your task:

{{#documentation}}
### {{title}}

{{summary}}

**Key Concepts**: {{#key_concepts}}{{.}}{{^last}}, {{/last}}{{/key_concepts}}

{{#link}}**Reference**: {{link}}{{/link}}

{{#code_patterns}}
{{#code_patterns.0}}**Code Patterns**:
{{#code_patterns}}
- {{.}}
{{/code_patterns}}
{{/code_patterns.0}}
{{/code_patterns}}

---
{{/documentation}}`;

    return prompt + docSection;
  }

  /**
   * Get prompt content by ID from template
   *
   * NEW STRUCTURE: Handles IDs like:
   * - "project_setup.default.systemPrompt"
   * - "project_setup.model_specific.claude-sonnet-4.5.systemPrompt"
   * - "default.spawnerPrompt" (general default prompts)
   * - "general.model_specific.claude-sonnet-4.5.spawnerPrompt"
   */
  private getPromptById(promptId: string): string | null {
    const parts = promptId.split('.');

    // Handle general default prompts: "default.spawnerPrompt"
    if (parts[0] === 'default' && parts.length === 2) {
      const key = parts[1];
      return (this.template.prompts.default as any)?.[key] || null;
    }

    // Handle general model-specific prompts: "general.model_specific.model.key"
    if (parts[0] === 'general' && parts[1] === 'model_specific' && parts.length >= 4) {
      const modelKey = parts[2];
      const promptKey = parts[3];
      return (this.template.prompts.model_specific as any)?.[modelKey]?.[promptKey] || null;
    }

    // Handle task-specific default prompts: "project_setup.default.systemPrompt"
    if (parts.length >= 3 && parts[1] === 'default') {
      const taskType = parts[0];
      const promptKey = parts[2];
      const taskPrompts = (this.template.prompts as any)[taskType];
      return taskPrompts?.default?.[promptKey] || null;
    }

    // Handle task-specific model prompts: "project_setup.model_specific.claude-sonnet-4.5.systemPrompt"
    if (parts.length >= 4 && parts[1] === 'model_specific') {
      const taskType = parts[0];
      const modelKey = parts[2];
      const promptKey = parts[3];
      const taskPrompts = (this.template.prompts as any)[taskType];
      return taskPrompts?.model_specific?.[modelKey]?.[promptKey] || null;
    }

    return null;
  }
}
