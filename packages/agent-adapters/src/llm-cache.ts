/**
 * In-memory cache for LLM prompt selection and variable extraction results
 *
 * Implements TTL-based caching to reduce LLM API calls for similar prompts
 */

import type { PromptSelectionResult, ExtractedVariables } from './llm-prompt-selector.js';
import type { ExtractedIntent, SpecialistSelection } from 'agency-prompt-creator';

interface CacheEntry<T> {
  value: T;
  expires: number;
}

/**
 * Generic cache implementation with TTL support
 */
class GenericCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private readonly ttl: number;

  constructor(ttlMs: number) {
    this.ttl = ttlMs;
  }

  /**
   * Get cached value
   *
   * @param cacheKey Cache key
   * @returns Cached value or null if not found/expired
   */
  get(cacheKey: string): T | null {
    const cached = this.cache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expires < Date.now()) {
      // Expired, remove from cache
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  /**
   * Store value in cache
   *
   * @param cacheKey Cache key
   * @param value Value to cache
   */
  set(cacheKey: string, value: T): void {
    this.cache.set(cacheKey, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clean up expired entries
   */
  cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * LLM result cache with TTL support
 */
export class LLMCache {
  private selectionCache: GenericCache<PromptSelectionResult>;
  private variablesCache: GenericCache<ExtractedVariables>;
  private intentCache: GenericCache<ExtractedIntent>;
  private componentSelectionCache: GenericCache<SpecialistSelection>;

  /**
   * Create a new cache instance
   *
   * @param ttlMs Time-to-live in milliseconds (default 1 hour)
   */
  constructor(ttlMs: number = 3600000) {
    this.selectionCache = new GenericCache<PromptSelectionResult>(ttlMs);
    this.variablesCache = new GenericCache<ExtractedVariables>(ttlMs);
    this.intentCache = new GenericCache<ExtractedIntent>(ttlMs);
    this.componentSelectionCache = new GenericCache<SpecialistSelection>(ttlMs);
  }

  /**
   * Get cached prompt selection result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached result or null if not found/expired
   */
  getSelection(cacheKey: string): PromptSelectionResult | null {
    return this.selectionCache.get(cacheKey);
  }

  /**
   * Store prompt selection result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param result Selection result to cache
   */
  setSelection(cacheKey: string, result: PromptSelectionResult): void {
    this.selectionCache.set(cacheKey, result);
  }

  /**
   * Get cached variable extraction result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached variables or null if not found/expired
   */
  getVariables(cacheKey: string): ExtractedVariables | null {
    return this.variablesCache.get(cacheKey);
  }

  /**
   * Store variable extraction result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param variables Extracted variables to cache
   */
  setVariables(cacheKey: string, variables: ExtractedVariables): void {
    this.variablesCache.set(cacheKey, variables);
  }

  /**
   * Get cached intent extraction result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached intent or null if not found/expired
   */
  getIntent(cacheKey: string): ExtractedIntent | null {
    return this.intentCache.get(cacheKey);
  }

  /**
   * Store intent extraction result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param intent Intent to cache
   */
  setIntent(cacheKey: string, intent: ExtractedIntent): void {
    this.intentCache.set(cacheKey, intent);
  }

  /**
   * Get cached component selection result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached selection or null if not found/expired
   */
  getComponentSelection(cacheKey: string): SpecialistSelection | null {
    return this.componentSelectionCache.get(cacheKey);
  }

  /**
   * Store component selection result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param selection Selection to cache
   */
  setComponentSelection(cacheKey: string, selection: SpecialistSelection): void {
    this.componentSelectionCache.set(cacheKey, selection);
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.selectionCache.clear();
    this.variablesCache.clear();
    this.intentCache.clear();
    this.componentSelectionCache.clear();
  }

  /**
   * Get cache statistics
   *
   * @returns Cache stats (size, hit rate tracking would require additional implementation)
   */
  getStats(): {
    selectionCacheSize: number;
    variablesCacheSize: number;
    intentCacheSize: number;
    componentSelectionCacheSize: number;
  } {
    return {
      selectionCacheSize: this.selectionCache.size(),
      variablesCacheSize: this.variablesCache.size(),
      intentCacheSize: this.intentCache.size(),
      componentSelectionCacheSize: this.componentSelectionCache.size()
    };
  }

  /**
   * Clean up expired entries (optional periodic maintenance)
   */
  cleanupExpired(): void {
    this.selectionCache.cleanupExpired();
    this.variablesCache.cleanupExpired();
    this.intentCache.cleanupExpired();
    this.componentSelectionCache.cleanupExpired();
  }
}
