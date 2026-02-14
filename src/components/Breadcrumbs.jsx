import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { routes } from '../navConfig';

/**
 * Breadcrumb Navigation Component
 * Automatically generates breadcrumbs based on current route
 */
export default function Breadcrumbs() {
  const location = useLocation();
  const pathSegments = location.pathname.split('/').filter(Boolean);

  // Build breadcrumb items
  const breadcrumbs = [
    { path: '/home', label: 'Home', icon: Home },
  ];

  // Check if we're on a city-comparison sub-route
  const isCityComparisonSubRoute = location.pathname.includes('/city-comparison/') && 
                                   location.pathname !== '/analysis/city-comparison';
  
  // Build path incrementally
  let currentPath = '';
  pathSegments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    
    // If we're on a city-comparison sub-route, only show the parent "City Comparison" breadcrumb
    if (isCityComparisonSubRoute && currentPath === '/analysis/city-comparison') {
      const route = routes.find(r => r.path === currentPath);
      if (route && route.label && route.label !== 'Home') {
        breadcrumbs.push({
          path: '/analysis/city-comparison',
          label: route.label,
          icon: route.icon,
        });
      }
      // Stop processing further segments for sub-routes
      return;
    }
    
    // Skip sub-route segments (heat-pump, gas-electric) when on city-comparison sub-route
    if (isCityComparisonSubRoute && (segment === 'heat-pump' || segment === 'gas-electric')) {
      return;
    }
    
    // Find route for this path
    const route = routes.find(r => r.path === currentPath);
    // Skip Energy Flow and Analyzer breadcrumbs (not related to budget)
    const skipRoutePaths = ['/analysis/energy-flow', '/analysis/analyzer'];
    const skipRouteNames = ['Performance', 'Analyze System'];
    if (route && route.label && route.label !== 'Home' && !skipRoutePaths.includes(currentPath) && !skipRouteNames.includes(route.name)) {
      breadcrumbs.push({
        path: currentPath,
        label: route.label,
        icon: route.icon,
      });
    } else if (!route && index > 0 && !isCityComparisonSubRoute && segment !== 'energy-flow' && segment !== 'analyzer') {
      // If no route found, use the segment as label (capitalized)
      // But skip this for city-comparison sub-routes
      breadcrumbs.push({
        path: currentPath,
        label: segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' '),
        icon: null,
      });
    }
  });

  // Don't show breadcrumbs on home page or if only one item
  if (breadcrumbs.length <= 1 || location.pathname === '/home' || location.pathname === '/') {
    return null;
  }
  // Hide breadcrumbs on Forecast/Compare Bill — top nav is enough (no duplicate nav layer)
  if (location.pathname.startsWith('/analysis/')) {
    return null;
  }

  return (
    <nav
      className="flex mb-3 md:mb-4 items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-600 dark:text-gray-400 overflow-x-auto pb-1 md:pb-0"
      aria-label="Breadcrumb"
      style={{ WebkitOverflowScrolling: 'touch' }}
    >
      <ol className="flex items-center gap-1.5 md:gap-2 min-w-0 flex-shrink-0">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = crumb.icon;

          return (
            <li key={crumb.path} className="flex items-center gap-1.5 md:gap-2 flex-shrink-0">
              {index > 0 && (
                <ChevronRight size={14} className="text-gray-400 dark:text-gray-500 flex-shrink-0 md:w-4 md:h-4" aria-hidden />
              )}
              {isLast ? (
                <span className="flex items-center gap-1 md:gap-1.5 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                  {Icon && <Icon size={14} className="flex-shrink-0 md:w-4 md:h-4" />}
                  <span className="truncate max-w-[12rem] md:max-w-none">{crumb.label}</span>
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="flex items-center gap-1 md:gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors py-1 -my-1 px-0.5 -mx-0.5 rounded min-h-[2rem] md:min-h-0 justify-center whitespace-nowrap touch-manipulation"
                  style={{ minHeight: '44px' }}
                >
                  {Icon && <Icon size={14} className="flex-shrink-0 md:w-4 md:h-4" />}
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}






