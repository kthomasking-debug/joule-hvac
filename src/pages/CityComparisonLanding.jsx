import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Zap, Flame } from 'lucide-react';

const CityComparisonLanding = () => {
  const navigate = useNavigate();

  const options = [
    {
      id: 'heat-pump',
      title: 'Heat Pump Comparison',
      description: 'Compare heating and cooling costs between cities using heat pumps',
      icon: Zap,
      path: '/analysis/city-comparison/heat-pump',
      color: 'blue',
    },
    {
      id: 'gas-electric',
      title: 'Gas + Electric Comparison',
      description: 'Compare costs between cities using gas heating and electric cooling',
      icon: Flame,
      path: '/analysis/city-comparison/gas-electric',
      color: 'orange',
    },
  ];

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <MapPin className="w-8 h-8 text-blue-400" />
            <h1 className="text-3xl font-semibold text-white">City Comparison</h1>
          </div>
          <p className="text-sm text-[#A7B0BA] italic">
            Compare heating and cooling costs between different cities and climates
          </p>
        </header>

        {/* Options Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {options.map((option) => {
            const Icon = option.icon;
            const isBlue = option.color === 'blue';
            const cardClasses = isBlue
              ? 'bg-blue-900/20 border-blue-700 hover:bg-blue-900/30 hover:border-blue-600'
              : 'bg-orange-900/20 border-orange-700 hover:bg-orange-900/30 hover:border-orange-600';
            const iconBgClasses = isBlue
              ? 'bg-blue-900/30 group-hover:bg-blue-900/50'
              : 'bg-orange-900/30 group-hover:bg-orange-900/50';
            const iconClasses = isBlue
              ? 'text-blue-400'
              : 'text-orange-400';

            return (
              <button
                key={option.id}
                onClick={() => navigate(option.path)}
                className={`${cardClasses} border rounded-xl p-6 text-left transition-all hover:scale-105 cursor-pointer group`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${iconBgClasses} transition-colors`}>
                    <Icon className={`w-6 h-6 ${iconClasses}`} />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-semibold text-white mb-2">
                      {option.title}
                    </h2>
                    <p className="text-sm text-[#A7B0BA]">
                      {option.description}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-blue-400 group-hover:text-blue-300">
                  <span>Select this option</span>
                  <span>→</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Info Section */}
        <div className="mt-8 p-4 bg-slate-900/50 rounded-lg border border-slate-700">
          <p className="text-sm text-[#A7B0BA]">
            <strong className="text-white">💡 Tip:</strong> Both comparison types use the same location data and thermostat settings. 
            The difference is in the heating system: heat pumps use electricity for both heating and cooling, 
            while gas+electric uses natural gas for heating and electricity for cooling.
          </p>
        </div>
      </div>
    </div>
  );
};

export default CityComparisonLanding;

