import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import App from './App.jsx';
import './styles/tailwind.css';
import './styles/ui.css';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { routes } from './navConfig.js';

// Define the routes for your application
// basename for GitHub Pages - update to match your repo name or remove for custom domain
const basename = import.meta.env.BASE_URL || '/';

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: routes.map(route => ({
      index: route.path === '/',
      path: route.path === '/' ? undefined : route.path.replace(/^\//, ''),
      element: <route.Component />,
    })),
  },
], { basename });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary reloadOnError>
      <RouterProvider router={router} />
    </ErrorBoundary>
  </React.StrictMode>,
);