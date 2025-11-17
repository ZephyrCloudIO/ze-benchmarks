/**
 * Example: Create shadcn-ui Specialist
 *
 * Run with: pnpm exec tsx examples/create-shadcn-specialist.ts
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
  console.log('Creating shadcn-ui specialist...\n');

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY environment variable is required');
    console.error('Set it with: export OPENROUTER_API_KEY=your-key-here');
    process.exit(1);
  }

  try {
    const pkg = await engine.createSpecialist({
      extraction: {
        domain: 'shadcn-ui',
        framework: 'vite',
        sources: {
          documentation: [
            'https://ui.shadcn.com/docs',
            'https://ui.shadcn.com/docs/installation/vite'
          ]
        },
        depth: 'standard'
      },
      template: {
        name: '@zephyr/shadcn-vite-specialist',
        version: '1.0.0'
      },
      enrichment: {
        enrichDocumentation: true,
        generateTiers: true,
        baseTask: 'Set up a new shadcn/ui project with Vite',
        scenario: 'vite-setup'
      },
      output: {
        outputDir: resolve('./specialists/shadcn-vite-specialist'),
        includeBenchmarks: false,
        includeDocs: true,
        includeExamples: false,
        format: 'json5'
      }
    });

    console.log('\n✅ Success!');
    console.log(`📦 Package created at: ${pkg.path}`);
    console.log(`📄 Files created: ${pkg.files.length}`);

    console.log('\n📝 Next steps:');
    console.log('1. Review the generated template');
    console.log('2. Test with benchmarks: pnpm bench --specialist @zephyr/shadcn-vite-specialist');
    console.log('3. Iterate and improve based on results\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
