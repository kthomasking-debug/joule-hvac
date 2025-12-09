import React, { useState, useMemo, useCallback } from 'react';
import { Search, X, FileText, BarChart3, Calculator, Settings, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { routes } from '../navConfig';

/**
 * Global Search Bar Component
 * Provides search functionality across all pages and content
 */
export default function SearchBar({ onClose }) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(true);
  const navigate = useNavigate();

  // Search through routes and content
  const searchResults = useMemo(() => {
    if (!query || query.length < 2) return [];

    const lowerQuery = query.toLowerCase();
    const results = [];

    // Search routes
    routes.forEach(route => {
      const searchableText = [
        route.name,
        route.label,
        route.description,
        route.path,
      ].filter(Boolean).join(' ').toLowerCase();

      if (searchableText.includes(lowerQuery)) {
        results.push({
          type: 'route',
          title: route.label || route.name,
          description: route.description,
          path: route.path,
          icon: route.icon || FileText,
        });
      }
    });

    // Search localStorage for analysis results
    try {
      const zones = JSON.parse(localStorage.getItem('zones') || '[]');
      zones.forEach(zone => {
        const zoneKey = `spa_resultsHistory_${zone.id}`;
        const history = JSON.parse(localStorage.getItem(zoneKey) || '[]');
        history.forEach((result, idx) => {
          const searchText = [
            zone.name,
            `Analysis ${idx + 1}`,
            result.heatLossFactor?.toString(),
            result.balancePoint?.toString(),
          ].filter(Boolean).join(' ').toLowerCase();

          if (searchText.includes(lowerQuery)) {
            results.push({
              type: 'analysis',
              title: `${zone.name} - Analysis ${idx + 1}`,
              description: `Heat Loss: ${result.heatLossFactor?.toFixed(1)} BTU/hr/°F`,
              path: `/analysis/analyzer?zone=${zone.id}`,
              icon: BarChart3,
            });
          }
        });
      });
    } catch (e) {
      // Ignore errors
    }

    return results.slice(0, 10); // Limit to 10 results
  }, [query]);

  const handleResultClick = useCallback((result) => {
    navigate(result.path);
    setIsOpen(false);
    if (onClose) onClose();
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      if (onClose) onClose();
    } else if (e.key === 'Enter' && searchResults.length > 0) {
      handleResultClick(searchResults[0]);
    }
  }, [searchResults, handleResultClick, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => {
          setIsOpen(false);
          if (onClose) onClose();
        }}
      />
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
        {/* Search Input */}
        <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
          <Search className="text-gray-400" size={20} />
            <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, analyses, settings..."
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none"
            autoFocus
            aria-label="Search input"
            aria-describedby="search-description"
          />
          <span id="search-description" className="sr-only">
            Search across pages, analysis results, and settings. Use arrow keys to navigate results, Enter to select, Escape to close.
          </span>
          <button
            onClick={() => {
              setIsOpen(false);
              if (onClose) onClose();
            }}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            aria-label="Close search"
          >
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Search Results */}
        {query.length >= 2 && (
          <div className="max-h-96 overflow-y-auto">
            {searchResults.length > 0 ? (
              <div className="p-2">
                {searchResults.map((result, idx) => {
                  const Icon = result.icon;
                  return (
                    <button
                      key={idx}
                      data-search-result={idx}
                      onClick={() => handleResultClick(result)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleResultClick(result);
                        } else if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          const next = document.querySelector(`[data-search-result="${idx + 1}"]`);
                          if (next) next.focus();
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          if (idx === 0) {
                            document.querySelector('input[type="text"]')?.focus();
                          } else {
                            const prev = document.querySelector(`[data-search-result="${idx - 1}"]`);
                            if (prev) prev.focus();
                          }
                        }
                      }}
                      className="w-full flex items-center gap-3 p-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors text-left focus:outline-none focus:ring-2 focus:ring-blue-500"
                      tabIndex={0}
                    >
                      <Icon size={20} className="text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {result.title}
                        </div>
                        {result.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate">
                            {result.description}
                          </div>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                        {result.type}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-2">Try searching for page names, analysis results, or settings</p>
              </div>
            )}
          </div>
        )}

        {/* Keyboard Shortcuts Hint */}
        {query.length < 2 && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
              <p className="font-semibold mb-2">Keyboard Shortcuts:</p>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Enter</kbd>
                <span>to select first result</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded">Esc</kbd>
                <span>to close</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

