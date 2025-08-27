import React from 'react';

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
}

export const ResultsDisplay: React.FC<ResultsDisplayProps> = ({ results }) => {
  const formatScore = (score: number) => score.toFixed(3);
  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

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
            <div
              key={evidence.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center space-x-2">
                  <span className="bg-blue-100 text-blue-800 text-sm font-medium px-2.5 py-0.5 rounded">
                    #{index + 1}
                  </span>
                  <span className="text-sm text-gray-600">{evidence.source}</span>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    {formatScore(evidence.score)}
                  </div>
                  <div className="text-xs text-gray-500">
                    {results.mode === 'volam' ? 'VOLaM Score' : 'Cosine Score'}
                  </div>
                </div>
              </div>

              <p className="text-gray-700 mb-3 leading-relaxed">{evidence.content}</p>

              {/* Score Breakdown for VOLaM */}
              {results.mode === 'volam' && (
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="bg-blue-50 p-2 rounded text-center">
                    <div className="font-medium text-blue-700">
                      {formatScore(evidence.cosineScore)}
                    </div>
                    <div className="text-blue-600 text-xs">Cosine</div>
                  </div>
                  <div className="bg-green-50 p-2 rounded text-center">
                    <div className="font-medium text-green-700">
                      {formatScore(1 - evidence.nullness)}
                    </div>
                    <div className="text-green-600 text-xs">Certainty</div>
                  </div>
                  <div className="bg-purple-50 p-2 rounded text-center">
                    <div className="font-medium text-purple-700">
                      {formatScore(evidence.empathyFit)}
                    </div>
                    <div className="text-purple-600 text-xs">Empathy Fit</div>
                  </div>
                </div>
              )}

              {/* Metadata */}
              {Object.keys(evidence.metadata).length > 0 && (
                <details className="mt-3">
                  <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                    View metadata
                  </summary>
                  <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                    <pre className="whitespace-pre-wrap">
                      {JSON.stringify(evidence.metadata, null, 2)}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
