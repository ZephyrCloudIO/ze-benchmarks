import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { CommandResult } from './validation.ts';

export type PackageManager = 'pnpm' | 'npm' | 'yarn' | 'bun' | 'unknown';

export interface TestResult {
  passed: number;
  failed: number;
  skipped?: number;
  total: number;
  failedTests?: string[];
  output?: string;
}

/**
 * Detects which package manager was used based on lockfiles in the workspace
 */
export function detectPackageManager(workspaceDir: string): PackageManager {
  if (existsSync(join(workspaceDir, 'pnpm-lock.yaml'))) {
    return 'pnpm';
  }
  if (existsSync(join(workspaceDir, 'package-lock.json'))) {
    return 'npm';
  }
  if (existsSync(join(workspaceDir, 'yarn.lock'))) {
    return 'yarn';
  }
  if (existsSync(join(workspaceDir, 'bun.lockb'))) {
    return 'bun';
  }
  
  // Try to infer from install command if available
  return 'unknown';
}

/**
 * Extracts package manager from install command if lockfile detection fails
 */
export function extractPackageManagerFromCommand(commandLog: CommandResult[]): PackageManager {
  const installCmd = commandLog.find(cmd => cmd.type === 'install');
  if (!installCmd) {
    return 'unknown';
  }
  
  const cmd = installCmd.raw.toLowerCase();
  if (cmd.includes('pnpm')) {
    return 'pnpm';
  }
  if (cmd.includes('npm')) {
    return 'npm';
  }
  if (cmd.includes('yarn')) {
    return 'yarn';
  }
  if (cmd.includes('bun')) {
    return 'bun';
  }
  
  return 'unknown';
}

/**
 * Parses test results from test command output
 * Supports multiple test frameworks: Jest, Vitest, Mocha, etc.
 */
export function extractTestResults(commandLog: CommandResult[]): TestResult | null {
  const testCmd = commandLog.find(cmd => cmd.type === 'test');
  if (!testCmd) {
    return null;
  }
  
  const output = (testCmd.stdout || '') + '\n' + (testCmd.stderr || '');
  const combinedOutput = output.toLowerCase();
  
  // Try Jest/Vitest format: "Tests: X passed, Y failed, Z total"
  // or "PASS" / "FAIL" with test counts
  let passed = 0;
  let failed = 0;
  let skipped = 0;
  let failedTests: string[] = [];
  
  // Pattern 1: Jest/Vitest summary format
  // "Tests:       5 passed, 1 failed, 6 total"
  const jestSummaryMatch = output.match(/tests?:\s*(\d+)\s*(?:passed|pass|✓|✅)/i);
  const jestFailedMatch = output.match(/tests?:\s*.*?(\d+)\s*(?:failed|fail|✗|❌)/i);
  const jestTotalMatch = output.match(/tests?:\s*.*?(\d+)\s*total/i);
  const jestSkippedMatch = output.match(/(\d+)\s*(?:skipped|skip)/i);
  
  if (jestSummaryMatch || jestFailedMatch || jestTotalMatch) {
    passed = jestSummaryMatch ? parseInt(jestSummaryMatch[1], 10) : 0;
    failed = jestFailedMatch ? parseInt(jestFailedMatch[1], 10) : 0;
    skipped = jestSkippedMatch ? parseInt(jestSkippedMatch[1], 10) : 0;
    const total = jestTotalMatch ? parseInt(jestTotalMatch[1], 10) : passed + failed + skipped;
    
    // Extract failed test names from Jest/Vitest output
    const failedTestMatches = output.matchAll(/FAIL\s+([^\n]+)|✗\s+([^\n]+)|❌\s+([^\n]+)/gi);
    for (const match of failedTestMatches) {
      const testName = (match[1] || match[2] || match[3] || '').trim();
      if (testName && !failedTests.includes(testName)) {
        failedTests.push(testName);
      }
    }
    
    return {
      passed,
      failed,
      skipped: skipped > 0 ? skipped : undefined,
      total: total || passed + failed + skipped,
      failedTests: failedTests.length > 0 ? failedTests : undefined,
      output: output.length > 10000 ? output.substring(0, 10000) + '... (truncated)' : output
    };
  }
  
  // Pattern 2: Mocha format
  // "5 passing (2s)" or "5 passing, 1 failing"
  const mochaPassMatch = output.match(/(\d+)\s+passing/i);
  const mochaFailMatch = output.match(/(\d+)\s+failing/i);
  
  if (mochaPassMatch || mochaFailMatch) {
    passed = mochaPassMatch ? parseInt(mochaPassMatch[1], 10) : 0;
    failed = mochaFailMatch ? parseInt(mochaFailMatch[1], 10) : 0;
    
    // Extract failed test names from Mocha
    const failedTestMatches = output.matchAll(/\d+\)\s+([^\n]+)\s+\([^)]+\)/g);
    for (const match of failedTestMatches) {
      const testName = match[1]?.trim();
      if (testName && !failedTests.includes(testName)) {
        failedTests.push(testName);
      }
    }
    
    return {
      passed,
      failed,
      total: passed + failed,
      failedTests: failedTests.length > 0 ? failedTests : undefined,
      output: output.length > 10000 ? output.substring(0, 10000) + '... (truncated)' : output
    };
  }
  
  // Pattern 3: Simple pass/fail based on exit code
  // If exit code is 0, assume all tests passed (or no tests)
  // If exit code is non-zero, assume tests failed
  if (testCmd.exitCode === 0) {
    // Try to extract any numbers from output as a fallback
    const anyNumberMatch = output.match(/(\d+)/);
    const testCount = anyNumberMatch ? parseInt(anyNumberMatch[1], 10) : 0;
    
    return {
      passed: testCount || 1, // Assume at least 1 test passed if exit code is 0
      failed: 0,
      total: testCount || 1,
      output: output.length > 10000 ? output.substring(0, 10000) + '... (truncated)' : output
    };
  } else {
    // Tests failed - try to extract failure information
    const failedTestMatches = output.matchAll(/(?:FAIL|✗|❌|Error|Failed):\s*([^\n]+)/gi);
    for (const match of failedTestMatches) {
      const testName = match[1]?.trim();
      if (testName && !failedTests.includes(testName)) {
        failedTests.push(testName);
      }
    }
    
    return {
      passed: 0,
      failed: failedTests.length || 1, // At least 1 failure if exit code is non-zero
      total: failedTests.length || 1,
      failedTests: failedTests.length > 0 ? failedTests : undefined,
      output: output.length > 10000 ? output.substring(0, 10000) + '... (truncated)' : output
    };
  }
}

