import { expect, test, describe } from '@rstest/core';
import { selectPrompt } from '../src/prompt-selection';
import type { SpecialistTemplate } from '../src/types';

const baseTemplate: SpecialistTemplate = {
  name: '@test/model-matching',
  version: '1.0.0',
  persona: {
    purpose: 'Test specialist',
  },
  prompts: {
    default: {
      spawnerPrompt: 'Default prompt',
    },
    model_specific: {
      'claude-sonnet-4.5': {
        spawnerPrompt: 'Claude Sonnet 4.5 prompt',
      },
      'anthropic/claude-opus-4': {
        spawnerPrompt: 'Claude Opus 4 prompt',
      },
      'gpt-4o': {
        spawnerPrompt: 'GPT-4o prompt',
      },
    },
  },
};

describe('Model Matching Flexibility', () => {
  describe('Exact Matching', () => {
    test('matches exact model name', () => {
      const result = selectPrompt(baseTemplate, 'default', 'claude-sonnet-4.5');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Sonnet 4.5 prompt');
    });

    test('matches exact model name with provider prefix', () => {
      const result = selectPrompt(baseTemplate, 'default', 'anthropic/claude-opus-4');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Opus 4 prompt');
    });
  });

  describe('Provider Prefix Normalization', () => {
    test('matches model with provider prefix to model without prefix', () => {
      // Template has "claude-sonnet-4.5", user provides "anthropic/claude-sonnet-4.5"
      const result = selectPrompt(baseTemplate, 'default', 'anthropic/claude-sonnet-4.5');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Sonnet 4.5 prompt');
    });

    test('matches model without provider prefix to model with prefix', () => {
      // Template has "anthropic/claude-opus-4", user provides "claude-opus-4"
      const result = selectPrompt(baseTemplate, 'default', 'claude-opus-4');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Opus 4 prompt');
    });

    test('matches with different provider prefixes', () => {
      // Template has "anthropic/claude-opus-4", user provides "openai/claude-opus-4" (unlikely but should normalize)
      const result = selectPrompt(baseTemplate, 'default', 'openai/claude-opus-4');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Opus 4 prompt');
    });
  });

  describe('Version Prefix Matching', () => {
    test('matches shorter version to longer version', () => {
      // Template has "claude-sonnet-4.5", user provides "claude-sonnet-4"
      const result = selectPrompt(baseTemplate, 'default', 'claude-sonnet-4');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Sonnet 4.5 prompt');
    });

    test('matches longer version to shorter version', () => {
      // Template has "gpt-4o", user provides "gpt-4o-mini" (should match as prefix)
      const result = selectPrompt(baseTemplate, 'default', 'gpt-4o-mini');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('GPT-4o prompt');
    });

    test('version matching with provider prefix', () => {
      // Template has "anthropic/claude-opus-4", user provides "anthropic/claude-opus-4.0"
      const result = selectPrompt(baseTemplate, 'default', 'anthropic/claude-opus-4.0');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Opus 4 prompt');
    });
  });

  describe('Case Insensitivity', () => {
    test('matches case-insensitive model names', () => {
      const result = selectPrompt(baseTemplate, 'default', 'CLAUDE-SONNET-4.5');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Sonnet 4.5 prompt');
    });

    test('matches case-insensitive with provider prefix', () => {
      const result = selectPrompt(baseTemplate, 'default', 'Anthropic/Claude-Opus-4');
      expect(result.usedModelSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Claude Opus 4 prompt');
    });
  });

  describe('Fallback Behavior', () => {
    test('falls back to default when no match found', () => {
      const result = selectPrompt(baseTemplate, 'default', 'unknown-model');
      expect(result.usedModelSpecific).toBe(false);
      expect(result.config.spawnerPrompt).toBe('Default prompt');
    });

    test('falls back to default when model not provided', () => {
      const result = selectPrompt(baseTemplate, 'default');
      expect(result.usedModelSpecific).toBe(false);
      expect(result.config.spawnerPrompt).toBe('Default prompt');
    });
  });

  describe('Task-Specific Model Matching', () => {
    test('matches model in task-specific prompts', () => {
      const templateWithTaskSpecific: SpecialistTemplate = {
        ...baseTemplate,
        prompts: {
          ...baseTemplate.prompts,
          project_setup: {
            default: {
              spawnerPrompt: 'Setup default prompt',
            },
            model_specific: {
              'claude-sonnet-4.5': {
                spawnerPrompt: 'Setup Claude Sonnet 4.5 prompt',
              },
            },
          },
        },
      };

      const result = selectPrompt(
        templateWithTaskSpecific,
        'project_setup',
        'anthropic/claude-sonnet-4.5'
      );

      expect(result.usedModelSpecific).toBe(true);
      expect(result.usedTaskSpecific).toBe(true);
      expect(result.config.spawnerPrompt).toBe('Setup Claude Sonnet 4.5 prompt');
    });
  });

  describe('Real-world Scenarios', () => {
    test('openrouter format matches template format', () => {
      // User uses OpenRouter format: "anthropic/claude-sonnet-4.5"
      // Template has: "claude-sonnet-4.5"
      const result = selectPrompt(baseTemplate, 'default', 'anthropic/claude-sonnet-4.5');
      expect(result.usedModelSpecific).toBe(true);
    });

    test('direct API format matches template format', () => {
      // User uses direct API format: "claude-sonnet-4"
      // Template has: "claude-sonnet-4.5"
      const result = selectPrompt(baseTemplate, 'default', 'claude-sonnet-4');
      expect(result.usedModelSpecific).toBe(true);
    });

    test('handles common model variations', () => {
      const variations = [
        'claude-sonnet-4.5',
        'anthropic/claude-sonnet-4.5',
        'claude-sonnet-4',
        'anthropic/claude-sonnet-4',
        'CLAUDE-SONNET-4.5',
      ];

      variations.forEach(variation => {
        const result = selectPrompt(baseTemplate, 'default', variation);
        expect(result.usedModelSpecific).toBe(true);
      });
    });
  });
});
