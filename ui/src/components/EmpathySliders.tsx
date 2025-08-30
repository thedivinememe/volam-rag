import { EmpathyProfile } from '../hooks/useEmpathyProfile';

interface EmpathySlidersProps {
  profile: EmpathyProfile;
  onChange: (profile: EmpathyProfile) => void;
  disabled?: boolean;
}

const STAKEHOLDER_LABELS: Record<string, string> = {
  general_public: 'General Public',
  experts: 'Experts',
  policymakers: 'Policymakers',
  affected_communities: 'Affected Communities',
};

export const EmpathySliders = ({ profile, onChange, disabled = false }: EmpathySlidersProps) => {
  const handleSliderChange = (stakeholder: string, value: number) => {
    const newProfile = { ...profile, [stakeholder]: value };
    
    // Normalize weights to sum to 1.0
    const total = Object.values(newProfile).reduce((sum, weight) => sum + weight, 0);
    if (total > 0) {
      const normalized: EmpathyProfile = {};
      for (const [key, weight] of Object.entries(newProfile)) {
        normalized[key] = weight / total;
      }
      onChange(normalized);
    }
  };

  const resetToDefault = () => {
    onChange({
      general_public: 0.4,
      experts: 0.3,
      policymakers: 0.2,
      affected_communities: 0.1,
    });
  };

  return (
    <div className="space-y-4 p-4 bg-gray-50 rounded-md">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium text-gray-700">Empathy Profile</h3>
        <button
          type="button"
          onClick={resetToDefault}
          disabled={disabled}
          className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
        >
          Reset
        </button>
      </div>
      
      <div className="space-y-3">
        {Object.entries(STAKEHOLDER_LABELS).map(([stakeholder, label]) => {
          const weight = profile[stakeholder] || 0;
          const percentage = Math.round(weight * 100);
          
          return (
            <div key={stakeholder} className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="text-xs text-gray-600">{label}</label>
                <span className="text-xs text-gray-500 font-mono">{percentage}%</span>
              </div>
              
              <div className="relative">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={percentage}
                  onChange={(e) => handleSliderChange(stakeholder, parseInt(e.target.value) / 100)}
                  disabled={disabled}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer 
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50
                           [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 
                           [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-blue-500 
                           [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:border-2 
                           [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:shadow-md
                           [&::-webkit-slider-thumb]:hover:bg-blue-600
                           disabled:[&::-webkit-slider-thumb]:bg-gray-400 disabled:[&::-webkit-slider-thumb]:cursor-not-allowed
                           [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full 
                           [&::-moz-range-thumb]:bg-blue-500 [&::-moz-range-thumb]:cursor-pointer 
                           [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:shadow-md
                           [&::-moz-range-thumb]:hover:bg-blue-600
                           disabled:[&::-moz-range-thumb]:bg-gray-400 disabled:[&::-moz-range-thumb]:cursor-not-allowed"
                />
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Profile Summary */}
      <div className="pt-2 border-t border-gray-200">
        <div className="text-xs text-gray-500">
          <div className="flex justify-between">
            <span>Total:</span>
            <span className="font-mono">
              {Math.round(Object.values(profile).reduce((sum, weight) => sum + weight, 0) * 100)}%
            </span>
          </div>
        </div>
      </div>
      
      {/* Visual representation */}
      <div className="space-y-1">
        <div className="text-xs text-gray-500">Weight Distribution:</div>
        <div className="flex h-2 bg-gray-200 rounded-full overflow-hidden">
          {Object.entries(STAKEHOLDER_LABELS).map(([stakeholder, label], index) => {
            const weight = profile[stakeholder] || 0;
            const percentage = weight * 100;
            const colors = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500'];
            
            return (
              <div
                key={stakeholder}
                className={`${colors[index]} transition-all duration-200`}
                style={{ width: `${percentage}%` }}
                title={`${label}: ${Math.round(percentage)}%`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
