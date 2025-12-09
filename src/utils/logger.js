/**
 * Production logging utility
 * 
 * Features:
 * - Logs to console in development
 * - Can send errors to error tracking service (Sentry) in production
 * - Filters sensitive data (API keys, tokens, etc.)
 * - Supports different log levels
 */

const isDevelopment = import.meta.env?.DEV || import.meta.env?.MODE === 'development';
const isProduction = !isDevelopment;

// Sensitive data patterns to filter
const SENSITIVE_PATTERNS = [
  /api[_-]?key/gi,
  /token/gi,
  /password/gi,
  /secret/gi,
  /auth/gi,
  /credential/gi,
];

/**
 * Filter sensitive data from log messages
 */
function filterSensitiveData(data) {
  if (typeof data === 'string') {
    let filtered = data;
    SENSITIVE_PATTERNS.forEach(pattern => {
      filtered = filtered.replace(pattern, '[REDACTED]');
    });
    return filtered;
  }
  
  if (typeof data === 'object' && data !== null) {
    const filtered = Array.isArray(data) ? [...data] : { ...data };
    for (const key in filtered) {
      if (SENSITIVE_PATTERNS.some(pattern => pattern.test(key))) {
        filtered[key] = '[REDACTED]';
      } else if (typeof filtered[key] === 'object' && filtered[key] !== null) {
        filtered[key] = filterSensitiveData(filtered[key]);
      }
    }
    return filtered;
  }
  
  return data;
}

/**
 * Get error context for better debugging
 */
function getErrorContext(error) {
  return {
    message: error?.message,
    stack: isDevelopment ? error?.stack : undefined,
    name: error?.name,
    timestamp: new Date().toISOString(),
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
    url: typeof window !== 'undefined' ? window.location.href : undefined,
  };
}

/**
 * Send error to error tracking service (Sentry, etc.)
 * This is a placeholder - integrate with actual service as needed
 */
function sendToErrorTracking(level, message, context) {
  if (!isProduction) return;
  
  // TODO: Integrate with Sentry or other error tracking service
  // Example:
  // if (window.Sentry) {
  //   if (level === 'error') {
  //     window.Sentry.captureException(new Error(message), { extra: context });
  //   } else {
  //     window.Sentry.captureMessage(message, { level, extra: context });
  //   }
  // }
}

const logger = {
  /**
   * Log debug information (development only)
   */
  debug(...args) {
    if (isDevelopment) {
      const filtered = args.map(filterSensitiveData);
      console.debug('[DEBUG]', ...filtered);
    }
  },

  /**
   * Log informational messages
   */
  info(...args) {
    const filtered = args.map(filterSensitiveData);
    if (isDevelopment) {
      console.info('[INFO]', ...filtered);
    }
    // In production, could send to analytics
  },

  /**
   * Log warnings
   */
  warn(...args) {
    const filtered = args.map(filterSensitiveData);
    console.warn('[WARN]', ...filtered);
    
    // Send warnings to error tracking in production
    if (isProduction && args.length > 0) {
      sendToErrorTracking('warning', String(args[0]), { args: filtered });
    }
  },

  /**
   * Log errors
   */
  error(...args) {
    const filtered = args.map(filterSensitiveData);
    console.error('[ERROR]', ...filtered);
    
    // Extract error object if present
    const error = args.find(arg => arg instanceof Error);
    const context = error ? getErrorContext(error) : { args: filtered };
    
    // Send errors to error tracking in production
    if (isProduction) {
      sendToErrorTracking('error', error?.message || String(args[0]), context);
    }
  },

  /**
   * Log group (for organizing related logs)
   */
  group(label) {
    if (isDevelopment) {
      console.group(label);
    }
  },

  /**
   * End log group
   */
  groupEnd() {
    if (isDevelopment) {
      console.groupEnd();
    }
  },

  /**
   * Log table (for structured data)
   */
  table(data) {
    if (isDevelopment) {
      const filtered = filterSensitiveData(data);
      console.table(filtered);
    }
  },
};

export default logger;






