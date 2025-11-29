import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch() {
    // Intentionally left blank; add logging/telemetry here if desired.
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
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="max-w-lg w-full p-6 rounded-lg border bg-white shadow">
            <h1 className="text-xl font-bold mb-2">Unexpected Application Error</h1>
            <p className="text-sm text-gray-700">Something went wrong while rendering this page.</p>
            {isDev && (
              <pre className="mt-3 p-3 bg-gray-50 rounded text-xs overflow-auto">{String(this.state.error)}</pre>
            )}
            <div className="mt-4 flex gap-2">
              <button onClick={this.handleRetry} className="px-3 py-2 bg-blue-600 text-white rounded">Try Again</button>
              <button onClick={() => window.location.reload()} className="px-3 py-2 bg-gray-100 rounded">Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
