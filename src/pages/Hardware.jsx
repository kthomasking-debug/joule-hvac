import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Server, 
  Zap,
  ChevronLeft,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import DocumentationSetupGuides from './DocumentationSetupGuides';
import { EBAY_STORE_URL } from '../utils/rag/salesFAQ';

// Simple Shop component that links directly to eBay
const Shop = () => {
  return (
    <div className="glass-card p-glass animate-fade-in-up">
      <div className="text-center py-12">
        <Zap className="w-16 h-16 text-violet-400 mx-auto mb-6" />
        <h2 className="text-3xl font-bold mb-4 text-high-contrast">Joule Products</h2>
        <p className="text-muted mb-8 max-w-2xl mx-auto">
          Purchase Joule Monitor, Bridge, and other products directly from our eBay store.
          All transactions are protected by eBay's Money Back Guarantee.
        </p>
        <a
          href={EBAY_STORE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white rounded-lg font-bold text-lg transition-all shadow-lg hover:shadow-xl"
        >
          Visit eBay Store
          <ExternalLink className="w-5 h-5" />
        </a>
      </div>
    </div>
  );
};

const Hardware = () => {
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('bridge');

  const tabs = [
    { id: 'bridge', label: 'Bridge', icon: Server, component: DocumentationSetupGuides },
    { id: 'shop', label: 'Shop', icon: Zap, component: Shop },
  ];

  const activeTabData = tabs.find(t => t.id === activeTab);
  const ActiveComponent = activeTabData?.component || DocumentationSetupGuides;

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
  };

  const handlePrevious = () => {
    navigate('/control');
  };

  const handleNext = () => {
    navigate('/config');
  };

  return (
    <div className="page-gradient-overlay min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
        {/* Tab Navigation */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                className="icon-container hover:opacity-80 transition-opacity"
                aria-label="Previous"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <h1 className="heading-primary">Docs</h1>
              <button
                onClick={handleNext}
                className="icon-container hover:opacity-80 transition-opacity"
                aria-label="Next"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="flex gap-2 overflow-x-auto pb-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg'
                      : 'btn-glass text-high-contrast'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
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

export default Hardware;

