import { expect, test } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

test('App Router migration completed successfully', () => {
  console.log('🧪 Running: App Router migration completed successfully');
  const rootDir = process.cwd();
  
  // 1. App directory should exist
  const appDir = join(rootDir, 'app');
  const appDirExists = existsSync(appDir);
  console.log(`  ✓ App directory exists: ${appDirExists}`);
  expect(appDirExists).toBe(true);
  
  // 2. App Router files should exist
  const layoutPath = join(appDir, 'layout.tsx');
  const pagePath = join(appDir, 'page.tsx');
  
  const layoutExists = existsSync(layoutPath);
  const pageExists = existsSync(pagePath);
  console.log(`  ✓ Layout file exists: ${layoutExists}`);
  console.log(`  ✓ Page file exists: ${pageExists}`);
  expect(layoutExists).toBe(true);
  expect(pageExists).toBe(true);
  console.log('✅ Test passed: App Router migration completed successfully');
});

test('App layout.tsx has proper structure', () => {
  console.log('🧪 Running: App layout.tsx has proper structure');
  const rootDir = process.cwd();
  const layoutPath = join(rootDir, 'app', 'layout.tsx');
  
  if (existsSync(layoutPath)) {
    const layoutContent = readFileSync(layoutPath, 'utf-8');
    
    // Should export default function (either function or const arrow function)
    const hasExport = /export\s+(default\s+)?(function|const)/.test(layoutContent);
    console.log(`  ✓ Has export statement: ${hasExport}`);
    expect(layoutContent).toMatch(/export\s+(default\s+)?(function|const)/);
    
    // Should have children prop or children in JSX
    const hasChildren = /children/.test(layoutContent);
    console.log(`  ✓ Has children prop: ${hasChildren}`);
    expect(layoutContent).toMatch(/children/);
    
    // Should have html and body tags (or return JSX)
    const hasHtmlBody = layoutContent.match(/<html/) && layoutContent.match(/<body/);
    const hasJsxReturn = layoutContent.match(/return\s*\(/);
    const hasValidStructure = hasHtmlBody || hasJsxReturn;
    console.log(`  ✓ Has HTML/body tags: ${!!hasHtmlBody}`);
    console.log(`  ✓ Has JSX return: ${!!hasJsxReturn}`);
    expect(hasValidStructure).toBeTruthy();
    console.log('✅ Test passed: App layout.tsx has proper structure');
  } else {
    // If layout doesn't exist, that's a failure
    console.log('  ❌ Layout file does not exist');
    expect(existsSync(layoutPath)).toBe(true);
  }
});

test('App page.tsx migrated correctly', () => {
  console.log('🧪 Running: App page.tsx migrated correctly');
  const rootDir = process.cwd();
  const pagePath = join(rootDir, 'app', 'page.tsx');
  
  if (existsSync(pagePath)) {
    const pageContent = readFileSync(pagePath, 'utf-8');
    
    // Should export default function (either function or const arrow function)
    const hasExport = /export\s+(default\s+)?(function|const)/.test(pageContent);
    console.log(`  ✓ Has export statement: ${hasExport}`);
    expect(pageContent).toMatch(/export\s+(default\s+)?(function|const)/);
    
    // Should have some content (JSX return or text)
    const hasContent = pageContent.match(/return\s*\(/) || pageContent.match(/<[a-zA-Z]/);
    console.log(`  ✓ Has content (JSX/text): ${!!hasContent}`);
    expect(hasContent).toBeTruthy();
    
    // Should NOT have Next/Head imports (App Router uses layout)
    const hasHeadImport = /import.*Head.*from.*next\/head/.test(pageContent);
    console.log(`  ✓ No Next/Head import (App Router pattern): ${!hasHeadImport}`);
    expect(pageContent).not.toMatch(/import.*Head.*from.*next\/head/);
    console.log('✅ Test passed: App page.tsx migrated correctly');
  } else {
    // If page doesn't exist, that's a failure
    console.log('  ❌ Page file does not exist');
    expect(existsSync(pagePath)).toBe(true);
  }
});

test('Pages directory is removed or cleaned up', () => {
  console.log('🧪 Running: Pages directory is removed or cleaned up');
  const rootDir = process.cwd();
  const pagesDir = join(rootDir, 'pages');
  
  if (existsSync(pagesDir)) {
    const pagesContents = readdirSync(pagesDir);
    console.log(`  ℹ️  Pages directory exists with ${pagesContents.length} items: ${pagesContents.join(', ')}`);
    
    // Pages directory should be empty or only contain API routes or special files
    const nonApiFiles = pagesContents.filter(file => 
      !file.startsWith('api') && 
      !file.startsWith('_') && 
      (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js'))
    );
    
    console.log(`  ✓ Non-API/special files count: ${nonApiFiles.length}`);
    if (nonApiFiles.length > 0) {
      console.log(`  ⚠️  Found non-API files: ${nonApiFiles.join(', ')}`);
    }
    
    // Allow pages directory to exist if it only has special files (like _app, _document, or api routes)
    // The key is that the main page routes should be in app/ directory
    expect(nonApiFiles.length).toBe(0);
    console.log('✅ Test passed: Pages directory is removed or cleaned up');
  } else {
    // If pages directory doesn't exist at all, that's also fine (complete removal)
    console.log('  ✓ Pages directory does not exist (complete removal - OK)');
    console.log('✅ Test passed: Pages directory is removed or cleaned up');
  }
});

test('Navigation uses App Router patterns', () => {
  console.log('🧪 Running: Navigation uses App Router patterns');
  const rootDir = process.cwd();
  const pagePath = join(rootDir, 'app', 'page.tsx');
  
  if (existsSync(pagePath)) {
    const pageContent = readFileSync(pagePath, 'utf-8');
    
    // Should use Link component instead of anchor tags for internal navigation
    // Only check if there are internal links (href="/...")
    const hasInternalLinks = pageContent.match(/href=["']\//);
    console.log(`  ✓ Has internal links: ${!!hasInternalLinks}`);
    
    if (hasInternalLinks) {
      // If there are internal links, they should use Next.js Link component
      const usesLink = pageContent.match(/import.*Link.*from.*['"]next\/link['"]/) || 
                       pageContent.match(/<Link\s+/);
      console.log(`  ✓ Uses Next.js Link component: ${!!usesLink}`);
      expect(usesLink).toBeTruthy();
    } else {
      console.log('  ℹ️  No internal links found (test passes - not all pages need navigation)');
    }
    console.log('✅ Test passed: Navigation uses App Router patterns');
  } else {
    console.log('  ⚠️  Page file does not exist, skipping navigation test');
  }
});