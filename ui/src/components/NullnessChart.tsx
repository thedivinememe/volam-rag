import { useEffect, useState } from 'react';

interface NullnessDataPoint {
  timestamp: string;
  concept: string;
  nullness: number;
  confidence: number;
}

export const NullnessChart = () => {
  const [nullnessHistory, setNullnessHistory] = useState<NullnessDataPoint[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch nullness history from API
    const fetchNullnessHistory = async () => {
      try {
        const response = await fetch('/api/nullness/history');
        if (response.ok) {
          const data = await response.json();
          setNullnessHistory(data);
        }
      } catch (error) {
        console.error('Failed to fetch nullness history:', error);
        // Generate mock data for demonstration
        generateMockData();
      } finally {
        setLoading(false);
      }
    };

    fetchNullnessHistory();
  }, []);

  const generateMockData = () => {
    const concepts = ['climate_change', 'renewable_energy', 'carbon_emissions', 'sustainability'];
    const mockData: NullnessDataPoint[] = [];
    
    for (let i = 0; i < 20; i++) {
      const timestamp = new Date(Date.now() - (19 - i) * 60000).toISOString();
      concepts.forEach(concept => {
        mockData.push({
          timestamp,
          concept,
          nullness: Math.random() * 0.6 + 0.2, // Random nullness between 0.2 and 0.8
          confidence: Math.random() * 0.4 + 0.6, // Random confidence between 0.6 and 1.0
        });
      });
    }
    
    setNullnessHistory(mockData);
  };

  const filteredData = selectedConcept === 'all' 
    ? nullnessHistory 
    : nullnessHistory.filter(d => d.concept === selectedConcept);

  const concepts = Array.from(new Set(nullnessHistory.map(d => d.concept)));

  const getColorForConcept = (concept: string) => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];
    const index = concepts.indexOf(concept) % colors.length;
    return colors[index];
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Nullness Tracking Over Time</h3>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading nullness history...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-semibold text-gray-900">
          Nullness Tracking Over Time (ΔNullness)
        </h3>
        
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Filter by concept:</label>
          <select
            value={selectedConcept}
            onChange={(e) => setSelectedConcept(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Concepts</option>
            {concepts.map(concept => (
              <option key={concept} value={concept}>
                {concept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Simple Chart Visualization */}
      <div className="space-y-4">
        {/* Chart Area */}
        <div className="relative h-64 bg-gray-50 rounded-lg p-4 overflow-hidden">
          <div className="absolute inset-4">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
              <span>1.0</span>
              <span>0.8</span>
              <span>0.6</span>
              <span>0.4</span>
              <span>0.2</span>
              <span>0.0</span>
            </div>
            
            {/* Chart content */}
            <div className="ml-8 h-full relative">
              {/* Grid lines */}
              <div className="absolute inset-0">
                {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map(value => (
                  <div
                    key={value}
                    className="absolute w-full border-t border-gray-200"
                    style={{ bottom: `${value * 100}%` }}
                  />
                ))}
              </div>
              
              {/* Data points */}
              <div className="relative h-full">
                {selectedConcept === 'all' ? (
                  // Show all concepts with different colors
                  concepts.map(concept => {
                    const conceptData = nullnessHistory.filter(d => d.concept === concept);
                    return (
                      <div key={concept} className="absolute inset-0">
                        {conceptData.map((point, index) => (
                          <div
                            key={`${point.concept}-${point.timestamp}`}
                            className="absolute w-2 h-2 rounded-full transform -translate-x-1 -translate-y-1"
                            style={{
                              backgroundColor: getColorForConcept(concept),
                              left: `${(index / (conceptData.length - 1)) * 100}%`,
                              bottom: `${point.nullness * 100}%`,
                            }}
                            title={`${concept}: ${formatPercentage(point.nullness)} nullness at ${formatTime(point.timestamp)}`}
                          />
                        ))}
                      </div>
                    );
                  })
                ) : (
                  // Show single concept
                  <div className="absolute inset-0">
                    {filteredData.map((point, index) => (
                      <div
                        key={`${point.concept}-${point.timestamp}`}
                        className="absolute w-3 h-3 bg-blue-500 rounded-full transform -translate-x-1.5 -translate-y-1.5"
                        style={{
                          left: `${(index / (filteredData.length - 1)) * 100}%`,
                          bottom: `${point.nullness * 100}%`,
                        }}
                        title={`${formatPercentage(point.nullness)} nullness at ${formatTime(point.timestamp)}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        {selectedConcept === 'all' && (
          <div className="flex flex-wrap gap-4 justify-center">
            {concepts.map(concept => (
              <div key={concept} className="flex items-center space-x-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getColorForConcept(concept) }}
                />
                <span className="text-sm text-gray-700">
                  {concept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {formatPercentage(
                filteredData.reduce((sum, d) => sum + d.nullness, 0) / filteredData.length || 0
              )}
            </div>
            <div className="text-sm text-gray-600">Average Nullness</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {formatPercentage(
                filteredData.reduce((sum, d) => sum + d.confidence, 0) / filteredData.length || 0
              )}
            </div>
            <div className="text-sm text-gray-600">Average Confidence</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-semibold text-gray-900">
              {filteredData.length}
            </div>
            <div className="text-sm text-gray-600">Data Points</div>
          </div>
        </div>
      </div>
    </div>
  );
};
