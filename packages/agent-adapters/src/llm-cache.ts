/**
 * In-memory cache for LLM prompt selection and variable extraction results
 *
 * Implements TTL-based caching to reduce LLM API calls for similar prompts
 */

import type { PromptSelectionResult, ExtractedVariables } from './llm-prompt-selector.js';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * LLM result cache with TTL support
 */
export class LLMCache {
  private selectionCache = new Map<string, CacheEntry<PromptSelectionResult>>();
  private variablesCache = new Map<string, CacheEntry<ExtractedVariables>>();
  private readonly ttl: number;

  /**
   * Create a new cache instance
   *
   * @param ttlMs Time-to-live in milliseconds (default 1 hour)
   */
  constructor(ttlMs: number = 3600000) {
    this.ttl = ttlMs;
  }

  /**
   * Get cached prompt selection result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached result or null if not found/expired
   */
  getSelection(cacheKey: string): PromptSelectionResult | null {
    const cached = this.selectionCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expires < Date.now()) {
      // Expired, remove from cache
      this.selectionCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  /**
   * Store prompt selection result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param result Selection result to cache
   */
  setSelection(cacheKey: string, result: PromptSelectionResult): void {
    this.selectionCache.set(cacheKey, {
      value: result,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Get cached variable extraction result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached variables or null if not found/expired
   */
  getVariables(cacheKey: string): ExtractedVariables | null {
    const cached = this.variablesCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expires < Date.now()) {
      // Expired, remove from cache
      this.variablesCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  /**
   * Store variable extraction result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param variables Extracted variables to cache
   */
  setVariables(cacheKey: string, variables: ExtractedVariables): void {
    this.variablesCache.set(cacheKey, {
      value: variables,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.selectionCache.clear();
    this.variablesCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats (size, hit rate tracking would require additional implementation)
   */
  getStats(): { selectionCacheSize: number; variablesCacheSize: number } {
    return {
      selectionCacheSize: this.selectionCache.size,
      variablesCacheSize: this.variablesCache.size
    };
  }

  /**
   * Clean up expired entries (optional periodic maintenance)
   */
  cleanupExpired(): void {
    const now = Date.now();

    // Clean selection cache
    for (const [key, entry] of this.selectionCache.entries()) {
      if (entry.expires < now) {
        this.selectionCache.delete(key);
      }
    }

    // Clean variables cache
    for (const [key, entry] of this.variablesCache.entries()) {
      if (entry.expires < now) {
        this.variablesCache.delete(key);
      }
    }
  }
}
