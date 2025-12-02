/**
 * Documentation Filtering
 *
 * Intelligently filters and ranks documentation based on:
 * - Task type relevance
 * - Tech stack matching
 * - Capability tag overlap
 * - Documentation type priority
 * - User prompt keyword matching (frameworks, components, tech stack)
 */

import type { SpecialistTemplate, TaskType, TemplateContext } from './types';
import { extractKeywords, containsKeyword, countKeywordMatches, type ExtractedKeywords } from './keyword-extraction';
import { logger } from '@ze/logger';

const log = logger.docFilter;

/**
 * Documentation entry with enrichment data
 */
interface DocumentationEntry {
  type: 'official' | 'reference' | 'recipes' | 'examples' | 'control';
  url?: string;
  path?: string;
  description: string;
  enrichment?: {
    summary: string;
    key_concepts: string[];
    relevant_for_tasks: string[];
    relevant_tech_stack: string[];
    relevant_tags: string[];
    code_patterns: string[];
    last_enriched: string;
    enrichment_model: string;
  };
}

/**
 * Filtered documentation for template context
 */
export interface FilteredDocumentation {
  title: string;
  summary: string;
  key_concepts: string[];
  link?: string;
  code_patterns: string[];
  relevance_score: number;
}

/**
 * Filter and rank documentation based on context
 *
 * @param template Specialist template
 * @param taskType Current task type
 * @param userPrompt User's prompt text for keyword extraction
 * @param maxDocs Maximum number of docs to include (default: 5)
 * @returns Filtered and ranked documentation
 */
export function filterDocumentation(
  template: SpecialistTemplate,
  taskType: TaskType,
  userPrompt: string,
  maxDocs: number = 5
): FilteredDocumentation[] {
  const documentation = template.documentation as DocumentationEntry[] | undefined;

  // If no documentation or no enriched docs, return empty
  if (!documentation || documentation.length === 0) {
    return [];
  }

  // Extract keywords from user prompt
  const keywords = extractKeywords(userPrompt);

  // Score and filter documentation
  const scoredDocs = documentation
    .map(doc => {
      // Only include enriched docs for intelligent filtering
      if (!doc.enrichment) {
        return null;
      }

      const score = calculateRelevanceScore(doc, taskType, template, keywords);
      return {
        doc,
        score,
        keywords // For debugging
      };
    })
    .filter((item): item is { doc: DocumentationEntry; score: number; keywords: ExtractedKeywords } => item !== null)
    .sort((a, b) => b.score - a.score);

  // Log scoring decisions for debugging
  if (process.env.DEBUG_DOC_FILTERING === 'true') {
    log.debug('\n=== Documentation Filtering Debug ===');
    log.debug('User Prompt:', userPrompt);
    log.debug('Extracted Keywords:', keywords);
    log.debug('\nScored Documents:');
    scoredDocs.forEach(({ doc, score }) => {
      log.debug(`  [${score.toFixed(1)}] ${doc.description}`);
      log.debug(`       URL: ${doc.url || doc.path}`);
    });
    log.debug('=====================================\n');
  }

  // Take top N docs
  const topDocs = scoredDocs.slice(0, maxDocs);

  // Transform to template-friendly format
  return topDocs.map(({ doc, score }) => ({
    title: doc.description,
    summary: doc.enrichment!.summary,
    key_concepts: doc.enrichment!.key_concepts,
    link: doc.url || doc.path,
    code_patterns: doc.enrichment!.code_patterns,
    relevance_score: score
  }));
}

/**
 * Calculate relevance score for a documentation entry
 * Now includes keyword-based scoring from user prompt
 */
function calculateRelevanceScore(
  doc: DocumentationEntry,
  taskType: TaskType,
  template: SpecialistTemplate,
  keywords: ExtractedKeywords
): number {
  if (!doc.enrichment) {
    return 0;
  }

  let score = 0;
  const debugScores: Record<string, number> = {};

  // Task type exact match: +10 points
  if (doc.enrichment.relevant_for_tasks.includes(taskType)) {
    score += 10;
    debugScores['task_type_match'] = 10;
  }

  // Tech stack item match: +5 points per match
  if (template.persona?.tech_stack) {
    const techStackMatches = doc.enrichment.relevant_tech_stack.filter(tech =>
      template.persona.tech_stack!.includes(tech)
    ).length;
    const techStackScore = techStackMatches * 5;
    score += techStackScore;
    debugScores['tech_stack_match'] = techStackScore;
  }

  // Capability tag match: +3 points per match (base score)
  if (template.capabilities?.tags) {
    const tagMatches = doc.enrichment.relevant_tags.filter(tag =>
      template.capabilities.tags.includes(tag)
    ).length;
    const tagScore = tagMatches * 3;
    score += tagScore;
    debugScores['capability_tag_match'] = tagScore;
  }

  // KEYWORD-BASED SCORING (NEW)

  // Framework keyword matching: +30 points per match (high priority)
  const docText = `${doc.url || ''} ${doc.path || ''} ${doc.description} ${doc.enrichment.summary}`.toLowerCase();
  const frameworkMatches = countKeywordMatches(docText, keywords.frameworks);
  if (frameworkMatches > 0) {
    const frameworkScore = frameworkMatches * 30;
    score += frameworkScore;
    debugScores['framework_keyword_match'] = frameworkScore;
  }

  // Competing framework penalty: -10 points per competing framework
  const competingMatches = countKeywordMatches(docText, keywords.competingFrameworks);
  if (competingMatches > 0) {
    const penaltyScore = competingMatches * -10;
    score += penaltyScore;
    debugScores['competing_framework_penalty'] = penaltyScore;
  }

  // Component keyword matching: +15 points per match
  const componentMatches = countKeywordMatches(docText, keywords.components);
  if (componentMatches > 0) {
    const componentScore = componentMatches * 15;
    score += componentScore;
    debugScores['component_keyword_match'] = componentScore;
  }

  // Tech stack keyword matching: +10 points per match
  const techKeywordMatches = countKeywordMatches(docText, keywords.techStack);
  if (techKeywordMatches > 0) {
    const techKeywordScore = techKeywordMatches * 10;
    score += techKeywordScore;
    debugScores['tech_keyword_match'] = techKeywordScore;
  }

  // Tag keyword amplification: +25 points when enriched tag matches user prompt keyword
  // This is in addition to the base +3 points above
  if (doc.enrichment.relevant_tags.length > 0) {
    let tagKeywordMatches = 0;
    for (const tag of doc.enrichment.relevant_tags) {
      if (containsKeyword(tag, keywords.allKeywords)) {
        tagKeywordMatches++;
      }
    }
    if (tagKeywordMatches > 0) {
      const tagKeywordScore = tagKeywordMatches * 25;
      score += tagKeywordScore;
      debugScores['tag_keyword_amplification'] = tagKeywordScore;
    }
  }

  // Documentation type priority: official > reference > examples > recipes
  const typePriority: Record<string, number> = {
    official: 2,
    reference: 1,
    examples: 0.5,
    recipes: 0.5,
    control: 0
  };
  const typeScore = typePriority[doc.type] || 0;
  score += typeScore;
  debugScores['doc_type_priority'] = typeScore;

  // Debug logging
  if (process.env.DEBUG_DOC_FILTERING === 'true') {
    log.debug(`\nScoring: ${doc.description}`);
    log.debug('  Breakdown:', debugScores);
    log.debug(`  Total: ${score}`);
  }

  return score;
}

/**
 * Check if template has any enriched documentation
 */
export function hasEnrichedDocumentation(template: SpecialistTemplate): boolean {
  const documentation = template.documentation as DocumentationEntry[] | undefined;
  if (!documentation) {
    return false;
  }

  return documentation.some(doc => doc.enrichment !== undefined);
}
