import { useCallback, useState } from 'react';

interface NullnessUpdateParams {
  concept: string;
  action: 'support' | 'refute';
  evidence_strength: number;
  k?: number;
  lambda?: number;
}

interface NullnessUpdateResult {
  success: boolean;
  data?: {
    concept: string;
    action: string;
    old_nullness: number;
    new_nullness: number;
    delta: number;
    timestamp: string;
    evidence_strength: number;
    k: number;
    lambda: number;
  };
  metadata?: {
    responseTime: number;
  };
  error?: string;
}

export const useNullnessUpdate = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<NullnessUpdateResult | null>(null);

  const updateNullness = useCallback(async (params: NullnessUpdateParams): Promise<NullnessUpdateResult> => {
    setIsUpdating(true);
    
    try {
      const response = await fetch('/api/update_nullness', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          concept: params.concept,
          action: params.action,
          evidence_strength: params.evidence_strength,
          k: params.k || 0.1,
          lambda: params.lambda || 0.9
        }),
      });

      const result: NullnessUpdateResult = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update nullness');
      }

      setLastUpdate(result);
      return result;
    } catch (error) {
      const errorResult: NullnessUpdateResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      setLastUpdate(errorResult);
      return errorResult;
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const updateFromEvidence = useCallback(async (
    evidenceContent: string,
    stance: 'support' | 'refute' | 'neutral',
    evidenceStrength: number = 0.7
  ): Promise<NullnessUpdateResult> => {
    // Extract concept from evidence content (simple approach)
    // In a real implementation, this would be more sophisticated
    const concept = extractConceptFromContent(evidenceContent);
    
    // Convert neutral stance to support with lower strength
    const action = stance === 'neutral' ? 'support' : stance;
    const adjustedStrength = stance === 'neutral' ? evidenceStrength * 0.5 : evidenceStrength;
    
    return updateNullness({
      concept,
      action,
      evidence_strength: adjustedStrength
    });
  }, [updateNullness]);

  return {
    updateNullness,
    updateFromEvidence,
    isUpdating,
    lastUpdate,
    clearLastUpdate: () => setLastUpdate(null)
  };
};

// Simple concept extraction - in practice this would be more sophisticated
function extractConceptFromContent(content: string): string {
  // Extract key nouns and concepts from the content
  // This is a simplified version - real implementation would use NLP
  const words = content.toLowerCase().split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
  
  const meaningfulWords = words.filter(word => 
    word.length > 3 && 
    !stopWords.has(word) && 
    /^[a-z]+$/.test(word)
  );
  
  // Return the first meaningful word as concept, or fallback
  return meaningfulWords[0] || 'general_concept';
}
