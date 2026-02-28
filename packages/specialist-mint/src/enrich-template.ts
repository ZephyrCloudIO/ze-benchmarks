/**
 * Template Enrichment Engine
 *
 * Automatically analyzes documentation resources using LLM and enriches them with:
 * - Comprehensive summaries
 * - Key concepts and patterns
 * - Task type relevance
 * - Tech stack mappings
 * - Capability tag associations
 * - Code patterns/examples
 */

import chalk from 'chalk';
import type { SpecialistTemplate, DocumentationEnrichment } from './types.js';
import { loadJSON5, writeJSON5 } from './utils.js';
import { logger } from '@ze/logger';
import { bumpVersion, updateVersionMetadata } from './version-manager.js';

const log = logger.enrichTemplate;
import { createLLMClient, type LLMProvider } from './llm-client.js';
import { fetchDocumentation } from './doc-fetcher.js';
import { resolve, dirname, basename, join } from 'path';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import type { OpenAI } from 'openai';

/**
 * Documentation entry type
 */
type DocumentationEntry = NonNullable<SpecialistTemplate['documentation']>[number];

export interface EnrichmentOptions {
  /**
   * LLM provider to use for enrichment
   * @default 'openrouter'
   */
  provider?: LLMProvider;

  /**
   * Model to use for enrichment
   * @default 'anthropic/claude-3.5-haiku' (fast and cost-effective)
   */
  model?: string;

  /**
   * Force re-enrichment even if already enriched
   * @default false
   */
  force?: boolean;

  /**
   * Timeout for each document enrichment in ms
   * @default 30000 (30 seconds)
   */
  timeoutMs?: number;

  /**
   * Maximum number of documents to enrich concurrently
   * @default 3
   */
  concurrency?: number;
}

export interface EnrichmentResult {
  enrichedTemplatePath: string;
  documentsEnriched: number;
  documentsSkipped: number;
  errors: Array<{ index: number; error: string }>;
}

/**
 * Find the latest enriched template for a given base template
 * Returns the path to the latest enriched version, or null if none exists
 */
function findLatestEnrichedTemplate(baseTemplatePath: string, specialistName: string): string | null {
  const dir = dirname(baseTemplatePath);
  const enrichedBaseDir = join(dir, 'enriched');

  // Check if enriched directory exists
  if (!existsSync(enrichedBaseDir)) {
    return null;
  }

  // Find all version directories (e.g., 0.0.1, 0.0.2, 0.0.3)
  const versionDirs = readdirSync(enrichedBaseDir)
    .filter(entry => {
      const fullPath = join(enrichedBaseDir, entry);
      return existsSync(fullPath) && readdirSync(fullPath).length > 0;
    })
    .filter(entry => /^\d+\.\d+\.\d+$/.test(entry)) // Match semantic version pattern
    .sort((a, b) => {
      // Sort versions semantically
      const aParts = a.split('.').map(Number);
      const bParts = b.split('.').map(Number);
      for (let i = 0; i < 3; i++) {
        if (aParts[i] !== bParts[i]) {
          return aParts[i] - bParts[i];
        }
      }
      return 0;
    });

  if (versionDirs.length === 0) {
    return null;
  }

  // Get the highest version
  const latestVersion = versionDirs[versionDirs.length - 1];
  const latestVersionDir = join(enrichedBaseDir, latestVersion);

  // Find the latest enriched file in that version directory
  const escapedName = specialistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);

  const files = readdirSync(latestVersionDir);
  const enrichedFiles = files
    .filter(f => filePattern.test(f))
    .map(f => {
      const match = f.match(filePattern);
      return { file: f, number: match ? parseInt(match[1], 10) : 0 };
    })
    .filter(f => f.number > 0)
    .sort((a, b) => b.number - a.number); // Sort descending

  if (enrichedFiles.length === 0) {
    return null;
  }

  // Return the latest enriched file path
  return join(latestVersionDir, enrichedFiles[0].file);
}

/**
 * Main enrichment function
 *
 * Analyzes documentation resources in a template and creates an enriched version
 * with LLM-generated metadata for intelligent documentation injection.
 */
export async function enrichTemplate(
  templatePath: string,
  options: EnrichmentOptions = {}
): Promise<EnrichmentResult> {
  const {
    provider = 'openrouter',
    model = process.env.ENRICHMENT_MODEL || 'anthropic/claude-3.5-haiku',
    force = false,
    timeoutMs = 30000,
    concurrency = 3
  } = options;

  log.debug(chalk.blue('🔍 Starting template enrichment...'));
  log.debug(chalk.gray(`   Provider: ${provider}`));
  log.debug(chalk.gray(`   Model: ${model}`));

  // Resolve base template path
  const resolvedTemplatePath = resolve(process.cwd(), templatePath);

  // Extract specialist name from template path
  // e.g., templates/nextjs-specialist-template.json5 or .jsonc -> nextjs-specialist
  const templateBasename = resolvedTemplatePath.endsWith('.jsonc')
    ? basename(resolvedTemplatePath, '.jsonc')
    : basename(resolvedTemplatePath, '.json5');
  const specialistName = templateBasename.replace(/-template$/, '');

  // Try to find the latest enriched template
  const latestEnrichedPath = findLatestEnrichedTemplate(resolvedTemplatePath, specialistName);

  // Load from latest enriched version if it exists, otherwise use base template
  let templateSourcePath: string;
  let isFirstEnrichment: boolean;

  if (latestEnrichedPath) {
    templateSourcePath = latestEnrichedPath;
    isFirstEnrichment = false;
    log.info(chalk.cyan(`📂 Using latest enriched template: ${basename(dirname(latestEnrichedPath))}/${basename(latestEnrichedPath)}`));
  } else {
    templateSourcePath = resolvedTemplatePath;
    isFirstEnrichment = true;
    log.info(chalk.cyan(`📂 Using base template (first enrichment)`));
  }

  // Load template
  const template: SpecialistTemplate = loadJSON5(templateSourcePath);

  // Auto-bump version for enrichment
  const oldVersion = template.version;
  const newVersion = bumpVersion(oldVersion, 'patch');

  log.debug(chalk.gray(`   Template: ${template.name} v${oldVersion}`));
  log.info(chalk.blue(`📦 Bumping version: ${oldVersion} → ${newVersion}`));

  // Always generate new enriched template with incremented number
  const enrichedPath = getNextEnrichedTemplatePath(resolvedTemplatePath, newVersion, specialistName);
  log.debug(chalk.gray(`   Output: ${enrichedPath}`));

  // Initialize LLM client
  const llmClient = createLLMClient(provider);
  if (!llmClient) {
    throw new Error(`Failed to initialize LLM client for provider: ${provider}`);
  }

  log.debug(chalk.green('   ✓ LLM client initialized'));

  // Enrich documentation
  const documentation = template.documentation || [];
  log.debug(chalk.blue(`\n📚 Enriching ${documentation.length} documentation resources...`));

  const errors: Array<{ index: number; error: string }> = [];
  let enriched = 0;
  let skipped = 0;

  // Process in batches to respect concurrency
  for (let i = 0; i < documentation.length; i += concurrency) {
    const batch = documentation.slice(i, i + concurrency);
    const batchPromises = batch.map(async (doc, batchIndex) => {
      const index = i + batchIndex;

      // Skip if already enriched and not forcing
      if (!force && doc.enrichment) {
        log.debug(chalk.gray(`   [${index + 1}/${documentation.length}] Skipping (already enriched): ${doc.description}`));
        skipped++;
        return doc;
      }

      try {
        log.debug(chalk.gray(`   [${index + 1}/${documentation.length}] Enriching: ${doc.description}`));

        const enrichment = await enrichDocument(
          doc,
          template,
          llmClient,
          model,
          timeoutMs
        );

        enriched++;
        log.debug(chalk.green(`   [${index + 1}/${documentation.length}] ✓ Enriched: ${doc.description}`));

        return {
          ...doc,
          enrichment
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        errors.push({ index, error: errorMessage });
        log.debug(chalk.red(`   [${index + 1}/${documentation.length}] ✗ Failed: ${errorMessage}`));

        // Return original doc without enrichment
        return doc;
      }
    });

    // Wait for batch to complete
    const enrichedBatch = await Promise.all(batchPromises);

    // Update documentation array
    enrichedBatch.forEach((enrichedDoc, batchIndex) => {
      documentation[i + batchIndex] = enrichedDoc;
    });
  }

  // Create enriched template with updated version and metadata
  const enrichedTemplate: SpecialistTemplate = {
    ...template,
    version: newVersion,
    documentation,
    version_metadata: updateVersionMetadata(template.version_metadata, {
      oldVersion,
      newVersion,
      type: 'patch',
      changes: [{
        category: 'enrichment',
        description: `Enriched ${enriched} documentation resource${enriched !== 1 ? 's' : ''}`,
        breaking: false
      }]
    })
  };

  // Write enriched template
  log.debug(chalk.blue('\n💾 Writing enriched template...'));
  writeJSON5(enrichedPath, enrichedTemplate);
  log.debug(chalk.green(`   ✓ Enriched template saved to: ${enrichedPath}`));

  // Summary
  log.debug(chalk.blue('\n📊 Enrichment Summary:'));
  log.debug(chalk.gray(`   Documents enriched: ${enriched}`));
  log.debug(chalk.gray(`   Documents skipped: ${skipped}`));
  log.debug(chalk.gray(`   Errors: ${errors.length}`));

  if (errors.length > 0) {
    log.debug(chalk.yellow('\n⚠️  Errors occurred:'));
    errors.forEach(({ index, error }) => {
      log.debug(chalk.yellow(`   [${index + 1}] ${error}`));
    });
  }

  return {
    enrichedTemplatePath: enrichedPath,
    documentsEnriched: enriched,
    documentsSkipped: skipped,
    errors
  };
}

/**
 * Enrich a single documentation resource
 */
async function enrichDocument(
  doc: DocumentationEntry,
  template: SpecialistTemplate,
  llmClient: OpenAI,
  model: string,
  timeoutMs: number
): Promise<DocumentationEnrichment> {
  // Fetch documentation content
  const content = await fetchDocumentation(doc);

  // Build enrichment prompt
  const prompt = buildEnrichmentPrompt(doc, content, template);

  // Call LLM
  const response = await Promise.race([
    llmClient.chat.completions.create({
      model: model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 2000
    }),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Enrichment timeout')), timeoutMs)
    )
  ]);

  const responseContent = response.choices[0]?.message?.content;
  if (!responseContent) {
    throw new Error('No content in LLM response');
  }

  // Parse response
  return parseEnrichmentResponse(responseContent, model);
}

/**
 * Build enrichment prompt for LLM
 */
function buildEnrichmentPrompt(
  doc: DocumentationEntry,
  content: string,
  template: SpecialistTemplate
): string {
  const availableTaskTypes = extractTaskTypes(template);
  const availableTechStack = template.persona.tech_stack || [];
  const availableTags = template.capabilities?.tags || [];

  return `You are a documentation analyst. Analyze the following documentation and extract structured metadata.

**Documentation Type**: ${doc.type}
**User Description**: ${doc.description}

**Available Task Types in Template**:
${availableTaskTypes.map(t => `- ${t}`).join('\n')}

**Available Tech Stack**:
${availableTechStack.map(t => `- ${t}`).join('\n')}

**Available Capability Tags**:
${availableTags.map(t => `- ${t}`).join('\n')}

**Documentation Content**:
\`\`\`
${content.slice(0, 10000)} ${content.length > 10000 ? '...(truncated)' : ''}
\`\`\`

**Task**: Analyze this documentation and provide structured metadata in JSON format:

\`\`\`json
{
  "summary": "2-3 paragraph comprehensive summary of the documentation",
  "key_concepts": ["concept1", "concept2", "..."],
  "relevant_for_tasks": ["task_type1", "task_type2"],
  "relevant_tech_stack": ["tech1", "tech2"],
  "relevant_tags": ["tag1", "tag2"],
  "code_patterns": ["code example 1", "code example 2"]
}
\`\`\`

**Instructions**:
1. Write a comprehensive 2-3 paragraph summary
2. Extract 3-10 key concepts
3. Match task types from the available list that this doc is relevant for
4. Match tech stack items from the available list
5. Match capability tags from the available list
6. Extract 2-5 important code patterns or examples (keep them concise)

IMPORTANT: Only return the JSON object, no other text.`;
}

/**
 * Parse enrichment response from LLM
 */
function parseEnrichmentResponse(
  response: string,
  model: string
): DocumentationEnrichment {
  // Extract JSON from response (handle markdown code blocks)
  const jsonMatch = response.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  const jsonStr = jsonMatch ? jsonMatch[1] : response;

  try {
    const parsed = JSON.parse(jsonStr);

    return {
      summary: parsed.summary || '',
      key_concepts: Array.isArray(parsed.key_concepts) ? parsed.key_concepts : [],
      relevant_for_tasks: Array.isArray(parsed.relevant_for_tasks) ? parsed.relevant_for_tasks : [],
      relevant_tech_stack: Array.isArray(parsed.relevant_tech_stack) ? parsed.relevant_tech_stack : [],
      relevant_tags: Array.isArray(parsed.relevant_tags) ? parsed.relevant_tags : [],
      code_patterns: Array.isArray(parsed.code_patterns) ? parsed.code_patterns : [],
      last_enriched: new Date().toISOString(),
      enrichment_model: model
    };
  } catch (error) {
    throw new Error(`Failed to parse enrichment response: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract available task types from template
 *
 * NEW STRUCTURE: Task types are top-level keys in prompts object
 * Each task has: { default: {...}, model_specific: {...} }
 */
function extractTaskTypes(template: SpecialistTemplate): string[] {
  const taskTypes = new Set<string>();

  if (!template.prompts) {
    return [];
  }

  // Iterate through all top-level keys
  Object.entries(template.prompts).forEach(([key, value]) => {
    // Skip metadata keys and general prompts
    if (key === 'default' || key === 'model_specific' || key === 'prompt_strategy') {
      return;
    }

    // If the value is an object with default or model_specific, it's a task type
    if (typeof value === 'object' && value !== null &&
        (('default' in value) || ('model_specific' in value))) {
      taskTypes.add(key);
    }
  });

  return Array.from(taskTypes);
}

/**
 * Get enriched template path with incremental numbering
 *
 * NEW STRUCTURE:
 * - Original: templates/nextjs-specialist-template.json5
 * - Enriched: templates/enriched/0.0.1/nextjs-specialist.enriched.001.json5
 *             templates/enriched/0.0.1/nextjs-specialist.enriched.002.json5
 *             ... (always increment, never overwrite)
 */
/**
 * Get path for the next enriched template to be created
 * Auto-increments the enriched version number and creates directory if needed
 */
function getNextEnrichedTemplatePath(templatePath: string, version: string, specialistName: string): string {
  const dir = dirname(templatePath);
  const enrichedDir = join(dir, 'enriched', version);

  // Create enriched directory if it doesn't exist
  if (!existsSync(enrichedDir)) {
    mkdirSync(enrichedDir, { recursive: true });
    // First enrichment for this version
    return join(enrichedDir, `${specialistName}.enriched.001.json5`);
  }

  // Find highest numbered enriched file for this specialist
  // Escape special regex characters in specialist name
  const escapedName = specialistName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filePattern = new RegExp(`^${escapedName}\\.enriched\\.(\\d+)\\.json5$`);

  const files = readdirSync(enrichedDir);
  const enrichedFiles = files
    .filter(f => filePattern.test(f))
    .map(f => {
      const match = f.match(filePattern);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  // Get next number
  const nextNumber = enrichedFiles.length > 0
    ? Math.max(...enrichedFiles) + 1
    : 1;

  // Format with leading zeros (e.g., 001, 002, 010)
  const formattedNumber = String(nextNumber).padStart(3, '0');

  return join(enrichedDir, `${specialistName}.enriched.${formattedNumber}.json5`);
}
