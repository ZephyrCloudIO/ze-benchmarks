/**
 * Unit tests for LLM cache
 */

import { LLMCache } from '../llm-cache';
import type { PromptSelectionResult, ExtractedVariables } from '../llm-prompt-selector';

describe('LLMCache', () => {
  let cache: LLMCache;

  beforeEach(() => {
    cache = new LLMCache(1000); // 1 second TTL for testing
  });

  describe('Selection cache', () => {
    it('should store and retrieve selection results', () => {
      const result: PromptSelectionResult = {
        selectedPromptId: 'default.project_setup',
        confidence: 'High',
        reasoning: 'User wants to setup a project'
      };

      cache.setSelection('test-key', result);
      const retrieved = cache.getSelection('test-key');

      expect(retrieved).toEqual(result);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.getSelection('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for expired entries', async () => {
      const result: PromptSelectionResult = {
        selectedPromptId: 'default.project_setup',
        confidence: 'High',
        reasoning: 'Test'
      };

      cache.setSelection('test-key', result);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const retrieved = cache.getSelection('test-key');

      expect(retrieved).toBeNull();
    });

    it('should remove expired entries on access', async () => {
      const result: PromptSelectionResult = {
        selectedPromptId: 'default.project_setup',
        confidence: 'High',
        reasoning: 'Test'
      };

      cache.setSelection('test-key', result);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));

      cache.getSelection('test-key');

      const stats = cache.getStats();
      expect(stats.selectionCacheSize).toBe(0);
    });
  });

  describe('Variables cache', () => {
    it('should store and retrieve variable extraction results', () => {
      const vars: ExtractedVariables = {
        framework: 'Vite',
        packageManager: 'pnpm'
      };

      cache.setVariables('test-key', vars);
      const retrieved = cache.getVariables('test-key');

      expect(retrieved).toEqual(vars);
    });

    it('should return null for non-existent keys', () => {
      const result = cache.getVariables('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for expired entries', async () => {
      const vars: ExtractedVariables = {
        framework: 'Next.js'
      };

      cache.setVariables('test-key', vars);

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const retrieved = cache.getVariables('test-key');

      expect(retrieved).toBeNull();
    });

    it('should handle empty variable objects', () => {
      const vars: ExtractedVariables = {};

      cache.setVariables('test-key', vars);
      const retrieved = cache.getVariables('test-key');

      expect(retrieved).toEqual({});
    });
  });

  describe('Cache management', () => {
    it('should clear all cached entries', () => {
      const selection: PromptSelectionResult = {
        selectedPromptId: 'test',
        confidence: 'High',
        reasoning: 'test'
      };
      const vars: ExtractedVariables = { framework: 'Vite' };

      cache.setSelection('key1', selection);
      cache.setVariables('key2', vars);

      expect(cache.getStats().selectionCacheSize).toBe(1);
      expect(cache.getStats().variablesCacheSize).toBe(1);

      cache.clear();

      expect(cache.getStats().selectionCacheSize).toBe(0);
      expect(cache.getStats().variablesCacheSize).toBe(0);
    });

    it('should provide accurate cache statistics', () => {
      const selection: PromptSelectionResult = {
        selectedPromptId: 'test',
        confidence: 'High',
        reasoning: 'test'
      };
      const vars: ExtractedVariables = { framework: 'Vite' };

      cache.setSelection('key1', selection);
      cache.setSelection('key2', selection);
      cache.setVariables('key3', vars);

      const stats = cache.getStats();

      expect(stats.selectionCacheSize).toBe(2);
      expect(stats.variablesCacheSize).toBe(1);
    });

    it('should clean up expired entries', async () => {
      const selection: PromptSelectionResult = {
        selectedPromptId: 'test',
        confidence: 'High',
        reasoning: 'test'
      };

      cache.setSelection('key1', selection);
      cache.setSelection('key2', selection);

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Add new entry
      cache.setSelection('key3', selection);

      // Clean up expired
      cache.cleanupExpired();

      const stats = cache.getStats();
      expect(stats.selectionCacheSize).toBe(1); // Only key3 should remain
    });
  });

  describe('TTL configuration', () => {
    it('should use custom TTL', async () => {
      const shortCache = new LLMCache(500); // 500ms TTL
      const result: PromptSelectionResult = {
        selectedPromptId: 'test',
        confidence: 'High',
        reasoning: 'test'
      };

      shortCache.setSelection('key', result);

      // Before expiry
      expect(shortCache.getSelection('key')).not.toBeNull();

      // Wait for expiry
      await new Promise(resolve => setTimeout(resolve, 600));

      // After expiry
      expect(shortCache.getSelection('key')).toBeNull();
    });

    it('should use default TTL of 1 hour', async () => {
      const defaultCache = new LLMCache();
      const result: PromptSelectionResult = {
        selectedPromptId: 'test',
        confidence: 'High',
        reasoning: 'test'
      };

      defaultCache.setSelection('key', result);

      // Should still be valid after 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(defaultCache.getSelection('key')).not.toBeNull();
    });
  });

  describe('Multiple cache instances', () => {
    it('should maintain separate caches', () => {
      const cache1 = new LLMCache();
      const cache2 = new LLMCache();

      const result: PromptSelectionResult = {
        selectedPromptId: 'test',
        confidence: 'High',
        reasoning: 'test'
      };

      cache1.setSelection('key', result);

      expect(cache1.getSelection('key')).not.toBeNull();
      expect(cache2.getSelection('key')).toBeNull();
    });
  });
});
