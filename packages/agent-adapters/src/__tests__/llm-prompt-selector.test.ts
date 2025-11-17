/**
 * Unit tests for LLM prompt selection utilities
 */

import {
  buildPromptSelectionPrompt,
  parsePromptSelectionResponse,
  buildVariableExtractionPrompt,
  parseToolCallResponse,
  validateExtractedVariables,
  applyDefaults,
  createCacheKey,
  type ExtractedVariables
} from '../llm-prompt-selector';

describe('buildPromptSelectionPrompt', () => {
  it('should build a valid selection prompt with default prompts', () => {
    const prompts = {
      default: {
        spawnerPrompt: 'I am a specialist',
        project_setup: 'Set up a {framework} project'
      }
    };

    const result = buildPromptSelectionPrompt('Create a new Vite project', prompts);

    expect(result).toContain('User Request: "Create a new Vite project"');
    expect(result).toContain('default.spawnerPrompt');
    expect(result).toContain('default.project_setup');
    expect(result).toContain('Available Templates:');
  });

  it('should include model-specific prompts when model is provided', () => {
    const prompts = {
      default: {
        spawnerPrompt: 'I am a specialist'
      },
      model_specific: {
        'claude-sonnet-4.5': {
          spawnerPrompt: 'Claude specific prompt',
          project_setup: 'Claude specific setup'
        }
      }
    };

    const result = buildPromptSelectionPrompt('Setup project', prompts, 'claude-sonnet-4.5');

    expect(result).toContain('model_specific.claude-sonnet-4.5.spawnerPrompt');
    expect(result).toContain('model_specific.claude-sonnet-4.5.project_setup');
  });
});

describe('parsePromptSelectionResponse', () => {
  it('should parse valid JSON response', () => {
    const response = JSON.stringify({
      selected_prompt_id: 'default.project_setup',
      confidence: 'High',
      reasoning: 'User wants to setup a project'
    });

    const result = parsePromptSelectionResponse(response);

    expect(result.selectedPromptId).toBe('default.project_setup');
    expect(result.confidence).toBe('High');
    expect(result.reasoning).toBe('User wants to setup a project');
  });

  it('should parse JSON from markdown code blocks', () => {
    const response = `Here's my response:
\`\`\`json
{
  "selected_prompt_id": "model_specific.claude-sonnet-4.5.component_add",
  "confidence": "High",
  "reasoning": "User wants to add a component"
}
\`\`\``;

    const result = parsePromptSelectionResponse(response);

    expect(result.selectedPromptId).toBe('model_specific.claude-sonnet-4.5.component_add');
    expect(result.confidence).toBe('High');
  });

  it('should throw error if JSON is invalid', () => {
    const response = 'not json at all';

    expect(() => parsePromptSelectionResponse(response)).toThrow('No JSON found in LLM response');
  });

  it('should throw error if required fields are missing', () => {
    const response = JSON.stringify({
      selected_prompt_id: 'default.project_setup'
      // missing confidence and reasoning
    });

    expect(() => parsePromptSelectionResponse(response)).toThrow('Missing required fields');
  });

  it('should throw error if confidence level is invalid', () => {
    const response = JSON.stringify({
      selected_prompt_id: 'default.project_setup',
      confidence: 'VeryHigh', // invalid
      reasoning: 'test'
    });

    expect(() => parsePromptSelectionResponse(response)).toThrow('Invalid confidence level');
  });
});

describe('buildVariableExtractionPrompt', () => {
  it('should build a valid extraction prompt', () => {
    const userPrompt = 'Create a Vite project with pnpm';
    const template = 'Set up a {framework} project with {packageManager}';

    const result = buildVariableExtractionPrompt(userPrompt, template);

    expect(result).toContain(userPrompt);
    expect(result).toContain('extract_template_variables');
    expect(result).toContain('Extract ONLY explicitly mentioned');
  });

  it('should truncate long templates', () => {
    const userPrompt = 'Create a Vite project';
    const template = 'a'.repeat(500);

    const result = buildVariableExtractionPrompt(userPrompt, template);

    expect(result.length).toBeLessThan(template.length + 500); // Should be truncated
    expect(result).toContain('...');
  });
});

describe('parseToolCallResponse', () => {
  it('should parse tool call with input object', () => {
    const toolCall = {
      input: {
        framework: 'Vite',
        packageManager: 'pnpm'
      }
    };

    const result = parseToolCallResponse(toolCall);

    expect(result.framework).toBe('Vite');
    expect(result.packageManager).toBe('pnpm');
  });

  it('should parse tool call with arguments object', () => {
    const toolCall = {
      arguments: {
        framework: 'Next.js',
        componentName: 'button'
      }
    };

    const result = parseToolCallResponse(toolCall);

    expect(result.framework).toBe('Next.js');
    expect(result.componentName).toBe('button');
  });

  it('should parse tool call with JSON string input', () => {
    const toolCall = {
      input: JSON.stringify({
        framework: 'Remix',
        baseColor: 'zinc'
      })
    };

    const result = parseToolCallResponse(toolCall);

    expect(result.framework).toBe('Remix');
    expect(result.baseColor).toBe('zinc');
  });

  it('should throw error for invalid tool call', () => {
    expect(() => parseToolCallResponse(null)).toThrow('Invalid tool call object');
    expect(() => parseToolCallResponse('string')).toThrow('Tool call input is not an object');
  });
});

describe('validateExtractedVariables', () => {
  it('should validate and normalize framework values', () => {
    const vars: ExtractedVariables = {
      framework: 'vite', // lowercase
      packageManager: 'pnpm'
    };

    const result = validateExtractedVariables(vars);

    expect(result.framework).toBe('Vite'); // normalized to proper case
  });

  it('should use default for invalid framework', () => {
    const vars: ExtractedVariables = {
      framework: 'InvalidFramework'
    };

    const result = validateExtractedVariables(vars);

    expect(result.framework).toBe('Vite'); // default
  });

  it('should normalize package manager to lowercase', () => {
    const vars: ExtractedVariables = {
      packageManager: 'PNPM'
    };

    const result = validateExtractedVariables(vars);

    expect(result.packageManager).toBe('pnpm');
  });

  it('should use default for invalid package manager', () => {
    const vars: ExtractedVariables = {
      packageManager: 'invalid'
    };

    const result = validateExtractedVariables(vars);

    expect(result.packageManager).toBe('pnpm');
  });

  it('should normalize base color to lowercase', () => {
    const vars: ExtractedVariables = {
      baseColor: 'SLATE'
    };

    const result = validateExtractedVariables(vars);

    expect(result.baseColor).toBe('slate');
  });

  it('should use default for invalid base color', () => {
    const vars: ExtractedVariables = {
      baseColor: 'rainbow' as any
    };

    const result = validateExtractedVariables(vars);

    expect(result.baseColor).toBe('slate');
  });

  it('should preserve other variables unchanged', () => {
    const vars: ExtractedVariables = {
      componentName: 'MyButton',
      features: 'dark mode, theming',
      issueType: 'build error',
      description: 'Some description'
    };

    const result = validateExtractedVariables(vars);

    expect(result.componentName).toBe('MyButton');
    expect(result.features).toBe('dark mode, theming');
    expect(result.issueType).toBe('build error');
    expect(result.description).toBe('Some description');
  });
});

describe('applyDefaults', () => {
  it('should apply default package manager for project_setup', () => {
    const vars: ExtractedVariables = {};

    const result = applyDefaults(vars, 'default.project_setup');

    expect(result.packageManager).toBe('pnpm');
  });

  it('should apply default framework for project_setup', () => {
    const vars: ExtractedVariables = {};

    const result = applyDefaults(vars, 'model_specific.claude.project_setup');

    expect(result.framework).toBe('Vite');
  });

  it('should not override existing values', () => {
    const vars: ExtractedVariables = {
      packageManager: 'npm',
      framework: 'Next.js'
    };

    const result = applyDefaults(vars, 'default.project_setup');

    expect(result.packageManager).toBe('npm'); // not overridden
    expect(result.framework).toBe('Next.js'); // not overridden
  });

  it('should apply theme defaults for theme_setup', () => {
    const vars: ExtractedVariables = {};

    const result = applyDefaults(vars, 'default.theme_setup');

    expect(result.themeType).toBe('CSS variables');
    expect(result.baseColor).toBe('slate');
  });

  it('should not apply defaults for non-matching prompt types', () => {
    const vars: ExtractedVariables = {};

    const result = applyDefaults(vars, 'default.troubleshoot');

    expect(result.packageManager).toBeUndefined();
    expect(result.framework).toBeUndefined();
  });
});

describe('createCacheKey', () => {
  it('should create consistent keys for same prompt', () => {
    const prompt = 'Create a Vite project with pnpm';

    const key1 = createCacheKey(prompt);
    const key2 = createCacheKey(prompt);

    expect(key1).toBe(key2);
  });

  it('should create different keys for different prompts', () => {
    const prompt1 = 'Create a Vite project';
    const prompt2 = 'Create a Next.js project';

    const key1 = createCacheKey(prompt1);
    const key2 = createCacheKey(prompt2);

    expect(key1).not.toBe(key2);
  });

  it('should create keys with prompt_ prefix', () => {
    const key = createCacheKey('test prompt');

    expect(key).toMatch(/^prompt_/);
  });

  it('should handle empty prompts', () => {
    const key = createCacheKey('');

    expect(key).toMatch(/^prompt_/);
  });
});
