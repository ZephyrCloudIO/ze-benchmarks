import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename, join } from 'node:path';
import JSON5 from 'json5';
import { OpenAI } from 'openai';
import type { AgentAdapter, AgentRequest, AgentResponse } from "./index.ts";
import type { SpecialistTemplate, TaskType, ExtractedIntent, SpecialistSelection, DocumentationReference } from 'agency-prompt-creator';
import { logger } from '@ze/logger';

const log = logger.specialist;
import {
  createPrompt,
  substituteTemplate,
  buildTemplateContext as buildPromptCreatorContext,
  buildIntentExtractionPrompt,
  parseIntentResponse,
  INTENT_EXTRACTION_TOOL,
  buildComponentSelectionPrompt,
  parseComponentSelectionResponse,
  COMPONENT_SELECTION_TOOL,
  substituteWithLLM,
  SUBSTITUTION_TOOL,
  loadTemplate
} from 'agency-prompt-creator';
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
  intent_extraction?: {
    intent: ExtractedIntent;
    duration_ms: number;
    model: string;
    cache_hit: boolean;
  };
  component_selection?: {
    selection: SpecialistSelection;
    duration_ms: number;
    model: string;
    cache_hit: boolean;
  };
  substitution?: {
    spawner_duration_ms: number;
    task_duration_ms: number;
    model: string;
  };
  // Legacy fields (for backward compatibility if needed)
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
   * Create a new specialist adapter (async factory method)
   * Uses agency-prompt-creator's loadTemplate for inheritance and validation
   *
   * @param underlyingAdapter - The base adapter to wrap (AnthropicAdapter, OpenRouterAdapter, etc.)
   * @param templatePath - Path to specialist template or snapshot JSON5 file (relative to project root)
   * @returns Promise resolving to SpecialistAdapter instance
   * @throws Error if template file not found, invalid, or loading fails
   */
  static async create(
    underlyingAdapter: AgentAdapter,
    templatePath: string
  ): Promise<SpecialistAdapter> {
    try {
      // Resolve enriched template path first (before loading)
      const resolvedPath = SpecialistAdapter.resolveTemplatePathSync(templatePath);
      
      // Load template using agency-prompt-creator (handles inheritance)
      log.debug('[SpecialistAdapter] Loading template with agency-prompt-creator:', resolvedPath);
      let template: SpecialistTemplate;
      
      try {
        template = await loadTemplate(resolvedPath, {
          baseDir: process.cwd()
        });
      } catch (loadError) {
        if (loadError instanceof Error) {
          // Provide more context about template loading failures
          if (loadError.message.includes('not found') || loadError.message.includes('ENOENT')) {
            throw new Error(
              `Specialist template not found: ${templatePath}\n` +
              `  Resolved path: ${resolvedPath}\n` +
              `  Make sure the path is relative to project root and the file exists.`
            );
          }
          if (loadError.message.includes('circular') || loadError.message.includes('Circular')) {
            throw new Error(
              `Circular dependency detected in template inheritance: ${templatePath}\n` +
              `  ${loadError.message}`
            );
          }
          if (loadError.message.includes('Invalid template') || loadError.message.includes('validation')) {
            throw new Error(
              `Invalid specialist template: ${templatePath}\n` +
              `  ${loadError.message}\n` +
              `  Ensure the template follows the correct schema.`
            );
          }
          throw new Error(`Failed to load specialist template: ${loadError.message}`);
        }
        throw loadError;
      }

      // Validate loaded template has required fields
      if (!template.name || !template.prompts) {
        throw new Error(
          `Invalid specialist template: missing required fields 'name' or 'prompts'\n` +
          `  Template path: ${templatePath}\n` +
          `  Loaded template name: ${template.name || 'missing'}\n` +
          `  Has prompts: ${!!template.prompts}`
        );
      }

      log.debug('[SpecialistAdapter] Template loaded:', template.name, 'version:', template.version);
      log.debug('[SpecialistAdapter] Documentation entries:', template.documentation?.length || 0);
      
      // Debug: Log template prompts structure
      log.debug('[SpecialistAdapter] ========== TEMPLATE PROMPTS STRUCTURE ==========');
      log.debug('[SpecialistAdapter] Top-level prompt keys:', Object.keys(template.prompts || {}).join(', '));
      
      if (template.prompts) {
        // Log each task type
        for (const [key, value] of Object.entries(template.prompts)) {
          if (key === 'default' || key === 'model_specific' || key === 'prompt_strategy') {
            continue;
          }
          log.debug(`[SpecialistAdapter] Task type "${key}":`, {
            hasDefault: !!(value as any)?.default,
            hasModelSpecific: !!(value as any)?.model_specific,
            defaultKeys: (value as any)?.default ? Object.keys((value as any).default) : [],
            modelSpecificModels: (value as any)?.model_specific ? Object.keys((value as any).model_specific) : []
          });
          
          // Log model-specific structure for migration specifically
          if (key === 'migration' && (value as any)?.model_specific) {
            log.debug(`[SpecialistAdapter] Migration model_specific structure:`, JSON.stringify((value as any).model_specific, null, 2).substring(0, 1000));
          }
        }
      }
      log.debug('[SpecialistAdapter] ================================================');

      // Create instance with pre-loaded template
      return new SpecialistAdapter(underlyingAdapter, templatePath, template);
    } catch (error) {
      // Re-throw with additional context if not already enhanced
      if (error instanceof Error) {
        // Only add context if error message doesn't already include template path
        if (!error.message.includes(templatePath)) {
          throw new Error(
            `Failed to create SpecialistAdapter: ${error.message}\n` +
            `  Template path: ${templatePath}`
          );
        }
        throw error;
      }
      throw new Error(`Failed to create SpecialistAdapter: ${String(error)}`);
    }
  }

  /**
   * Create a new specialist adapter
   *
   * @param underlyingAdapter - The base adapter to wrap (AnthropicAdapter, OpenRouterAdapter, etc.)
   * @param templatePath - Path to specialist template or snapshot JSON5 file (relative to project root)
   * @param preLoadedTemplate - Optional pre-loaded template (for use by static create() method)
   */
  constructor(
    underlyingAdapter: AgentAdapter,
    templatePath: string,
    preLoadedTemplate?: SpecialistTemplate
  ) {
    this.underlyingAdapter = underlyingAdapter;
    this.templatePath = templatePath;
    
    // Use pre-loaded template if provided, otherwise fall back to sync loading (backward compatibility)
    if (preLoadedTemplate) {
      this.template = preLoadedTemplate;
    } else {
      // Fallback to sync loading for backward compatibility
      log.warn('[SpecialistAdapter] Using synchronous template loading (deprecated). Use SpecialistAdapter.create() for async loading with inheritance support.');
      this.template = this.loadTemplateSync(templatePath);
    }

    this.name = `specialist:${this.template.name}:${underlyingAdapter.name}`;

    // Validate template version and log warnings
    if (this.template.version_metadata) {
      const warnings = this.validateVersion();
      warnings.forEach(w => log.warn(`[SpecialistAdapter] ${w}`));
    }

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
   * Synchronous template loading (backward compatibility only)
   * Uses direct JSON5 parsing - does NOT support inheritance
   *
   * @param templatePath - Path to JSON5 template file
   * @returns Parsed specialist template
   * @throws Error if file not found or invalid JSON5
   * @deprecated Use SpecialistAdapter.create() for async loading with inheritance support
   */
  private loadTemplateSync(templatePath: string): SpecialistTemplate {
    try {
      log.debug('[SpecialistAdapter] Loading template synchronously (deprecated):', templatePath);

      // Resolve template path (automatically use enriched version if available)
      const resolvedPath = this.resolveTemplatePath(templatePath);

      const contents = readFileSync(resolvedPath, 'utf-8');
      const template = JSON5.parse(contents) as SpecialistTemplate;

      log.debug('[SpecialistAdapter] Template loaded:', template.name, 'version:', template.version);
      log.debug('[SpecialistAdapter] Documentation entries:', template.documentation?.length || 0);

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
   * Static version for use in factory method
   *
   * NEW STRUCTURE:
   * - Original: templates/nextjs-specialist-template.json5
   * - Enriched: templates/enriched/0.0.1/nextjs-specialist.enriched.001.json5
   *             templates/enriched/0.0.1/nextjs-specialist.enriched.002.json5
   *             ... (always use highest number)
   */
  private static resolveTemplatePathSync(templatePath: string): string {
    const absolutePath = resolve(process.cwd(), templatePath);

    // If path is already an enriched template, use it
    if (SpecialistAdapter.isEnrichedTemplatePath(absolutePath)) {
      log.debug(`[SpecialistAdapter] Using explicitly specified enriched template: ${absolutePath}`);
      return absolutePath;
    }

    // Try to find latest enriched version
    try {
      const contents = readFileSync(absolutePath, 'utf-8');
      const template = JSON5.parse(contents) as SpecialistTemplate;
      const latestEnrichedPath = SpecialistAdapter.getLatestEnrichedTemplatePath(absolutePath, template.version);

      if (latestEnrichedPath) {
        log.debug(`[SpecialistAdapter] Using enriched template: ${latestEnrichedPath}`);
        return latestEnrichedPath;
      } else {
        log.warn(`[SpecialistAdapter] No enriched template found for version ${template.version}`);
        log.warn(`[SpecialistAdapter] Expected location: ${SpecialistAdapter.getEnrichedDir(absolutePath, template.version)}`);
        log.warn(`[SpecialistAdapter] Using original template. Run enrichment to generate enriched template.`);
      }
    } catch (error) {
      // If we can't read the template, fall back to original path
      log.warn(`[SpecialistAdapter] Failed to check for enriched template:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return absolutePath;
  }

  /**
   * Resolve template path, automatically using latest enriched version if available
   * Instance method for backward compatibility
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
      log.debug(`[SpecialistAdapter] Using explicitly specified enriched template: ${absolutePath}`);
      return absolutePath;
    }

    // Try to find latest enriched version
    try {
      const contents = readFileSync(absolutePath, 'utf-8');
      const template = JSON5.parse(contents) as SpecialistTemplate;
      const latestEnrichedPath = this.getLatestEnrichedTemplatePath(absolutePath, template.version);

      if (latestEnrichedPath) {
        log.debug(`[SpecialistAdapter] Using enriched template: ${latestEnrichedPath}`);
        return latestEnrichedPath;
      } else {
        log.warn(`[SpecialistAdapter] No enriched template found for version ${template.version}`);
        log.warn(`[SpecialistAdapter] Expected location: ${this.getEnrichedDir(absolutePath, template.version)}`);
        log.warn(`[SpecialistAdapter] Using original template. Run enrichment to generate enriched template.`);
      }
    } catch (error) {
      // If we can't read the template, fall back to original path
      log.warn(`[SpecialistAdapter] Failed to check for enriched template:`, error instanceof Error ? error.message : 'Unknown error');
    }

    return absolutePath;
  }

  /**
   * Check if a path is an enriched template
   * NEW FORMAT: {specialist-name}.enriched.{number}.json5 or .jsonc
   */
  private static isEnrichedTemplatePath(path: string): boolean {
    return path.includes('/enriched/') && path.includes('.enriched.') && (path.endsWith('.json5') || path.endsWith('.jsonc'));
  }

  /**
   * Instance method for backward compatibility
   */
  private isEnrichedTemplatePath(path: string): boolean {
    return SpecialistAdapter.isEnrichedTemplatePath(path);
  }

  /**
   * Get enriched directory for a template version
   */
  private static getEnrichedDir(templatePath: string, version: string): string {
    const dir = dirname(templatePath);
    return join(dir, 'enriched', version);
  }

  /**
   * Instance method for backward compatibility
   */
  private getEnrichedDir(templatePath: string, version: string): string {
    return SpecialistAdapter.getEnrichedDir(templatePath, version);
  }

  /**
   * Get latest enriched template path for a given template path and version
   * Returns null if no enriched templates exist
   * 
   * NEW FORMAT: {specialist-name}.enriched.{number}.json5
   * e.g., nextjs-specialist.enriched.001.json5
   */
  private static getLatestEnrichedTemplatePath(templatePath: string, version: string): string | null {
    const enrichedDir = SpecialistAdapter.getEnrichedDir(templatePath, version);

    if (!existsSync(enrichedDir)) {
      return null;
    }

    try {
      // Extract specialist name from template path
      // e.g., templates/nextjs-specialist-template.json5 or .jsonc -> nextjs-specialist
      const templateBasename = templatePath.endsWith('.jsonc')
        ? basename(templatePath, '.jsonc')
        : basename(templatePath, '.json5');
      const specialistName = templateBasename.replace(/-template$/, '');
      
      // Escape special regex characters in specialist name
      const escapedName = specialistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);
      
      // Find all {specialist-name}.enriched.{number}.json5 files
      const files = readdirSync(enrichedDir);
      const enrichedFiles = files
        .filter(f => filePattern.test(f))
        .map(f => {
          const match = f.match(filePattern);
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
   * Instance method for backward compatibility
   */
  private getLatestEnrichedTemplatePath(templatePath: string, version: string): string | null {
    return SpecialistAdapter.getLatestEnrichedTemplatePath(templatePath, version);
  }

  /**
   * Send a request with specialist prompt transformation (NEW 3-STEP WORKFLOW)
   *
   * This method implements the new 3-step workflow:
   * - Step 3a: Extract intent using LLM
   * - Step 3b: Select components using LLM (spawner prompt, task prompt, docs)
   * - Step 3c: Create system prompt via LLM substitution + concatenation
   * - Step 3d: Submit original user prompt + system prompt
   *
   * @param request - Agent request with messages, tools, etc.
   * @returns Agent response from underlying adapter
   */
  async send(request: AgentRequest): Promise<AgentResponse> {
    try {
      // Check validation mode - passthrough if pre-exported prompts
      if (this.isValidationMode(request)) {
        log.debug('[SpecialistAdapter] Validation mode: using pre-exported system prompt');
        return this.underlyingAdapter.send(request);
      }

      // Extract user prompt - NEVER modified
      const userPrompt = this.extractUserPrompt(request);
      if (!userPrompt) {
        throw new Error('No user message found in request');
      }

      log.debug('[SpecialistAdapter] ========================================');
      log.debug('[SpecialistAdapter] Original user prompt:', userPrompt.substring(0, 200));
      log.debug('[SpecialistAdapter] ========================================');

      // Check if LLM features are enabled
      if (!this.llmConfig.enabled) {
        log.debug('[SpecialistAdapter] LLM features disabled, using static prompt creation');
        return this.sendWithStaticPrompt(request, userPrompt);
      }

      // Try LLM-based pipeline with fallback to static on failure
      try {
        // ========================================================================
        // STEP 3a: Extract Intent
        // ========================================================================
        log.debug('[SpecialistAdapter] Step 3a: Extracting intent...');
        const intentStart = Date.now();
        const intent = await this.extractIntentWithLLM(userPrompt);
        const intentDuration = Date.now() - intentStart;

      log.debug('[SpecialistAdapter] Step 3a - Extracted intent:');
      log.debug('  Intent:', intent.intent);
      log.debug('  Primary goal:', intent.primaryGoal);
      log.debug('  Keywords:', intent.keywords.join(', '));
      if (intent.framework) log.debug('  Framework:', intent.framework);
      if (intent.components) log.debug('  Components:', intent.components.join(', '));
      if (intent.packageManager) log.debug('  Package manager:', intent.packageManager);
      if (intent.features) log.debug('  Features:', intent.features.join(', '));
      log.debug('  Duration:', intentDuration, 'ms');

      // ========================================================================
      // STEP 3b: Select Specialist Components
      // ========================================================================
      log.debug('[SpecialistAdapter] Step 3b: Selecting specialist components...');
      const selectionStart = Date.now();
      const selection = await this.selectComponentsWithLLM(userPrompt, intent);
      const selectionDuration = Date.now() - selectionStart;

      log.debug('[SpecialistAdapter] Step 3b - Selected components:');
      log.debug('  Spawner prompt ID:', selection.spawnerPromptId);
      log.debug('  Task prompt ID:', selection.taskPromptId);
      log.debug('  Relevant tags:', selection.relevantTags.join(', '));
      log.debug('  Relevant tech stack:', selection.relevantTechStack.join(', '));
      log.debug('  Documentation count:', selection.documentation.length);
      if (selection.documentation.length > 0) {
        log.debug('  Documentation URLs:');
        selection.documentation.forEach(doc => log.debug('    -', doc.url));
      }
      log.debug('  Reasoning:', selection.reasoning);
      log.debug('  Duration:', selectionDuration, 'ms');

      // ========================================================================
      // STEP 3c: Create System Prompt
      // ========================================================================
      log.debug('[SpecialistAdapter] Step 3c: Creating system prompt...');
      const systemPrompt = await this.createSystemPrompt(userPrompt, intent, selection);

      log.debug('[SpecialistAdapter] Step 3c - System prompt created:');
      log.debug('  Length:', systemPrompt.length, 'characters');
      log.debug('  Contains CRITICAL marker:', systemPrompt.includes('⚠️ CRITICAL'));
      log.debug('  Contains documentation URLs:', systemPrompt.includes('http'));
      log.debug('  Preview (first 300 chars):', systemPrompt.substring(0, 300));

      // ========================================================================
      // STEP 3d: Submit to LLM
      // ========================================================================
      log.debug('[SpecialistAdapter] Step 3d: Submitting to LLM...');
      log.debug('  User prompt (ORIGINAL, UNCHANGED):', userPrompt.substring(0, 100));
      log.debug('  System prompt length:', systemPrompt.length);

      // Build request with:
      // - System prompt (from 3c)
      // - Original user prompt (UNCHANGED)
      const transformedMessages = this.injectSystemPrompt(request.messages, systemPrompt);
      const modifiedRequest: AgentRequest = {
        ...request,
        messages: transformedMessages
      };

      // Store for telemetry/debugging
      this.lastTransformedMessages = transformedMessages;
      this.llmTelemetry = {
        intent_extraction: {
          intent,
          duration_ms: intentDuration,
          model: this.llmConfig.extractionModel,
          cache_hit: false // TODO: track cache hits
        },
        component_selection: {
          selection,
          duration_ms: selectionDuration,
          model: this.llmConfig.selectionModel,
          cache_hit: false // TODO: track cache hits
        }
      };

      log.debug('[SpecialistAdapter] ========================================');
      log.debug('[SpecialistAdapter] Delegating to underlying adapter...');
      log.debug('[SpecialistAdapter] ========================================');

        return this.underlyingAdapter.send(modifiedRequest);
      } catch (llmError) {
        // LLM-based pipeline failed - try fallback to static prompt if enabled
        if (this.llmConfig.fallbackToStatic) {
          log.warn('[SpecialistAdapter] LLM pipeline failed, falling back to static prompt creation');
          log.warn('[SpecialistAdapter] LLM error:', llmError instanceof Error ? llmError.message : String(llmError));
          return this.sendWithStaticPrompt(request, userPrompt);
        }

        // No fallback enabled - re-throw with context
        if (llmError instanceof Error) {
          throw new Error(
            `SpecialistAdapter (${this.template.name}) LLM pipeline error: ${llmError.message}`
          );
        }
        throw llmError;
      }
    } catch (error) {
      // Outer catch for non-LLM errors
      if (error instanceof Error) {
        throw new Error(
          `SpecialistAdapter (${this.template.name}) error: ${error.message}`
        );
      }
      throw error;
    }
  }

  /**
   * Simple static prompt creation (fallback when LLM features disabled)
   * Uses agency-prompt-creator's createPrompt without LLM tool calling
   */
  private async sendWithStaticPrompt(request: AgentRequest, userPrompt: string): Promise<AgentResponse> {
    try {
      log.debug('[SpecialistAdapter] Using static prompt creation (no LLM tool calling)');

      // Use agency-prompt-creator's simple createPrompt
      const { createPrompt } = await import('agency-prompt-creator');

      const result = createPrompt(this.template, {
        userPrompt,
        model: this.getModelName(),
        context: this.buildTemplateContext(request)
      });

      log.debug('[SpecialistAdapter] Static prompt created:');
      log.debug('  Task type:', result.taskType);
      log.debug('  Used model-specific:', result.usedModelSpecific);
      log.debug('  Prompt length:', result.prompt.length);

      // Inject the generated prompt as system message
      const transformedMessages = this.injectSystemPrompt(request.messages, result.prompt);
      const modifiedRequest: AgentRequest = {
        ...request,
        messages: transformedMessages
      };

      // Send to underlying adapter
      return this.underlyingAdapter.send(modifiedRequest);
    } catch (error) {
      log.error('[SpecialistAdapter] Static prompt creation failed:', error);
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
  // NEW 3-STEP WORKFLOW METHODS
  // =========================================================================

  /**
   * Check if we're in validation mode (pre-exported prompts)
   */
  private isValidationMode(request: AgentRequest): boolean {
    const systemMessage = request.messages.find(m => m.role === 'system');

    return (
      systemMessage !== undefined &&
      systemMessage.content.includes('⚠️ CRITICAL: Required Documentation Reading') &&
      process.env.SPECIALIST_VALIDATION_MODE === 'true'
    );
  }

  /**
   * Step 3a: Extract intent using LLM
   */
  private async extractIntentWithLLM(userPrompt: string): Promise<ExtractedIntent> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const cacheKey = createCacheKey(userPrompt + ':intent');
    const cached = this.llmCache.get(cacheKey);
    if (cached) {
      log.debug('[SpecialistAdapter] Using cached intent extraction');
      return cached as ExtractedIntent;
    }

    const prompt = buildIntentExtractionPrompt(userPrompt);

    try {
      const response = await Promise.race([
        this.llmClient.chat.completions.create({
          model: this.llmConfig.extractionModel,
          messages: [{ role: 'user', content: prompt }],
          tools: [INTENT_EXTRACTION_TOOL as any],
          tool_choice: { type: 'function', function: { name: 'extract_intent' } } as any,
          temperature: 0.1
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Intent extraction timeout')), this.llmConfig.timeoutMs)
        )
      ]);

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('No tool call in intent extraction response');
      }

      const intent = parseIntentResponse(toolCall.function.arguments);
      this.llmCache.set(cacheKey, intent);
      return intent;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Intent extraction failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Step 3b: Select specialist components using LLM
   */
  private async selectComponentsWithLLM(
    userPrompt: string,
    intent: ExtractedIntent
  ): Promise<SpecialistSelection> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const cacheKey = createCacheKey(userPrompt + ':selection');
    const cached = this.llmCache.get(cacheKey);
    if (cached) {
      log.debug('[SpecialistAdapter] Using cached component selection');
      return cached as SpecialistSelection;
    }

    const prompt = buildComponentSelectionPrompt(userPrompt, intent, this.template);
    
    // Debug: Log what prompts are available for selection
    log.debug('[SpecialistAdapter] ========== COMPONENT SELECTION DEBUG ==========');
    log.debug('[SpecialistAdapter] Template prompts structure check:');
    log.debug('[SpecialistAdapter]   - Has prompts object:', !!this.template.prompts);
    log.debug('[SpecialistAdapter]   - Prompt keys:', Object.keys(this.template.prompts || {}).join(', '));
    
    // Check migration specifically
    const migrationPrompts = (this.template.prompts as any)?.migration;
    if (migrationPrompts) {
      log.debug('[SpecialistAdapter] Migration prompts found:');
      log.debug('[SpecialistAdapter]   - Has default:', !!migrationPrompts.default);
      log.debug('[SpecialistAdapter]   - Has model_specific:', !!migrationPrompts.model_specific);
      if (migrationPrompts.model_specific) {
        log.debug('[SpecialistAdapter]   - Model-specific models:', Object.keys(migrationPrompts.model_specific).join(', '));
        if (migrationPrompts.model_specific['claude-sonnet-4.5']) {
          log.debug('[SpecialistAdapter]   - claude-sonnet-4.5 keys:', Object.keys(migrationPrompts.model_specific['claude-sonnet-4.5']).join(', '));
          log.debug('[SpecialistAdapter]   - Has systemPrompt:', !!migrationPrompts.model_specific['claude-sonnet-4.5'].systemPrompt);
        } else {
          log.debug('[SpecialistAdapter]   - ⚠️ claude-sonnet-4.5 NOT FOUND in model_specific');
        }
      }
    } else {
      log.debug('[SpecialistAdapter] ⚠️ Migration prompts NOT FOUND in template');
    }
    log.debug('[SpecialistAdapter] ================================================');

    try {
      const response = await Promise.race([
        this.llmClient.chat.completions.create({
          model: this.llmConfig.selectionModel,
          messages: [{ role: 'user', content: prompt }],
          tools: [COMPONENT_SELECTION_TOOL as any],
          tool_choice: { type: 'function', function: { name: 'select_specialist_components' } } as any,
          temperature: 0.1
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Component selection timeout')), this.llmConfig.timeoutMs)
        )
      ]);

      const toolCall = response.choices[0]?.message?.tool_calls?.[0];
      if (!toolCall) {
        throw new Error('No tool call in component selection response');
      }

      // Debug: Log raw LLM response
      log.debug('[SpecialistAdapter] ========== LLM COMPONENT SELECTION RESPONSE ==========');
      log.debug('[SpecialistAdapter] Raw tool call arguments:', toolCall.function.arguments);
      try {
        const parsedArgs = typeof toolCall.function.arguments === 'string' 
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        log.debug('[SpecialistAdapter] Parsed taskPromptId:', parsedArgs.taskPromptId);
        log.debug('[SpecialistAdapter] Parsed spawnerPromptId:', parsedArgs.spawnerPromptId);
      } catch (e) {
        log.debug('[SpecialistAdapter] Could not parse tool call arguments');
      }
      log.debug('[SpecialistAdapter] =======================================================');
      
      const selection = parseComponentSelectionResponse(toolCall.function.arguments, this.template);
      
      // Debug: Log parsed selection
      log.debug('[SpecialistAdapter] ========== PARSED SELECTION ==========');
      log.debug('[SpecialistAdapter] Selection taskPromptId:', selection.taskPromptId);
      log.debug('[SpecialistAdapter] Selection spawnerPromptId:', selection.spawnerPromptId);
      log.debug('[SpecialistAdapter] ====================================');
      
      this.llmCache.set(cacheKey, selection);
      return selection;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Component selection failed: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Step 3c: Create system prompt via LLM substitution + concatenation
   */
  private async createSystemPrompt(
    userPrompt: string,
    intent: ExtractedIntent,
    selection: SpecialistSelection
  ): Promise<string> {
    log.debug('[SpecialistAdapter] ========== CREATING SYSTEM PROMPT ==========');
    log.debug('[SpecialistAdapter] Requested spawnerPromptId:', selection.spawnerPromptId);
    log.debug('[SpecialistAdapter] Requested taskPromptId:', selection.taskPromptId);
    
    // Debug: Log full template.prompts structure before lookup
    log.debug('[SpecialistAdapter] Full template.prompts keys:', Object.keys(this.template.prompts || {}).join(', '));
    
    // 1. Get spawner prompt content
    log.debug('[SpecialistAdapter] Looking up spawner prompt...');
    const spawnerPromptContent = this.getPromptById(selection.spawnerPromptId);
    if (!spawnerPromptContent) {
      log.error('[SpecialistAdapter] ❌ Spawner prompt lookup FAILED');
      throw new Error(`Spawner prompt not found: ${selection.spawnerPromptId}`);
    }
    log.debug('[SpecialistAdapter] ✓ Spawner prompt found, length:', spawnerPromptContent.length);

    // 2. Get task prompt content
    log.debug('[SpecialistAdapter] Looking up task prompt...');
    let taskPromptContent = this.getPromptById(selection.taskPromptId);
    if (!taskPromptContent) {
      log.debug('[SpecialistAdapter] ⚠️ Task prompt not found on first attempt');
      // Try to fallback to default if model-specific not found
      const parts = selection.taskPromptId.split('.');
      log.debug('[SpecialistAdapter] Task prompt ID parts:', parts);
      if (parts.length >= 4 && parts[1] === 'model_specific') {
        // Try default version: "migration.model_specific.claude-sonnet-4.5.systemPrompt" -> "migration.default.systemPrompt"
        const fallbackId = `${parts[0]}.default.${parts[3]}`;
        log.debug(`[SpecialistAdapter] Trying fallback: ${fallbackId}`);
        taskPromptContent = this.getPromptById(fallbackId);
        if (taskPromptContent) {
          log.debug('[SpecialistAdapter] ✓ Fallback prompt found');
        } else {
          log.debug('[SpecialistAdapter] ❌ Fallback prompt also not found');
        }
      }
      
      if (!taskPromptContent) {
        // Final debug: Log the exact structure we're looking for
        log.debug('[SpecialistAdapter] ========== FINAL DEBUG: TEMPLATE STRUCTURE ==========');
        const taskType = parts[0];
        const modelKey = parts.length >= 3 ? parts[2] : 'N/A';
        const promptKey = parts.length >= 4 ? parts[3] : 'N/A';
        log.debug('[SpecialistAdapter] Looking for:', { taskType, modelKey, promptKey });
        
        const taskPrompts = (this.template.prompts as any)?.[taskType];
        log.debug('[SpecialistAdapter] Task prompts exists:', !!taskPrompts);
        if (taskPrompts) {
          log.debug('[SpecialistAdapter] Task prompts keys:', Object.keys(taskPrompts).join(', '));
          log.debug('[SpecialistAdapter] Has model_specific:', !!taskPrompts.model_specific);
          if (taskPrompts.model_specific) {
            log.debug('[SpecialistAdapter] Model-specific keys:', Object.keys(taskPrompts.model_specific).join(', '));
            if (taskPrompts.model_specific[modelKey]) {
              log.debug('[SpecialistAdapter] Model key exists, its keys:', Object.keys(taskPrompts.model_specific[modelKey]).join(', '));
            } else {
              log.debug('[SpecialistAdapter] Model key does not exist');
            }
          }
        }
        log.debug('[SpecialistAdapter] ====================================================');
        
        throw new Error(`Task prompt not found: ${selection.taskPromptId} (also tried fallback)`);
      }
    } else {
      log.debug('[SpecialistAdapter] ✓ Task prompt found, length:', taskPromptContent.length);
    }
    log.debug('[SpecialistAdapter] ===========================================');

    // 3. Build context for substitution
    const context = {
      name: this.template.name,
      version: this.template.version,
      specialistName: this.template.name,
      framework: intent.framework,
      packageManager: intent.packageManager,
      techStack: selection.relevantTechStack.join(', '),
      tags: selection.relevantTags.join(', '),
      components: intent.components?.join(', '),
      features: intent.features?.join(', '),
      ...selection
    };

    // 4. LLM-based substitution on spawner prompt
    const spawnerStart = Date.now();
    const substitutedSpawner = await substituteWithLLM(
      this.llmClient!,
      this.llmConfig.extractionModel,
      spawnerPromptContent,
      userPrompt,
      intent,
      context
    );
    const spawnerDuration = Date.now() - spawnerStart;

    log.debug('[SpecialistAdapter] Step 3c - Spawner prompt substituted:');
    log.debug('  Original length:', spawnerPromptContent.length);
    log.debug('  Substituted length:', substitutedSpawner.length);
    log.debug('  Duration:', spawnerDuration, 'ms');

    // 5. LLM-based substitution on task prompt
    const taskStart = Date.now();
    const substitutedTask = await substituteWithLLM(
      this.llmClient!,
      this.llmConfig.extractionModel,
      taskPromptContent,
      userPrompt,
      intent,
      context
    );
    const taskDuration = Date.now() - taskStart;

    log.debug('[SpecialistAdapter] Step 3c - Task prompt substituted:');
    log.debug('  Original length:', taskPromptContent.length);
    log.debug('  Substituted length:', substitutedTask.length);
    log.debug('  Duration:', taskDuration, 'ms');

    // Store substitution telemetry
    if (this.llmTelemetry.substitution) {
      this.llmTelemetry.substitution.spawner_duration_ms = spawnerDuration;
      this.llmTelemetry.substitution.task_duration_ms = taskDuration;
    } else {
      this.llmTelemetry.substitution = {
        spawner_duration_ms: spawnerDuration,
        task_duration_ms: taskDuration,
        model: this.llmConfig.extractionModel
      };
    }

    // 6. Format documentation section with CRITICAL marker
    const docSection = this.formatDocumentationSection(selection.documentation);

    log.debug('[SpecialistAdapter] Step 3c - Documentation section formatted:');
    log.debug('  Documentation section length:', docSection.length);
    log.debug('  Has CRITICAL marker:', docSection.includes('⚠️ CRITICAL'));

    // 7. String concatenation ONLY - no interpretation
    const systemPrompt = [
      substitutedSpawner,
      '',
      substitutedTask,
      '',
      docSection
    ].join('\n');

    return systemPrompt;
  }

  /**
   * Format documentation section with CRITICAL marker
   */
  private formatDocumentationSection(docs: DocumentationReference[]): string {
    if (docs.length === 0) {
      return '';
    }

    let section = '\n## ⚠️ CRITICAL: Required Documentation Reading\n\n';
    section += '**YOU MUST START BY USING THE WEB FETCH TOOL TO READ THESE DOCUMENTATION PAGES BEFORE PROCEEDING WITH ANY IMPLEMENTATION.**\n\n';
    section += 'These documentation pages contain essential patterns and configurations that you must follow exactly.\n\n';

    for (const doc of docs) {
      section += `### ${doc.title}\n\n`;
      section += `**📄 Documentation URL**: ${doc.url}\n`;
      section += `**YOU MUST READ THIS PAGE FIRST**\n\n`;
      section += `**Summary**: ${doc.summary}\n\n`;

      if (doc.keyConcepts.length > 0) {
        section += `**Key Concepts**: ${doc.keyConcepts.join(', ')}\n\n`;
      }

      if (doc.codePatterns.length > 0) {
        section += '**Code Patterns from Documentation**:\n';
        for (const pattern of doc.codePatterns) {
          section += `- \`${pattern}\`\n`;
        }
        section += '\n';
      }

      section += '---\n\n';
    }

    return section;
  }

  /**
   * Validate template version and return warnings
   */
  private validateVersion(): string[] {
    const warnings: string[] = [];
    const metadata = this.template.version_metadata;

    if (!metadata) return warnings;

    if (metadata.deprecated) {
      warnings.push(
        `Template ${this.template.name} v${this.template.version} is deprecated`
      );
      if (metadata.replacement) {
        warnings.push(`Consider migrating to: ${metadata.replacement}`);
      }
    }

    if (metadata.breaking_changes && metadata.breaking_changes.length > 0) {
      const recent = metadata.breaking_changes.slice(0, 3);
      warnings.push(
        `Breaking changes detected:\n` +
        recent.map((bc: any) => `   - ${bc.description}`).join('\n')
      );
    }

    return warnings;
  }

  // =========================================================================
  // LLM-POWERED PROMPT SELECTION AND VARIABLE EXTRACTION (LEGACY)
  // =========================================================================

  /**
   * Load LLM configuration from template and environment variables
   */
  private loadLLMConfig(): LLMConfig {
    // Check template llm_config
    const templateConfig = (this.template as any).llm_config;

    // Allow disabling LLM features via environment or template
    const enabled = process.env.SPECIALIST_LLM_ENABLED !== 'false' && (templateConfig?.enabled ?? true);

    return {
      enabled,
      provider: templateConfig?.provider || 'openrouter',
      selectionModel: process.env.LLM_SELECTION_MODEL || templateConfig?.selection_model || 'anthropic/claude-3.5-haiku',
      extractionModel: process.env.LLM_EXTRACTION_MODEL || templateConfig?.extraction_model || 'anthropic/claude-3.5-haiku',
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
        log.warn('[SpecialistAdapter] LLM selection enabled but OPENROUTER_API_KEY not found, disabling LLM selection');
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
        log.warn('[SpecialistAdapter] LLM selection enabled but ANTHROPIC_API_KEY not found, disabling LLM selection');
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
    log.debug('[SpecialistAdapter] Phase 1: Selecting prompt template');

    const selectionStart = Date.now();
    let selectionResult: PromptSelectionResult;
    let selectionCacheHit = false;

    const cachedSelection = this.llmCache.getSelection(cacheKey);
    if (cachedSelection) {
      selectionResult = cachedSelection;
      selectionCacheHit = true;
      log.debug('  Using cached selection');
    } else {
      selectionResult = await this.selectPromptWithLLM(userPrompt, model);
      this.llmCache.setSelection(cacheKey, selectionResult);
      log.debug('  LLM selected prompt');
    }

    log.debug('  Selected prompt ID:', selectionResult.selectedPromptId);
    log.debug('  Confidence:', selectionResult.confidence);
    log.debug('  Reasoning:', selectionResult.reasoning);

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

    log.debug('[SpecialistAdapter] Phase 4: Building context');
    log.debug('  Task type:', taskType);
    log.debug('  Extracted variables:', Object.keys(defaultedVars));

    // Build base context from request
    const baseContext = request ? this.buildTemplateContext(request) : {
      workspaceDir: undefined,
      hasTools: false,
      toolCount: 0
    };

    log.debug('  Base context:', Object.keys(baseContext));

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

    log.debug('  Template context keys:', Object.keys(templateContext));
    log.debug('  Documentation in context:', templateContext.documentation?.length || 0);
    if (templateContext.documentation && templateContext.documentation.length > 0) {
      log.debug('  Documentation entries:', templateContext.documentation.map((d: any) => d.title));
    }

    // Phase 5: Append documentation section if available
    const promptWithDocs = this.appendDocumentationSection(templateContent, templateContext);

    log.debug('[SpecialistAdapter] Phase 5: Appended documentation section');
    log.debug('  Template length before:', templateContent.length);
    log.debug('  Template length after:', promptWithDocs.length);
    log.debug('  Documentation section added:', promptWithDocs.length > templateContent.length);

    // Phase 6: Substitute and return
    const finalPrompt = substituteTemplate(promptWithDocs, templateContext);

    log.debug('[SpecialistAdapter] Phase 6: Final prompt generated');
    log.debug('  Final prompt length:', finalPrompt.length);
    log.debug('  Contains "Relevant Documentation":', finalPrompt.includes('Relevant Documentation'));

    return finalPrompt;
  }

  /**
   * Select best prompt using LLM
   */
  private async selectPromptWithLLM(userPrompt: string, model?: string): Promise<PromptSelectionResult> {
    if (!this.llmClient) {
      throw new Error('LLM client not initialized');
    }

    const prompt = buildPromptSelectionPrompt(userPrompt, this.template.prompts, model);

    log.debug('[SpecialistAdapter] Prompt selection LLM prompt (first 500 chars):');
    log.debug(prompt.substring(0, 500) + '...');

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
        log.warn('[SpecialistAdapter] No tool calls in extraction response, returning empty variables');
        return {};
      }

      const extracted = parseToolCallResponse(toolCalls[0].function);
      return validateExtractedVariables(extracted);
    } catch (error) {
      if (error instanceof Error) {
        log.warn(`[SpecialistAdapter] LLM variable extraction failed: ${error.message}`);
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

    log.warn(`[SpecialistAdapter] Unknown task type "${taskType}" in prompt ID "${promptId}", using "default"`);
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
    log.debug(`[SpecialistAdapter] getPromptById called with: "${promptId}"`);
    const parts = promptId.split('.');
    log.debug(`[SpecialistAdapter] Split into ${parts.length} parts:`, parts);

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
    // NOTE: Model names can contain dots (e.g., "claude-sonnet-4.5"), so we can't just split by "."
    // Format: <taskType>.model_specific.<modelName>.<promptKey>
    // We need to extract: taskType, "model_specific" (constant), modelName (can have dots), promptKey
    if (parts.length >= 4 && parts[1] === 'model_specific') {
      const taskType = parts[0];
      
      // Model name is everything between "model_specific" and the last part (promptKey)
      // So if we have: ["migration", "model_specific", "claude-sonnet-4", "5", "systemPrompt"]
      // We need: modelKey = "claude-sonnet-4.5" (parts[2] + "." + parts[3] + ... + parts[length-2])
      // And: promptKey = "systemPrompt" (last part)
      const modelKeyParts = parts.slice(2, -1); // Everything except first 2 and last 1
      const modelKey = modelKeyParts.join('.'); // Rejoin with dots to handle model names like "claude-sonnet-4.5"
      const promptKey = parts[parts.length - 1]; // Last part is always the prompt key
      
      const taskPrompts = (this.template.prompts as any)[taskType];
      
      log.debug(`[SpecialistAdapter] Looking for prompt: ${promptId}`);
      log.debug(`[SpecialistAdapter] Parsed: taskType="${taskType}", modelKey="${modelKey}", promptKey="${promptKey}"`);
      log.debug(`[SpecialistAdapter] Task prompts exists: ${!!taskPrompts}`);
      
      if (!taskPrompts) {
        const availableTasks = Object.keys(this.template.prompts || {}).filter(k => k !== 'default' && k !== 'model_specific' && k !== 'prompt_strategy');
        log.debug(`[SpecialistAdapter] Task type "${taskType}" not found in template. Available tasks: ${availableTasks.join(', ')}`);
        log.debug(`[SpecialistAdapter] All prompt keys: ${Object.keys(this.template.prompts || {}).join(', ')}`);
        return null;
      }
      
      log.debug(`[SpecialistAdapter] Task prompts structure:`, {
        hasDefault: !!taskPrompts.default,
        hasModelSpecific: !!taskPrompts.model_specific,
        defaultKeys: taskPrompts.default ? Object.keys(taskPrompts.default) : [],
        modelSpecificKeys: taskPrompts.model_specific ? Object.keys(taskPrompts.model_specific) : []
      });
      
      // Try model-specific first
      const modelSpecificPrompt = taskPrompts?.model_specific?.[modelKey]?.[promptKey];
      log.debug(`[SpecialistAdapter] Model-specific prompt lookup: taskPrompts.model_specific["${modelKey}"]["${promptKey}"] = ${modelSpecificPrompt ? 'FOUND' : 'NOT FOUND'}`);
      
      if (modelSpecificPrompt) {
        log.debug(`[SpecialistAdapter] ✓ Found model-specific prompt: ${promptId}`);
        return modelSpecificPrompt;
      }
      
      // Debug: Log what models are available
      if (taskPrompts.model_specific) {
        const availableModels = Object.keys(taskPrompts.model_specific);
        log.debug(`[SpecialistAdapter] Model "${modelKey}" not found in model_specific. Available models: ${availableModels.join(', ')}`);
        log.debug(`[SpecialistAdapter] Full model_specific structure:`, JSON.stringify(taskPrompts.model_specific, null, 2).substring(0, 500));
      } else {
        log.debug(`[SpecialistAdapter] No model_specific section found for task "${taskType}"`);
        log.debug(`[SpecialistAdapter] Task prompts keys: ${Object.keys(taskPrompts).join(', ')}`);
      }
      
      // Fallback to default if model-specific not found
      const defaultPrompt = taskPrompts?.default?.[promptKey];
      if (defaultPrompt) {
        log.debug(`[SpecialistAdapter] Model-specific prompt not found for ${promptId}, falling back to default`);
        return defaultPrompt;
      }
      
      log.debug(`[SpecialistAdapter] Default prompt also not found. Available keys in default: ${taskPrompts.default ? Object.keys(taskPrompts.default).join(', ') : 'none'}`);
      return null;
    }

    return null;
  }
}
