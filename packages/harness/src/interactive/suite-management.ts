import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { intro, outro, spinner, log, select, confirm, isCancel, cancel, text } from '@clack/prompts';
import chalk from 'chalk';

// Import helper functions
import { findRepoRoot } from '../lib/workspace-utils.ts';
import { validateName, checkSuiteExists, checkScenarioExists } from '../domain/scenario.ts';
import { logger } from '@ze/logger';

async function createNewSuite(name?: string): Promise<void> {
	const root = findRepoRoot();
	const suitesDir = join(root, 'suites');

	// Get suite name from argument or prompt
	let suiteName: string | undefined = name;
	if (!suiteName) {
		intro(chalk.bgGreen(' Create New Suite '));
		const input = await text({
			message: 'Enter suite name (kebab-case):',
			placeholder: 'e.g., my-benchmark-suite',
			validate: (value) => {
				const validation = validateName(value, 'suite');
				if (!validation.valid) {
					return validation.error;
				}
				if (checkSuiteExists(value)) {
					return `Suite "${value}" already exists`;
				}
				return;
			}
		});

		if (isCancel(input)) {
			cancel('Operation cancelled.');
			return;
		}
		suiteName = input as string;
	}

	// Validate name - TypeScript guard
	if (!suiteName) {
		log.error('Suite name is required');
		return;
	}

	// TypeScript type narrowing - suiteName is guaranteed to be string here
	const finalSuiteName = suiteName as string;
	const validation = validateName(finalSuiteName, 'suite');
	if (!validation.valid) {
		log.error(validation.error || 'Invalid suite name');
		return;
	}

	// Check if suite exists
	if (checkSuiteExists(finalSuiteName)) {
		log.error(`Suite "${finalSuiteName}" already exists at suites/${finalSuiteName}/`);
		return;
	}

	// Create directory structure
	const suitePath = join(suitesDir, finalSuiteName);
	const promptsPath = join(suitePath, 'prompts');
	const scenariosPath = join(suitePath, 'scenarios');

	const s = spinner();
	s.start('Creating suite directory structure...');

	try {
		mkdirSync(suitePath, { recursive: true });
		mkdirSync(promptsPath, { recursive: true });
		mkdirSync(scenariosPath, { recursive: true });
		s.stop('Suite created');

		// Show relative path
		const relativePath = join('suites', finalSuiteName);
		logger.suite.raw(`\n${chalk.green('✓')} Suite created at: ${chalk.cyan(relativePath)}`);
		logger.suite.raw(`   ${chalk.gray('Structure:')} ${relativePath}/{prompts,scenarios}`);

		outro(chalk.green(`Suite "${finalSuiteName}" created successfully`));
	} catch (error) {
		s.stop('Failed to create suite');
		log.error(`Failed to create suite: ${error instanceof Error ? error.message : String(error)}`);
	}
}

async function createNewScenario(suite?: string, scenarioName?: string): Promise<void> {
	const root = findRepoRoot();
	const suitesDir = join(root, 'suites');

	// Get suite name
	let suiteName = suite;
	if (!suiteName) {
		intro(chalk.bgGreen(' Create New Scenario '));

		// Check if any suites exist
		if (!existsSync(suitesDir)) {
			log.error('No suites directory found. Create a suite first.');
			return;
		}

		const existingSuites = readdirSync(suitesDir).filter(dir =>
			existsSync(join(suitesDir, dir, 'scenarios'))
		);

		if (existingSuites.length === 0) {
			const shouldCreate = await confirm({
				message: 'No existing suites found. Create a new suite first?',
				initialValue: true
			});

			if (isCancel(shouldCreate) || !shouldCreate) {
				cancel('Operation cancelled.');
				return;
			}

			await createNewSuite();
			// Refresh suites list
			const refreshedSuites = readdirSync(suitesDir).filter(dir =>
				existsSync(join(suitesDir, dir, 'scenarios'))
			);
			if (refreshedSuites.length === 0) {
				log.error('Failed to create suite or no suites available');
				return;
			}
			existingSuites.push(...refreshedSuites);
		}

		const selectedSuite = await select({
			message: 'Select suite to add scenario to:',
			options: existingSuites.map(s => ({ value: s, label: s }))
		});

		if (isCancel(selectedSuite)) {
			cancel('Operation cancelled.');
			return;
		}
		suiteName = selectedSuite as string;
	}

	// TypeScript guard - suiteName must be string at this point
	if (!suiteName) {
		log.error('Suite name is required');
		return;
	}

	// Validate suite exists
	if (!checkSuiteExists(suiteName)) {
		log.error(`Suite "${suiteName}" does not exist. Create it first with --new-suite.`);
		return;
	}

	// Get scenario name
	let name: string | undefined = scenarioName;
	if (!name) {
		const input = await text({
			message: 'Enter scenario name (kebab-case):',
			placeholder: 'e.g., my-test-scenario',
			validate: (value) => {
				const validation = validateName(value, 'scenario');
				if (!validation.valid) {
					return validation.error;
				}
				if (checkScenarioExists(suiteName, value)) {
					return `Scenario "${value}" already exists in suite "${suiteName}"`;
				}
				return;
			}
		});

		if (isCancel(input)) {
			cancel('Operation cancelled.');
			return;
		}
		name = input as string;
	}

	// Validate name - TypeScript guard
	if (!name) {
		log.error('Scenario name is required');
		return;
	}

	// TypeScript type narrowing - name is guaranteed to be string here
	const finalName = name as string;
	const validation = validateName(finalName, 'scenario');
	if (!validation.valid) {
		log.error(validation.error || 'Invalid scenario name');
		return;
	}

	// Check if scenario exists
	if (checkScenarioExists(suiteName, finalName)) {
		log.error(`Scenario "${finalName}" already exists in suite "${suiteName}" at suites/${suiteName}/scenarios/${finalName}/`);
		return;
	}

	const s = spinner();
	s.start('Creating scenario structure...');

	try {
		// Create scenario directory
		const scenarioPath = join(suitesDir, suiteName, 'scenarios', finalName);
		mkdirSync(scenarioPath, { recursive: true });

		// Create prompts directory for this scenario
		const promptsPath = join(suitesDir, suiteName, 'prompts', finalName);
		mkdirSync(promptsPath, { recursive: true });

		s.message('Copying scenario template...');

		// Copy and customize scenario.yaml template
		const templatePath = join(root, 'docs', 'templates', 'scenario.yaml');
		if (!existsSync(templatePath)) {
			throw new Error(`Template file not found: ${templatePath}`);
		}

		let templateContent = readFileSync(templatePath, 'utf8');
		// Replace placeholders
		templateContent = templateContent.replace(/^id: my-scenario$/m, `id: ${finalName}`);
		templateContent = templateContent.replace(/^suite: my-suite$/m, `suite: ${suiteName}`);

		const scenarioYamlPath = join(scenarioPath, 'scenario.yaml');
		writeFileSync(scenarioYamlPath, templateContent);

		s.message('Creating oracle-answers.json...');

		// Create oracle-answers.json
		const oraclePath = join(scenarioPath, 'oracle-answers.json');
		writeFileSync(oraclePath, '{}\n');

		s.message('Creating repo-fixture directory...');

		// Create repo-fixture directory
		const repoFixturePath = join(scenarioPath, 'repo-fixture');
		mkdirSync(repoFixturePath, { recursive: true });

		s.message('Copying repo-fixture guide to README.md...');

		// Copy repo-fixture.md template content into README.md inside repo-fixture
		const repoFixtureTemplatePath = join(root, 'docs', 'templates', 'repo-fixture.md');
		if (existsSync(repoFixtureTemplatePath)) {
			const templateContent = readFileSync(repoFixtureTemplatePath, 'utf8');
			const repoFixtureReadmePath = join(repoFixturePath, 'README.md');
			writeFileSync(repoFixtureReadmePath, templateContent);
		} else {
			log.warning(`Template file not found: ${repoFixtureTemplatePath}`);
			// Create a basic README if template is missing
			const repoFixtureReadmePath = join(repoFixturePath, 'README.md');
			const basicContent = `# Repository Fixture

This directory contains the starting codebase state for this scenario.

## Setup Instructions

1. Add a \`package.json\` file with your project dependencies
2. Include source files, tests, and configuration files
3. Ensure the fixture represents the starting state before the agent performs the task
4. Test that baseline commands (install, build, test) work correctly
`;
			writeFileSync(repoFixtureReadmePath, basicContent);
		}

		s.message('Creating default prompt tiers...');

		// Create default prompt tier files
		const promptTiers = [
			{ file: 'L0-minimal.md', content: 'Complete the task with minimal guidance.\n' },
			{ file: 'L1-basic.md', content: 'Complete the task with basic context and requirements.\n\nConstraints and goals:\n- Follow best practices\n- Ensure correctness\n' },
			{ file: 'L2-directed.md', content: 'Complete the task with detailed guidance.\n\nConstraints and goals:\n- Follow all specified requirements\n- Maintain code quality\n- Ensure tests pass\n- Handle edge cases appropriately\n\nIf major changes are required, ask before proceeding.\n' }
		];

		for (const tier of promptTiers) {
			const tierPath = join(promptsPath, tier.file);
			writeFileSync(tierPath, tier.content);
		}

		s.stop('Scenario created');

		// Show relative paths
		const scenarioRelativePath = join('suites', suiteName, 'scenarios', finalName);
		const promptsRelativePath = join('suites', suiteName, 'prompts', finalName);

		logger.suite.raw(`\n${chalk.green('✓')} Scenario created:`);
		logger.suite.raw(`   ${chalk.cyan('Scenario:')} ${scenarioRelativePath}/`);
		logger.suite.raw(`   ${chalk.cyan('Prompts:')} ${promptsRelativePath}/`);
		const repoFixtureRelativePath = join('suites', suiteName, 'scenarios', finalName, 'repo-fixture');

		logger.suite.raw(`\n${chalk.gray('Created files:')}`);
		logger.suite.raw(`   - ${scenarioRelativePath}/scenario.yaml`);
		logger.suite.raw(`   - ${scenarioRelativePath}/oracle-answers.json`);
		logger.suite.raw(`   - ${repoFixtureRelativePath}/README.md ${chalk.dim('(setup guide)')}`);
		logger.suite.raw(`   - ${repoFixtureRelativePath}/ ${chalk.dim('(empty - add your fixture files here)')}`);
		logger.suite.raw(`   - ${promptsRelativePath}/L0-minimal.md`);
		logger.suite.raw(`   - ${promptsRelativePath}/L1-basic.md`);
		logger.suite.raw(`   - ${promptsRelativePath}/L2-directed.md`);
		logger.suite.raw(`\n${chalk.yellow('Next steps:')}`);
		logger.suite.raw(`   ${chalk.cyan('1.')} Read ${chalk.bold('repo-fixture/README.md')} for setup instructions`);
		logger.suite.raw(`   ${chalk.cyan('2.')} Add your starting codebase to ${chalk.bold('repo-fixture/')} directory`);
		logger.suite.raw(`   ${chalk.cyan('3.')} Customize ${chalk.bold('scenario.yaml')} with your scenario configuration`);
		logger.suite.raw(`   ${chalk.cyan('4.')} Update prompt files in ${chalk.bold('prompts/')} directory`);

		outro(chalk.green(`Scenario "${finalName}" created successfully in suite "${suiteName}"`));
	} catch (error) {
		s.stop('Failed to create scenario');
		log.error(`Failed to create scenario: ${error instanceof Error ? error.message : String(error)}`);
	}
}

export { createNewSuite, createNewScenario };
