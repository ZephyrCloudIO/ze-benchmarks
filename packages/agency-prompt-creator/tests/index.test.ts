import { expect, test, describe } from '@rstest/core';
import {
  createPrompt,
  loadTemplateFromString,
  detectTaskType,
  mergeTemplates,
  substituteTemplate,
  validateTemplate,
} from '../src/index';
import type { SpecialistTemplate } from '../src/index';

// Test fixtures
const baseTemplate: SpecialistTemplate = {
  name: '@test/base',
  version: '1.0.0',
  persona: {
    purpose: 'Base specialist',
    values: ['Quality', 'Performance'],
    tech_stack: ['TypeScript', 'Node.js'],
  },
  capabilities: {
    tags: ['typescript', 'testing'],
  },
  prompts: {
    default: {
      spawnerPrompt: 'You are a helpful assistant.',
      systemPrompt: 'Follow best practices.',
    },
  },
};

const childTemplate: Partial<SpecialistTemplate> = {
  name: '@test/child',
  version: '2.0.0',
  persona: {
    purpose: 'Child specialist',
    tech_stack: ['TypeScript', 'React'],
  },
  capabilities: {
    tags: ['react', 'ui'],
  },
};

describe('Template Inheritance', () => {
  test('merges primitives - child overrides parent', () => {
    const merged = mergeTemplates(baseTemplate, childTemplate);
    expect(merged.name).toBe('@test/child');
    expect(merged.version).toBe('2.0.0');
  });

  test('deep merges objects - child keys override parent', () => {
    const merged = mergeTemplates(baseTemplate, childTemplate);
    expect(merged.persona.purpose).toBe('Child specialist');
    expect(merged.persona.values).toEqual(['Quality', 'Performance']); // From parent
  });

  test('replaces arrays - no merging', () => {
    const merged = mergeTemplates(baseTemplate, childTemplate);
    expect(merged.persona.tech_stack).toEqual(['TypeScript', 'React']); // Child replaces
    expect(merged.capabilities.tags).toEqual(['react', 'ui']); // Child replaces
  });

  test('validates template structure', () => {
    expect(validateTemplate(baseTemplate)).toBe(true);
    expect(validateTemplate({})).toBe(false);
    expect(validateTemplate({ name: 'test' })).toBe(false);
  });
});

describe('Task Detection', () => {
  test('detects project_setup', () => {
    expect(detectTaskType('Setup a new React project')).toBe('project_setup');
    expect(detectTaskType('Initialize a new app')).toBe('project_setup');
    expect(detectTaskType('Create new project from scratch')).toBe('project_setup');
  });

  test('detects component_generation', () => {
    expect(detectTaskType('Create a button component')).toBe('component_generation');
    expect(detectTaskType('Generate a new modal')).toBe('component_generation');
    expect(detectTaskType('Add a navbar component')).toBe('component_generation');
  });

  test('detects migration', () => {
    expect(detectTaskType('Migrate to React 18')).toBe('migration');
    expect(detectTaskType('Upgrade from Vue 2 to Vue 3')).toBe('migration');
    expect(detectTaskType('Convert JavaScript to TypeScript')).toBe('migration');
  });

  test('detects bug_fix', () => {
    expect(detectTaskType('Fix the login bug')).toBe('bug_fix');
    expect(detectTaskType('Debug the error in component')).toBe('bug_fix');
    expect(detectTaskType('The app is not working')).toBe('bug_fix');
  });

  test('detects refactoring', () => {
    expect(detectTaskType('Refactor the code')).toBe('refactoring');
    expect(detectTaskType('Clean up the components')).toBe('refactoring');
    expect(detectTaskType('Optimize the performance')).toBe('refactoring');
  });

  test('returns default for unmatched prompts', () => {
    expect(detectTaskType('Hello world')).toBe('default');
    expect(detectTaskType('Random text')).toBe('default');
  });
});

describe('Template Substitution', () => {
  test('substitutes simple variables', () => {
    const template = 'Hello {{name}}!';
    const context = { name: 'World' };
    expect(substituteTemplate(template, context)).toBe('Hello World!');
  });

  test('substitutes nested properties', () => {
    const template = 'Purpose: {{persona.purpose}}';
    const context = { persona: { purpose: 'Testing' } };
    expect(substituteTemplate(template, context)).toBe('Purpose: Testing');
  });

  test('handles missing values', () => {
    const template = 'Value: {{missing}}';
    const context = {};
    expect(substituteTemplate(template, context)).toBe('Value: ');
  });

  test('handles arrays', () => {
    const template = 'Tags: {{tags}}';
    const context = { tags: ['one', 'two', 'three'] };
    expect(substituteTemplate(template, context)).toBe('Tags: one, two, three');
  });

  test('handles multiple substitutions', () => {
    const template = '{{greeting}} {{name}}, your role is {{role}}';
    const context = { greeting: 'Hello', name: 'User', role: 'Developer' };
    expect(substituteTemplate(template, context)).toBe(
      'Hello User, your role is Developer'
    );
  });
});

describe('Prompt Creation', () => {
  test('creates prompt with default settings', () => {
    const result = createPrompt(baseTemplate, {
      userPrompt: 'Create a button component',
    });

    expect(result.taskType).toBe('component_generation');
    expect(result.usedModelSpecific).toBe(false);
    expect(result.prompt).toContain('You are a helpful assistant');
    expect(result.prompt).toContain('Follow best practices');
  });

  test('uses provided task type', () => {
    const result = createPrompt(baseTemplate, {
      userPrompt: 'Some task',
      taskType: 'refactoring',
    });

    expect(result.taskType).toBe('refactoring');
  });

  test('selects model-specific prompt when available', () => {
    const templateWithModelSpecific: SpecialistTemplate = {
      ...baseTemplate,
      prompts: {
        default: {
          spawnerPrompt: 'Default prompt',
        },
        model_specific: {
          'claude-sonnet-4.5': {
            spawnerPrompt: 'Claude-specific prompt',
          },
        },
      },
    };

    const result = createPrompt(templateWithModelSpecific, {
      userPrompt: 'Test',
      model: 'claude-sonnet-4.5',
    });

    expect(result.usedModelSpecific).toBe(true);
    expect(result.prompt).toContain('Claude-specific prompt');
  });

  test('performs template substitution in prompts', () => {
    const templateWithVariables: SpecialistTemplate = {
      ...baseTemplate,
      prompts: {
        default: {
          spawnerPrompt: 'You are {{persona.purpose}} specialized in {{tech_stack}}',
        },
      },
    };

    const result = createPrompt(templateWithVariables, {
      userPrompt: 'Test',
    });

    expect(result.prompt).toContain('Base specialist');
    expect(result.prompt).toContain('TypeScript');
  });
});

describe('Template Loading', () => {
  test('loads template from string', () => {
    const json = JSON.stringify(baseTemplate);
    const loaded = loadTemplateFromString(json);

    expect(loaded.name).toBe('@test/base');
    expect(loaded.version).toBe('1.0.0');
    expect(loaded.persona.purpose).toBe('Base specialist');
  });

  test('throws error on invalid JSON', () => {
    expect(() => loadTemplateFromString('invalid json')).toThrow();
  });

  test('throws error on invalid template structure', () => {
    const invalidTemplate = JSON.stringify({ name: 'test' });
    expect(() => loadTemplateFromString(invalidTemplate)).toThrow();
  });
});

describe('Edge Cases', () => {
  test('handles empty prompts object', () => {
    const template: SpecialistTemplate = {
      ...baseTemplate,
      prompts: {
        default: {
          spawnerPrompt: '',
        },
      },
    };

    const result = createPrompt(template, {
      userPrompt: 'Test',
    });

    expect(result.prompt).toBe('');
  });

  test('handles template with no tech_stack', () => {
    const template: SpecialistTemplate = {
      ...baseTemplate,
      persona: {
        purpose: 'Test',
      },
    };

    const result = createPrompt(template, {
      userPrompt: 'Test',
    });

    expect(result.prompt).toBeDefined();
  });

  test('handles complex nested substitutions', () => {
    const template = 'Name: {{name}}, Version: {{version}}, Purpose: {{persona.purpose}}';
    const context = {
      name: '@test/specialist',
      version: '1.0.0',
      persona: { purpose: 'Testing' },
    };

    const result = substituteTemplate(template, context);
    expect(result).toBe('Name: @test/specialist, Version: 1.0.0, Purpose: Testing');
  });
});
