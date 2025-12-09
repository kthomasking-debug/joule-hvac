import React from 'react';
import logger from '../utils/logger';
import { handleVercelError, isVercelError } from '../utils/vercelErrorHandler';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log error with context
    logger.error('ErrorBoundary caught an error:', error, {
      componentStack: errorInfo?.componentStack,
      errorBoundary: this.props.name || 'Unknown',
    });
    
    this.setState({ errorInfo });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    // Optionally reload the page to reset app state
    if (this.props.reloadOnError) {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta && import.meta.env && import.meta.env.DEV;
      const { error, errorInfo } = this.state;
      const { name, fallback } = this.props;
      
      // Check if this is a Vercel error and get user-friendly message
      const vercelError = isVercelError(error) ? handleVercelError(error) : null;
      const errorMessage = vercelError?.userMessage || 
        (name 
          ? `Something went wrong in the ${name} section.`
          : 'Something went wrong while rendering this page.');
      
      // Use custom fallback if provided
      if (fallback) {
        return fallback(error, errorInfo, this.handleRetry);
      }
      
      return (
        <div className={`${name ? 'p-4' : 'min-h-screen flex items-center justify-center p-6'}`}>
          <div className={`max-w-lg w-full p-6 rounded-lg border bg-white dark:bg-gray-800 shadow-lg ${name ? '' : 'mx-auto'}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  {name ? `${name} Error` : 'Unexpected Application Error'}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {errorMessage}
                </p>
                {vercelError?.code && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 font-mono">
                    Error: {vercelError.code}
                  </p>
                )}
              </div>
            </div>
            
            {isDev && error && (
              <details className="mt-4">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 p-3 bg-gray-50 dark:bg-gray-900 rounded text-xs overflow-auto border border-gray-200 dark:border-gray-700">
                  {error.toString()}
                  {errorInfo?.componentStack && (
                    <>
                      {'\n\nComponent Stack:'}
                      {errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
            
            <div className="mt-4 flex gap-2">
              <button 
                onClick={this.handleRetry} 
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                aria-label="Try again"
              >
                Try Again
              </button>
              {!name && (
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  aria-label="Reload page"
                >
                  Reload Page
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
