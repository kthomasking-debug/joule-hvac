import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Calendar, 
  TrendingUp, 
  Search, 
  BarChart2,
  Activity,
  MapPin
} from 'lucide-react';

// Lazy load components to isolate any import issues
const SevenDayCostForecaster = lazy(() => import('./SevenDayCostForecaster'));
const MonthlyBudgetPlanner = lazy(() => import('./MonthlyBudgetPlanner'));
const GasVsHeatPump = lazy(() => import('./GasVsHeatPump'));
const SystemPerformanceAnalyzer = lazy(() => import('./SystemPerformanceAnalyzer'));
const HeatPumpEnergyFlow = lazy(() => import('./HeatPumpEnergyFlow'));

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
    if (location.pathname.includes('/analysis/annual')) {
      return 'annual';
    }
    if (location.pathname.includes('/analysis/city-comparison')) {
      return 'city-comparison';
    }
    if (location.pathname.includes('/analysis/compare')) {
      return 'compare';
    }
    if (location.pathname.includes('/analysis/analyzer')) {
      return 'analyzer';
    }
    if (location.pathname.includes('/analysis/energy-flow')) {
      return 'energy-flow';
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

  // City Comparison wrapper component
  const CityComparison = () => <MonthlyBudgetPlanner initialMode="comparison" />;
  // Annual Forecast wrapper component
  const AnnualForecast = () => <MonthlyBudgetPlanner initialMode="annual" />;

  const tabs = [
    { id: 'forecast', label: 'Weekly Forecast', icon: Calendar, component: SevenDayCostForecaster },
    { id: 'budget', label: 'Monthly Forecast', icon: TrendingUp, component: MonthlyBudgetPlanner },
    { id: 'annual', label: 'Annual Forecast', icon: TrendingUp, component: AnnualForecast },
    { id: 'city-comparison', label: 'City Comparison', icon: MapPin, component: CityComparison },
    { id: 'energy-flow', label: 'Energy Flow', icon: Activity, component: HeatPumpEnergyFlow },
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
    budget: "Plan your monthly energy budget and explore how different strategies affect your costs.",
    annual: "View your annual heating and cooling cost breakdown by month.",
    'city-comparison': "Compare heating costs between different cities and climates.",
    'energy-flow': "Visualize heat pump performance and see when backup heat is needed.",
    compare: "Compare heat pump vs gas furnace costs for your home and climate.",
    analyzer: "Upload your thermostat data to see how your system is performing — and where it might need attention.",
  };

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Page Header - Always visible */}
        <header className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-2xl font-semibold text-white">Simulator</h1>
            <Link
              to="/analysis/annual"
              className="text-sm text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
            >
              <TrendingUp className="w-4 h-4" />
              Annual Forecast
            </Link>
          </div>
          <p className="text-sm text-[#A7B0BA] italic">
            Forecast costs, compare systems, and explore what your thermostat data reveals — all in one place.
          </p>
        </header>

        {/* Tab Navigation - Always visible */}
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

