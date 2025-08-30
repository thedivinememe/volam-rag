import { Evidence, RankingResult } from '../types/core.js';

import { NullnessService } from './nullness.js';

export interface Citation {
  id: string;
  content: string;
  source: string;
  score: number;
  index: number;
  quotedText?: string;
}

export interface AnswerComposition {
  answer: string;
  citations: Citation[];
  confidence: number;
  rationale: string;
  metadata: {
    evidenceCount: number;
    avgScore: number;
    avgNullness: number;
    synthesisMethod: string;
  };
}

export interface AnswerRequest {
  query: string;
  evidence: Evidence[];
  mode: 'baseline' | 'volam';
  rankingResult: RankingResult;
}

/**
 * Service for composing answers with rationale and citations
 * 
 * This service handles the composition of answers from ranked evidence,
 * including citation formatting, confidence calculation, and rationale generation.
 */
export class AnswerService {
  private nullnessService: NullnessService;

  constructor() {
    this.nullnessService = new NullnessService();
  }

  /**
   * Compose a complete answer with citations and rationale
   */
  async composeAnswer(request: AnswerRequest): Promise<AnswerComposition> {
    const { query, evidence, mode, rankingResult } = request;

    if (evidence.length === 0) {
      return this.composeEmptyAnswer(query);
    }

    // Extract citations from evidence
    const citations = this.extractCitations(evidence);

    // Calculate confidence using nullness service
    const confidence = await this.calculateConfidence(query, evidence, rankingResult);

    // Generate rationale explaining the answer composition
    const rationale = this.generateRationale(evidence, mode, confidence);

    // Compose the main answer with proper citation integration
    const answer = this.synthesizeAnswer(query, evidence, citations);

    // Calculate metadata
    const metadata = {
      evidenceCount: evidence.length,
      avgScore: evidence.reduce((sum, e) => sum + e.score, 0) / evidence.length,
      avgNullness: evidence.reduce((sum, e) => sum + e.nullness, 0) / evidence.length,
      synthesisMethod: 'template-based'
    };

    return {
      answer,
      citations,
      confidence,
      rationale,
      metadata
    };
  }

  /**
   * Extract citations from evidence with proper formatting
   */
  private extractCitations(evidence: Evidence[]): Citation[] {
    return evidence.map((e, index) => ({
      id: e.id,
      content: e.content,
      source: e.source,
      score: e.score,
      index: index + 1,
      quotedText: this.extractQuotedText(e.content)
    }));
  }

  /**
   * Extract the most relevant quoted text from evidence content
   */
  private extractQuotedText(content: string): string {
    // For now, take the first sentence or up to 100 characters
    const sentences = content.split(/[.!?]+/);
    const firstSentence = sentences[0]?.trim();
    
    if (firstSentence && firstSentence.length <= 100) {
      return firstSentence;
    }
    
    // If first sentence is too long, truncate to 97 chars + "..."
    if (content.length > 100) {
      return content.substring(0, 97).trim() + '...';
    }
    
    return content.trim();
  }

  /**
   * Calculate confidence using nullness service integration
   */
  private async calculateConfidence(
    query: string, 
    evidence: Evidence[], 
    rankingResult: RankingResult
  ): Promise<number> {
    // Update nullness tracking for this query
    await this.nullnessService.updateNullness(query, rankingResult);

    // Get concept-based nullness
    const concept = this.extractConcept(query);
    const conceptNullness = await this.nullnessService.getCurrentNullness(concept);

    // Calculate evidence-weighted confidence
    const evidenceConfidence = this.calculateEvidenceConfidence(evidence);

    // Combine concept nullness with evidence confidence
    // confidence = (1 - conceptNullness) * evidenceConfidence
    const combinedConfidence = (1 - conceptNullness) * evidenceConfidence;

    // Ensure confidence is in [0, 1] range
    return Math.max(0, Math.min(1, combinedConfidence));
  }

  /**
   * Calculate confidence based on evidence scores and nullness
   */
  private calculateEvidenceConfidence(evidence: Evidence[]): number {
    if (evidence.length === 0) return 0;

    // Weight evidence by scores and inverse nullness
    let weightedConfidence = 0;
    let totalWeight = 0;

    for (const e of evidence) {
      const weight = e.score; // Use evidence score as weight
      const evidenceConfidence = 1 - e.nullness; // Convert nullness to confidence
      
      weightedConfidence += weight * evidenceConfidence;
      totalWeight += weight;
    }

    return totalWeight > 0 ? weightedConfidence / totalWeight : 0;
  }

  /**
   * Generate rationale explaining how the answer was composed
   */
  private generateRationale(evidence: Evidence[], mode: string, confidence: number): string {
    const evidenceCount = evidence.length;
    const avgScore = evidence.reduce((sum, e) => sum + e.score, 0) / evidenceCount;
    const avgNullness = evidence.reduce((sum, e) => sum + e.nullness, 0) / evidenceCount;

    let rationale = `This answer is based on ${evidenceCount} piece${evidenceCount > 1 ? 's' : ''} of evidence `;
    rationale += `retrieved using ${mode} ranking mode. `;

    if (mode === 'volam') {
      rationale += `The VOLaM algorithm considered cosine similarity, certainty (1-nullness), and empathy fit when ranking evidence. `;
    } else {
      rationale += `The baseline algorithm used cosine similarity for ranking. `;
    }

    rationale += `The average evidence score is ${avgScore.toFixed(3)} and average nullness is ${avgNullness.toFixed(3)}. `;

    // Confidence interpretation
    if (confidence >= 0.8) {
      rationale += `The high confidence score (${confidence.toFixed(3)}) indicates strong evidence support for this answer.`;
    } else if (confidence >= 0.6) {
      rationale += `The moderate confidence score (${confidence.toFixed(3)}) suggests reasonable evidence support with some uncertainty.`;
    } else {
      rationale += `The low confidence score (${confidence.toFixed(3)}) indicates limited or uncertain evidence for this answer.`;
    }

    return rationale;
  }

  /**
   * Synthesize the main answer from evidence with citations
   */
  private synthesizeAnswer(query: string, evidence: Evidence[], citations: Citation[]): string {
    // Create introduction
    let answer = `Based on the available evidence, here's what I found regarding "${query}":\n\n`;

    // Add evidence-based content with citations
    const synthesizedContent = evidence.map((e, index) => {
      const citationNum = index + 1;
      const quotedText = citations[index].quotedText || e.content.substring(0, 100) + '...';
      return `According to the evidence, "${quotedText}" [${citationNum}]`;
    }).join('\n\n');

    answer += synthesizedContent;

    // Add sources section
    answer += '\n\n**Sources:**\n';
    citations.forEach(citation => {
      answer += `[${citation.index}] ${citation.source} (Score: ${citation.score.toFixed(3)})\n`;
    });

    return answer;
  }

  /**
   * Compose answer for empty evidence case
   */
  private composeEmptyAnswer(query: string): AnswerComposition {
    return {
      answer: `I don't have sufficient evidence to answer the query: "${query}". Please try rephrasing your question or providing more context.`,
      citations: [],
      confidence: 0,
      rationale: 'No evidence was found matching the query criteria.',
      metadata: {
        evidenceCount: 0,
        avgScore: 0,
        avgNullness: 0.5, // Default uncertainty
        synthesisMethod: 'empty-response'
      }
    };
  }

  /**
   * Extract concept from query for nullness tracking
   */
  private extractConcept(query: string): string {
    // Use same logic as NullnessService for consistency
    return query.toLowerCase()
      .split(' ')
      .slice(0, 3)
      .join('_')
      .replace(/[^a-z0-9_]/g, '');
  }
}
