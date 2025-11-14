#!/usr/bin/env node
/**
 * Copy sql.js WASM file to public directory
 * This ensures the WASM file is available at /sql-wasm.wasm
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rootDir = resolve(__dirname, '..');
const publicDir = resolve(rootDir, 'public');
const wasmTarget = resolve(publicDir, 'sql-wasm.wasm');

function findWasmFile() {
  const nodeModulesRoot = resolve(rootDir, '../node_modules');
  
  // Try pnpm structure first (.pnpm/sql.js@VERSION/node_modules/sql.js/dist/)
  const pnpmDir = join(nodeModulesRoot, '.pnpm');
  if (existsSync(pnpmDir)) {
    try {
      const entries = readdirSync(pnpmDir);
      const sqlJsDir = entries.find(entry => entry.startsWith('sql.js@'));
      if (sqlJsDir) {
        const wasmPath = join(pnpmDir, sqlJsDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
        if (existsSync(wasmPath)) {
          return wasmPath;
        }
      }
    } catch (err) {
      // Continue to try other paths
    }
  }
  
  // Try direct node_modules path (npm/yarn)
  const directPath = join(nodeModulesRoot, 'sql.js', 'dist', 'sql-wasm.wasm');
  if (existsSync(directPath)) {
    return directPath;
  }
  
  // Try local node_modules (if installed locally)
  const localPath = join(rootDir, 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');
  if (existsSync(localPath)) {
    return localPath;
  }
  
  return null;
}

try {
  const wasmSource = findWasmFile();
  
  if (!wasmSource) {
    console.warn('⚠️  sql-wasm.wasm not found in node_modules. Make sure sql.js is installed.');
    console.warn('   Run: pnpm install');
    process.exit(0); // Don't fail, just warn
  }
  
  // Ensure public directory exists
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true });
  }
  
  // Copy WASM file
  copyFileSync(wasmSource, wasmTarget);
  console.log('✅ Copied sql-wasm.wasm to public directory');
} catch (error) {
  console.error('❌ Failed to copy sql-wasm.wasm:', error.message);
  process.exit(1);
}

