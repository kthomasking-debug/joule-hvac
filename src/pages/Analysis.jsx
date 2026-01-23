import React, { useState, useEffect, lazy, Suspense } from 'react';
import { useNavigate, useLocation, Link, useOutletContext } from 'react-router-dom';
import { 
  Calendar, 
  TrendingUp, 
  Search, 
  BarChart2,
  Activity,
  MapPin
} from 'lucide-react';
import AIExplanation from '../components/AIExplanation';

// Lazy load components to isolate any import issues
const SevenDayCostForecaster = lazy(() => import('./SevenDayCostForecaster'));
const MonthlyBudgetPlanner = lazy(() => import('./MonthlyBudgetPlanner'));
const SystemPerformanceAnalyzer = lazy(() => import('./SystemPerformanceAnalyzer'));
const HeatPumpEnergyFlow = lazy(() => import('./HeatPumpEnergyFlow'));
const CityComparisonLanding = lazy(() => import('./CityComparisonLanding'));

const Analysis = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Determine active tab from URL or default to forecast
  const getActiveTab = () => {
    if (location.pathname.includes('/analysis/weekly') || location.pathname.includes('/analysis/forecast') || location.pathname === '/analysis') {
      return 'forecast';
    }
    if (location.pathname.includes('/analysis/monthly') || location.pathname.includes('/analysis/budget')) {
      return 'budget';
    }
    if (location.pathname.includes('/analysis/annual')) {
      return 'annual';
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
      navigate('/analysis/weekly', { replace: true });
      return;
    }
    setActiveTab(getActiveTab());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, navigate]);

  // Check if we're on a city comparison route
  const isCityComparisonRoute = location.pathname.includes('/city-comparison') || location.pathname.includes('/city-cost-comparison');

  // City Cost Comparison wrapper components
  const CityComparison = () => {
    // Check if we're on a sub-route (support both old /analysis and new /tools paths)
    if (location.pathname === '/analysis/city-comparison' || location.pathname === '/tools/city-cost-comparison') {
      return <CityComparisonLanding />;
    }
    if (location.pathname.includes('/analysis/city-comparison/heat-pump') || location.pathname.includes('/tools/city-cost-comparison/heat-pump')) {
      return <MonthlyBudgetPlanner initialMode="comparison" />;
    }
    if (location.pathname.includes('/analysis/city-comparison/gas-electric') || location.pathname.includes('/tools/city-cost-comparison/gas-electric')) {
      const outletContext = useOutletContext() || {};
      const { setUserSetting } = outletContext;
      
      // Force gas furnace for heating, electric for cooling
      React.useEffect(() => {
        if (setUserSetting) {
          setUserSetting("primarySystem", "gasFurnace");
        }
      }, [setUserSetting]);
      
      return <MonthlyBudgetPlanner initialMode="comparison" />;
    }
    // Default to landing page
    return <CityComparisonLanding />;
  };
  
  // Annual Forecast wrapper component
  const AnnualForecast = () => <MonthlyBudgetPlanner initialMode="annual" />;

  const tabs = [
    { id: 'forecast', label: 'Weekly Forecast', icon: Calendar, component: SevenDayCostForecaster },
    { id: 'budget', label: 'Monthly Forecast', icon: TrendingUp, component: MonthlyBudgetPlanner },
    { id: 'annual', label: 'Annual Forecast', icon: TrendingUp, component: AnnualForecast },
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
  };

  return (
    <div className="min-h-screen bg-[#0C0F14]">
      <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Render City Comparison if on that route */}
        {isCityComparisonRoute ? (
          <Suspense fallback={
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                <p className="text-sm text-[#A7B0BA]">Loading...</p>
              </div>
            </div>
          }>
            <CityComparison />
          </Suspense>
        ) : (
          <>
            {/* Page Header - Always visible */}
            <header className="mb-2">
              <div className="flex items-center justify-between mb-0.5">
                <h1 className="text-lg font-semibold text-white">Forecaster</h1>
                <Link
                  to="/analysis/annual"
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                >
                  <TrendingUp className="w-3 h-3" />
                  Annual Forecast
                </Link>
              </div>
              <p className="text-xs text-[#A7B0BA] italic">
                Forecast costs, compare systems, and explore what your thermostat data reveals — all in one place.
              </p>
            </header>

            {/* Tab Navigation - Always visible */}
            <div className="mb-2">
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
                <p className="mt-1.5 text-xs text-[#A7B0BA]">
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
          </>
        )}

        {/* AI Explanation for City Comparison */}
        {(location.pathname.includes('/city-comparison') || location.pathname.includes('/city-cost-comparison')) && (
          <AIExplanation
            prompt={`Explain how location affects heating and cooling costs when comparing cities.

Key factors to discuss:
- Climate differences measured by HDD (Heating Degree Days) and CDD (Cooling Degree Days)
- How regional utility rates vary (electricity $/kWh and natural gas $/therm)
- Impact of equipment efficiency (SEER2, HSPF2, AFUE) on costs in different climates
- Why a heat pump might be cost-effective in one climate but not another
- How weather patterns and temperature extremes affect annual operating costs

The user is comparing cities to understand where their HVAC system would be most cost-effective. Help them understand the climate and economic factors that drive these cost differences.`}
          />
        )}
      </div>
    </div>
  );
};

export default Analysis;

