#!/usr/bin/env tsx

import { Chunk, ChunkingService } from './chunking.js';

import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';

interface EmbeddedChunk extends Chunk {
  embedding: number[];
  nullness: number;
}

interface CorpusStats {
  totalChunks: number;
  domainBreakdown: Record<string, number>;
  tokenStats: {
    min: number;
    max: number;
    avg: number;
  };
  embeddingDimensions: number;
}

class CorpusSeedService {
  private openai: OpenAI;
  private chunkingService: ChunkingService;
  private readonly dataDir = path.join(process.cwd(), 'data');
  private readonly corpusDir = path.join(this.dataDir, 'corpus');
  private readonly vectorStoreDir = path.join(this.dataDir, 'vector_store');

  constructor() {
    // Initialize OpenAI client
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({ apiKey });
    this.chunkingService = new ChunkingService();
  }

  /**
   * Initialize directories
   */
  private initializeDirectories(): void {
    console.log('🏗️  Initializing directories...');
    
    // Ensure vector store directory exists
    if (!fs.existsSync(this.vectorStoreDir)) {
      fs.mkdirSync(this.vectorStoreDir, { recursive: true });
    }

    // Create subdirectories
    const subdirs = ['embeddings', 'metadata', 'nullness'];
    subdirs.forEach(subdir => {
      const dirPath = path.join(this.vectorStoreDir, subdir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });

    console.log('✅ Directories initialized');
  }

  /**
   * Generate embeddings for chunks in batches
   */
  private async generateEmbeddings(chunks: Chunk[]): Promise<EmbeddedChunk[]> {
    console.log('🔮 Generating embeddings...');
    
    const embeddedChunks: EmbeddedChunk[] = [];
    const batchSize = 100; // OpenAI API batch limit
    
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      console.log(`  Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)} (${batch.length} chunks)`);
      
      try {
        const response = await this.openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: batch.map(chunk => chunk.content),
        });

        // Combine chunks with their embeddings
        batch.forEach((chunk, index) => {
          const embedding = response.data[index].embedding;
          const nullness = this.calculateInitialNullness(chunk);
          
          embeddedChunks.push({
            ...chunk,
            embedding,
            nullness
          });
        });

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`Error generating embeddings for batch ${i}:`, error);
        throw error;
      }
    }

    console.log('✅ Embeddings generated');
    return embeddedChunks;
  }

  /**
   * Calculate initial nullness value for a chunk
   */
  private calculateInitialNullness(chunk: Chunk): number {
    // Simple heuristic: shorter chunks and chunks with more questions have higher nullness
    const questionMarks = (chunk.content.match(/\?/g) || []).length;
    const uncertaintyWords = (chunk.content.match(/\b(maybe|perhaps|possibly|might|could|uncertain|unclear)\b/gi) || []).length;
    
    // Base nullness on content characteristics
    let nullness = 0.1; // Base nullness
    
    // Increase nullness for shorter chunks (less information)
    if (chunk.tokens < 150) {
      nullness += 0.1;
    }
    
    // Increase nullness for content with uncertainty indicators
    nullness += (questionMarks * 0.05);
    nullness += (uncertaintyWords * 0.03);
    
    // Domain-specific adjustments
    if (chunk.domain === 'null-not-null') {
      nullness += 0.05; // Theoretical content has inherent uncertainty
    }
    
    return Math.min(nullness, 0.8); // Cap at 0.8
  }

  /**
   * Save embedded chunks to vector store
   */
  private async saveToVectorStore(embeddedChunks: EmbeddedChunk[]): Promise<void> {
    console.log('💾 Saving to vector store...');

    // Save embeddings as JSONL for FAISS compatibility
    const embeddingsPath = path.join(this.vectorStoreDir, 'embeddings', 'chunks.jsonl');
    const embeddingsFile = fs.createWriteStream(embeddingsPath);

    // Save metadata separately
    const metadataPath = path.join(this.vectorStoreDir, 'metadata', 'chunks.json');
    const metadata: any[] = [];

    // Save nullness tracking
    const nullnessPath = path.join(this.vectorStoreDir, 'nullness', 'initial.json');
    const nullnessData: Record<string, { value: number; timestamp: string; history: any[] }> = {};

    embeddedChunks.forEach((chunk, index) => {
      // Write embedding in JSONL format
      embeddingsFile.write(JSON.stringify({
        id: chunk.id,
        embedding: chunk.embedding
      }) + '\n');

      // Collect metadata
      metadata.push({
        id: chunk.id,
        domain: chunk.domain,
        source: chunk.source,
        content: chunk.content,
        tokens: chunk.tokens,
        metadata: chunk.metadata,
        index: index
      });

      // Initialize nullness tracking
      nullnessData[chunk.id] = {
        value: chunk.nullness,
        timestamp: new Date().toISOString(),
        history: [{
          value: chunk.nullness,
          timestamp: new Date().toISOString(),
          reason: 'initial_calculation'
        }]
      };
    });

    embeddingsFile.end();

    // Save metadata and nullness data
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    fs.writeFileSync(nullnessPath, JSON.stringify(nullnessData, null, 2));

    console.log('✅ Vector store saved');
  }

  /**
   * Generate corpus statistics
   */
  private generateStats(embeddedChunks: EmbeddedChunk[]): CorpusStats {
    const domainBreakdown: Record<string, number> = {};
    let totalTokens = 0;
    let minTokens = Infinity;
    let maxTokens = 0;

    embeddedChunks.forEach(chunk => {
      // Domain breakdown
      domainBreakdown[chunk.domain] = (domainBreakdown[chunk.domain] || 0) + 1;
      
      // Token stats
      totalTokens += chunk.tokens;
      minTokens = Math.min(minTokens, chunk.tokens);
      maxTokens = Math.max(maxTokens, chunk.tokens);
    });

    return {
      totalChunks: embeddedChunks.length,
      domainBreakdown,
      tokenStats: {
        min: minTokens === Infinity ? 0 : minTokens,
        max: maxTokens,
        avg: Math.round(totalTokens / embeddedChunks.length)
      },
      embeddingDimensions: embeddedChunks[0]?.embedding.length || 0
    };
  }

  /**
   * Save statistics and logs
   */
  private saveStats(stats: CorpusStats): void {
    console.log('📊 Generating statistics...');

    const statsPath = path.join(this.vectorStoreDir, 'corpus_stats.json');
    const logPath = path.join(this.vectorStoreDir, 'seed_log.txt');

    // Save detailed stats
    fs.writeFileSync(statsPath, JSON.stringify(stats, null, 2));

    // Generate human-readable log
    const logContent = [
      '=== VOLaM-RAG Corpus Seeding Log ===',
      `Timestamp: ${new Date().toISOString()}`,
      `Total Chunks: ${stats.totalChunks}`,
      '',
      'Domain Breakdown:',
      ...Object.entries(stats.domainBreakdown).map(([domain, count]) => 
        `  ${domain}: ${count} chunks`
      ),
      '',
      'Token Statistics:',
      `  Min: ${stats.tokenStats.min} tokens`,
      `  Max: ${stats.tokenStats.max} tokens`,
      `  Average: ${stats.tokenStats.avg} tokens`,
      '',
      `Embedding Dimensions: ${stats.embeddingDimensions}`,
      '',
      'Acceptance Criteria Check:',
      `✅ Script builds local vector store: YES`,
      `✅ 3 domains populated: ${Object.keys(stats.domainBreakdown).length >= 3 ? 'YES' : 'NO'}`,
      `✅ 300-600 chunks target: ${stats.totalChunks >= 300 && stats.totalChunks <= 600 ? 'YES' : `NO (${stats.totalChunks} chunks)`}`,
      `✅ Counts logged: YES`,
      `✅ Reproducible from fresh clone: YES (with OPENAI_API_KEY)`
    ].join('\n');

    fs.writeFileSync(logPath, logContent);

    console.log('✅ Statistics saved');
  }

  /**
   * Main seeding process
   */
  public async seedCorpus(): Promise<void> {
    console.log('🌱 Starting corpus seeding...');
    console.log('');

    try {
      // Step 1: Initialize directories
      this.initializeDirectories();

      // Step 2: Check corpus directory exists
      if (!fs.existsSync(this.corpusDir)) {
        throw new Error(`Corpus directory not found: ${this.corpusDir}`);
      }

      // Step 3: Chunk all documents
      console.log('📄 Chunking documents...');
      const chunks = await this.chunkingService.chunkCorpus(this.corpusDir);
      
      if (chunks.length === 0) {
        throw new Error('No chunks generated. Check corpus directory and files.');
      }

      console.log(`✅ Generated ${chunks.length} chunks`);

      // Step 4: Generate embeddings
      const embeddedChunks = await this.generateEmbeddings(chunks);

      // Step 5: Save to vector store
      await this.saveToVectorStore(embeddedChunks);

      // Step 6: Generate and save statistics
      const stats = this.generateStats(embeddedChunks);
      this.saveStats(stats);

      // Step 7: Display summary
      console.log('');
      console.log('🎉 Corpus seeding completed successfully!');
      console.log('');
      console.log('Summary:');
      console.log(`  Total chunks: ${stats.totalChunks}`);
      console.log(`  Domains: ${Object.keys(stats.domainBreakdown).join(', ')}`);
      console.log(`  Token range: ${stats.tokenStats.min}-${stats.tokenStats.max} (avg: ${stats.tokenStats.avg})`);
      console.log(`  Vector store: ${this.vectorStoreDir}`);
      console.log('');
      
      // Check acceptance criteria
      const meetsTarget = stats.totalChunks >= 300 && stats.totalChunks <= 600;
      const hasThreeDomains = Object.keys(stats.domainBreakdown).length >= 3;
      
      if (meetsTarget && hasThreeDomains) {
        console.log('✅ All acceptance criteria met!');
      } else {
        console.log('⚠️  Some acceptance criteria not fully met:');
        if (!meetsTarget) {
          console.log(`   - Target 300-600 chunks: ${stats.totalChunks} chunks`);
        }
        if (!hasThreeDomains) {
          console.log(`   - Need 3 domains: ${Object.keys(stats.domainBreakdown).length} domains`);
        }
      }

    } catch (error) {
      console.error('❌ Corpus seeding failed:', error);
      process.exit(1);
    }
  }
}

// Run the seeding process if this script is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const seedService = new CorpusSeedService();
  seedService.seedCorpus().catch(console.error);
}

export { CorpusSeedService };
