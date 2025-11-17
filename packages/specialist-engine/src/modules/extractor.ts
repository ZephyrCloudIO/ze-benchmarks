/**
 * Extractor Module
 * Extracts domain knowledge from various sources
 * Uses agency-prompt-creator for keyword extraction and pattern recognition
 */

import { OpenAI } from 'openai';
import { extractKeywords, containsKeyword } from 'agency-prompt-creator';
import type {
  ExtractedKnowledge,
  ExtractionConfig,
  Concept,
  Gotcha,
  BestPractice,
  Source
} from '../types/index.js';

export class DocumentationExtractor {
  private openai: OpenAI;
  private extractionModel: string;

  constructor(apiKey?: string, model: string = 'anthropic/claude-3.5-haiku') {
    const key = apiKey || process.env.OPENROUTER_API_KEY;
    if (!key) {
      throw new Error('OPENROUTER_API_KEY environment variable is required');
    }

    this.openai = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: key
    });
    this.extractionModel = model;
  }

  /**
   * Extract knowledge from a single URL
   */
  async extractFromUrl(url: string): Promise<Partial<ExtractedKnowledge>> {
    console.log(`[Extractor] Fetching documentation from: ${url}`);

    try {
      // Fetch the documentation
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
      }

      const html = await response.text();
      const text = this.extractTextFromHtml(html);

      console.log(`[Extractor] Fetched ${text.length} characters`);

      // Use agency-prompt-creator for keyword extraction
      const keywordData = extractKeywords(text);
      console.log(`[Extractor] Extracted ${keywordData.allKeywords.length} keywords using agency-prompt-creator`);

      // Use LLM to extract structured knowledge with keyword context
      const knowledge = await this.analyzeWithLLM(text, url, keywordData);

      return knowledge;
    } catch (error) {
      console.error(`[Extractor] Failed to extract from ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract from multiple documentation URLs
   */
  async extractFromSite(urls: string[]): Promise<ExtractedKnowledge> {
    console.log(`[Extractor] Extracting from ${urls.length} URLs...`);

    const results = await Promise.all(
      urls.map(url => this.extractFromUrl(url).catch(err => {
        console.warn(`[Extractor] Skipping ${url} due to error:`, err.message);
        return null;
      }))
    );

    // Merge all results
    const merged = this.mergeKnowledge(results.filter((r): r is Partial<ExtractedKnowledge> => r !== null));

    return merged;
  }

  /**
   * Analyze documentation text with LLM
   * Uses keyword data from agency-prompt-creator to improve extraction quality
   */
  private async analyzeWithLLM(
    text: string,
    sourceUrl: string,
    keywordData: ReturnType<typeof extractKeywords>
  ): Promise<Partial<ExtractedKnowledge>> {
    // Use top keywords from agency-prompt-creator to guide extraction
    const topKeywords = keywordData.allKeywords.slice(0, 10).join(', ');
    const frameworks = keywordData.frameworks.join(', ');
    const components = keywordData.components.join(', ');

    const prompt = `Analyze this documentation and extract structured knowledge.

Documentation Text:
${text.substring(0, 15000)} ${text.length > 15000 ? '... (truncated)' : ''}

Context from agency-prompt-creator:
- Key topics: ${topKeywords}
- Frameworks detected: ${frameworks || 'none'}
- Components detected: ${components || 'none'}

Extract the following in JSON format:
{
  "concepts": [
    {
      "name": "Concept name",
      "description": "What it is",
      "importance": "critical|high|medium|low",
      "relatedConcepts": ["related concept names"]
    }
  ],
  "gotchas": [
    {
      "title": "Common mistake or pitfall",
      "description": "What goes wrong",
      "impact": "critical|high|medium|low",
      "solution": "How to fix it",
      "relatedTo": ["related concepts"]
    }
  ],
  "bestPractices": [
    {
      "title": "Best practice name",
      "description": "What to do",
      "category": "setup|configuration|usage|testing",
      "reasoning": "Why this is best",
      "examples": ["code example or command"]
    }
  ],
  "configurations": [
    {
      "file": "filename",
      "purpose": "What this file does",
      "requiredFields": {"field": "purpose"},
      "examples": ["example code"]
    }
  ]
}

Focus on:
- Critical setup steps
- Common mistakes and how to avoid them
- Required configurations
- Version-specific information
- Command patterns

Return ONLY valid JSON.`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.extractionModel,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 4000
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from LLM');
      }

      // Parse JSON response
      const parsed = JSON.parse(content);

      return {
        concepts: parsed.concepts || [],
        gotchas: parsed.gotchas || [],
        bestPractices: parsed.bestPractices || [],
        configurations: parsed.configurations || [],
        sources: [{
          type: 'documentation',
          url: sourceUrl,
          relevance: 1.0,
          lastAccessed: new Date()
        }]
      };
    } catch (error) {
      console.error('[Extractor] LLM analysis failed:', error);
      // Return empty structure on error
      return {
        concepts: [],
        gotchas: [],
        bestPractices: [],
        configurations: [],
        sources: [{
          type: 'documentation',
          url: sourceUrl,
          relevance: 0.5,
          lastAccessed: new Date()
        }]
      };
    }
  }

  /**
   * Extract text from HTML (simple version)
   */
  private extractTextFromHtml(html: string): string {
    // Remove script and style tags
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, ' ');

    // Clean up whitespace
    text = text.replace(/\s+/g, ' ').trim();

    return text;
  }

  /**
   * Merge multiple knowledge extractions
   */
  private mergeKnowledge(results: Partial<ExtractedKnowledge>[]): ExtractedKnowledge {
    const merged: ExtractedKnowledge = {
      domain: '',
      framework: '',
      version: '',
      concepts: [],
      procedures: [],
      configurations: [],
      gotchas: [],
      bestPractices: [],
      commonMistakes: [],
      sources: [],
      extractedAt: new Date(),
      confidence: results.length > 0 ? 0.8 : 0
    };

    // Merge all arrays, removing duplicates by title/name
    for (const result of results) {
      if (result.concepts) {
        for (const concept of result.concepts) {
          if (!merged.concepts.find(c => c.name === concept.name)) {
            merged.concepts.push(concept);
          }
        }
      }

      if (result.gotchas) {
        for (const gotcha of result.gotchas) {
          if (!merged.gotchas.find(g => g.title === gotcha.title)) {
            merged.gotchas.push(gotcha);
          }
        }
      }

      if (result.bestPractices) {
        for (const practice of result.bestPractices) {
          if (!merged.bestPractices.find(p => p.title === practice.title)) {
            merged.bestPractices.push(practice);
          }
        }
      }

      if (result.configurations) {
        for (const config of result.configurations) {
          if (!merged.configurations.find(c => c.file === config.file)) {
            merged.configurations.push(config);
          }
        }
      }

      if (result.sources) {
        merged.sources.push(...result.sources);
      }
    }

    return merged;
  }
}

/**
 * Extract knowledge from extraction config
 */
export async function extract(config: ExtractionConfig): Promise<ExtractedKnowledge> {
  const extractor = new DocumentationExtractor();

  console.log('[Extractor] Starting knowledge extraction...');
  console.log(`[Extractor] Domain: ${config.domain}`);
  console.log(`[Extractor] Depth: ${config.depth}`);

  const urls: string[] = [
    ...(config.sources.documentation || []),
  ];

  if (urls.length === 0) {
    throw new Error('No documentation URLs provided');
  }

  const knowledge = await extractor.extractFromSite(urls);

  // Set domain and framework from config
  knowledge.domain = config.domain;
  knowledge.framework = config.framework || config.domain;

  console.log(`[Extractor] Extraction complete!`);
  console.log(`[Extractor] - ${knowledge.concepts.length} concepts`);
  console.log(`[Extractor] - ${knowledge.gotchas.length} gotchas`);
  console.log(`[Extractor] - ${knowledge.bestPractices.length} best practices`);
  console.log(`[Extractor] - ${knowledge.configurations.length} configurations`);

  return knowledge;
}