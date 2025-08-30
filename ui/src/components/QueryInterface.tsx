import { FormEvent, useState } from 'react';

import { EmpathySliders } from './EmpathySliders';
import { useEmpathyProfile } from '../hooks/useEmpathyProfile';

interface QueryInterfaceProps {
  onQuery: (
    query: string,
    mode: 'baseline' | 'volam',
    parameters: { alpha: number; beta: number; gamma: number; k: number },
    empathyProfile?: Record<string, number>
  ) => void;
  loading: boolean;
}

export const QueryInterface = ({ onQuery, loading }: QueryInterfaceProps) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<'baseline' | 'volam'>('volam');
  const [parameters, setParameters] = useState({
    alpha: 0.4,
    beta: 0.3,
    gamma: 0.3,
    k: 5,
  });

  const { profile, setFullProfile } = useEmpathyProfile();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (query.trim()) {
      onQuery(query.trim(), mode, parameters, mode === 'volam' ? profile : undefined);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Query Interface</h2>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Query Input */}
        <div>
          <label htmlFor="query" className="block text-sm font-medium text-gray-700 mb-2">
            Query
          </label>
          <textarea
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Enter your question..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            disabled={loading}
          />
        </div>

        {/* Mode Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Ranking Mode
          </label>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="baseline"
                checked={mode === 'baseline'}
                onChange={(e) => setMode(e.target.value as 'baseline' | 'volam')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm">Baseline (cosine similarity only)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="volam"
                checked={mode === 'volam'}
                onChange={(e) => setMode(e.target.value as 'baseline' | 'volam')}
                className="mr-2"
                disabled={loading}
              />
              <span className="text-sm">VOLaM (α·cosine + β·(1−nullness) + γ·empathy_fit)</span>
            </label>
          </div>
        </div>

        {/* VOLaM Parameters */}
        {mode === 'volam' && (
          <div className="space-y-4">
            <div className="space-y-3 p-4 bg-gray-50 rounded-md">
              <h3 className="text-sm font-medium text-gray-700">VOLaM Parameters</h3>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">α (cosine weight)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={parameters.alpha}
                    onChange={(e) => setParameters(prev => ({ ...prev, alpha: parseFloat(e.target.value) }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">β (nullness weight)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={parameters.beta}
                    onChange={(e) => setParameters(prev => ({ ...prev, beta: parseFloat(e.target.value) }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">γ (empathy weight)</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.1"
                    value={parameters.gamma}
                    onChange={(e) => setParameters(prev => ({ ...prev, gamma: parseFloat(e.target.value) }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    disabled={loading}
                  />
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">k (top results)</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={parameters.k}
                    onChange={(e) => setParameters(prev => ({ ...prev, k: parseInt(e.target.value) }))}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>

            {/* Empathy Profile Sliders */}
            <EmpathySliders
              profile={profile}
              onChange={setFullProfile}
              disabled={loading}
            />
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Searching...' : 'Search Evidence'}
        </button>
      </form>
    </div>
  );
};
