import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App.jsx";
import "./styles/tailwind.css";
import "./styles/ui.css";
import "./styles/design-system.css";
import "./styles/print.css";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { routes } from "./navConfig.js";

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
      children: routes.map((route) => ({
        index: route.path === "/",
        path: route.path === "/" ? undefined : route.path.replace(/^\//, ""),
        element: (
          <Suspense fallback={<RouteLoadingFallback />}>
            <route.Component />
          </Suspense>
        ),
      })),
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
    <ErrorBoundary reloadOnError>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>
);
