import { expect, test, describe } from '@rstest/core';
import {
  extractKeywords,
  containsKeyword,
  countKeywordMatches,
} from '../src/keyword-extraction';

describe('Keyword Extraction', () => {
  describe('Framework Keywords', () => {
    test('extracts vite framework', () => {
      const keywords = extractKeywords('Create a new vite project');
      expect(keywords.frameworks).toContain('vite');
    });

    test('extracts next framework', () => {
      const keywords = extractKeywords('Setup a Next.js application');
      expect(keywords.frameworks).toContain('next');
    });

    test('extracts multiple frameworks', () => {
      const keywords = extractKeywords('Migrate from Vite to Next.js');
      expect(keywords.frameworks).toContain('vite');
      expect(keywords.frameworks).toContain('next');
    });

    test('normalizes framework aliases', () => {
      const keywords1 = extractKeywords('Use nextjs');
      const keywords2 = extractKeywords('Use next.js');
      const keywords3 = extractKeywords('Use next');

      expect(keywords1.frameworks).toContain('next');
      expect(keywords2.frameworks).toContain('next');
      expect(keywords3.frameworks).toContain('next');
    });

    test('identifies competing frameworks', () => {
      const keywords = extractKeywords('Create a vite project');
      expect(keywords.competingFrameworks).toContain('next');
      expect(keywords.competingFrameworks).toContain('remix');
      expect(keywords.competingFrameworks).not.toContain('vite');
    });

    test('does not mark mentioned frameworks as competing', () => {
      const keywords = extractKeywords('Migrate from next to vite');
      // Both are mentioned, so neither should be in competingFrameworks
      expect(keywords.competingFrameworks).not.toContain('next');
      expect(keywords.competingFrameworks).not.toContain('vite');
    });
  });

  describe('Component Keywords', () => {
    test('extracts button component', () => {
      const keywords = extractKeywords('Create a button component');
      expect(keywords.components).toContain('button');
    });

    test('extracts multiple components', () => {
      const keywords = extractKeywords('Add a button, form, and modal');
      expect(keywords.components).toContain('button');
      expect(keywords.components).toContain('form');
      expect(keywords.components).toContain('modal');
    });

    test('extracts common UI components', () => {
      const keywords = extractKeywords('Build a navbar with dropdown menu');
      expect(keywords.components).toContain('navbar');
      expect(keywords.components).toContain('dropdown');
      expect(keywords.components).toContain('menu');
    });
  });

  describe('Tech Stack Keywords', () => {
    test('extracts typescript', () => {
      const keywords = extractKeywords('Use TypeScript for the project');
      expect(keywords.techStack).toContain('typescript');
    });

    test('extracts tailwind', () => {
      const keywords = extractKeywords('Style with Tailwind CSS');
      expect(keywords.techStack).toContain('tailwind');
    });

    test('extracts shadcn', () => {
      const keywords = extractKeywords('Use shadcn/ui components');
      expect(keywords.techStack).toContain('shadcn');
    });

    test('extracts multiple tech keywords', () => {
      const keywords = extractKeywords('Build with TypeScript, Tailwind, and Radix');
      expect(keywords.techStack).toContain('typescript');
      expect(keywords.techStack).toContain('tailwind');
      expect(keywords.techStack).toContain('radix');
    });
  });

  describe('Combined Keywords', () => {
    test('combines all keyword types', () => {
      const keywords = extractKeywords(
        'Create a new vite project with TypeScript, add a button component'
      );

      expect(keywords.allKeywords).toContain('vite');
      expect(keywords.allKeywords).toContain('typescript');
      expect(keywords.allKeywords).toContain('button');
    });

    test('handles empty prompt', () => {
      const keywords = extractKeywords('');
      expect(keywords.frameworks).toEqual([]);
      expect(keywords.components).toEqual([]);
      expect(keywords.techStack).toEqual([]);
      expect(keywords.allKeywords).toEqual([]);
    });

    test('handles prompt with no keywords', () => {
      const keywords = extractKeywords('Hello world');
      expect(keywords.frameworks).toEqual([]);
      expect(keywords.components).toEqual([]);
      expect(keywords.techStack).toEqual([]);
    });
  });

  describe('Real-world Scenarios', () => {
    test('extracts from shadcn vite benchmark prompt', () => {
      const keywords = extractKeywords(
        'Generate a new shadcn project, use vite and add the button component'
      );

      expect(keywords.frameworks).toContain('vite');
      expect(keywords.components).toContain('button');
      expect(keywords.techStack).toContain('shadcn');
      expect(keywords.competingFrameworks).toContain('next');
    });

    test('extracts from next.js project setup', () => {
      const keywords = extractKeywords(
        'Setup a new Next.js project with TypeScript and Tailwind'
      );

      expect(keywords.frameworks).toContain('next');
      expect(keywords.techStack).toContain('typescript');
      expect(keywords.techStack).toContain('tailwind');
      expect(keywords.competingFrameworks).toContain('vite');
    });
  });
});

describe('Keyword Matching Utilities', () => {
  describe('containsKeyword', () => {
    test('returns true when keyword is present', () => {
      expect(containsKeyword('This is a vite project', ['vite'])).toBe(true);
    });

    test('returns false when keyword is not present', () => {
      expect(containsKeyword('This is a react project', ['vite'])).toBe(false);
    });

    test('is case insensitive', () => {
      expect(containsKeyword('This is a VITE project', ['vite'])).toBe(true);
      expect(containsKeyword('This is a vite project', ['VITE'])).toBe(true);
    });

    test('handles multiple keywords', () => {
      expect(containsKeyword('vite and react', ['vite', 'react'])).toBe(true);
      expect(containsKeyword('vite project', ['next', 'remix'])).toBe(false);
    });

    test('handles empty inputs', () => {
      expect(containsKeyword('', ['vite'])).toBe(false);
      expect(containsKeyword('text', [])).toBe(false);
    });
  });

  describe('countKeywordMatches', () => {
    test('counts single match', () => {
      expect(countKeywordMatches('vite project', ['vite'])).toBe(1);
    });

    test('counts multiple matches', () => {
      expect(countKeywordMatches('vite and react project', ['vite', 'react'])).toBe(2);
    });

    test('returns zero for no matches', () => {
      expect(countKeywordMatches('angular project', ['vite', 'react'])).toBe(0);
    });

    test('is case insensitive', () => {
      expect(countKeywordMatches('VITE and REACT', ['vite', 'react'])).toBe(2);
    });

    test('handles empty inputs', () => {
      expect(countKeywordMatches('', ['vite'])).toBe(0);
      expect(countKeywordMatches('text', [])).toBe(0);
    });
  });
});
