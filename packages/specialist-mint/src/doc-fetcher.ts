/**
 * Documentation Fetcher
 *
 * Fetches documentation content from URLs or file paths
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import type { SpecialistTemplate } from './types.js';

/**
 * Documentation entry type
 */
type DocumentationEntry = NonNullable<SpecialistTemplate['documentation']>[number];

/**
 * Fetch documentation content from URL or file path
 *
 * @param doc Documentation resource entry
 * @returns Content as string
 */
export async function fetchDocumentation(
  doc: DocumentationEntry
): Promise<string> {
  // Check url field first
  if (doc.url) {
    return await fetchFromURL(doc.url);
  }

  // Check path field - could be URL or file path
  if (doc.path) {
    // If path looks like a URL, fetch it as URL
    if (isURL(doc.path)) {
      return await fetchFromURL(doc.path);
    }
    // Otherwise treat as file path
    return fetchFromFile(doc.path);
  }

  throw new Error('Documentation entry must have either url or path');
}

/**
 * Check if a string is a URL
 */
function isURL(str: string): boolean {
  return str.startsWith('http://') || str.startsWith('https://');
}

/**
 * Fetch documentation from URL
 */
async function fetchFromURL(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';

    // Handle HTML
    if (contentType.includes('text/html')) {
      const html = await response.text();
      return extractTextFromHTML(html);
    }

    // Handle JSON
    if (contentType.includes('application/json')) {
      const json = await response.json();
      return JSON.stringify(json, null, 2);
    }

    // Handle plain text / markdown
    return await response.text();
  } catch (error) {
    throw new Error(`Failed to fetch from URL: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Fetch documentation from file path
 */
function fetchFromFile(path: string): string {
  try {
    const resolvedPath = path.startsWith('.')
      ? resolve(process.cwd(), path)
      : path;

    return readFileSync(resolvedPath, 'utf-8');
  } catch (error) {
    throw new Error(`Failed to read file: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Extract meaningful text from HTML
 * Simple approach - just strip tags and clean up
 */
function extractTextFromHTML(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');

  // Remove HTML tags
  text = text.replace(/<[^>]+>/g, ' ');

  // Decode common HTML entities
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");

  // Clean up whitespace
  text = text.replace(/\s+/g, ' ');
  text = text.trim();

  return text;
}
