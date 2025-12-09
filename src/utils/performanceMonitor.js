/**
 * Performance Monitoring Utility
 *
 * Tracks and reports performance metrics for the application
 * - Component render times
 * - API call durations
 * - User interaction latency
 * - Bundle load times
 */

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      componentRenders: new Map(),
      apiCalls: [],
      userInteractions: [],
      bundleLoads: [],
    };
    this.enabled =
      typeof window !== "undefined" &&
      (import.meta.env.DEV ||
        localStorage.getItem("perfMonitoring") === "true");
  }

  /**
   * Track component render time
   * @param {string} componentName - Name of the component
   * @param {number} renderTime - Time in milliseconds
   */
  trackComponentRender(componentName, renderTime) {
    if (!this.enabled) return;

    if (!this.metrics.componentRenders.has(componentName)) {
      this.metrics.componentRenders.set(componentName, []);
    }

    const renders = this.metrics.componentRenders.get(componentName);
    renders.push({
      time: renderTime,
      timestamp: Date.now(),
    });

    // Keep only last 100 renders per component
    if (renders.length > 100) {
      renders.shift();
    }
  }

  /**
   * Track API call duration
   * @param {string} endpoint - API endpoint name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether the call succeeded
   */
  trackApiCall(endpoint, duration, success = true) {
    if (!this.enabled) return;

    this.metrics.apiCalls.push({
      endpoint,
      duration,
      success,
      timestamp: Date.now(),
    });

    // Keep only last 100 API calls
    if (this.metrics.apiCalls.length > 100) {
      this.metrics.apiCalls.shift();
    }
  }

  /**
   * Track user interaction latency
   * @param {string} interactionType - Type of interaction (click, input, etc.)
   * @param {number} latency - Latency in milliseconds
   */
  trackUserInteraction(interactionType, latency) {
    if (!this.enabled) return;

    this.metrics.userInteractions.push({
      type: interactionType,
      latency,
      timestamp: Date.now(),
    });

    // Keep only last 100 interactions
    if (this.metrics.userInteractions.length > 100) {
      this.metrics.userInteractions.shift();
    }
  }

  /**
   * Get performance report
   * @returns {Object} Performance metrics summary
   */
  getReport() {
    const report = {
      componentRenders: {},
      apiCalls: {
        total: this.metrics.apiCalls.length,
        averageDuration: 0,
        successRate: 0,
      },
      userInteractions: {
        total: this.metrics.userInteractions.length,
        averageLatency: 0,
      },
    };

    // Calculate component render statistics
    this.metrics.componentRenders.forEach((renders, componentName) => {
      const times = renders.map((r) => r.time);
      report.componentRenders[componentName] = {
        count: times.length,
        average: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
      };
    });

    // Calculate API call statistics
    if (this.metrics.apiCalls.length > 0) {
      const durations = this.metrics.apiCalls.map((c) => c.duration);
      const successes = this.metrics.apiCalls.filter((c) => c.success).length;

      report.apiCalls.averageDuration =
        durations.reduce((a, b) => a + b, 0) / durations.length;
      report.apiCalls.successRate =
        (successes / this.metrics.apiCalls.length) * 100;
    }

    // Calculate user interaction statistics
    if (this.metrics.userInteractions.length > 0) {
      const latencies = this.metrics.userInteractions.map((i) => i.latency);
      report.userInteractions.averageLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
    }

    return report;
  }

  /**
   * Log performance report to console
   */
  logReport() {
    if (!this.enabled) return;

    const report = this.getReport();
    console.group("📊 Performance Report");
    console.log("Component Renders:", report.componentRenders);
    console.log("API Calls:", report.apiCalls);
    console.log("User Interactions:", report.userInteractions);
    console.groupEnd();
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics.componentRenders.clear();
    this.metrics.apiCalls = [];
    this.metrics.userInteractions = [];
    this.metrics.bundleLoads = [];
  }
}

// Create singleton instance
export const performanceMonitor = new PerformanceMonitor();

/**
 * React hook to track component render performance
 * @param {string} componentName - Name of the component
 * @requires React - Must be imported in the component using this hook
 */
export function usePerformanceTracking(componentName) {
  if (typeof window === "undefined") return;

  // Note: React must be imported in the component using this hook
  // This avoids adding React as a dependency to this utility
  const React =
    typeof window !== "undefined" && window.React
      ? window.React
      : (() => {
          try {
            return require("react");
          } catch {
            return null;
          }
        })();

  if (!React || !React.useEffect) return;

  React.useEffect(() => {
    const startTime = performance.now();

    return () => {
      const renderTime = performance.now() - startTime;
      performanceMonitor.trackComponentRender(componentName, renderTime);
    };
  });
}

/**
 * Higher-order component to track render performance
 * @param {React.Component} Component - Component to wrap
 * @param {string} componentName - Name for tracking
 * @requires React - Must be imported in the file using this HOC
 */
export function withPerformanceTracking(Component, componentName) {
  const React =
    typeof window !== "undefined" && window.React
      ? window.React
      : (() => {
          try {
            return require("react");
          } catch {
            return null;
          }
        })();

  if (!React) return Component;

  return function TrackedComponent(props) {
    usePerformanceTracking(componentName);
    return React.createElement(Component, props);
  };
}

// Auto-log report on page unload (dev mode only)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  window.addEventListener("beforeunload", () => {
    performanceMonitor.logReport();
  });

  // Also expose to window for manual inspection
  window.__performanceMonitor = performanceMonitor;
}
