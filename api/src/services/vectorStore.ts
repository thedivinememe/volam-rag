/**
 * Abstract Vector Store Interface
 * Provides pluggable backend support for FAISS, Chroma, and SQLite
 */

export interface VectorDocument {
  id: string;
  content: string;
  embedding: number[];
  metadata: {
    domain: string;
    source: string;
    chunkIndex: number;
    tokens: number;
    [key: string]: string | number | boolean;
  };
}

export interface SearchResult {
  document: VectorDocument;
  score: number;
  distance: number;
}

export interface VectorStoreConfig {
  backend: 'faiss' | 'chroma' | 'sqlite';
  dimensions: number;
  indexPath?: string;
  connectionString?: string;
  collectionName?: string;
}

export abstract class VectorStore {
  protected config: VectorStoreConfig;
  protected isInitialized = false;

  constructor(config: VectorStoreConfig) {
    this.config = config;
  }

  /**
   * Initialize the vector store
   */
  abstract initialize(): Promise<void>;

  /**
   * Add documents to the vector store
   */
  abstract addDocuments(documents: VectorDocument[]): Promise<void>;

  /**
   * Search for similar documents
   */
  abstract search(queryEmbedding: number[], k: number): Promise<SearchResult[]>;

  /**
   * Get document by ID
   */
  abstract getDocument(id: string): Promise<VectorDocument | null>;

  /**
   * Get total document count
   */
  abstract getDocumentCount(): Promise<number>;

  /**
   * Clear all documents
   */
  abstract clear(): Promise<void>;

  /**
   * Save the index to disk (for persistence)
   */
  abstract save(): Promise<void>;

  /**
   * Load the index from disk
   */
  abstract load(): Promise<void>;

  /**
   * Close the vector store and cleanup resources
   */
  abstract close(): Promise<void>;

  /**
   * Check if the store is initialized
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get configuration
   */
  getConfig(): VectorStoreConfig {
    return { ...this.config };
  }
}

/**
 * Vector Store Factory
 */
export class VectorStoreFactory {
  static async create(config: VectorStoreConfig): Promise<VectorStore> {
    let store: VectorStore;

    switch (config.backend) {
      case 'faiss': {
        const { FaissVectorStore } = await import('./vectorStore/faissStore.js');
        store = new FaissVectorStore(config);
        break;
      }
      case 'chroma':
        throw new Error('Chroma vector store not implemented yet');
      case 'sqlite':
        throw new Error('SQLite vector store not implemented yet');
      default:
        throw new Error(`Unsupported vector store backend: ${config.backend}`);
    }

    await store.initialize();
    return store;
  }
}
