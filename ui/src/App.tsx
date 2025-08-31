import { ConceptPanel } from './components/ConceptPanel';
import { QueryInterface } from './components/QueryInterface';
import { ResultsDisplay } from './components/ResultsDisplay';
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

function App() {
  const [results, setResults] = useState<QueryResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<string | undefined>(undefined);

  const handleQuery = async (
    query: string,
    mode: 'baseline' | 'volam',
    parameters: { alpha: number; beta: number; gamma: number; k: number },
    empathyProfile?: Record<string, number>
  ) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams({
        query,
        mode,
        k: parameters.k.toString(),
        ...(mode === 'volam' && {
          alpha: parameters.alpha.toString(),
          beta: parameters.beta.toString(),
          gamma: parameters.gamma.toString(),
        }),
      });

      // Add empathy profile if provided
      if (empathyProfile && mode === 'volam') {
        queryParams.set('empathyProfile', JSON.stringify(empathyProfile));
      }

      const response = await fetch(`/api/rank?${queryParams}`);
      if (!response.ok) {
        throw new Error('Query failed');
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Query error:', error);
      // TODO: Add proper error handling
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">VOLaM-RAG</h1>
              <p className="text-sm text-gray-600 mt-1">
                Evidence ranking with nullness tracking and empathy profiling
              </p>
            </div>
            <div className="text-sm text-gray-500">
              α·cosine + β·(1−nullness) + γ·empathy_fit
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Query Interface */}
          <div className="lg:col-span-1">
            <QueryInterface onQuery={handleQuery} loading={loading} />
          </div>

          {/* Results Display */}
          <div className="lg:col-span-2">
            {results ? (
              <ResultsDisplay 
                results={results} 
                onConceptSelect={setSelectedConcept}
              />
            ) : (
              <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-medium mb-2">Ready to search</h3>
                <p>Enter a query to see VOLaM-RAG evidence ranking in action</p>
              </div>
            )}
          </div>

          {/* Concept Panel */}
          <div className="lg:col-span-1">
            <ConceptPanel selectedConcept={selectedConcept} />
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
