/**
 * Enricher Module
 * Creates tier-based enrichments and model-specific prompts
 * Uses agency-prompt-creator for task detection and keyword extraction
 */

import { OpenAI } from 'openai';
import { detectTaskType, extractKeywords } from 'agency-prompt-creator';
import JSON5 from 'json5';
import { readFileSync } from 'node:fs';
import type {
  SpecialistTemplate,
  DocumentationEntry,
  TierLevel,
  TierPrompt,
  TierSet,
  EnrichmentResult
} from '../types/index.js';

export class Enricher {
  private openai: OpenAI;
  private enrichmentModel: string;

  constructor(apiKey?: string, model: string = 'anthropic/claude-3.5-haiku') {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: key
    });
    this.enrichmentModel = model;
  }

  /**
   * Enrich documentation entries with metadata
   */
  async enrichDocumentation(doc: DocumentationEntry): Promise<DocumentationEntry> {
    console.log(`[Enricher] Enriching documentation: ${doc.url || doc.path || 'unknown'}`);

    if (!doc.url) {
      console.warn(`[Enricher] No URL provided for documentation entry, skipping enrichment`);
      return doc;
    }

    try {
      // Fetch documentation content
      const response = await fetch(doc.url);
      if (!response.ok) {
        console.warn(`[Enricher] Failed to fetch ${doc.url}: ${response.statusText}`);
        return doc;
      }

      const html = await response.text();
      const text = this.extractTextFromHtml(html);

      // Use agency-prompt-creator for keyword extraction
      const keywordData = extractKeywords(text);
      console.log(`[Enricher] Extracted keywords: ${keywordData.allKeywords.slice(0, 5).join(', ')}`);

      // Use LLM to extract enrichment metadata with keyword context
      const enrichment = await this.extractEnrichmentMetadata(text, keywordData);

      return {
        ...doc,
        enrichment
      };
    } catch (error) {
      console.error(`[Enricher] Failed to enrich ${doc.url}:`, error);
      return doc;
    }
  }

  /**
   * Extract enrichment metadata using LLM with agency-prompt-creator keyword context
   */
  private async extractEnrichmentMetadata(
    text: string,
    keywordData: ReturnType<typeof extractKeywords>
  ): Promise<DocumentationEntry['enrichment']> {
    // Use keyword data from agency-prompt-creator
    const frameworks = keywordData.frameworks.join(', ');
    const components = keywordData.components.join(', ');
    const techStack = keywordData.techStack.join(', ');

    const prompt = `Analyze this documentation and extract metadata in JSON format.

Documentation:
${text.substring(0, 10000)} ${text.length > 10000 ? '... (truncated)' : ''}

Context from agency-prompt-creator:
- Detected frameworks: ${frameworks || 'none'}
- Detected components: ${components || 'none'}
- Detected tech stack: ${techStack || 'none'}

Extract:
{
  "summary": "1-2 sentence summary",
  "key_concepts": ["concept 1", "concept 2", ...],
  "relevant_for_tasks": ["project_setup", "component_add", etc.],
  "relevant_tech_stack": ["React", "TypeScript", etc.],
  "relevant_tags": ["tag1", "tag2", ...],
  "code_patterns": ["command or code pattern", ...]
}

Return ONLY valid JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.enrichmentModel,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      const parsed = JSON.parse(content);

      return {
        summary: parsed.summary || '',
        key_concepts: parsed.key_concepts || [],
        relevant_for_tasks: parsed.relevant_for_tasks || [],
        relevant_tech_stack: parsed.relevant_tech_stack || [],
        relevant_tags: parsed.relevant_tags || [],
        code_patterns: parsed.code_patterns || [],
        last_enriched: new Date().toISOString(),
        enrichment_model: this.enrichmentModel
      };
    } catch (error) {
      console.error('[Enricher] Metadata extraction failed:', error);
      return {
        summary: '',
        key_concepts: [],
        relevant_for_tasks: [],
        relevant_tech_stack: [],
        relevant_tags: [],
        code_patterns: [],
        last_enriched: new Date().toISOString(),
        enrichment_model: this.enrichmentModel
      };
    }
  }

  private extractTextFromHtml(html: string): string {
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/\s+/g, ' ').trim();
    return text;
  }

  /**
   * Generate tier-based prompts
   * Uses agency-prompt-creator for task type detection
   */
  generateTiers(template: SpecialistTemplate, baseTask: string, scenario: string): TierSet {
    console.log('[Enricher] Generating tier-based prompts...');

    // Use agency-prompt-creator to detect task type from baseTask
    const taskType = detectTaskType(baseTask);
    console.log(`[Enricher] Detected task type: ${taskType}`);

    const tiers: Record<TierLevel, TierPrompt> = {
      'L0': this.generateL0(baseTask),
      'L1': this.generateL1(baseTask, template),
      'L2': this.generateL2(baseTask, template),
      'L3': this.generateL3(baseTask, template),
      'Lx': this.generateLx(baseTask, template)
    };

    return {
      tiers,
      baseTask,
      scenario
    };
  }

  private generateL0(task: string): TierPrompt {
    return {
      level: 'L0',
      content: task,
      metadata: {
        includeContext: false,
        includeSteps: false,
        includeConstraints: false,
        includeExamples: false
      }
    };
  }

  private generateL1(task: string, template: SpecialistTemplate): TierPrompt {
    const content = `${task}

Requirements:
- Follow official documentation
- Ensure the project builds successfully
- Use recommended tools and configurations`;

    return {
      level: 'L1',
      content,
      metadata: {
        includeContext: 'basic',
        includeSteps: false,
        includeConstraints: 'essential',
        includeExamples: false
      }
    };
  }

  private generateL2(task: string, template: SpecialistTemplate): TierPrompt {
    const steps = template.capabilities.tags
      .slice(0, 5)
      .map((tag: string, i: number) => `${i + 1}. ${template.capabilities.descriptions?.[tag] || tag}`)
      .join('\n');

    const constraints = (template.capabilities as any).considerations
      ?.map((c: string) => `- ${c}`)
      .join('\n') || '';

    const content = `${task}

Steps:
${steps}

Constraints:
${constraints}

Verify all configurations are correct and test the build.`;

    return {
      level: 'L2',
      content,
      metadata: {
        includeContext: 'detailed',
        includeSteps: true,
        includeConstraints: 'comprehensive',
        includeExamples: 'inline'
      }
    };
  }

  private generateL3(task: string, template: SpecialistTemplate): TierPrompt {
    return this.generateL2(task, template); // Simplified for now
  }

  private generateLx(task: string, template: SpecialistTemplate): TierPrompt {
    const content = `${task}

ADVERSARIAL CONDITIONS:
- Multiple conflicting configurations may be present
- Some dependencies may have breaking changes
- Build errors are expected - debug and fix them
- Documentation may be outdated - verify everything

You must handle all edge cases and ensure a working solution.`;

    return {
      level: 'Lx',
      content,
      metadata: {
        includeContext: 'adversarial',
        includeSteps: 'detailed',
        includeConstraints: 'strict',
        includeExamples: 'edge-cases',
        includePitfalls: true
      }
    };
  }
}

/**
 * Enrich a template with documentation metadata and tier prompts
 */
export async function enrich(
  template: SpecialistTemplate,
  options: {
    enrichDocumentation?: boolean;
    generateTiers?: boolean;
    baseTask?: string;
    scenario?: string;
  }
): Promise<EnrichmentResult> {
  const enricher = new Enricher();

  console.log('[Enricher] Starting enrichment...');

  let enrichedTemplate = { ...template };

  // Enrich documentation if requested
  if (options.enrichDocumentation && template.documentation && template.documentation.length > 0) {
    console.log(`[Enricher] Enriching ${template.documentation.length} documentation entries...`);
    enrichedTemplate.documentation = await Promise.all(
      template.documentation.map(doc => enricher.enrichDocumentation(doc))
    );
  }

  // Generate tiers if requested
  let tiers: TierSet | undefined;
  if (options.generateTiers && options.baseTask && options.scenario) {
    tiers = enricher.generateTiers(enrichedTemplate, options.baseTask, options.scenario);
  }

  console.log('[Enricher] Enrichment complete');

  return {
    template: enrichedTemplate,
    tiers: tiers || { tiers: {} as any, baseTask: '', scenario: '' },
    modelSpecific: {},
    enrichedAt: new Date()
  };
}

/**
 * Enrich an existing template file
 * Loads template, enriches documentation, and returns enriched template ready for saving
 */
export async function enrichExistingTemplate(
  templatePath: string,
  options: {
    enrichDocumentation?: boolean;
    generateTiers?: boolean;
    baseTask?: string;
    scenario?: string;
  }
): Promise<EnrichmentResult> {
  console.log(`[Enricher] Loading existing template from: ${templatePath}`);
  
  // Load existing template
  const templateContent = readFileSync(templatePath, 'utf-8');
  const template: SpecialistTemplate = JSON5.parse(templateContent);
  
  console.log(`[Enricher] Loaded template: ${template.name} v${template.version}`);
  console.log(`[Enricher] Documentation entries: ${template.documentation?.length || 0}`);
  
  // Use existing enrich function
  return await enrich(template, options);
}