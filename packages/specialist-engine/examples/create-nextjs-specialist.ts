/**
 * Example: Create Next.js Specialist
 *
 * Run with: pnpm exec tsx examples/create-nextjs-specialist.ts
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

import { engine } from '../src/engine.js';

async function main() {
  console.log('Creating Next.js specialist...\n');

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    console.error('Set it with: export OPENROUTER_API_KEY=your-key-here');
    process.exit(1);
  }

  try {
    const pkg = await engine.createSpecialist({
      extraction: {
        domain: 'nextjs',
        framework: 'nextjs',
        sources: {
          documentation: [
            'https://nextjs.org/docs',
            'https://nextjs.org/docs/app',
            'https://nextjs.org/docs/app/building-your-application/routing',
            'https://nextjs.org/docs/app/building-your-application/rendering/server-components',
            'https://nextjs.org/docs/app/api-reference/server-actions'
          ]
        },
        depth: 'standard'
      },
      template: {
        name: '@zephyr/nextjs-specialist',
        version: '1.0.0'
      },
      enrichment: {
        enrichDocumentation: true,
        generateTiers: true,
        baseTask: 'Set up a new Next.js project with App Router',
        scenario: 'nextjs-setup'
      },
      output: {
        outputDir: resolve(projectRoot, 'starting_from_outcome/nextjs-specialist'),
        includeBenchmarks: false,
        includeDocs: true,
        includeExamples: false,
        format: 'json5'
      }
    });

    console.log('\n✅ Success!');
    console.log(`📦 Package created at: ${pkg.path}`);
    console.log(`📄 Files created: ${pkg.files.length}`);
    console.log(`📝 Template: ${pkg.files.find(f => f.includes('-template.json5'))}`);

    console.log('\n📝 Next steps:');
    console.log('1. Review the generated template');
    console.log('2. Enrich it further if needed: pnpm exec tsx examples/enrich-nextjs-specialist.ts');
    console.log('3. Test with benchmarks\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

