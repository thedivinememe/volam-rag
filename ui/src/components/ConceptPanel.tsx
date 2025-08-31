import { useState } from 'react';

interface ConceptPanelProps {
  selectedConcept?: string;
}

interface NullnessDataPoint {
  timestamp: string;
  nullness: number;
  confidence: number;
}

export const ConceptPanel = ({ selectedConcept }: ConceptPanelProps) => {
  const [hoveredPoint, setHoveredPoint] = useState<NullnessDataPoint | null>(null);

  // Mock data for initial implementation
  const mockData: NullnessDataPoint[] = [
    { timestamp: '2025-08-31T09:00:00Z', nullness: 0.3, confidence: 0.8 },
    { timestamp: '2025-08-31T09:15:00Z', nullness: 0.25, confidence: 0.82 },
    { timestamp: '2025-08-31T09:30:00Z', nullness: 0.35, confidence: 0.75 },
    { timestamp: '2025-08-31T09:45:00Z', nullness: 0.2, confidence: 0.85 },
    { timestamp: '2025-08-31T10:00:00Z', nullness: 0.15, confidence: 0.9 },
  ];

  const currentNullness = mockData[mockData.length - 1]?.nullness || 0;
  const currentConfidence = mockData[mockData.length - 1]?.confidence || 0;

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  const exportToCSV = () => {
    const csvContent = [
      'timestamp,nullness,confidence',
      ...mockData.map(point => 
        `${point.timestamp},${point.nullness},${point.confidence}`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nullness-history-${selectedConcept || 'concept'}-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 h-fit">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          Concept Nullness
        </h3>
        <button
          onClick={exportToCSV}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          title="Export CSV"
        >
          📊 CSV
        </button>
      </div>

      {/* Current Concept Info */}
      <div className="mb-6">
        <div className="text-sm text-gray-600 mb-2">
          Selected Concept: <span className="font-medium">{selectedConcept || 'None'}</span>
        </div>
        
        {selectedConcept && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded p-3">
              <div className="text-2xl font-bold text-gray-900">
                {formatPercentage(currentNullness)}
              </div>
              <div className="text-sm text-gray-600">Current Nullness</div>
            </div>
            <div className="bg-gray-50 rounded p-3">
              <div className="text-2xl font-bold text-gray-900">
                {formatPercentage(currentConfidence)}
              </div>
              <div className="text-sm text-gray-600">Confidence</div>
            </div>
          </div>
        )}
      </div>

      {/* Sparkline Chart */}
      {selectedConcept && (
        <div className="mb-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Nullness History (ΔNullness)
          </h4>
          
          <div className="relative h-32 bg-gray-50 rounded p-2">
            <div className="relative h-full">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
                <span>1.0</span>
                <span>0.5</span>
                <span>0.0</span>
              </div>
              
              {/* Chart area */}
              <div className="ml-6 h-full relative">
                {/* Grid lines */}
                <div className="absolute inset-0">
                  {[0, 0.5, 1.0].map(value => (
                    <div
                      key={value}
                      className="absolute w-full border-t border-gray-200"
                      style={{ bottom: `${value * 100}%` }}
                    />
                  ))}
                </div>
                
                {/* Data points and line */}
                <svg className="absolute inset-0 w-full h-full">
                  {/* Line path */}
                  <path
                    d={mockData.map((point, index) => {
                      const x = (index / (mockData.length - 1)) * 100;
                      const y = 100 - (point.nullness * 100);
                      return `${index === 0 ? 'M' : 'L'} ${x}% ${y}%`;
                    }).join(' ')}
                    stroke="#3B82F6"
                    strokeWidth="2"
                    fill="none"
                    vectorEffect="non-scaling-stroke"
                  />
                  
                  {/* Data points */}
                  {mockData.map((point, index) => {
                    const x = (index / (mockData.length - 1)) * 100;
                    const y = 100 - (point.nullness * 100);
                    return (
                      <circle
                        key={index}
                        cx={`${x}%`}
                        cy={`${y}%`}
                        r="3"
                        fill="#3B82F6"
                        className="cursor-pointer hover:r-4"
                        onMouseEnter={() => setHoveredPoint(point)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </svg>
                
                {/* Hover tooltip */}
                {hoveredPoint && (
                  <div className="absolute top-0 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs rounded px-2 py-1 pointer-events-none z-10">
                    <div>Time: {formatTime(hoveredPoint.timestamp)}</div>
                    <div>Nullness: {formatPercentage(hoveredPoint.nullness)}</div>
                    <div>Confidence: {formatPercentage(hoveredPoint.confidence)}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* No concept selected state */}
      {!selectedConcept && (
        <div className="text-center py-8 text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <div className="text-sm">Click on evidence to view concept nullness</div>
        </div>
      )}
    </div>
  );
};
