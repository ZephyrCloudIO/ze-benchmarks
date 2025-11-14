#!/usr/bin/env tsx
/**
 * Check if D1 database tables exist
 * Usage: tsx scripts/check-db.ts [--remote]
 */

const isRemote = process.argv.includes('--remote');
const location = isRemote ? 'remote' : 'local';

async function checkTables() {
  try {
    // Use wrangler to check if tables exist
    const { execSync } = require('child_process');
    
    console.log(`Checking ${location} D1 database for existing tables...\n`);
    
    // Try to query the batch_runs table
    const command = `wrangler d1 execute ze-benchmarks ${isRemote ? '--remote' : '--local'} --command="SELECT name FROM sqlite_master WHERE type='table' AND name='batch_runs';"`;
    
    try {
      const result = execSync(command, { encoding: 'utf-8', stdio: 'pipe' });
      
      if (result.includes('batch_runs')) {
        console.log('✓ Tables already exist in the database.');
        console.log('  The migration has likely already been applied.');
        console.log('  You can skip running db:push:local or db:push:remote.');
        return true;
      }
    } catch (error: any) {
      // If query fails, tables might not exist
      if (error.message.includes('no such table')) {
        console.log('✗ Tables do not exist. You need to run migrations.');
        return false;
      }
      // Other errors (like database not found) are handled below
      throw error;
    }
    
    return false;
  } catch (error: any) {
    if (error.message.includes("Couldn't find a D1 DB")) {
      console.log(`✗ ${location} D1 database not found or not initialized.`);
      if (!isRemote) {
        console.log('  For local: Run "pnpm dev" first to initialize the local D1 database.');
      } else {
        console.log('  For remote: Create the database with "wrangler d1 create ze-benchmarks"');
        console.log('  Then update database_id in wrangler.toml');
      }
      return false;
    }
    throw error;
  }
}

checkTables().then(exists => {
  process.exit(exists ? 0 : 1);
}).catch(error => {
  console.error('Error:', error.message);
  process.exit(1);
});

