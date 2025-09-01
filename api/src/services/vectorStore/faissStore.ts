import * as faiss from 'faiss-node';
import * as fs from 'fs/promises';
import * as path from 'path';

import { SearchResult, VectorDocument, VectorStore, VectorStoreConfig } from '../vectorStore.js';

export class FaissVectorStore extends VectorStore {
  private index: faiss.IndexFlatIP | null = null;
  private documents: Map<string, VectorDocument> = new Map();
  private idToIndex: Map<string, number> = new Map();
  private indexToId: Map<number, string> = new Map();
  private nextIndex = 0;

  constructor(config: VectorStoreConfig) {
    super(config);
    if (!config.indexPath) {
      config.indexPath = path.join(process.cwd(), 'data', 'embeddings', 'faiss.index');
    }
  }

  async initialize(): Promise<void> {
    try {
      // Create FAISS index for inner product (cosine similarity with normalized vectors)
      this.index = new faiss.IndexFlatIP(this.config.dimensions);
      
      // Try to load existing index
      await this.load();
      
      this.isInitialized = true;
      console.log(`FAISS vector store initialized with ${this.documents.size} documents`);
    } catch (error) {
      console.log('No existing FAISS index found, starting fresh');
      this.isInitialized = true;
    }
  }

  async addDocuments(documents: VectorDocument[]): Promise<void> {
    if (!this.index) {
      throw new Error('Vector store not initialized');
    }

    const embeddings: number[][] = [];
    const ids: string[] = [];

    for (const doc of documents) {
      // Normalize embedding for cosine similarity
      const normalizedEmbedding = this.normalizeVector(doc.embedding);
      
      embeddings.push(normalizedEmbedding);
      ids.push(doc.id);
      
      // Store document metadata
      this.documents.set(doc.id, doc);
      this.idToIndex.set(doc.id, this.nextIndex);
      this.indexToId.set(this.nextIndex, doc.id);
      this.nextIndex++;
    }

    // Add to FAISS index
    if (embeddings.length > 0) {
      // FAISS expects a flat array of numbers
      const flatEmbeddings = embeddings.flat();
      this.index.add(flatEmbeddings);
      console.log(`Added ${embeddings.length} documents to FAISS index`);
    }
  }

  async search(queryEmbedding: number[], k: number): Promise<SearchResult[]> {
    if (!this.index) {
      throw new Error('Vector store not initialized');
    }

    if (this.documents.size === 0) {
      return [];
    }

    // Normalize query embedding
    const normalizedQuery = this.normalizeVector(queryEmbedding);
    
    // Search FAISS index
    const searchK = Math.min(k, this.documents.size);
    const results = this.index.search(normalizedQuery, searchK);
    
    const searchResults: SearchResult[] = [];
    
    for (let i = 0; i < results.labels.length; i++) {
      const indexId = results.labels[i];
      const score = results.distances[i];
      
      if (indexId >= 0) { // Valid result
        const docId = this.indexToId.get(indexId);
        if (docId) {
          const document = this.documents.get(docId);
          if (document) {
            searchResults.push({
              document,
              score: score, // Inner product score (higher is better)
              distance: 1 - score // Convert to distance (lower is better)
            });
          }
        }
      }
    }

    return searchResults;
  }

  async getDocument(id: string): Promise<VectorDocument | null> {
    return this.documents.get(id) || null;
  }

  async getDocumentCount(): Promise<number> {
    return this.documents.size;
  }

  async clear(): Promise<void> {
    if (this.index) {
      // Create new empty index
      this.index = new faiss.IndexFlatIP(this.config.dimensions);
    }
    
    this.documents.clear();
    this.idToIndex.clear();
    this.indexToId.clear();
    this.nextIndex = 0;
    
    console.log('FAISS vector store cleared');
  }

  async save(): Promise<void> {
    if (!this.index || !this.config.indexPath) {
      throw new Error('Cannot save: index or path not configured');
    }

    try {
      // Ensure directory exists
      const indexDir = path.dirname(this.config.indexPath);
      await fs.mkdir(indexDir, { recursive: true });

      // Save FAISS index
      this.index.write(this.config.indexPath);

      // Save document metadata
      const metadataPath = this.config.indexPath + '.metadata.json';
      const metadata = {
        documents: Array.from(this.documents.entries()),
        idToIndex: Array.from(this.idToIndex.entries()),
        indexToId: Array.from(this.indexToId.entries()),
        nextIndex: this.nextIndex,
        config: this.config
      };
      
      await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
      
      console.log(`FAISS index saved to ${this.config.indexPath}`);
    } catch (error) {
      console.error('Error saving FAISS index:', error);
      throw error;
    }
  }

  async load(): Promise<void> {
    if (!this.config.indexPath) {
      throw new Error('Index path not configured');
    }

    try {
      // Load FAISS index
      this.index = faiss.IndexFlatIP.read(this.config.indexPath);

      // Load document metadata
      const metadataPath = this.config.indexPath + '.metadata.json';
      const metadataContent = await fs.readFile(metadataPath, 'utf-8');
      const metadata = JSON.parse(metadataContent);

      // Restore maps
      this.documents = new Map(metadata.documents);
      this.idToIndex = new Map(metadata.idToIndex);
      this.indexToId = new Map(metadata.indexToId.map(([k, v]: [string, string]) => [parseInt(k), v]));
      this.nextIndex = metadata.nextIndex;

      console.log(`FAISS index loaded from ${this.config.indexPath}`);
    } catch (error) {
      console.log('Could not load existing FAISS index:', error);
      throw error;
    }
  }

  async close(): Promise<void> {
    // Save before closing
    if (this.isInitialized && this.index) {
      await this.save();
    }
    
    this.index = null;
    this.documents.clear();
    this.idToIndex.clear();
    this.indexToId.clear();
    this.isInitialized = false;
    
    console.log('FAISS vector store closed');
  }

  /**
   * Normalize vector for cosine similarity
   */
  private normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return vector; // Avoid division by zero
    }
    return vector.map(val => val / magnitude);
  }
}
