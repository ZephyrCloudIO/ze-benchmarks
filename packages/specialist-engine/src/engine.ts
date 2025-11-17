/**
 * Main Specialist Engine
 * Coordinates all modules to create specialists
 */

import { extract } from './modules/extractor.js';
import { structure } from './modules/structurer.js';
import { enrich } from './modules/enricher.js';
import { validate } from './modules/validator.js';
import { generate } from './modules/generator.js';

import type {
  ExtractionConfig,
  ExtractedKnowledge,
  SpecialistTemplate,
  EnrichmentResult,
  ValidationResult,
  GeneratorConfig,
  SpecialistPackage
} from './types/index.js';

export class SpecialistEngine {
  /**
   * Extract knowledge from sources
   */
  async extract(config: ExtractionConfig): Promise<ExtractedKnowledge> {
    console.log('\n[SpecialistEngine] ========================================');
    console.log('[SpecialistEngine] STEP 1: EXTRACTION');
    console.log('[SpecialistEngine] ========================================\n');

    return await extract(config);
  }

  /**
   * Structure knowledge into template
   */
  structure(
    knowledge: ExtractedKnowledge,
    options: {
      name: string;
      version: string;
      baseTemplate?: string;
    }
  ): SpecialistTemplate {
    console.log('\n[SpecialistEngine] ========================================');
    console.log('[SpecialistEngine] STEP 2: STRUCTURING');
    console.log('[SpecialistEngine] ========================================\n');

    return structure(knowledge, options);
  }

  /**
   * Enrich template with metadata and tiers
   */
  async enrich(
    template: SpecialistTemplate,
    options: {
      enrichDocumentation?: boolean;
      generateTiers?: boolean;
      baseTask?: string;
      scenario?: string;
    }
  ): Promise<EnrichmentResult> {
    console.log('\n[SpecialistEngine] ========================================');
    console.log('[SpecialistEngine] STEP 3: ENRICHMENT');
    console.log('[SpecialistEngine] ========================================\n');

    return await enrich(template, options);
  }

  /**
   * Validate template
   */
  validate(template: SpecialistTemplate): ValidationResult {
    console.log('\n[SpecialistEngine] ========================================');
    console.log('[SpecialistEngine] STEP 4: VALIDATION');
    console.log('[SpecialistEngine] ========================================\n');

    return validate(template);
  }

  /**
   * Generate complete specialist package
   */
  generate(
    template: SpecialistTemplate,
    enrichmentResult: EnrichmentResult | undefined,
    config: GeneratorConfig
  ): SpecialistPackage {
    console.log('\n[SpecialistEngine] ========================================');
    console.log('[SpecialistEngine] STEP 5: GENERATION');
    console.log('[SpecialistEngine] ========================================\n');

    return generate(template, enrichmentResult?.tiers, config);
  }

  /**
   * Complete workflow: extract → structure → enrich → validate → generate
   */
  async createSpecialist(config: {
    extraction: ExtractionConfig;
    template: {
      name: string;
      version: string;
    };
    enrichment?: {
      enrichDocumentation?: boolean;
      generateTiers?: boolean;
      baseTask?: string;
      scenario?: string;
    };
    output: GeneratorConfig;
  }): Promise<SpecialistPackage> {
    console.log('[SpecialistEngine] Starting complete specialist creation workflow...\n');

    // Step 1: Extract knowledge
    const knowledge = await this.extract(config.extraction);

    // Step 2: Structure template
    const template = this.structure(knowledge, config.template);

    // Step 3: Enrich template
    let enrichmentResult: EnrichmentResult | undefined;
    if (config.enrichment) {
      enrichmentResult = await this.enrich(template, config.enrichment);
    }

    // Use enriched template if available
    const finalTemplate = enrichmentResult?.template || template;

    // Step 4: Validate
    const validation = this.validate(finalTemplate);
    if (validation.hasErrors) {
      console.error('\n[SpecialistEngine] ❌ Validation failed with errors:');
      validation.errors.forEach(err => {
        console.error(`  - ${err.message} (${err.path})`);
      });
      throw new Error('Template validation failed');
    }

    if (validation.hasWarnings) {
      console.warn('\n[SpecialistEngine] ⚠️  Validation warnings:');
      validation.warnings.forEach(warn => {
        console.warn(`  - ${warn.message} (${warn.path})`);
        if (warn.suggestion) {
          console.warn(`    Suggestion: ${warn.suggestion}`);
        }
      });
    }

    // Step 5: Generate package
    const pkg = this.generate(finalTemplate, enrichmentResult, config.output);

    console.log('\n[SpecialistEngine] ========================================');
    console.log('[SpecialistEngine] ✅ SPECIALIST CREATION COMPLETE');
    console.log('[SpecialistEngine] ========================================');
    console.log(`[SpecialistEngine] Package location: ${pkg.path}`);
    console.log(`[SpecialistEngine] Files created: ${pkg.files.length}`);
    console.log('[SpecialistEngine] ========================================\n');

    return pkg;
  }
}

// Export singleton instance
export const engine = new SpecialistEngine();
