import React, { lazy, Suspense } from 'react';

// Lazy load recharts components
const RechartsComponents = lazy(() => 
  import('recharts').then(module => ({
    default: {
      LineChart: module.LineChart,
      Line: module.Line,
      BarChart: module.BarChart,
      Bar: module.Bar,
      XAxis: module.XAxis,
      YAxis: module.YAxis,
      CartesianGrid: module.CartesianGrid,
      Tooltip: module.Tooltip,
      Legend: module.Legend,
      ResponsiveContainer: module.ResponsiveContainer,
      ReferenceLine: module.ReferenceLine,
    }
  }))
);

// Chart loading fallback
const ChartLoadingFallback = () => (
  <div className="flex items-center justify-center h-64 bg-gray-50 dark:bg-gray-900 rounded-lg">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-blue-600 dark:border-blue-400 mb-2"></div>
      <p className="text-sm text-gray-500 dark:text-gray-400">Loading chart...</p>
    </div>
  </div>
);

/**
 * Lazy Chart Wrapper
 * Wraps chart components with lazy loading and suspense
 */
export default function LazyChart({ children, ...props }) {
  return (
    <Suspense fallback={<ChartLoadingFallback />}>
      <RechartsComponents>
        {({ default: Recharts }) => (
          <div {...props}>
            {React.Children.map(children, child => {
              if (React.isValidElement(child)) {
                return React.cloneElement(child, { Recharts });
              }
              return child;
            })}
          </div>
        )}
      </RechartsComponents>
    </Suspense>
  );
}

// Export individual chart components for easier use
export const LazyLineChart = lazy(() => import('recharts').then(m => ({ default: m.LineChart })));
export const LazyBarChart = lazy(() => import('recharts').then(m => ({ default: m.BarChart })));
export const LazyResponsiveContainer = lazy(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })));






