#!/usr/bin/env node
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import JSON5 from 'json5';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '@ze/logger';

const log = logger.validateSchemas;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize AJV with JSON Schema draft-07 support
const ajv = new Ajv({
  strict: false, // Allow JSON5 features
  allErrors: true,
  verbose: true,
});
addFormats(ajv);

// Helper to load and parse JSON5 files
function loadJSON5(filePath: string): any {
  const content = readFileSync(filePath, 'utf-8');
  return JSON5.parse(content);
}

// Load schemas
const templateSchemaPath = join(__dirname, 'schemas', 'template.schema.jsonc');
const snapshotSchemaPath = join(__dirname, 'schemas', 'snapshot.schema.json5');

const templateSchema = loadJSON5(templateSchemaPath);
const snapshotSchema = loadJSON5(snapshotSchemaPath);

// Compile schemas
const validateTemplate = ajv.compile(templateSchema);
const validateSnapshot = ajv.compile(snapshotSchema);

// Test files - both are snapshots since they include benchmarks
const exampleFiles = {
  shadcnSnapshot: join(__dirname, '..', '..', 'starting_from_outcome', 'shadcn-specialist.json5'),
  nxSnapshot: join(__dirname, '..', '..', 'generic_nx_snapshot_example.json5'),
};

log.debug('🔍 Validating Specialist Schemas\n');
log.debug('Note: Both example files are snapshots (include benchmarks section)\n');

// Validate shadcn snapshot
log.debug('📄 Validating Snapshot: shadcn-specialist.json5');
const shadcnSnapshot = loadJSON5(exampleFiles.shadcnSnapshot);
const isShadcnValid = validateSnapshot(shadcnSnapshot);

if (isShadcnValid) {
  log.debug('✅ shadcn-specialist validation passed!\n');
} else {
  log.debug('❌ shadcn-specialist validation failed:');
  log.debug(JSON.stringify(validateSnapshot.errors, null, 2));
  log.debug();
}

// Validate nx snapshot
log.debug('📄 Validating Snapshot: generic_nx_snapshot_example.json5');
const nxSnapshot = loadJSON5(exampleFiles.nxSnapshot);
const isNxValid = validateSnapshot(nxSnapshot);

if (isNxValid) {
  log.debug('✅ generic_nx_snapshot validation passed!\n');
} else {
  log.debug('❌ generic_nx_snapshot validation failed:');
  log.debug(JSON.stringify(validateSnapshot.errors, null, 2));
  log.debug();
}

// Summary
log.debug('📊 Summary:');
log.debug(`shadcn-specialist.json5: ${isShadcnValid ? '✅ Valid' : '❌ Invalid'}`);
log.debug(`generic_nx_snapshot_example.json5: ${isNxValid ? '✅ Valid' : '❌ Invalid'}`);

// Exit with error code if validation failed
if (!isShadcnValid || !isNxValid) {
  process.exit(1);
}

log.debug('\n🎉 All snapshot schemas validated successfully!');
log.debug('\nNote: Template schema can be used for specialists without benchmarks.');
log.debug('The template schema validates all required fields and is a subset of the snapshot schema.');
