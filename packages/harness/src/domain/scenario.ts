import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import YAML from 'yaml';
import chalk from 'chalk';
import { log } from '@clack/prompts';
import { findRepoRoot } from '../lib/workspace-utils.ts';

// ============================================================================
// SCENARIO DOMAIN LOGIC
// ============================================================================

export function validateName(name: string, type: 'suite' | 'scenario'): { valid: boolean; error?: string } {
	if (!name || name.trim().length === 0) {
		return { valid: false, error: `${type} name cannot be empty` };
	}

	// Check kebab-case: lowercase, alphanumeric + hyphens, no spaces or special chars
	const kebabCasePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
	if (!kebabCasePattern.test(name)) {
		return {
			valid: false,
			error: `${type} name must be in kebab-case (lowercase, alphanumeric and hyphens only, e.g., "my-benchmark")`
		};
	}

	return { valid: true };
}

export function checkSuiteExists(suiteName: string): boolean {
	const root = findRepoRoot();
	const suitePath = join(root, 'suites', suiteName);
	return existsSync(suitePath);
}

export function checkScenarioExists(suiteName: string, scenarioName: string): boolean {
	const root = findRepoRoot();
	const scenarioPath = join(root, 'suites', suiteName, 'scenarios', scenarioName);
	return existsSync(scenarioPath);
}

export function loadScenario(suite: string, scenario: string) {
	const root = findRepoRoot();
	const scenarioPath = join(root, 'suites', suite, 'scenarios', scenario, 'scenario.yaml');
	const yamlText = readFileSync(scenarioPath, 'utf8');
	return YAML.parse(yamlText);
}

export function getScenarioDir(suite: string, scenario: string) {
	const root = findRepoRoot();
	return join(root, 'suites', suite, 'scenarios', scenario);
}

export function getTierLabel(tier: string): string {
  const labels: Record<string, string> = {
    'L0': 'L0 - Minimal',
    'L1': 'L1 - Basic',
    'L2': 'L2 - Directed',
    'L3': 'L3 - Migration',
    'Lx': 'Lx - Adversarial'
  };
  return labels[tier] || tier;
}

export function getAvailableTiers(suite: string, scenario: string): Array<{value: string, label: string}> {
  const root = findRepoRoot();
  const promptDir = join(root, 'suites', suite, 'prompts', scenario);

  if (!existsSync(promptDir)) {
    return [];
  }

  const files = readdirSync(promptDir);
  const tierPattern = /^(L\d+|Lx)(-.*)?\.md$/;

  const tiers = new Set<string>();
  files.forEach(file => {
    const match = file.match(tierPattern);
    if (match) {
      tiers.add(match[1]);
    }
  });

  return Array.from(tiers).sort().map(tier => ({
    value: tier,
    label: getTierLabel(tier)
  }));
}

export function loadPrompt(suite: string, scenario: string, tier: string): string | null {
	const root = findRepoRoot();
	const promptDir = join(root, 'suites', suite, 'prompts', scenario);

	if (!existsSync(promptDir)) {
		log.warning(`Prompt directory not found: ${promptDir}`);
		return null;
	}

	// Look for files that start with the tier (e.g., L1-basic.md, L1.md)
	try {
		const files = readdirSync(promptDir);
		const promptFile = files.find((file: string) => file.startsWith(`${tier}-`) || file === `${tier}.md`);

		if (!promptFile) {
			log.warning(`No prompt file found for tier ${tier} in ${promptDir}`);
			return null;
		}

		const promptPath = join(promptDir, promptFile);
		return readFileSync(promptPath, 'utf8');
	} catch (err) {
		log.error('Failed to load prompt file:');
		console.error(chalk.dim(err instanceof Error ? err.message : String(err)));
		return null;
	}
}
