import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Calendar, 
  TrendingUp, 
  Search, 
  BarChart2
} from 'lucide-react';

// Lazy load components to isolate any import issues
const SevenDayCostForecaster = lazy(() => import('./SevenDayCostForecaster'));
const MonthlyBudgetPlanner = lazy(() => import('./MonthlyBudgetPlanner'));
const GasVsHeatPump = lazy(() => import('./GasVsHeatPump'));
const SystemPerformanceAnalyzer = lazy(() => import('./SystemPerformanceAnalyzer'));

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab from URL or default to forecast
  const getActiveTab = () => {
    if (location.pathname.includes('/analysis/forecast') || location.pathname === '/analysis') {
      return 'forecast';
    }
    if (location.pathname.includes('/analysis/budget')) {
      return 'budget';
    }
    if (location.pathname.includes('/analysis/compare')) {
      return 'compare';
    }
    if (location.pathname.includes('/analysis/analyzer')) {
      return 'analyzer';
    }
    return 'forecast';
  };

  const [activeTab, setActiveTab] = useState(getActiveTab());

  // Sync activeTab with location changes and redirect to default if needed
  useEffect(() => {
    if (location.pathname === '/analysis') {
      navigate('/analysis/forecast', { replace: true });
      return;
    }
    setActiveTab(getActiveTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate]);

  const tabs = [
    { id: 'forecast', label: 'Forecast', icon: Calendar, component: SevenDayCostForecaster },
    { id: 'budget', label: 'Budget', icon: TrendingUp, component: MonthlyBudgetPlanner },
    { id: 'compare', label: 'Compare', icon: Search, component: GasVsHeatPump },
    { id: 'analyzer', label: 'Analyzer', icon: BarChart2, component: SystemPerformanceAnalyzer },
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveComponent = activeTabData?.component || SevenDayCostForecaster;

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    navigate(`/analysis/${tabId}`);
  };

  // Tab descriptions for context
  const tabDescriptions = {
    forecast: "See what you'll spend this week based on your schedule and weather.",
    budget: "Plan your monthly energy budget and see how different strategies affect costs.",
    compare: "Compare heat pump vs gas furnace costs for your home and climate.",
    analyzer: "Upload ecobee CSV files to see how hard your system is working — and where it's wasting money.",
  };

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-semibold text-white mb-1">Analysis</h1>
          <p className="text-sm text-[#A7B0BA]">
            Forecast costs, compare heat pump vs gas, and dig into raw thermostat data.
          </p>
        </header>

        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap text-sm font-medium ${
                    activeTab === tab.id
                      ? 'bg-[#1E4CFF] text-white'
                      : 'bg-[#151A21] text-[#A7B0BA] hover:bg-[#1D232C] border border-[#222A35]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          {/* Tab Description */}
          {tabDescriptions[activeTab] && (
            <p className="mt-3 text-sm text-[#A7B0BA]">
              {tabDescriptions[activeTab]}
            </p>
          )}
        </div>

        {/* Active Tab Content */}
        <div className="animate-fade-in-up">
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-[#A7B0BA]">Loading...</p>
              </div>
            </div>
          }>
            <ActiveComponent />
          </Suspense>
        </div>
      </div>
    </div>
  );
};

export default Analysis;

