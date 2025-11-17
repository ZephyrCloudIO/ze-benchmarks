/**
 * Example: Enrich Next.js Specialist Template
 *
 * Run with: pnpm exec tsx examples/enrich-nextjs-specialist.ts
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
  console.log('Enriching Next.js specialist template...\n');

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    console.error('Set it with: export OPENROUTER_API_KEY=your-key-here');
    process.exit(1);
  }

  // Path to existing template (relative to project root)
  const templatePath = resolve(projectRoot, 'specialists/nextjs-specialist/nextjs-specialist-template.json5');

  try {
    console.log(`Loading template from: ${templatePath}\n`);

    // Enrich the template
    const result = await enrichExistingTemplate(templatePath, {
      enrichDocumentation: true,
      generateTiers: false, // Can enable if needed
      baseTask: 'Set up a new Next.js project with App Router',
      scenario: 'nextjs-setup'
    });

    // Save enriched template
    const enrichedPath = saveEnrichedTemplate(result.template, templatePath);

    console.log('\n✅ Success!');
    console.log(`📦 Enriched template saved at: ${enrichedPath}`);
    console.log(`📄 Template: ${result.template.name} v${result.template.version}`);
    
    if (result.template.documentation) {
      const enrichedCount = result.template.documentation.filter(d => d.enrichment).length;
      console.log(`📚 Documentation entries enriched: ${enrichedCount}/${result.template.documentation.length}`);
    }

    console.log('\n📝 Next steps:');
    console.log('1. Review the enriched template');
    console.log('2. Run benchmarks with the specialist');
    console.log('3. Create snapshot from results\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

