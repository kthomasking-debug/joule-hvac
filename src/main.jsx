import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App.jsx";
import "./styles/tailwind.css";
import "./styles/ui.css";
import "./styles/design-system.css";
import "./styles/print.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { routes } from "./navConfig.jsx";

// Create React Query client with optimized settings for background fetching
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15 * 60 * 1000, // Data stays fresh for 15 minutes
      cacheTime: 30 * 60 * 1000, // Cache persists for 30 minutes
      refetchOnWindowFocus: false, // Don't refetch when window regains focus
      refetchOnReconnect: true, // Refetch when reconnecting
      retry: 2, // Retry failed requests twice
    },
  },
});

// Expose parser for E2E tests (production build)
// This allows tests to access parseAskJoule without dynamic imports
// Note: Only expose on localhost to avoid exposing internals in production deployments
if (typeof window !== "undefined" && 
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1")) {
  // Import and expose the parser - use dynamic import to avoid loading it in production
  // but it will be available in the bundle since useAskJoule imports it
  import("./utils/askJouleParser.js")
    .then((module) => {
      window.parseAskJoule = module.parseAskJoule || module.default;
    })
    .catch(() => {
      // Silently fail - parser might not be available in some build configurations
      // Tests will wait for it to be available via waitForFunction
    });
}

// Loading fallback component for lazy-loaded routes
const RouteLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen bg-white dark:bg-gray-900">
    <div className="text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Loading...</p>
    </div>
  </div>
);

// Suppress common browser extension errors that don't affect the application
window.addEventListener("error", (event) => {
  // Suppress Chrome extension message channel errors
  if (
    event.message &&
    event.message.includes("message channel closed") &&
    event.message.includes("asynchronous response")
  ) {
    event.preventDefault();
    if (import.meta.env.DEV) {
      console.debug("Suppressed browser extension error:", event.message);
    }
    return false;
  }
});

// Suppress unhandled promise rejections from browser extensions
window.addEventListener("unhandledrejection", (event) => {
  // Suppress Chrome extension message channel errors
  if (
    event.reason &&
    typeof event.reason === "object" &&
    event.reason.message &&
    event.reason.message.includes("message channel closed") &&
    event.reason.message.includes("asynchronous response")
  ) {
    event.preventDefault();
    if (import.meta.env.DEV) {
      console.debug("Suppressed browser extension promise rejection:", event.reason.message);
    }
    return false;
  }
});

// Define the routes for your application
// basename for GitHub Pages - update to match your repo name or remove for custom domain
const basename = import.meta.env.BASE_URL || "/";

const router = createBrowserRouter(
  [
    {
      path: "/",
      element: <App />,
      children: [
        {
          index: true,
          element: <Navigate to="/home" replace />,
        },
        // Redirect old tool paths to new /tools/ paths for backward compatibility
        {
          path: "energyplus",
          element: <Navigate to="/tools/energyplus" replace />,
        },
        {
          path: "wiring-diagram",
          element: <Navigate to="/tools/wiring-diagram" replace />,
        },
        {
          path: "equipment-settings",
          element: <Navigate to="/tools/equipment-settings" replace />,
        },
        {
          path: "hvac-troubleshooting",
          element: <Navigate to="/tools/hvac-troubleshooting" replace />,
        },
        ...routes
          .filter((route) => route.path !== "/") // Remove landing page route
          .map((route) => ({
            path: route.path.replace(/^\//, ""),
            element: (
              <Suspense fallback={<RouteLoadingFallback />}>
                <route.Component />
              </Suspense>
            ),
          })),
      ],
    },
  ],
  { basename }
);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary reloadOnError>
        <RouterProvider router={router} />
      </ErrorBoundary>
    </QueryClientProvider>
  </React.StrictMode>
);
