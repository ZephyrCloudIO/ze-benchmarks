/**
 * Example: Enrich Existing Specialist Template
 *
 * Run with: pnpm exec tsx examples/enrich-existing-specialist.ts
 */

// Load .env from project root
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve to project root: packages/specialist-engine/examples -> packages/specialist-engine -> packages -> root
const projectRoot = resolve(__dirname, '../../../');
config({ path: resolve(projectRoot, '.env') });

import { enrichExistingTemplate } from '../src/modules/enricher.js';
import { saveEnrichedTemplate } from '../src/modules/generator.js';

async function main() {
  console.log('Enriching existing shadcn specialist template...\n');

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    console.error('Set it with: export OPENROUTER_API_KEY=your-key-here');
    process.exit(1);
  }

  // Path to existing template (relative to project root)
  const templatePath = resolve(projectRoot, 'starting_from_outcome/shadcn-specialist-template.json5');

  try {
    console.log(`Loading template from: ${templatePath}\n`);

    // Enrich the template
    const result = await enrichExistingTemplate(templatePath, {
      enrichDocumentation: true,
      generateTiers: false, // Set to true if you want tier prompts
      baseTask: 'Set up a new shadcn/ui project with Vite',
      scenario: 'vite-setup'
    });

    // Save enriched template
    const enrichedPath = saveEnrichedTemplate(result.template, templatePath);

    console.log('\n✅ Success!');
    console.log(`📦 Enriched template saved at: ${enrichedPath}`);
    console.log(`📄 Template: ${result.template.name} v${result.template.version}`);
    
    if (result.template.documentation) {
      const enrichedCount = result.template.documentation.filter(d => d.enrichment).length;
      console.log(`📚 Documentation entries enriched: ${enrichedCount}/${result.template.documentation.length}`);
      
      // Show first enriched doc as example
      const firstEnriched = result.template.documentation.find(d => d.enrichment);
      if (firstEnriched && firstEnriched.enrichment) {
        console.log('\n📝 Example enriched documentation:');
        console.log(`   Title: ${firstEnriched.description}`);
        console.log(`   Summary: ${firstEnriched.enrichment.summary.substring(0, 100)}...`);
        console.log(`   Key Concepts: ${firstEnriched.enrichment.key_concepts.slice(0, 3).join(', ')}`);
      }
    }

    console.log('\n📝 Next steps:');
    console.log('1. Review the enriched template');
    console.log('2. Test with benchmarks using the enriched version');
    console.log('3. Create additional enriched versions as needed\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

