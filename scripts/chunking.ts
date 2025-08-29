import fs from 'fs';
import path from 'path';

export interface Chunk {
  id: string;
  domain: string;
  source: string;
  content: string;
  tokens: number;
  metadata: {
    chunkIndex: number;
    totalChunks: number;
    startOffset: number;
    endOffset: number;
  };
}

export class ChunkingService {
  private readonly minTokens = 100;
  private readonly maxTokens = 300;
  private readonly overlapTokens = 50;

  /**
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Split text into sentences for better chunk boundaries
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence endings, keeping the delimiter
    return text.split(/(?<=[.!?])\s+/).filter(sentence => sentence.trim().length > 0);
  }

  /**
   * Create chunks from text content
   */
  public chunkText(text: string, domain: string, source: string): Chunk[] {
    const sentences = this.splitIntoSentences(text);
    const chunks: Chunk[] = [];
    
    let currentChunk = '';
    let currentTokens = 0;
    let chunkIndex = 0;
    let startOffset = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i];
      const sentenceTokens = this.estimateTokens(sentence);

      // If adding this sentence would exceed max tokens, finalize current chunk
      if (currentTokens + sentenceTokens > this.maxTokens && currentChunk.length > 0) {
        chunks.push(this.createChunk(
          currentChunk.trim(),
          domain,
          source,
          chunkIndex,
          startOffset,
          startOffset + currentChunk.length
        ));

        // Start new chunk with overlap
        const overlapText = this.getOverlapText(currentChunk, this.overlapTokens);
        currentChunk = overlapText + ' ' + sentence;
        currentTokens = this.estimateTokens(currentChunk);
        startOffset += currentChunk.length - overlapText.length - sentence.length - 1;
        chunkIndex++;
      } else {
        // Add sentence to current chunk
        if (currentChunk.length > 0) {
          currentChunk += ' ';
        }
        currentChunk += sentence;
        currentTokens += sentenceTokens;
      }
    }

    // Add final chunk if it meets minimum requirements
    if (currentChunk.trim().length > 0 && currentTokens >= this.minTokens) {
      chunks.push(this.createChunk(
        currentChunk.trim(),
        domain,
        source,
        chunkIndex,
        startOffset,
        startOffset + currentChunk.length
      ));
    }

    // Update total chunks count
    chunks.forEach(chunk => {
      chunk.metadata.totalChunks = chunks.length;
    });

    return chunks;
  }

  /**
   * Get overlap text from the end of current chunk
   */
  private getOverlapText(text: string, overlapTokens: number): string {
    const words = text.split(' ');
    const overlapWords = Math.min(overlapTokens / 4, words.length); // Rough estimate
    return words.slice(-overlapWords).join(' ');
  }

  /**
   * Create a chunk object
   */
  private createChunk(
    content: string,
    domain: string,
    source: string,
    chunkIndex: number,
    startOffset: number,
    endOffset: number
  ): Chunk {
    const id = `${domain}-${source}-${chunkIndex}`;
    const tokens = this.estimateTokens(content);

    return {
      id,
      domain,
      source,
      content,
      tokens,
      metadata: {
        chunkIndex,
        totalChunks: 0, // Will be updated after all chunks are created
        startOffset,
        endOffset
      }
    };
  }

  /**
   * Process all files in a domain directory
   */
  public async chunkDomain(domainPath: string): Promise<Chunk[]> {
    const domain = path.basename(domainPath);
    const chunks: Chunk[] = [];

    try {
      const files = fs.readdirSync(domainPath);
      
      for (const file of files) {
        if (file.endsWith('.txt')) {
          const filePath = path.join(domainPath, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const source = path.basename(file, '.txt');
          
          const fileChunks = this.chunkText(content, domain, source);
          chunks.push(...fileChunks);
        }
      }
    } catch (error) {
      console.error(`Error processing domain ${domain}:`, error);
    }

    return chunks;
  }

  /**
   * Process all domains in the corpus directory
   */
  public async chunkCorpus(corpusPath: string): Promise<Chunk[]> {
    const allChunks: Chunk[] = [];

    try {
      const domains = fs.readdirSync(corpusPath);
      
      for (const domain of domains) {
        const domainPath = path.join(corpusPath, domain);
        
        if (fs.statSync(domainPath).isDirectory()) {
          console.log(`Processing domain: ${domain}`);
          const domainChunks = await this.chunkDomain(domainPath);
          allChunks.push(...domainChunks);
          console.log(`  Created ${domainChunks.length} chunks`);
        }
      }
    } catch (error) {
      console.error('Error processing corpus:', error);
    }

    return allChunks;
  }

  /**
   * Get chunking statistics
   */
  public getChunkingStats(chunks: Chunk[]): {
    totalChunks: number;
    domainStats: Record<string, { count: number; avgTokens: number }>;
    tokenDistribution: { min: number; max: number; avg: number };
  } {
    const domainStats: Record<string, { count: number; avgTokens: number }> = {};
    let totalTokens = 0;
    let minTokens = Infinity;
    let maxTokens = 0;

    chunks.forEach(chunk => {
      // Domain stats
      if (!domainStats[chunk.domain]) {
        domainStats[chunk.domain] = { count: 0, avgTokens: 0 };
      }
      domainStats[chunk.domain].count++;

      // Token stats
      totalTokens += chunk.tokens;
      minTokens = Math.min(minTokens, chunk.tokens);
      maxTokens = Math.max(maxTokens, chunk.tokens);
    });

    // Calculate average tokens per domain
    Object.keys(domainStats).forEach(domain => {
      const domainChunks = chunks.filter(c => c.domain === domain);
      const domainTotalTokens = domainChunks.reduce((sum, c) => sum + c.tokens, 0);
      domainStats[domain].avgTokens = Math.round(domainTotalTokens / domainChunks.length);
    });

    return {
      totalChunks: chunks.length,
      domainStats,
      tokenDistribution: {
        min: minTokens === Infinity ? 0 : minTokens,
        max: maxTokens,
        avg: Math.round(totalTokens / chunks.length)
      }
    };
  }
}
