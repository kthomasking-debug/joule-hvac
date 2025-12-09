/**
 * React hook for handling Vercel errors in API calls
 */
import { useState, useCallback } from 'react';
import { handleVercelError, isVercelError } from '../utils/vercelErrorHandler';

export function useVercelErrorHandler() {
  const [vercelError, setVercelError] = useState(null);

  const handleError = useCallback((error) => {
    if (isVercelError(error)) {
      const errorInfo = handleVercelError(error);
      setVercelError(errorInfo);
      return errorInfo;
    }
    setVercelError(null);
    return null;
  }, []);

  const clearError = useCallback(() => {
    setVercelError(null);
  }, []);

  return {
    vercelError,
    handleError,
    clearError,
    hasVercelError: vercelError !== null
  };
}






