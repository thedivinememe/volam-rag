import React, { useEffect, useState } from 'react';

import { TelemetryEntry } from '../types/telemetry';
import { telemetryStorage } from '../utils/telemetryStorage';

interface TelemetryPanelProps {
  entries: TelemetryEntry[];
  onClear: () => void;
}

export const TelemetryPanel: React.FC<TelemetryPanelProps> = ({ entries, onClear }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(telemetryStorage.getVisibility());
  }, []);

  const toggleVisibility = () => {
    const newVisibility = !isVisible;
    setIsVisible(newVisibility);
    telemetryStorage.setVisibility(newVisibility);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatResponseTime = (ms: number) => {
    return `${ms}ms`;
  };

  const formatScores = (scores: number[]) => {
    return scores.map(s => s.toFixed(3)).join(', ');
  };

  if (!isVisible) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white p-2 border-t border-gray-600">
        <button
          onClick={toggleVisibility}
          className="text-sm hover:text-blue-300 transition-colors"
        >
          📊 Show Telemetry ({entries.length} requests)
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 text-white border-t border-gray-600 max-h-80 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-600">
        <div className="flex items-center gap-4">
          <button
            onClick={toggleVisibility}
            className="text-sm hover:text-blue-300 transition-colors"
          >
            📊 Hide Telemetry
          </button>
          <span className="text-sm text-gray-300">
            {entries.length} requests logged
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-sm px-3 py-1 bg-red-600 hover:bg-red-700 rounded transition-colors"
        >
          Clear Log
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {entries.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            No telemetry data yet. Make a query to see request logs.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="text-left p-2 border-r border-gray-600">Time</th>
                  <th className="text-left p-2 border-r border-gray-600">Mode</th>
                  <th className="text-left p-2 border-r border-gray-600">Query</th>
                  <th className="text-left p-2 border-r border-gray-600">α/β/γ</th>
                  <th className="text-left p-2 border-r border-gray-600">Latency</th>
                  <th className="text-left p-2 border-r border-gray-600">Top-K Scores</th>
                  <th className="text-left p-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-gray-700 hover:bg-gray-750">
                    <td className="p-2 border-r border-gray-600 text-gray-300">
                      {formatTimestamp(entry.timestamp)}
                    </td>
                    <td className="p-2 border-r border-gray-600">
                      <span className={`px-2 py-1 rounded text-xs ${
                        entry.mode === 'volam' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-600 text-white'
                      }`}>
                        {entry.mode}
                      </span>
                    </td>
                    <td className="p-2 border-r border-gray-600 max-w-xs truncate" title={entry.query}>
                      {entry.query}
                    </td>
                    <td className="p-2 border-r border-gray-600 text-xs text-gray-300">
                      {entry.parameters.alpha.toFixed(2)}/
                      {entry.parameters.beta.toFixed(2)}/
                      {entry.parameters.gamma.toFixed(2)}
                    </td>
                    <td className="p-2 border-r border-gray-600 text-gray-300">
                      {formatResponseTime(entry.responseTime)}
                    </td>
                    <td className="p-2 border-r border-gray-600 text-xs text-gray-300">
                      {formatScores(entry.topKScores)}
                    </td>
                    <td className="p-2">
                      {entry.success ? (
                        <span className="text-green-400">✓</span>
                      ) : (
                        <span className="text-red-400" title={entry.error}>✗</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
