import * as fs from 'fs/promises';
import * as path from 'path';

import { VectorDocument, VectorStoreFactory } from './vectorStore.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { FaissVectorStore } from './vectorStore/faissStore.js';

describe('VectorStore', () => {
  const testDataDir = path.join(process.cwd(), 'data', 'test');
  const testIndexPath = path.join(testDataDir, 'test.index');

  beforeEach(async () => {
    // Ensure test directory exists
    await fs.mkdir(testDataDir, { recursive: true });
  });

  afterEach(async () => {
    // Clean up test files
    try {
      await fs.rm(testDataDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('VectorStoreFactory', () => {
    it('should create FAISS vector store', async () => {
      const store = await VectorStoreFactory.create({
        backend: 'faiss',
        dimensions: 1536,
        indexPath: testIndexPath
      });

      expect(store).toBeInstanceOf(FaissVectorStore);
      await store.close();
    });

    it('should throw error for unsupported backend', async () => {
      await expect(async () => {
        await VectorStoreFactory.create({
          backend: 'unsupported' as any,
          dimensions: 1536
        });
      }).rejects.toThrow('Unsupported vector store backend: unsupported');
    });
  });

  describe('FaissVectorStore', () => {
    let vectorStore: FaissVectorStore;
    const testDimensions = 128; // Smaller for testing

    beforeEach(async () => {
      vectorStore = new FaissVectorStore({
        backend: 'faiss',
        dimensions: testDimensions,
        indexPath: testIndexPath
      });
      await vectorStore.initialize();
    });

    afterEach(async () => {
      if (vectorStore) {
        await vectorStore.close();
      }
    });

    it('should initialize successfully', async () => {
      expect(vectorStore.isReady()).toBe(true);
    });

    it('should add and retrieve documents', async () => {
      const documents: VectorDocument[] = [
        {
          id: 'doc1',
          content: 'This is a test document about climate change.',
          embedding: new Array(testDimensions).fill(0).map(() => Math.random()),
          metadata: {
            source: 'test',
            domain: 'climate',
            chunkIndex: 0,
            tokens: 100
          }
        },
        {
          id: 'doc2',
          content: 'This is another document about renewable energy.',
          embedding: new Array(testDimensions).fill(0).map(() => Math.random()),
          metadata: {
            source: 'test',
            domain: 'energy',
            chunkIndex: 1,
            tokens: 120
          }
        }
      ];

      await vectorStore.addDocuments(documents);

      const count = await vectorStore.getDocumentCount();
      expect(count).toBe(2);

      const doc1 = await vectorStore.getDocument('doc1');
      expect(doc1).toBeTruthy();
      expect(doc1?.content).toBe('This is a test document about climate change.');
    });

    it('should perform vector search', async () => {
      const documents: VectorDocument[] = [
        {
          id: 'doc1',
          content: 'Climate change is a global issue.',
          embedding: [1, 0, 0, ...new Array(testDimensions - 3).fill(0)],
          metadata: { source: 'test', domain: 'climate', chunkIndex: 0, tokens: 80 }
        },
        {
          id: 'doc2',
          content: 'Renewable energy is sustainable.',
          embedding: [0, 1, 0, ...new Array(testDimensions - 3).fill(0)],
          metadata: { source: 'test', domain: 'energy', chunkIndex: 1, tokens: 70 }
        },
        {
          id: 'doc3',
          content: 'Solar panels generate electricity.',
          embedding: [0, 0, 1, ...new Array(testDimensions - 3).fill(0)],
          metadata: { source: 'test', domain: 'solar', chunkIndex: 2, tokens: 75 }
        }
      ];

      await vectorStore.addDocuments(documents);

      // Search with query similar to doc1
      const queryEmbedding = [0.9, 0.1, 0, ...new Array(testDimensions - 3).fill(0)];
      const results = await vectorStore.search(queryEmbedding, 2);

      expect(results).toHaveLength(2);
      expect(results[0].document.id).toBe('doc1'); // Should be most similar
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });

    it('should clear all documents', async () => {
      const documents: VectorDocument[] = [
        {
          id: 'doc1',
          content: 'Test document',
          embedding: new Array(testDimensions).fill(0).map(() => Math.random()),
          metadata: { source: 'test', domain: 'test', chunkIndex: 0, tokens: 50 }
        }
      ];

      await vectorStore.addDocuments(documents);
      expect(await vectorStore.getDocumentCount()).toBe(1);

      await vectorStore.clear();
      expect(await vectorStore.getDocumentCount()).toBe(0);
    });

    it('should handle empty search results', async () => {
      const queryEmbedding = new Array(testDimensions).fill(0).map(() => Math.random());
      const results = await vectorStore.search(queryEmbedding, 5);

      expect(results).toHaveLength(0);
    });
  });
});
