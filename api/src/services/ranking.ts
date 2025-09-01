import { Evidence, RankingResult } from '../types/core.js';
import { VectorStore, VectorStoreFactory } from './vectorStore.js';

import { EmbeddingService } from './embedding.js';
import { EmpathyService } from './empathy.js';

export class RankingService {
  private vectorStore!: VectorStore; // Will be initialized in initialize()
  private embeddingService: EmbeddingService;
  private empathyService: EmpathyService;

  constructor() {
    // Initialize embedding service
    this.embeddingService = new EmbeddingService({
      model: 'text-embedding-3-small',
      dimensions: 1536
    });

    this.empathyService = new EmpathyService();
    console.log('RankingService initialized with embeddings');
  }

  /**
   * Initialize the vector store and embedding service
   */
  async initialize(): Promise<void> {
    // Initialize vector store with FAISS backend
    this.vectorStore = await VectorStoreFactory.create({
      backend: 'faiss',
      dimensions: 1536,
      indexPath: 'data/embeddings/faiss.index'
    });
    console.log('RankingService vector store initialized');
  }

  /**
   * Baseline ranking using cosine similarity only
   */
  async rankBaseline(query: string, k: number = 5): Promise<RankingResult> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.embed(query);
    
    // Search for similar documents
    const searchResults = await this.vectorStore.search(queryEmbedding.embedding, k);
    
    // Convert search results to Evidence objects
    const evidence: Evidence[] = searchResults.map(result => this.convertToEvidence(result));

    const answer = this.composeAnswer(evidence, query);
    const confidence = this.calculateConfidence(evidence);
    const nullness = this.calculateAverageNullness(evidence);

    return {
      evidence,
      answer,
      confidence,
      nullness,
      mode: 'baseline'
    };
  }

  /**
   * VOLaM ranking: α·cosine + β·(1−nullness) + γ·empathy_fit
   */
  async rankWithVOLaM(
    query: string,
    k: number = 5,
    alpha: number = 0.6,
    beta: number = 0.3,
    gamma: number = 0.1,
    empathyProfile: string | Record<string, number> = 'default'
  ): Promise<RankingResult> {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.embed(query);
    
    // Search for similar documents (get more than k to allow for re-ranking)
    const searchResults = await this.vectorStore.search(queryEmbedding.embedding, Math.max(k * 2, 10));
    
    // Convert search results to Evidence objects
    const evidence: Evidence[] = searchResults.map(result => this.convertToEvidence(result));

    // Calculate empathy fit for each evidence piece
    for (const evidenceItem of evidence) {
      const contentTags = this.empathyService.extractContentTags(evidenceItem.content, evidenceItem.metadata);
      evidenceItem.empathyFit = this.empathyService.calculateEmpathyFit(contentTags, empathyProfile);
      
      // Calculate VOLaM score
      evidenceItem.score = this.calculateVOLaMScore(
        evidenceItem.cosineScore,
        evidenceItem.nullness,
        evidenceItem.empathyFit,
        alpha,
        beta,
        gamma
      );
    }

    // Sort by VOLaM score, with tie-breaking by cosine similarity
    evidence.sort((a: Evidence, b: Evidence) => {
      const scoreDiff = b.score - a.score;
      if (Math.abs(scoreDiff) < 0.001) { // Tie-breaking threshold
        return b.cosineScore - a.cosineScore; // Tie-break by cosine
      }
      return scoreDiff;
    });

    const answer = this.composeAnswer(evidence, query);
    const confidence = this.calculateConfidence(evidence);
    const nullness = this.calculateAverageNullness(evidence);

    return {
      evidence: evidence.slice(0, k),
      answer,
      confidence,
      nullness,
      mode: 'volam',
      parameters: { alpha, beta, gamma },
      empathyProfile: typeof empathyProfile === 'string' ? empathyProfile : undefined
    };
  }

  /**
   * Convert SearchResult to Evidence object
   */
  private convertToEvidence(searchResult: any): Evidence {
    const { document, score } = searchResult;
    
    // Calculate basic nullness based on confidence (inverse relationship)
    // Higher similarity scores = lower nullness (more certainty)
    const nullness = Math.max(0, Math.min(1, 1 - score));
    
    return {
      id: document.id,
      content: document.content,
      score: score, // Will be recalculated for VOLaM mode
      cosineScore: score,
      nullness: nullness,
      empathyFit: 0.0, // Will be calculated later for VOLaM mode
      source: document.metadata.source || 'unknown',
      metadata: {
        domain: document.metadata.domain,
        source: document.metadata.source,
        chunkIndex: document.metadata.chunkIndex,
        tokens: document.metadata.tokens,
        ...document.metadata
      }
    };
  }

  /**
   * Calculate VOLaM score: α·cosine + β·(1−nullness) + γ·empathy_fit
   */
  private calculateVOLaMScore(
    cosineScore: number,
    nullness: number,
    empathyFit: number,
    alpha: number,
    beta: number,
    gamma: number
  ): number {
    return alpha * cosineScore + beta * (1 - nullness) + gamma * empathyFit;
  }

  /**
   * Compose answer from top evidence pieces
   */
  private composeAnswer(evidence: Evidence[], query: string): string {
    const topEvidence = evidence.slice(0, 3);
    const citations = topEvidence.map((e, i) => `[${i + 1}] ${e.content}`).join('\n\n');
    
    return `Based on the available evidence:\n\n${citations}\n\nThis information addresses the query: "${query}"`;
  }

  /**
   * Calculate confidence based on evidence scores
   */
  private calculateConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;
    
    const avgScore = evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length;
    const maxScore = Math.max(...evidence.map(e => e.score));
    
    // Confidence combines average and max scores
    return (avgScore * 0.7 + maxScore * 0.3);
  }

  /**
   * Calculate average nullness across evidence
   */
  private calculateAverageNullness(evidence: Evidence[]): number {
    if (evidence.length === 0) return 1.0; // Maximum uncertainty
    
    return evidence.reduce((sum, e) => sum + e.nullness, 0) / evidence.length;
  }
}
