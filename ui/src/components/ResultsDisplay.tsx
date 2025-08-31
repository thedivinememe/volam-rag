import { EvidenceCard } from './EvidenceCard';
import { useNullnessUpdate } from '../hooks/useNullnessUpdate';
import { useState } from 'react';

interface Evidence {
  id: string;
  content: string;
  score: number;
  cosineScore: number;
  nullness: number;
  empathyFit: number;
  source: string;
  metadata: Record<string, unknown>;
}

interface QueryResult {
  mode: 'baseline' | 'volam';
  query: string;
  evidence: Evidence[];
  answer: string;
  confidence: number;
  nullness: number;
  parameters: {
    alpha: number;
    beta: number;
    gamma: number;
    k: number;
  };
  metadata: {
    responseTime: number;
    timestamp: string;
  };
}

interface ResultsDisplayProps {
  results: QueryResult;
  onConceptSelect?: (concept: string) => void;
}

export const ResultsDisplay = ({ results, onConceptSelect }: ResultsDisplayProps) => {
  const [updatingCardId, setUpdatingCardId] = useState<string | null>(null);
  const { updateFromEvidence, lastUpdate } = useNullnessUpdate();
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  const handleEvidenceClick = async (evidence: Evidence) => {
    setUpdatingCardId(evidence.id);
    
    try {
      // Extract concept from evidence content
      const concept = extractConceptFromContent(evidence.content);
      
      // Notify parent component about concept selection
      if (onConceptSelect) {
        onConceptSelect(concept);
      }
      
      // Detect stance from evidence content
      const stance = detectStance(evidence.content);
      
      // Calculate evidence strength based on score and certainty
      const evidenceStrength = Math.min(0.9, evidence.score * (1 - evidence.nullness));
      
      await updateFromEvidence(evidence.content, stance, evidenceStrength);
      
      // Show success feedback
      console.log('Nullness updated successfully:', lastUpdate);
    } catch (error) {
      console.error('Failed to update nullness:', error);
    } finally {
      setUpdatingCardId(null);
    }
  };

  // Extract concept from content (same logic as in useNullnessUpdate)
  const extractConceptFromContent = (content: string): string => {
    const words = content.toLowerCase().split(/\s+/);
    const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those']);
    
    const meaningfulWords = words.filter(word => 
      word.length > 3 && 
      !stopWords.has(word) && 
      /^[a-z]+$/.test(word)
    );
    
    return meaningfulWords[0] || 'general_concept';
  };

  // Simple stance detection helper
  const detectStance = (content: string): 'support' | 'refute' | 'neutral' => {
    const supportWords = ['support', 'agree', 'confirm', 'validate', 'prove', 'demonstrate', 'show', 'evidence suggests'];
    const refuteWords = ['refute', 'disagree', 'contradict', 'disprove', 'challenge', 'oppose', 'however', 'but'];
    
    const lowerContent = content.toLowerCase();
    
    const supportCount = supportWords.filter(word => lowerContent.includes(word)).length;
    const refuteCount = refuteWords.filter(word => lowerContent.includes(word)).length;
    
    if (supportCount > refuteCount) return 'support';
    if (refuteCount > supportCount) return 'refute';
    return 'neutral';
  };

  return (
    <div className="space-y-6">
      {/* Query Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Query Results</h2>
            <p className="text-sm text-gray-600 mt-1">
              Mode: <span className="font-medium">{results.mode.toUpperCase()}</span>
            </p>
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>Response time: {results.metadata.responseTime}ms</div>
            <div>Timestamp: {new Date(results.metadata.timestamp).toLocaleTimeString()}</div>
          </div>
        </div>

        <div className="bg-gray-50 rounded-md p-4 mb-4">
          <h3 className="font-medium text-gray-900 mb-2">Query</h3>
          <p className="text-gray-700">{results.query}</p>
        </div>

        {/* Parameters Display */}
        {results.mode === 'volam' && (
          <div className="grid grid-cols-4 gap-4 mb-4">
            <div className="text-center p-3 bg-blue-50 rounded-md">
              <div className="text-lg font-semibold text-blue-700">α = {results.parameters.alpha}</div>
              <div className="text-xs text-blue-600">cosine weight</div>
            </div>
            <div className="text-center p-3 bg-green-50 rounded-md">
              <div className="text-lg font-semibold text-green-700">β = {results.parameters.beta}</div>
              <div className="text-xs text-green-600">nullness weight</div>
            </div>
            <div className="text-center p-3 bg-purple-50 rounded-md">
              <div className="text-lg font-semibold text-purple-700">γ = {results.parameters.gamma}</div>
              <div className="text-xs text-purple-600">empathy weight</div>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-md">
              <div className="text-lg font-semibold text-gray-700">k = {results.parameters.k}</div>
              <div className="text-xs text-gray-600">top results</div>
            </div>
          </div>
        )}

        {/* Confidence and Nullness */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-emerald-50 rounded-md">
            <div className="text-lg font-semibold text-emerald-700">
              {formatPercentage(results.confidence)}
            </div>
            <div className="text-xs text-emerald-600">Confidence</div>
          </div>
          <div className="text-center p-3 bg-orange-50 rounded-md">
            <div className="text-lg font-semibold text-orange-700">
              {formatPercentage(results.nullness)}
            </div>
            <div className="text-xs text-orange-600">Nullness</div>
          </div>
        </div>
      </div>

      {/* Generated Answer */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Generated Answer</h3>
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-r-md">
          <p className="text-gray-800">{results.answer}</p>
        </div>
      </div>

      {/* Evidence List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Top {results.evidence.length} Evidence Sources
        </h3>
        
        <div className="space-y-4">
          {results.evidence.map((evidence, index) => (
            <EvidenceCard
              key={evidence.id}
              evidence={evidence}
              index={index}
              mode={results.mode}
              onCardClick={handleEvidenceClick}
              isUpdating={updatingCardId === evidence.id}
            />
          ))}
        </div>
        
        {/* Nullness Update Feedback */}
        {lastUpdate && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="text-sm text-blue-800">
              <strong>Nullness Updated:</strong> Concept "{lastUpdate.data?.concept}" 
              {lastUpdate.data && (
                <span> changed from {(lastUpdate.data.old_nullness * 100).toFixed(1)}% to {(lastUpdate.data.new_nullness * 100).toFixed(1)}% nullness</span>
              )}
              {lastUpdate.metadata && (
                <span> (Response time: {lastUpdate.metadata.responseTime}ms)</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
