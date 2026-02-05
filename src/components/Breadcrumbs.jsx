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

  return (
    <nav 
      className="hidden md:flex mb-4 items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2">
        {breadcrumbs.map((crumb, index) => {
          const isLast = index === breadcrumbs.length - 1;
          const Icon = crumb.icon;

          return (
            <li key={crumb.path} className="flex items-center gap-2">
              {index > 0 && (
                <ChevronRight size={16} className="text-gray-400 dark:text-gray-500" />
              )}
              {isLast ? (
                <span className="flex items-center gap-1.5 font-medium text-gray-900 dark:text-gray-100">
                  {Icon && <Icon size={16} />}
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.path}
                  className="flex items-center gap-1.5 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                >
                  {Icon && <Icon size={16} />}
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






