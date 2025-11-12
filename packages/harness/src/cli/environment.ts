import chalk from 'chalk';

// ============================================================================
// ENVIRONMENT VALIDATION
// ============================================================================

export async function validateEnvironment() {
	const missingVars: string[] = [];

	// Check for API keys based on available agents
	if (!process.env.OPENROUTER_API_KEY && !process.env.ANTHROPIC_API_KEY) {
		missingVars.push('OPENROUTER_API_KEY or ANTHROPIC_API_KEY');
	}

	if (missingVars.length > 0) {
		console.log(chalk.red('❌ Missing required environment variables:'));
		console.log(chalk.yellow(`   ${missingVars.join(', ')}`));
		console.log('\n' + chalk.cyan('Setup Instructions:'));
		console.log(chalk.gray('1. Get API keys from:'));
		console.log(chalk.gray('   - OpenRouter: https://openrouter.ai/keys'));
		console.log(chalk.gray('   - Anthropic: https://console.anthropic.com/settings/keys'));
		console.log(chalk.gray('2. Create a .env file in the project root:'));
		console.log(chalk.gray('   cp .env.example .env'));
		console.log(chalk.gray('3. Edit .env and add your API keys:'));
		console.log(chalk.gray('   OPENROUTER_API_KEY=your_key_here'));
		console.log(chalk.gray('   ANTHROPIC_API_KEY=your_key_here'));
		console.log(chalk.gray('4. Or set environment variables directly:'));
		console.log(chalk.gray('   Windows: set OPENROUTER_API_KEY=your_key_here'));
		console.log(chalk.gray('   Linux/Mac: export OPENROUTER_API_KEY=your_key_here'));
		console.log('\n' + chalk.red('Please set up your environment variables and try again.'));
		process.exit(1);
	}
}
