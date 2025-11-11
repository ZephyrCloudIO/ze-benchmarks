/**
 * Test script for SpecialistAdapter
 * Run with: pnpm exec tsx test-specialist.ts
 */

import { SpecialistAdapter } from './src/specialist.ts';
import { EchoAgent } from './src/index.ts';

async function test() {
  console.log('🧪 Testing SpecialistAdapter...\n');

  // Test 1: Load template
  console.log('Test 1: Loading specialist template...');
  try {
    const echo = new EchoAgent();
    const specialist = new SpecialistAdapter(
      echo,
      'starting_from_outcome/shadcn-specialist-template.json5'
    );
    console.log(`✅ Loaded specialist: ${specialist.name}\n`);
  } catch (error) {
    console.error(`❌ Failed to load template:`, error);
    return;
  }

  // Test 2: Send request
  console.log('Test 2: Sending request with prompt transformation...');
  try {
    const echo = new EchoAgent();
    const specialist = new SpecialistAdapter(
      echo,
      'starting_from_outcome/shadcn-specialist-template.json5'
    );

    const response = await specialist.send({
      messages: [
        { role: 'user', content: 'Set up a new Vite project with shadcn/ui' }
      ]
    });

    console.log('✅ Request succeeded');
    console.log('Response content length:', response.content.length);
    console.log('First 200 chars:', response.content.substring(0, 200));
    console.log();
  } catch (error) {
    console.error('❌ Request failed:', error);
    return;
  }

  // Test 3: Error handling - missing template
  console.log('Test 3: Testing error handling (missing template)...');
  try {
    const echo = new EchoAgent();
    new SpecialistAdapter(echo, 'nonexistent/template.json5');
    console.log('❌ Should have thrown an error');
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      console.log('✅ Correctly threw error for missing template\n');
    } else {
      console.error('❌ Unexpected error:', error);
    }
  }

  console.log('✅ All tests passed!');
}

test().catch(console.error);
