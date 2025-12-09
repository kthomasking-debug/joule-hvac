import React, { useState, useMemo } from 'react';
import { Search, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * FAQ Page with Search Functionality
 */
export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedItems, setExpandedItems] = useState(new Set());

  const faqItems = [
    {
      category: 'Getting Started',
      questions: [
        {
          q: 'How do I upload my thermostat data?',
          a: 'Go to the System Performance Analyzer page and click "Upload Data File". Select your CSV file exported from your thermostat (e.g., ecobee). The file should contain temperature, runtime, and setpoint data.',
        },
        {
          q: 'What format should my CSV file be in?',
          a: 'Your CSV file should have a header row with columns like "Date", "Time", "Current Temp", "Heat Set Temp", "Outdoor Temp", "Heat Stage 1", etc. Download a sample CSV file from the analyzer page for reference.',
        },
        {
          q: 'How do I calculate my heat loss factor?',
          a: 'Upload your thermostat CSV data to the System Performance Analyzer. The app uses the "coast-down method" to calculate your building\'s heat loss factor by analyzing temperature decay when the heating system is off.',
        },
      ],
    },
    {
      category: 'Understanding Results',
      questions: [
        {
          q: 'What is a heat loss factor?',
          a: 'Heat loss factor (BTU/hr/°F) measures how much heat your building loses per hour per degree Fahrenheit of temperature difference between inside and outside. Lower values indicate better insulation and air sealing.',
        },
        {
          q: 'What is a balance point?',
          a: 'The balance point is the outdoor temperature where your heat pump\'s output equals your building\'s heat loss. Below this temperature, you\'ll need auxiliary heat to maintain indoor comfort.',
        },
        {
          q: 'What is a good heat loss factor?',
          a: 'For a typical home, a heat loss factor of 0.10-0.15 BTU/hr/°F per square foot is excellent (modern, well-insulated). 0.25-0.35 is good (well-insulated, 2010+). Above 0.45 indicates older or poorly insulated homes.',
        },
        {
          q: 'Why is my measured heat loss lower than expected?',
          a: 'Exceptionally low measured heat loss may indicate significant solar gain (sunlight heating your home) or internal loads (electronics, occupants, appliances) assisting your heating system. This can make your actual heat loss appear lower than the building envelope alone would suggest.',
        },
      ],
    },
    {
      category: 'Technical Terms',
      questions: [
        {
          q: 'What is HSPF?',
          a: 'HSPF (Heating Seasonal Performance Factor) measures heat pump heating efficiency. Higher is better. Typical range: 8-13. It represents the total heating output divided by the total electrical energy consumed during the heating season.',
        },
        {
          q: 'What is SEER?',
          a: 'SEER (Seasonal Energy Efficiency Ratio) measures air conditioning efficiency. Higher is better. Typical range: 13-25. It represents the total cooling output divided by the total electrical energy consumed during the cooling season.',
        },
        {
          q: 'What is COP?',
          a: 'COP (Coefficient of Performance) is the ratio of heat output to energy input. Higher is better. Typical range: 2.5-5.0. A COP of 3 means you get 3 units of heat for every 1 unit of electricity consumed.',
        },
        {
          q: 'What is BTU?',
          a: 'BTU (British Thermal Unit) is a unit of energy. 1 BTU = the amount of energy needed to heat 1 pound of water by 1°F. BTU/hr measures the rate of heat transfer.',
        },
      ],
    },
    {
      category: 'Troubleshooting',
      questions: [
        {
          q: 'My CSV file won\'t upload. What\'s wrong?',
          a: 'Check that your file is a .csv format, is under 10MB, and has a valid header row. The app looks for columns like "Date", "Time", "Current Temp", "Heat Stage 1", etc. Try downloading the sample CSV file to see the expected format.',
        },
        {
          q: 'The analysis shows an error. What should I do?',
          a: 'First, try clicking "Retry Analysis". If that doesn\'t work, check that your CSV file contains valid temperature and runtime data. The analysis needs at least a few hours of data with temperature changes to calculate heat loss.',
        },
        {
          q: 'My heat loss factor seems too high or too low. Is this normal?',
          a: 'Heat loss factors can vary significantly based on home size, insulation, air sealing, and local climate. Compare your per-square-foot factor to benchmarks. If it\'s exceptionally low, you may have solar gain or internal loads. If it\'s very high, consider an energy audit.',
        },
        {
          q: 'Can I compare multiple analyses?',
          a: 'Yes! In the Analysis History section, click "Compare" and select two analyses to view them side-by-side. This helps you track changes over time, such as after insulation upgrades.',
        },
      ],
    },
    {
      category: 'Features',
      questions: [
        {
          q: 'How do I save my analysis results?',
          a: 'Analysis results are automatically saved to your browser\'s local storage. You can export them as JSON or CSV files using the "Export" buttons. Results are stored per zone if you have multiple zones configured.',
        },
        {
          q: 'Can I share my analysis results?',
          a: 'Yes! Click the "Share" button on any analysis result to share via email, Twitter, Facebook, or copy the link. You can also export the data as JSON or CSV files.',
        },
        {
          q: 'How do I print my analysis report?',
          a: 'Press Ctrl+P (or Cmd+P on Mac) to print. The app automatically formats the page for printing, hiding navigation and buttons while showing all analysis data and charts.',
        },
        {
          q: 'What is the "Recently Viewed" section?',
          a: 'The Recently Viewed section on the home page shows your 5 most recently visited pages, making it easy to quickly return to pages you\'ve been working with.',
        },
      ],
    },
  ];

  // Filter FAQ items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return faqItems;

    const query = searchQuery.toLowerCase();
    return faqItems.map(category => ({
      ...category,
      questions: category.questions.filter(
        item => 
          item.q.toLowerCase().includes(query) ||
          item.a.toLowerCase().includes(query) ||
          category.category.toLowerCase().includes(query)
      ),
    })).filter(category => category.questions.length > 0);
  }, [searchQuery]);

  const toggleItem = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4 flex items-center gap-3">
          <HelpCircle size={40} className="text-blue-600 dark:text-blue-400" />
          Frequently Asked Questions
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400">
          Find answers to common questions about using the Joule engineering tools
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search FAQs..."
            className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
            aria-label="Search frequently asked questions"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
            Found {filteredItems.reduce((sum, cat) => sum + cat.questions.length, 0)} result(s)
          </p>
        )}
      </div>

      {/* FAQ Items */}
      <div className="space-y-6">
        {filteredItems.map((category, categoryIndex) => (
          <div key={categoryIndex} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              {category.category}
            </h2>
            <div className="space-y-3">
              {category.questions.map((item, questionIndex) => {
                const key = `${categoryIndex}-${questionIndex}`;
                const isExpanded = expandedItems.has(key);
                return (
                  <div
                    key={questionIndex}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden"
                  >
                    <button
                      onClick={() => toggleItem(categoryIndex, questionIndex)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                      aria-expanded={isExpanded}
                      aria-controls={`faq-answer-${key}`}
                    >
                      <span className="font-semibold text-gray-900 dark:text-gray-100 pr-4">
                        {item.q}
                      </span>
                      {isExpanded ? (
                        <ChevronUp size={20} className="text-gray-400 flex-shrink-0" />
                      ) : (
                        <ChevronDown size={20} className="text-gray-400 flex-shrink-0" />
                      )}
                    </button>
                    {isExpanded && (
                      <div
                        id={`faq-answer-${key}`}
                        className="px-4 pb-4 text-gray-700 dark:text-gray-300"
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* No Results */}
      {filteredItems.length === 0 && searchQuery && (
        <div className="text-center py-12">
          <HelpCircle size={48} className="mx-auto text-gray-400 mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
            No results found for "{searchQuery}"
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Try different keywords or <button onClick={() => setSearchQuery('')} className="text-blue-600 dark:text-blue-400 hover:underline">clear your search</button>
          </p>
        </div>
      )}

      {/* Help Links */}
      <div className="mt-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Still need help?
        </h3>
        <div className="space-y-2">
          <p className="text-gray-700 dark:text-gray-300">
            Check out these resources:
          </p>
          <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
            <li>
              <Link to="/analysis/analyzer" className="text-blue-600 dark:text-blue-400 hover:underline">
                System Performance Analyzer
              </Link>
              {' '}— Upload and analyze your thermostat data
            </li>
            <li>
              <Link to="/settings" className="text-blue-600 dark:text-blue-400 hover:underline">
                Settings
              </Link>
              {' '}— Configure your home and system settings
            </li>
            <li>
              <Link to="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </Link>
              {' '}— Learn about data handling and privacy
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}






