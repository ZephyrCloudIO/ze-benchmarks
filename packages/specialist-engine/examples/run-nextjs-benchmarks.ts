/**
 * Example: Run Benchmarks with Next.js Specialist
 *
 * Run with: pnpm exec tsx examples/run-nextjs-benchmarks.ts
 */

// Load .env from project root
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve to project root: packages/specialist-engine/examples -> packages/specialist-engine -> packages -> root
const projectRoot = resolve(__dirname, '../../../');
config({ path: resolve(projectRoot, '.env') });

async function runBenchmark(
  suite: string,
  scenario: string,
  tier: string,
  agent: string,
  model?: string,
  specialist?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      suite,
      scenario,
      tier,
      agent,
      ...(model ? ['--model', model] : []),
      ...(specialist ? ['--specialist', specialist] : []),
      '--quiet'
    ];

    console.log(`\n📊 Running: ${suite}/${scenario} (${tier}) ${agent}${model ? ` [${model}]` : ''}${specialist ? ` with ${specialist}` : ''}`);
    
    const childProcess = spawn('pnpm', ['bench', ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
      shell: true,
      env: { ...process.env }
    });

    childProcess.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        // Don't reject - just log and continue
        console.error(`⚠️  Benchmark exited with code ${code}`);
        resolve();
      }
    });

    childProcess.on('error', (error) => {
      console.error(`⚠️  Benchmark error: ${error.message}`);
      resolve(); // Continue with next benchmark
    });
  });
}

async function main() {
  console.log('Running Next.js benchmarks with specialist...\n');

  // Check for API key
  if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    console.error('Error: OPENROUTER_API_KEY or ANTHROPIC_API_KEY environment variable is required');
    process.exit(1);
  }

  const specialist = '@zephyr/nextjs-specialist';
  const suite = 'next.js';
  
  // Select a few representative scenarios to test
  const scenarios = [
    '001-server-component',
    '002-client-component',
    '003-cookies',
    '004-search-params'
  ];

  const agent = 'openrouter';
  const model = 'anthropic/claude-sonnet-4.5';
  const tier = 'L1';

  try {
    for (const scenario of scenarios) {
      await runBenchmark(suite, scenario, tier, agent, model, specialist);
      // Small delay between runs
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log('\n✅ Benchmarks completed!');
    console.log('\n📝 Next steps:');
    console.log('1. Review results: pnpm stats');
    console.log('2. View batches: pnpm batches');
    console.log('3. View in dashboard: pnpm dash:dev\n');
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();

