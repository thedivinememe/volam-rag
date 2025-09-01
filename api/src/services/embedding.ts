import OpenAI from 'openai';

export interface EmbeddingConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  maxTokens?: number;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export class EmbeddingService {
  private openai: OpenAI;
  private config: Required<EmbeddingConfig>;

  constructor(config: EmbeddingConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.OPENAI_API_KEY || '',
      model: config.model || 'text-embedding-3-small',
      dimensions: config.dimensions || 1536,
      maxTokens: config.maxTokens || 8191
    };

    if (!this.config.apiKey) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass apiKey in config.');
    }

    this.openai = new OpenAI({
      apiKey: this.config.apiKey
    });
  }

  /**
   * Generate embedding for a single text
   */
  async embed(text: string): Promise<EmbeddingResult> {
    if (!text.trim()) {
      throw new Error('Text cannot be empty');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: text,
        dimensions: this.config.dimensions
      });

      const embedding = response.data[0].embedding;
      const tokens = response.usage?.total_tokens || 0;

      return {
        embedding,
        tokens
      };
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Generate embeddings for multiple texts in batch
   */
  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    if (texts.length === 0) {
      return [];
    }

    // Filter out empty texts
    const validTexts = texts.filter(text => text.trim());
    if (validTexts.length === 0) {
      throw new Error('No valid texts provided');
    }

    try {
      const response = await this.openai.embeddings.create({
        model: this.config.model,
        input: validTexts,
        dimensions: this.config.dimensions
      });

      const results: EmbeddingResult[] = [];
      const totalTokens = response.usage?.total_tokens || 0;
      const tokensPerText = Math.ceil(totalTokens / validTexts.length);

      for (let i = 0; i < response.data.length; i++) {
        results.push({
          embedding: response.data[i].embedding,
          tokens: tokensPerText
        });
      }

      return results;
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      throw new Error(`Failed to generate batch embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the embedding dimensions for this model
   */
  getDimensions(): number {
    return this.config.dimensions;
  }

  /**
   * Get the model name
   */
  getModel(): string {
    return this.config.model;
  }

  /**
   * Estimate token count for text (rough approximation)
   */
  estimateTokens(text: string): number {
    // Rough approximation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if text is within token limits
   */
  isWithinTokenLimit(text: string): boolean {
    return this.estimateTokens(text) <= this.config.maxTokens;
  }

  /**
   * Truncate text to fit within token limits
   */
  truncateToTokenLimit(text: string): string {
    if (this.isWithinTokenLimit(text)) {
      return text;
    }

    const maxChars = this.config.maxTokens * 4; // Rough approximation
    return text.substring(0, maxChars);
  }
}

// Default instance for convenience
let defaultEmbeddingService: EmbeddingService | null = null;

export function getEmbeddingService(config?: EmbeddingConfig): EmbeddingService {
  if (!defaultEmbeddingService) {
    defaultEmbeddingService = new EmbeddingService(config);
  }
  return defaultEmbeddingService;
}
