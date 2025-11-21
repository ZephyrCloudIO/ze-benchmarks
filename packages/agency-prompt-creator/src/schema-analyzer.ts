/**
 * Zod schema for Specialist Template JSON5 files
 * Provides runtime validation and type inference for template structures
 */

import { z } from 'zod';
import json5 from 'json5';
import { readFile } from 'fs/promises';
import { logger } from '@ze/logger';

const log = logger.schemaAnalyzer;

/**
 * Zod schema for Documentation Entry enrichment
 */
const DocumentationEnrichmentSchema = z.object({
  summary: z.string(),
  key_concepts: z.array(z.string()),
  relevant_for_tasks: z.array(z.string()),
  relevant_tech_stack: z.array(z.string()),
  relevant_tags: z.array(z.string()),
  code_patterns: z.array(z.string()),
  last_enriched: z.string(),
  enrichment_model: z.string(),
}).passthrough(); // Allow extra fields

/**
 * Zod schema for Documentation Entry
 */
const DocumentationEntrySchema = z.object({
  type: z.enum(['official', 'reference', 'recipes', 'examples', 'control']),
  url: z.string().url().optional(),
  path: z.string().optional(),
  description: z.string(),
  enrichment: DocumentationEnrichmentSchema.optional(),
}).passthrough();

/**
 * Zod schema for Preferred Model
 */
const PreferredModelSchema = z.object({
  model: z.string(),
  weight: z.number().optional(),
  benchmarks: z.record(z.string(), z.number()).optional(),
}).passthrough();

/**
 * Zod schema for Maintainer
 */
const MaintainerSchema = z.object({
  name: z.string(),
  email: z.string().email().optional(),
}).passthrough();

/**
 * Zod schema for MCP (Model Context Protocol) entry
 */
const MCPSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  permissions: z.array(z.string()).optional(),
  description: z.string().optional(),
  required: z.boolean().optional(),
}).passthrough();

/**
 * Zod schema for Dependencies section
 */
const DependenciesSchema = z.object({
  subscription: z.object({
    required: z.boolean().optional(),
    purpose: z.string().optional(),
  }).passthrough().optional(),
  available_tools: z.array(z.string()).optional(),
  mcps: z.array(MCPSchema).optional(),
}).passthrough();

/**
 * Zod schema for Persona
 * Flexible to allow any additional fields
 */
const PersonaSchema = z.object({
  purpose: z.string(),
  values: z.array(z.string()).optional(),
  attributes: z.array(z.string()).optional(),
  tech_stack: z.array(z.string()).optional(),
}).passthrough(); // Allow extra fields like displayName, etc.

/**
 * Zod schema for Capabilities
 */
const CapabilitiesSchema = z.object({
  tags: z.array(z.string()),
  descriptions: z.record(z.string(), z.string()).optional(),
  considerations: z.array(z.string()).optional(),
}).passthrough(); // Allow extra fields

/**
 * Zod schema for Prompt Config
 * Can contain any string keys (spawnerPrompt, systemPrompt, task-specific prompts, etc.)
 */
const PromptConfigSchema = z.record(z.string(), z.any());

/**
 * Zod schema for Prompts structure
 * Supports:
 * - default: PromptConfig
 * - model_specific: Record<string, PromptConfig>
 * - task-specific: Record<string, PromptConfig | Record<string, PromptConfig>>
 * - prompt_strategy: configuration object
 */
const PromptsSchema = z.object({
  default: PromptConfigSchema.optional(),
  model_specific: z.record(z.string(), PromptConfigSchema).optional(),
  prompt_strategy: z.object({
    fallback: z.string().optional(),
    model_detection: z.string().optional(),
    allow_override: z.boolean().optional(),
    interpolation: z.object({
      style: z.string().optional(),
      escape_html: z.boolean().optional(),
    }).passthrough().optional(),
  }).passthrough().optional(),
}).passthrough(); // Allow task-specific prompts and other fields

/**
 * Zod schema for Task Detection configuration
 * Allows templates to define custom task types and detection patterns
 * Patterns can be:
 * - Simple strings like "add.*component" (automatically converted to regex)
 * - Full regex strings like "/add.*component/i" (parsed as regex)
 */
const TaskDetectionSchema = z.object({
  patterns: z.record(
    z.string(), // Task type name
    z.array(z.string()) // Pattern strings (converted to RegExp internally)
  ).optional(),
  priority: z.array(z.string()).optional(), // Order to check task types
}).passthrough().optional();

/**
 * Main Specialist Template Schema
 * This is the complete schema for a JSON5 template file
 */
export const SpecialistTemplateSchema = z.object({
  // Inheritance
  from: z.string().optional(),

  // Identity
  name: z.string(),
  displayName: z.string().optional(),
  version: z.string(),
  schema_version: z.string().optional(),
  license: z.string().optional(),
  availability: z.string().optional(),
  maintainers: z.array(MaintainerSchema).optional(),

  // Specialist definition (required)
  persona: PersonaSchema,
  capabilities: CapabilitiesSchema,
  prompts: PromptsSchema,

  // Task detection configuration (optional)
  task_detection: TaskDetectionSchema,

  // Optional sections
  preferred_models: z.array(PreferredModelSchema).optional(),
  documentation: z.array(DocumentationEntrySchema).optional(),
  dependencies: DependenciesSchema.optional(),
  spawnable_sub_agent_specialists: z.array(z.string()).optional(),

  // Allow any additional metadata fields
}).passthrough();

/**
 * Infer TypeScript type from Zod schema
 */
export type SpecialistTemplate = z.infer<typeof SpecialistTemplateSchema>;

/**
 * Read and validate a JSON5 template file
 * 
 * @param filePath Path to the JSON5 template file
 * @returns Validated and parsed template
 * @throws ZodError if validation fails
 */
export async function readAndValidateTemplate(
  filePath: string
): Promise<SpecialistTemplate> {
    try {
      const fileContent = await readFile(filePath, 'utf8');
    const parsedData = json5.parse(fileContent);
    
    // Validate against schema
    return SpecialistTemplateSchema.parse(parsedData);
    } catch (error) {
    if (error instanceof z.ZodError) {
      log.error(`Validation error in ${filePath}:`);
      log.error(JSON.stringify(error.errors, null, 2));
      throw new Error(`Template validation failed: ${error.message}`);
    }
    log.error(`Error reading or parsing JSON5 file at ${filePath}:`, error);
    throw error;
  }
}

/**
 * Safely parse a template (returns result instead of throwing)
 * Useful for validation without error handling
 */
export async function safeReadTemplate(
  filePath: string
): Promise<{ success: true; data: SpecialistTemplate } | { success: false; error: z.ZodError }> {
  try {
    const fileContent = await readFile(filePath, 'utf8');
    const parsedData = json5.parse(fileContent);
    const result = SpecialistTemplateSchema.safeParse(parsedData);
    
    if (result.success) {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    // Wrap non-Zod errors in a ZodError-like structure
    const zodError = new z.ZodError([
      {
        code: 'custom',
        path: [],
        message: error instanceof Error ? error.message : String(error),
      },
    ]);
    return { success: false, error: zodError };
  }
}
