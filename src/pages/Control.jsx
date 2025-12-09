import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Thermometer, 
  Wind
} from 'lucide-react';
import SmartThermostatDemo from './SmartThermostatDemo';
import AirQualityHMI from './AirQualityHMI';

const Control = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab from URL or default to thermostat
  const getActiveTab = () => {
    if (location.pathname.includes('/control/air-quality')) {
      return 'air-quality';
    }
    return 'thermostat';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  // Sync activeTab with location changes and redirect to default if needed
  useEffect(() => {
    if (location.pathname === '/control') {
      navigate('/control/thermostat', { replace: true });
      return;
    }
    setActiveTab(getActiveTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate]);

  const tabs = [
    { id: 'thermostat', label: 'Thermostat', icon: Thermometer, component: SmartThermostatDemo },
    { id: 'air-quality', label: 'Air Quality', icon: Wind, component: AirQualityHMI },
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveComponent = activeTabData?.component || SmartThermostatDemo;

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/control/${tabId}`);
  };

  return (
    <div className="min-h-screen bg-[#050B10]">
      <div className="mx-auto max-w-[1200px] px-6 lg:px-8 py-4">
        {/* Tab Navigation - Integrated with page header */}
        <div className="mb-3">
          <div className="inline-flex rounded-lg border border-slate-800 bg-slate-900/80 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Tab Content */}
        <div className="animate-fade-in-up">
          <ActiveComponent />
        </div>
      </div>
    </div>
  );
};

export default Control;

