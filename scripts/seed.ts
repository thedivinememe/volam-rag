#!/usr/bin/env tsx

/**
 * Seed script: Chunk documents and generate embeddings
 * Usage: npm run seed
 */

import { Chunk, ChunkingService } from './chunking.js';

import { config } from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';

// Load environment variables from .env file

config();

class SeedService {
  private dataDir = path.join(process.cwd(), 'data');
  private corpusDir = path.join(this.dataDir, 'corpus');
  private embeddingsDir = path.join(this.dataDir, 'embeddings');
  private chunkingService = new ChunkingService();

  async run(): Promise<void> {
    console.log('🌱 Starting VOLaM-RAG seeding process...');

    try {
      await this.ensureDirectories();
      const chunks = await this.loadCorpus();
      await this.generateEmbeddings(chunks);
      await this.initializeNullnessTracking();
      await this.setupEmpathyProfiles();

      console.log('✅ Seeding completed successfully!');
    } catch (error) {
      console.error('❌ Seeding failed:', error);
      process.exit(1);
    }
  }

  private async ensureDirectories(): Promise<void> {
    console.log('📁 Ensuring data directories exist...');
    
    const dirs = [
      this.corpusDir,
      this.embeddingsDir,
      path.join(this.dataDir, 'nullness'),
      path.join(this.dataDir, 'profiles')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async loadCorpus(): Promise<Chunk[]> {
    console.log('📚 Loading and chunking corpus...');

    // Check if corpus files exist
    try {
      const files = await fs.readdir(this.corpusDir);
      if (files.length === 0) {
        console.log('⚠️  No corpus files found. Creating sample documents...');
        await this.createSampleCorpus();
      }
    } catch (error) {
      console.log('⚠️  Corpus directory empty. Creating sample documents...');
      await this.createSampleCorpus();
    }

    // Chunk all documents in the corpus
    const chunks = await this.chunkingService.chunkCorpus(this.corpusDir);
    
    // Get and display chunking statistics
    const stats = this.chunkingService.getChunkingStats(chunks);
    console.log('📊 Chunking Statistics:');
    console.log(`  Total chunks: ${stats.totalChunks}`);
    console.log(`  Token distribution: min=${stats.tokenDistribution.min}, max=${stats.tokenDistribution.max}, avg=${stats.tokenDistribution.avg}`);
    
    for (const [domain, domainStats] of Object.entries(stats.domainStats)) {
      console.log(`  ${domain}: ${domainStats.count} chunks, avg ${domainStats.avgTokens} tokens`);
    }

    console.log('📄 Document chunking completed');
    return chunks;
  }

  private async createSampleCorpus(): Promise<void> {
    const sampleDocs = [
      {
        filename: 'sample-1.txt',
        content: `Climate change refers to long-term shifts in global temperatures and weather patterns. 
        While climate variations are natural, scientific evidence shows that human activities have been 
        the main driver of climate change since the 1800s. The burning of fossil fuels generates 
        greenhouse gas emissions that act like a blanket wrapped around Earth, trapping heat and 
        raising temperatures.`
      },
      {
        filename: 'sample-2.txt',
        content: `Artificial intelligence (AI) is intelligence demonstrated by machines, in contrast to 
        natural intelligence displayed by humans and animals. AI research has been highly successful 
        in developing effective techniques for solving a wide range of problems, from game playing to 
        medical diagnosis. Machine learning, a subset of AI, enables computers to learn and improve 
        from experience without being explicitly programmed.`
      },
      {
        filename: 'sample-3.txt',
        content: `Renewable energy comes from natural sources that are constantly replenished. Solar, 
        wind, hydroelectric, and geothermal are examples of renewable energy sources. These sources 
        are sustainable and have a much lower environmental impact compared to fossil fuels. The 
        transition to renewable energy is crucial for reducing greenhouse gas emissions and combating 
        climate change.`
      }
    ];

    for (const doc of sampleDocs) {
      const filePath = path.join(this.corpusDir, doc.filename);
      await fs.writeFile(filePath, doc.content);
    }

    console.log(`📝 Created ${sampleDocs.length} sample documents`);
  }

  private async generateEmbeddings(chunks: Chunk[]): Promise<void> {
    console.log('🔢 Generating embeddings...');

    if (chunks.length === 0) {
      console.log('⚠️  No chunks to process for embeddings');
      return;
    }

    // Import embedding service (using file:// URL for Windows compatibility)
    const embeddingPath = new URL('file://' + path.join(process.cwd(), 'api/src/services/embedding.js').replace(/\\/g, '/'));
    const vectorStorePath = new URL('file://' + path.join(process.cwd(), 'api/src/services/vectorStore.js').replace(/\\/g, '/'));
    
    const { EmbeddingService } = await import(embeddingPath.href);
    const { VectorStoreFactory } = await import(vectorStorePath.href);
    
    // Initialize embedding service
    const embeddingService = new EmbeddingService({
      model: 'text-embedding-3-small',
      dimensions: 1536
    });

    // Generate real embeddings using OpenAI
    const embeddedChunks = [];
    console.log(`📊 Processing ${chunks.length} chunks...`);
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`  Processing chunk ${i + 1}/${chunks.length}: ${chunk.id}`);
      
      try {
        const result = await embeddingService.embed(chunk.content);
        embeddedChunks.push({
          id: chunk.id,
          domain: chunk.domain,
          source: chunk.source,
          content: chunk.content,
          tokens: chunk.tokens,
          metadata: chunk.metadata,
          embedding: result.embedding
        });
      } catch (error) {
        console.error(`❌ Failed to generate embedding for chunk ${chunk.id}:`, error);
        throw error;
      }
    }

    // Create embedding data structure
    const embeddingData = {
      model: 'text-embedding-3-small',
      dimensions: 1536,
      generated: new Date().toISOString(),
      chunks: embeddedChunks
    };

    // Save embeddings to JSON file
    const embeddingsPath = path.join(this.embeddingsDir, 'embeddings.json');
    await fs.writeFile(embeddingsPath, JSON.stringify(embeddingData, null, 2));

    // Save chunks metadata separately for easier access
    const chunksPath = path.join(this.embeddingsDir, 'chunks.json');
    await fs.writeFile(chunksPath, JSON.stringify(chunks, null, 2));

    // Create and populate FAISS vector store
    console.log('🔍 Creating FAISS vector store...');
    const vectorStore = await VectorStoreFactory.create({
      backend: 'faiss',
      dimensions: 1536,
      indexPath: path.join(this.embeddingsDir, 'faiss.index')
    });

    // Convert chunks to VectorDocument format
    const vectorDocuments = embeddedChunks.map(chunk => ({
      id: chunk.id,
      content: chunk.content,
      embedding: chunk.embedding,
      metadata: {
        domain: chunk.domain,
        source: chunk.source,
        chunkIndex: chunks.findIndex(c => c.id === chunk.id),
        tokens: chunk.tokens
      }
    }));

    // Add documents to vector store
    await vectorStore.addDocuments(vectorDocuments);
    
    // Save the vector store
    await vectorStore.save();
    await vectorStore.close();

    console.log(`✨ Generated embeddings for ${chunks.length} chunks`);
    console.log(`📁 Saved embeddings to: ${embeddingsPath}`);
    console.log(`🔍 Created FAISS index with ${vectorDocuments.length} documents`);
  }

  private async initializeNullnessTracking(): Promise<void> {
    console.log('🎯 Initializing nullness tracking...');

    const nullnessConfig = {
      initialized: new Date().toISOString(),
      concepts: {},
      settings: {
        defaultNullness: 0.5,
        updateThreshold: 0.1,
        historyRetention: 30 // days
      }
    };

    const nullnessPath = path.join(this.dataDir, 'nullness', 'config.json');
    await fs.writeFile(nullnessPath, JSON.stringify(nullnessConfig, null, 2));

    console.log('📊 Nullness tracking initialized');
  }

  private async setupEmpathyProfiles(): Promise<void> {
    console.log('❤️  Setting up empathy profiles...');

    const empathyProfiles = {
      default: {
        name: 'Default Profile',
        stakeholders: {
          'general_public': 0.4,
          'experts': 0.3,
          'policymakers': 0.2,
          'affected_communities': 0.1
        }
      },
      climate_focused: {
        name: 'Climate-Focused Profile',
        stakeholders: {
          'affected_communities': 0.4,
          'environmental_scientists': 0.3,
          'policymakers': 0.2,
          'general_public': 0.1
        }
      }
    };

    const profilesPath = path.join(this.dataDir, 'profiles', 'empathy-profiles.json');
    await fs.writeFile(profilesPath, JSON.stringify(empathyProfiles, null, 2));

    console.log('🤝 Empathy profiles configured');
  }
}

// Run the seeding process
const seedService = new SeedService();
seedService.run();
