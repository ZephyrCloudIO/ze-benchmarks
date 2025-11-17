#!/usr/bin/env tsx
/**
 * Specialist Engine CLI
 * Command-line interface for the specialist engine
 */

// Load .env from project root (2 levels up from packages/specialist-engine/src/cli/)
import { config } from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve to project root: packages/specialist-engine/src/cli -> packages/specialist-engine -> packages -> root
const projectRoot = resolve(__dirname, '../../../../');
config({ path: resolve(projectRoot, '.env') });

import { intro, outro, text, select, confirm, spinner, log } from '@clack/prompts';
import chalk from 'chalk';
import { SpecialistEngine } from '../engine.js';
import type { ExtractionConfig, GeneratorConfig } from '../types/index.js';

const engine = new SpecialistEngine();

async function main() {
  console.clear();

  intro(chalk.bgCyan(' Specialist Engine '));

  // Get command
  const command = process.argv[2];

  if (!command || command === 'help' || command === '--help' || command === '-h') {
    showHelp();
    return;
  }

  switch (command) {
    case 'create':
      await createSpecialist();
      break;
    case 'extract':
      await extractOnly();
      break;
    case 'enrich':
      await enrichOnly();
      break;
    default:
      log.error(`Unknown command: ${command}`);
      log.info('Run "specialist-engine help" for usage information');
      process.exit(1);
  }
}

async function createSpecialist() {
  log.info('Creating a new specialist from documentation...\n');

  // Get configuration from user
  const domain = await text({
    message: 'What is the domain? (e.g., shadcn-ui, next.js)',
    placeholder: 'shadcn-ui',
    validate: (value) => {
      if (!value) return 'Domain is required';
    }
  });

  if (typeof domain !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const framework = await text({
    message: 'What framework? (leave empty to use domain)',
    placeholder: domain as string
  });

  const docsUrl = await text({
    message: 'Documentation URL?',
    placeholder: 'https://ui.shadcn.com/docs',
    validate: (value) => {
      if (!value) return 'Documentation URL is required';
      if (!value.toString().startsWith('http')) return 'Must be a valid URL';
    }
  });

  if (typeof docsUrl !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const name = await text({
    message: 'Specialist name?',
    placeholder: `@zephyr/${domain}-specialist`,
    initialValue: `@zephyr/${domain}-specialist`
  });

  if (typeof name !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const version = await text({
    message: 'Version?',
    placeholder: '1.0.0',
    initialValue: '1.0.0'
  });

  if (typeof version !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const outputDir = await text({
    message: 'Output directory?',
    placeholder: `./specialists/${domain}-specialist`,
    initialValue: `./specialists/${domain}-specialist`
  });

  if (typeof outputDir !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const enrichDocs = await confirm({
    message: 'Enrich documentation with metadata?',
    initialValue: true
  });

  const generateTiers = await confirm({
    message: 'Generate tier-based prompts?',
    initialValue: true
  });

  let baseTask = 'Set up project';
  let scenario = 'project-setup';

  if (generateTiers) {
    const taskInput = await text({
      message: 'Base task description?',
      placeholder: 'Set up new project',
      initialValue: 'Set up new project'
    });

    if (typeof taskInput === 'string') {
      baseTask = taskInput;
    }

    const scenarioInput = await text({
      message: 'Scenario name?',
      placeholder: 'project-setup',
      initialValue: 'project-setup'
    });

    if (typeof scenarioInput === 'string') {
      scenario = scenarioInput;
    }
  }

  // Build configuration
  const extractionConfig: ExtractionConfig = {
    domain: domain as string,
    framework: (framework as string) || (domain as string),
    sources: {
      documentation: [docsUrl as string]
    },
    depth: 'standard'
  };

  const outputConfig: GeneratorConfig = {
    outputDir: resolve(outputDir as string),
    includeBenchmarks: false,
    includeDocs: true,
    includeExamples: false,
    format: 'json5'
  };

  // Create specialist
  const s = spinner();
  s.start('Creating specialist...');

  try {
    const pkg = await engine.createSpecialist({
      extraction: extractionConfig,
      template: {
        name: name as string,
        version: version as string
      },
      enrichment: {
        enrichDocumentation: enrichDocs as boolean,
        generateTiers: generateTiers as boolean,
        baseTask,
        scenario
      },
      output: outputConfig
    });

    s.stop('Specialist created successfully!');

    log.success(`\n✅ Specialist package created at: ${chalk.cyan(pkg.path)}`);
    log.info(`\n📦 Files created: ${pkg.files.length}`);
    pkg.files.forEach(file => {
      log.info(`  - ${file}`);
    });

    outro(chalk.green('Done! Your specialist is ready to use.'));
  } catch (error) {
    s.stop('Failed');
    log.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    outro(chalk.red('Specialist creation failed'));
    process.exit(1);
  }
}

async function extractOnly() {
  log.info('Extracting knowledge from documentation...\n');

  const domain = await text({
    message: 'Domain?',
    placeholder: 'shadcn-ui'
  });

  const docsUrl = await text({
    message: 'Documentation URL?',
    placeholder: 'https://ui.shadcn.com/docs'
  });

  if (typeof domain !== 'string' || typeof docsUrl !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const s = spinner();
  s.start('Extracting knowledge...');

  try {
    const knowledge = await engine.extract({
      domain,
      sources: {
        documentation: [docsUrl]
      },
      depth: 'standard'
    });

    s.stop('Knowledge extracted!');

    log.success(`\n✅ Extracted:`);
    log.info(`  - ${knowledge.concepts.length} concepts`);
    log.info(`  - ${knowledge.gotchas.length} gotchas`);
    log.info(`  - ${knowledge.bestPractices.length} best practices`);
    log.info(`  - ${knowledge.configurations.length} configurations`);

    outro(chalk.green('Extraction complete!'));
  } catch (error) {
    s.stop('Failed');
    log.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    outro(chalk.red('Extraction failed'));
    process.exit(1);
  }
}

async function enrichOnly() {
  log.info('Enriching an existing specialist template...\n');

  const templatePath = await text({
    message: 'Path to existing template file?',
    placeholder: './specialists/shadcn-specialist/shadcn-specialist-template.json5',
    validate: (value) => {
      if (!value) return 'Template path is required';
      const { existsSync } = require('node:fs');
      if (!existsSync(value)) return 'Template file does not exist';
      if (!value.endsWith('.json5')) return 'Template must be a .json5 file';
    }
  });

  if (typeof templatePath !== 'string') {
    outro(chalk.red('Cancelled'));
    return;
  }

  const enrichDocs = await confirm({
    message: 'Enrich documentation with metadata?',
    initialValue: true
  });

  const generateTiers = await confirm({
    message: 'Generate tier-based prompts?',
    initialValue: false
  });

  let baseTask = '';
  let scenario = '';

  if (generateTiers) {
    const taskInput = await text({
      message: 'Base task description?',
      placeholder: 'Set up new project',
      initialValue: 'Set up new project'
    });

    if (typeof taskInput === 'string') {
      baseTask = taskInput;
    }

    const scenarioInput = await text({
      message: 'Scenario name?',
      placeholder: 'project-setup',
      initialValue: 'project-setup'
    });

    if (typeof scenarioInput === 'string') {
      scenario = scenarioInput;
    }
  }

  const s = spinner();
  s.start('Enriching template...');

  try {
    const { enrichExistingTemplate } = await import('../modules/enricher.js');
    const { saveEnrichedTemplate } = await import('../modules/generator.js');

    // Enrich the template
    const result = await enrichExistingTemplate(templatePath, {
      enrichDocumentation: enrichDocs as boolean,
      generateTiers: generateTiers as boolean,
      baseTask,
      scenario
    });

    // Save enriched template
    const enrichedPath = saveEnrichedTemplate(result.template, templatePath);

    s.stop('Template enriched successfully!');

    log.success(`\n✅ Enriched template saved at: ${chalk.cyan(enrichedPath)}`);
    log.info(`\n📦 Template: ${result.template.name} v${result.template.version}`);
    
    if (result.template.documentation) {
      const enrichedCount = result.template.documentation.filter(d => d.enrichment).length;
      log.info(`📄 Documentation entries enriched: ${enrichedCount}/${result.template.documentation.length}`);
    }

    if (result.tiers && Object.keys(result.tiers.tiers).length > 0) {
      log.info(`📝 Tier prompts generated: ${Object.keys(result.tiers.tiers).length}`);
    }

    outro(chalk.green('Enrichment complete!'));
  } catch (error) {
    s.stop('Failed');
    log.error(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
    outro(chalk.red('Enrichment failed'));
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
${chalk.bold('Specialist Engine CLI')}

${chalk.dim('Usage:')}
  specialist-engine <command> [options]

${chalk.dim('Commands:')}
  ${chalk.cyan('create')}      Create a new specialist from documentation
  ${chalk.cyan('extract')}     Extract knowledge from documentation only
  ${chalk.cyan('enrich')}      Enrich an existing template
  ${chalk.cyan('help')}        Show this help message

${chalk.dim('Examples:')}
  ${chalk.gray('# Interactive specialist creation')}
  specialist-engine create

  ${chalk.gray('# Extract knowledge only')}
  specialist-engine extract

  ${chalk.gray('# Enrich existing template')}
  specialist-engine enrich

${chalk.dim('Environment Variables:')}
  ${chalk.yellow('OPENROUTER_API_KEY')}  Required for LLM-powered extraction

${chalk.dim('Documentation:')}
  https://github.com/ZephyrCloudIO/ze-benchmarks
`);

  outro(chalk.dim('For more information, visit the documentation'));
}

// Run CLI
main().catch((error) => {
  console.error(chalk.red('\n[CLI Error]'), error);
  process.exit(1);
});