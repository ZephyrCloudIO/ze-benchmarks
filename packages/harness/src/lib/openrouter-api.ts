import { OpenAI } from 'openai';

export interface OpenRouterModel {
  id: string;
  name: string;
  description: string;
  pricing: {
    prompt: string;
    completion: string;
  };
  context_length: number;
  supported_parameters: string[];
}

export interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

export class OpenRouterAPI {
  private client: OpenAI;
  private cachedModels: OpenRouterModel[] | null = null;
  private cacheTimestamp: number = 0;
  private CACHE_TTL = 3600000; // 1 hour

  constructor(apiKey: string) {
    this.client = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey
    });
  }

  async getModelsWithToolSupport(): Promise<OpenRouterModel[]> {
    // Return cached models if still valid
    if (this.cachedModels && Date.now() - this.cacheTimestamp < this.CACHE_TTL) {
      return this.cachedModels;
    }

    try {
      // Fetch models from OpenRouter API
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`
        }
      });

      const data: OpenRouterModelsResponse = await response.json();
      
      // Filter models that support tool calling
      const toolSupportedModels = data.data.filter(model => 
        model.supported_parameters?.includes('tools') || 
        model.supported_parameters?.includes('tool_choice')
      );

      // Cache the results
      this.cachedModels = toolSupportedModels;
      this.cacheTimestamp = Date.now();

      return toolSupportedModels;
    } catch (error) {
      console.error('Failed to fetch OpenRouter models:', error);
      // Return empty array on error
      return [];
    }
  }

  searchModels(models: OpenRouterModel[], searchTerm: string): OpenRouterModel[] {
    const term = searchTerm.toLowerCase();
    return models.filter(model => 
      model.id.toLowerCase().includes(term) ||
      model.name.toLowerCase().includes(term) ||
      model.description?.toLowerCase().includes(term)
    ).slice(0, 20); // Limit to 20 results
  }
}
