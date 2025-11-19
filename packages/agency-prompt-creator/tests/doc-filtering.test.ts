import { expect, test, describe } from '@rstest/core';
import { filterDocumentation } from '../src/doc-filter';
import type { SpecialistTemplate } from '../src/types';

const createTemplate = (documentation: any[]): SpecialistTemplate => ({
  name: '@test/doc-filtering',
  version: '1.0.0',
  persona: {
    purpose: 'Test specialist',
    tech_stack: ['React', 'TypeScript'],
  },
  capabilities: {
    tags: ['ui', 'components'],
  },
  prompts: {
    default: {
      spawnerPrompt: 'Test',
    },
  },
  documentation,
});

describe('Documentation Filtering with Keywords', () => {
  describe('Framework Keyword Matching', () => {
    test('prioritizes vite docs when user mentions vite', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/vite',
          description: 'Vite Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Vite project',
            key_concepts: ['vite', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['vite-setup'],
            code_patterns: ['npm create vite@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/next',
          description: 'Next.js Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Next.js project',
            key_concepts: ['next', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['nextjs-setup'],
            code_patterns: ['npx create-next-app@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
      ]);

      const docs = filterDocumentation(
        template,
        'project_setup',
        'Generate a new shadcn project, use vite and add the button component',
        5
      );

      // Vite doc should score higher than Next.js doc
      expect(docs.length).toBe(2);
      expect(docs[0].title).toBe('Vite Installation');
      expect(docs[0].relevance_score).toBeGreaterThan(docs[1].relevance_score);
    });

    test('penalizes competing framework docs', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/vite',
          description: 'Vite Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Vite project',
            key_concepts: ['vite', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['vite-setup'],
            code_patterns: ['npm create vite@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/next',
          description: 'Next.js Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Next.js project',
            key_concepts: ['next', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['nextjs-setup'],
            code_patterns: ['npx create-next-app@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
      ]);

      const docs = filterDocumentation(
        template,
        'project_setup',
        'Create a vite project',
        5
      );

      // Next.js doc should be penalized (has competing framework "next")
      const viteDoc = docs.find(d => d.title === 'Vite Installation');
      const nextDoc = docs.find(d => d.title === 'Next.js Installation');

      expect(viteDoc).toBeDefined();
      expect(nextDoc).toBeDefined();
      expect(viteDoc!.relevance_score).toBeGreaterThan(nextDoc!.relevance_score);
    });
  });

  describe('Component Keyword Matching', () => {
    test('prioritizes button docs when user mentions button', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/components/button',
          description: 'Button Component',
          enrichment: {
            summary: 'A clickable button component',
            key_concepts: ['button', 'component'],
            relevant_for_tasks: ['component_generation'],
            relevant_tech_stack: ['React'],
            relevant_tags: ['button', 'ui'],
            code_patterns: ['<Button>Click me</Button>'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/components/form',
          description: 'Form Component',
          enrichment: {
            summary: 'A form component',
            key_concepts: ['form', 'component'],
            relevant_for_tasks: ['component_generation'],
            relevant_tech_stack: ['React'],
            relevant_tags: ['form', 'ui'],
            code_patterns: ['<Form>...</Form>'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
      ]);

      const docs = filterDocumentation(
        template,
        'component_generation',
        'Add a button component',
        5
      );

      expect(docs[0].title).toBe('Button Component');
      expect(docs[0].relevance_score).toBeGreaterThan(docs[1].relevance_score);
    });
  });

  describe('Tag Keyword Amplification', () => {
    test('amplifies score when tag matches user keyword', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/vite',
          description: 'Vite Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Vite project',
            key_concepts: ['vite', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['vite-setup', 'vite', 'installation'],
            code_patterns: ['npm create vite@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
      ]);

      const docs = filterDocumentation(
        template,
        'project_setup',
        'Create a vite project',
        5
      );

      // Should get base score + tag keyword amplification
      expect(docs[0].relevance_score).toBeGreaterThan(40); // Base scores + amplification
    });
  });

  describe('Multiple Keywords Combined', () => {
    test('scores docs with multiple keyword matches higher', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/vite',
          description: 'Vite Installation with Button',
          enrichment: {
            summary: 'How to install shadcn/ui in a Vite project and add button',
            key_concepts: ['vite', 'button', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['vite-setup', 'button'],
            code_patterns: ['npm create vite@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/vite',
          description: 'Vite Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Vite project',
            key_concepts: ['vite', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['vite-setup'],
            code_patterns: ['npm create vite@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
      ]);

      const docs = filterDocumentation(
        template,
        'project_setup',
        'Create a vite project with button component',
        5
      );

      // First doc matches both "vite" and "button", should score higher
      expect(docs[0].title).toBe('Vite Installation with Button');
      expect(docs[0].relevance_score).toBeGreaterThan(docs[1].relevance_score);
    });
  });

  describe('Documentation Limit', () => {
    test('respects maxDocs limit', () => {
      const template = createTemplate(
        Array.from({ length: 10 }, (_, i) => ({
          type: 'official',
          url: `https://example.com/doc${i}`,
          description: `Doc ${i}`,
          enrichment: {
            summary: `Documentation ${i}`,
            key_concepts: ['test'],
            relevant_for_tasks: ['default'],
            relevant_tech_stack: ['React'],
            relevant_tags: ['test'],
            code_patterns: ['code'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        }))
      );

      const docs = filterDocumentation(template, 'default', 'test', 3);
      expect(docs.length).toBe(3);
    });
  });

  describe('No Enriched Documentation', () => {
    test('returns empty array when no enriched docs', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://example.com/doc',
          description: 'Doc without enrichment',
          // No enrichment field
        },
      ]);

      const docs = filterDocumentation(template, 'default', 'test', 5);
      expect(docs).toEqual([]);
    });

    test('filters out non-enriched docs', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://example.com/doc1',
          description: 'Doc with enrichment',
          enrichment: {
            summary: 'Summary',
            key_concepts: ['test'],
            relevant_for_tasks: ['default'],
            relevant_tech_stack: ['React'],
            relevant_tags: ['test'],
            code_patterns: ['code'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
        {
          type: 'official',
          url: 'https://example.com/doc2',
          description: 'Doc without enrichment',
          // No enrichment
        },
      ]);

      const docs = filterDocumentation(template, 'default', 'test', 5);
      expect(docs.length).toBe(1);
      expect(docs[0].title).toBe('Doc with enrichment');
    });
  });

  describe('Score Breakdown', () => {
    test('includes all scoring components', () => {
      const template = createTemplate([
        {
          type: 'official',
          url: 'https://ui.shadcn.com/docs/installation/vite',
          description: 'Vite Installation',
          enrichment: {
            summary: 'How to install shadcn/ui in a Vite project',
            key_concepts: ['vite', 'installation'],
            relevant_for_tasks: ['project_setup'],
            relevant_tech_stack: ['React', 'TypeScript'],
            relevant_tags: ['vite-setup', 'vite'],
            code_patterns: ['npm create vite@latest'],
            last_enriched: '2025-01-01',
            enrichment_model: 'test',
          },
        },
      ]);

      const docs = filterDocumentation(
        template,
        'project_setup',
        'Create a vite project with React and TypeScript',
        5
      );

      // Score should include:
      // - Task type match: +10
      // - Tech stack matches (React, TypeScript): +10 (2 * 5)
      // - Framework keyword (vite): +30
      // - Tech keywords (react, typescript): +20 (2 * 10)
      // - Tag keyword amplification (vite-setup, vite): +50 (2 * 25)
      // - Doc type (official): +2
      // Total: 122
      expect(docs[0].relevance_score).toBeGreaterThan(100);
    });
  });
});
