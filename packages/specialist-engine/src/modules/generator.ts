/**
 * Generator Module
 * Generates complete specialist packages with all necessary files
 * Uses agency-prompt-creator for template substitution in documentation
 */

import { writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import JSON5 from 'json5';
import { substituteTemplate } from 'agency-prompt-creator';
import type {
  SpecialistTemplate,
  GeneratorConfig,
  SpecialistPackage,
  TierSet
} from '../types/index.js';

export function generate(
  template: SpecialistTemplate,
  tiers: TierSet | undefined,
  config: GeneratorConfig
): SpecialistPackage {
  console.log('[Generator] Generating specialist package...');
  console.log(`[Generator] Output directory: ${config.outputDir}`);

  const files: string[] = [];

  // Ensure output directory exists
  if (!existsSync(config.outputDir)) {
    mkdirSync(config.outputDir, { recursive: true });
  }

  // Generate main template file
  const templatePath = join(config.outputDir, `${template.name.split('/').pop()}-template.json5`);
  writeFileSync(templatePath, JSON5.stringify(template, null, 2));
  files.push(templatePath);
  console.log(`[Generator] Created template: ${templatePath}`);

  // Generate enriched directory structure
  const enrichedDir = join(config.outputDir, 'enriched', template.version);
  if (!existsSync(enrichedDir)) {
    mkdirSync(enrichedDir, { recursive: true });
  }

  // Find next enriched number
  const nextEnrichedNumber = findNextEnrichedNumber(enrichedDir);
  const enrichedPath = join(enrichedDir, `enriched-${nextEnrichedNumber.toString().padStart(3, '0')}.json5`);
  writeFileSync(enrichedPath, JSON5.stringify(template, null, 2));
  files.push(enrichedPath);
  console.log(`[Generator] Created enriched template: ${enrichedPath}`);

  // Generate tier prompts if provided
  if (tiers && config.includeDocs) {
    const promptsDir = join(config.outputDir, 'prompts', tiers.scenario);
    if (!existsSync(promptsDir)) {
      mkdirSync(promptsDir, { recursive: true });
    }

    for (const [level, prompt] of Object.entries(tiers.tiers)) {
      const tierName = level === 'L0' ? 'L0-minimal'
                     : level === 'L1' ? 'L1-basic'
                     : level === 'L2' ? 'L2-directed'
                     : level === 'L3' ? 'L3-migration'
                     : 'Lx-adversarial';

      const promptPath = join(promptsDir, `${tierName}.md`);
      writeFileSync(promptPath, prompt.content);
      files.push(promptPath);
      console.log(`[Generator] Created tier prompt: ${promptPath}`);
    }
  }

  // Generate README
  if (config.includeDocs) {
    const readmePath = join(config.outputDir, 'README.md');
    const readme = generateReadme(template);
    writeFileSync(readmePath, readme);
    files.push(readmePath);
    console.log(`[Generator] Created README: ${readmePath}`);
  }

  console.log(`[Generator] Package generation complete! Created ${files.length} files`);

  return {
    path: config.outputDir,
    template,
    files,
    benchmarks: [],
    docs: config.includeDocs ? [join(config.outputDir, 'README.md')] : []
  };
}

/**
 * Save an enriched template to the appropriate directory
 * Finds the next enriched version number and saves the template
 */
export function saveEnrichedTemplate(
  template: SpecialistTemplate,
  baseTemplatePath: string
): string {
  // Determine enriched directory from base template path
  // If base template is in starting_from_outcome/, enriched goes to starting_from_outcome/enriched/{version}/
  // If base template is in specialists/{name}/, enriched goes to specialists/{name}/enriched/{version}/
  const baseDir = dirname(baseTemplatePath);
  const enrichedDir = join(baseDir, 'enriched', template.version);
  
  if (!existsSync(enrichedDir)) {
    mkdirSync(enrichedDir, { recursive: true });
  }

  // Find next enriched number
  const nextEnrichedNumber = findNextEnrichedNumber(enrichedDir);
  const enrichedPath = join(enrichedDir, `enriched-${nextEnrichedNumber.toString().padStart(3, '0')}.json5`);
  
  writeFileSync(enrichedPath, JSON5.stringify(template, null, 2));
  console.log(`[Generator] Saved enriched template: ${enrichedPath}`);
  
  return enrichedPath;
}

/**
 * Find the next enriched version number
 * Scans existing enriched-NNN.json5 files and returns the next number
 */
function findNextEnrichedNumber(enrichedDir: string): number {
  if (!existsSync(enrichedDir)) {
    return 1;
  }

  const files = readdirSync(enrichedDir);
  const enrichedFiles = files.filter(f => f.startsWith('enriched-') && f.endsWith('.json5'));
  
  if (enrichedFiles.length === 0) {
    return 1;
  }

  // Extract numbers from enriched-NNN.json5 files
  const numbers = enrichedFiles
    .map(f => {
      const match = f.match(/enriched-(\d+)\.json5/);
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => n > 0);

  if (numbers.length === 0) {
    return 1;
  }

  // Return the highest number + 1
  return Math.max(...numbers) + 1;
}

function generateReadme(template: SpecialistTemplate): string {
  return `# ${template.displayName || template.name}

Version: ${template.version}

## Overview

${template.persona.purpose}

## Capabilities

${template.capabilities.tags.map((tag: string) => `- **${tag}**: ${template.capabilities.descriptions?.[tag] || ''}`).join('\n')}

## Tech Stack

${template.persona.tech_stack?.map((tech: string) => `- ${tech}`).join('\n') || 'Not specified'}

## Documentation

${template.documentation?.map(doc => `- [${doc.description}](${doc.url || doc.path || ''})`).join('\n') || 'No documentation provided'}

## Usage

This specialist template can be used with the ZE Benchmarks harness to provide specialized context for AI agents.

\`\`\`bash
pnpm bench --specialist ${template.name}
\`\`\`

## Considerations

${(template.capabilities as any).considerations?.map((c: string) => `- ${c}`).join('\n') || 'None specified'}

---

Generated by Specialist Engine
`;
}