/**
 * LLM Client Factory
 *
 * Creates and configures LLM clients for different providers
 */

import { OpenAI } from 'openai';

export type LLMProvider = 'openrouter' | 'anthropic';

/**
 * Create LLM client for specified provider
 *
 * @param provider LLM provider ('openrouter' or 'anthropic')
 * @returns OpenAI-compatible client or null if API key not found
 */
export function createLLMClient(provider: LLMProvider): OpenAI | null {
  if (provider === 'openrouter') {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      console.warn('[LLM Client] OPENROUTER_API_KEY not found');
      return null;
    }

    return new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: apiKey
    });
  }

  if (provider === 'anthropic') {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.warn('[LLM Client] ANTHROPIC_API_KEY not found');
      return null;
    }

    return new OpenAI({
      baseURL: 'https://api.anthropic.com/v1',
      apiKey: apiKey,
      defaultHeaders: {
        'anthropic-version': '2023-06-01'
      }
    });
  }

  return null;
}
