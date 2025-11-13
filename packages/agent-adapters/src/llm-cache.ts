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
 * LLM result cache with TTL support
 */
export class LLMCache {
  private selectionCache = new Map<string, CacheEntry<PromptSelectionResult>>();
  private variablesCache = new Map<string, CacheEntry<ExtractedVariables>>();
  private intentCache = new Map<string, CacheEntry<ExtractedIntent>>();
  private componentSelectionCache = new Map<string, CacheEntry<SpecialistSelection>>();
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
   * Get cached intent extraction result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached intent or null if not found/expired
   */
  getIntent(cacheKey: string): ExtractedIntent | null {
    const cached = this.intentCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expires < Date.now()) {
      // Expired, remove from cache
      this.intentCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  /**
   * Store intent extraction result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param intent Intent to cache
   */
  setIntent(cacheKey: string, intent: ExtractedIntent): void {
    this.intentCache.set(cacheKey, {
      value: intent,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Get cached component selection result
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @returns Cached selection or null if not found/expired
   */
  getComponentSelection(cacheKey: string): SpecialistSelection | null {
    const cached = this.componentSelectionCache.get(cacheKey);

    if (!cached) {
      return null;
    }

    if (cached.expires < Date.now()) {
      // Expired, remove from cache
      this.componentSelectionCache.delete(cacheKey);
      return null;
    }

    return cached.value;
  }

  /**
   * Store component selection result in cache
   *
   * @param cacheKey Cache key (typically hash of user prompt)
   * @param selection Selection to cache
   */
  setComponentSelection(cacheKey: string, selection: SpecialistSelection): void {
    this.componentSelectionCache.set(cacheKey, {
      value: selection,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Generic get method for any cached value
   *
   * @param cacheKey Cache key
   * @returns Cached value or null if not found/expired
   */
  get(cacheKey: string): any {
    // Try all caches
    return this.getIntent(cacheKey) ||
           this.getComponentSelection(cacheKey) ||
           this.getSelection(cacheKey) ||
           this.getVariables(cacheKey);
  }

  /**
   * Generic set method for any cached value
   * Note: This is a simple implementation that tries to infer the type
   * For better type safety, use the specific methods above
   *
   * @param cacheKey Cache key
   * @param value Value to cache
   */
  set(cacheKey: string, value: any): void {
    // Store in a generic cache
    const genericCache = new Map<string, CacheEntry<any>>();
    if (!this.hasOwnProperty('genericCache')) {
      (this as any).genericCache = genericCache;
    }
    ((this as any).genericCache as Map<string, CacheEntry<any>>).set(cacheKey, {
      value,
      expires: Date.now() + this.ttl
    });
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.selectionCache.clear();
    this.variablesCache.clear();
    this.intentCache.clear();
    this.componentSelectionCache.clear();
    if ((this as any).genericCache) {
      ((this as any).genericCache as Map<string, CacheEntry<any>>).clear();
    }
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
      selectionCacheSize: this.selectionCache.size,
      variablesCacheSize: this.variablesCache.size,
      intentCacheSize: this.intentCache.size,
      componentSelectionCacheSize: this.componentSelectionCache.size
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

    // Clean intent cache
    for (const [key, entry] of this.intentCache.entries()) {
      if (entry.expires < now) {
        this.intentCache.delete(key);
      }
    }

    // Clean component selection cache
    for (const [key, entry] of this.componentSelectionCache.entries()) {
      if (entry.expires < now) {
        this.componentSelectionCache.delete(key);
      }
    }

    // Clean generic cache if it exists
    if ((this as any).genericCache) {
      for (const [key, entry] of ((this as any).genericCache as Map<string, CacheEntry<any>>).entries()) {
        if (entry.expires < now) {
          ((this as any).genericCache as Map<string, CacheEntry<any>>).delete(key);
        }
      }
    }
  }
}
