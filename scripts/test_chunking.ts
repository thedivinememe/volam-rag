#!/usr/bin/env tsx

import { ChunkingService } from './chunking.js';
import path from 'path';

async function testChunking() {
  console.log('🧪 Testing chunking functionality...');
  console.log('');

  const chunkingService = new ChunkingService();
  const corpusPath = path.join(process.cwd(), 'data', 'corpus');

  try {
    // Test chunking all domains
    const chunks = await chunkingService.chunkCorpus(corpusPath);
    
    console.log('📊 Chunking Results:');
    console.log(`Total chunks: ${chunks.length}`);
    console.log('');

    // Get statistics
    const stats = chunkingService.getChunkingStats(chunks);
    
    console.log('Domain Breakdown:');
    Object.entries(stats.domainStats).forEach(([domain, domainStats]) => {
      console.log(`  ${domain}: ${domainStats.count} chunks (avg: ${domainStats.avgTokens} tokens)`);
    });
    
    console.log('');
    console.log('Token Distribution:');
    console.log(`  Min: ${stats.tokenDistribution.min} tokens`);
    console.log(`  Max: ${stats.tokenDistribution.max} tokens`);
    console.log(`  Average: ${stats.tokenDistribution.avg} tokens`);
    
    console.log('');
    console.log('Acceptance Criteria Check:');
    console.log(`✅ 3 domains populated: ${Object.keys(stats.domainStats).length >= 3 ? 'YES' : 'NO'} (${Object.keys(stats.domainStats).length} domains)`);
    console.log(`✅ 300-600 chunks target: ${stats.totalChunks >= 300 && stats.totalChunks <= 600 ? 'YES' : `NO (${stats.totalChunks} chunks)`}`);
    
    console.log('');
    console.log('Sample chunks:');
    chunks.slice(0, 3).forEach((chunk, index) => {
      console.log(`${index + 1}. [${chunk.domain}/${chunk.source}] ${chunk.tokens} tokens`);
      console.log(`   "${chunk.content.substring(0, 100)}..."`);
      console.log('');
    });

    console.log('✅ Chunking test completed successfully!');
    
  } catch (error) {
    console.error('❌ Chunking test failed:', error);
    process.exit(1);
  }
}

testChunking().catch(console.error);
