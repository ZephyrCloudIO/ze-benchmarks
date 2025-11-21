import chalk from 'chalk';
import { logger } from '@ze/logger';

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

export async function validateEnvironment() {
	const missingVars: string[] = [];

	// Check for API keys based on available agents
	if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
		missingVars.push('OPENROUTER_API_KEY or ANTHROPIC_API_KEY');
	}

	// Note: FIGMA_API_KEY is optional - only needed for artifact-based scenarios with Figma files
	// We don't fail if it's missing, but we'll warn if a Figma scenario is run without it

	if (missingVars.length > 0) {
		logger.config.error('❌ Missing required environment variables:');
		logger.config.warn(`   ${missingVars.join(', ')}`);
		logger.config.raw('\n' + chalk.cyan('Setup Instructions:'));
		logger.config.debug('1. Get API keys from:');
		logger.config.debug('   - OpenRouter: https://openrouter.ai/keys');
		logger.config.debug('   - Anthropic: https://console.anthropic.com/settings/keys');
		logger.config.debug('2. Create a .env file in the project root:');
		logger.config.debug('   cp .env.example .env');
		logger.config.debug('3. Edit .env and add your API keys:');
		logger.config.debug('   OPENROUTER_API_KEY=your_key_here');
		logger.config.debug('   ANTHROPIC_API_KEY=your_key_here');
		logger.config.debug('   FIGMA_API_KEY=your_key_here  # Optional: for Figma artifact scenarios');
		logger.config.debug('4. Or set environment variables directly:');
		logger.config.debug('   Windows: set OPENROUTER_API_KEY=your_key_here');
		logger.config.debug('   Linux/Mac: export OPENROUTER_API_KEY=your_key_here');
		logger.config.raw('\n' + chalk.red('Please set up your environment variables and try again.'));
		process.exit(1);
	}
}
