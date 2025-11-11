import { describe, test, expect } from 'vitest';
import { mapToShadCN, mapToRadix, mapToMUI } from '../src/mapper.js';

describe('Semantic Component Mapping', () => {
  describe('ShadCN mapping', () => {
    test('maps Button to ShadCN Button', () => {
      const mapping = mapToShadCN('Button');
      expect(mapping).toBeDefined();
      expect(mapping?.libraryName).toBe('Button');
      expect(mapping?.library).toBe('shadcn');
    });

    test('maps Input to ShadCN Input', () => {
      const mapping = mapToShadCN('Input');
      expect(mapping).toBeDefined();
      expect(mapping?.libraryName).toBe('Input');
    });
  });

  describe('Radix mapping', () => {
    test('maps Button to Radix Button', () => {
      const mapping = mapToRadix('Button');
      expect(mapping).toBeDefined();
      expect(mapping?.library).toBe('radix');
    });
  });

  describe('MUI mapping', () => {
    test('maps Button to MUI Button', () => {
      const mapping = mapToMUI('Button');
      expect(mapping).toBeDefined();
      expect(mapping?.library).toBe('mui');
    });
  });

  describe('Prop mappings', () => {
    test('includes prop mappings for Button', () => {
      const mapping = mapToShadCN('Button');
      expect(mapping?.propMappings).toBeDefined();
      expect(mapping?.propMappings.length).toBeGreaterThan(0);
    });
  });

  describe('Variant mappings', () => {
    test('includes variant mappings for Button', () => {
      const mapping = mapToShadCN('Button');
      expect(mapping?.variantMappings).toBeDefined();
      expect(mapping?.variantMappings.length).toBeGreaterThan(0);
    });
  });
});
