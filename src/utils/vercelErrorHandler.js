/**
 * Vercel Error Handler
 * Provides user-friendly error messages for Vercel deployment errors
 */

const VERCEL_ERROR_MESSAGES = {
  // Application Errors
  BODY_NOT_A_STRING_FROM_FUNCTION: {
    message: "Function returned invalid response format",
    userMessage: "A server function returned an unexpected format. Please try again.",
    action: "retry"
  },
  DEPLOYMENT_BLOCKED: {
    message: "Deployment blocked",
    userMessage: "This deployment has been blocked. Please check your deployment settings.",
    action: "contact-support"
  },
  DEPLOYMENT_DELETED: {
    message: "Deployment deleted",
    userMessage: "This deployment has been deleted and is no longer available.",
    action: "redeploy"
  },
  DEPLOYMENT_DISABLED: {
    message: "Deployment disabled",
    userMessage: "This deployment has been disabled. Please check your billing or account status.",
    action: "check-billing"
  },
  DEPLOYMENT_NOT_FOUND: {
    message: "Deployment not found",
    userMessage: "The requested deployment could not be found.",
    action: "check-url"
  },
  DEPLOYMENT_NOT_READY_REDIRECTING: {
    message: "Deployment not ready, redirecting",
    userMessage: "Deployment is still building. Please wait a moment and try again.",
    action: "wait-retry"
  },
  DEPLOYMENT_PAUSED: {
    message: "Deployment paused",
    userMessage: "This deployment has been paused. Please resume it in your dashboard.",
    action: "resume-deployment"
  },
  FUNCTION_INVOCATION_FAILED: {
    message: "Function invocation failed",
    userMessage: "A server function encountered an error. Please try again.",
    action: "retry"
  },
  FUNCTION_INVOCATION_TIMEOUT: {
    message: "Function invocation timeout",
    userMessage: "The request took too long to process. Please try again with a simpler query.",
    action: "retry-simpler"
  },
  FUNCTION_PAYLOAD_TOO_LARGE: {
    message: "Function payload too large",
    userMessage: "The request is too large. Please reduce the amount of data being sent.",
    action: "reduce-payload"
  },
  FUNCTION_RESPONSE_PAYLOAD_TOO_LARGE: {
    message: "Function response too large",
    userMessage: "The response is too large to process. Please try a more specific query.",
    action: "refine-query"
  },
  FUNCTION_THROTTLED: {
    message: "Function throttled",
    userMessage: "Too many requests. Please wait a moment and try again.",
    action: "wait-retry"
  },
  NOT_FOUND: {
    message: "Not found",
    userMessage: "The requested resource could not be found.",
    action: "check-url"
  },
  RESOURCE_NOT_FOUND: {
    message: "Resource not found",
    userMessage: "The requested resource could not be found.",
    action: "check-url"
  },
  URL_TOO_LONG: {
    message: "URL too long",
    userMessage: "The request URL is too long. Please use a shorter query.",
    action: "shorten-query"
  },
  REQUEST_HEADER_TOO_LARGE: {
    message: "Request header too large",
    userMessage: "The request headers are too large. Please clear your browser cache and try again.",
    action: "clear-cache"
  },
  
  // Platform Errors (Internal)
  INTERNAL_FUNCTION_INVOCATION_FAILED: {
    message: "Internal function error",
    userMessage: "An internal server error occurred. Please try again in a moment.",
    action: "wait-retry"
  },
  INTERNAL_FUNCTION_INVOCATION_TIMEOUT: {
    message: "Internal function timeout",
    userMessage: "The server is taking longer than expected. Please try again.",
    action: "wait-retry"
  },
  INTERNAL_UNEXPECTED_ERROR: {
    message: "Internal unexpected error",
    userMessage: "An unexpected error occurred. Please try again or contact support if the issue persists.",
    action: "retry-or-support"
  }
};

/**
 * Get user-friendly error message for Vercel error code
 */
export function getVercelErrorMessage(errorCode, statusCode = null) {
  const error = VERCEL_ERROR_MESSAGES[errorCode];
  
  if (error) {
    return {
      ...error,
      code: errorCode,
      statusCode: statusCode
    };
  }
  
  // Fallback for unknown error codes
  return {
    message: errorCode || "Unknown error",
    userMessage: statusCode === 502 
      ? "The server is temporarily unavailable. Please try again in a moment."
      : statusCode === 500
      ? "An internal server error occurred. Please try again."
      : statusCode === 404
      ? "The requested resource could not be found."
      : "An error occurred. Please try again.",
    action: "retry",
    code: errorCode,
    statusCode: statusCode
  };
}

/**
 * Check if error is a Vercel error
 */
export function isVercelError(error) {
  if (!error) return false;
  
  // Check for Vercel error code in error message or code
  const errorString = JSON.stringify(error).toUpperCase();
  return Object.keys(VERCEL_ERROR_MESSAGES).some(code => 
    errorString.includes(code) || 
    error.code === code ||
    error.message?.includes(code)
  );
}

/**
 * Extract Vercel error code from error object
 */
export function extractVercelErrorCode(error) {
  if (!error) return null;
  
  // Check error code directly
  if (error.code && VERCEL_ERROR_MESSAGES[error.code]) {
    return error.code;
  }
  
  // Check error message
  if (error.message) {
    for (const code of Object.keys(VERCEL_ERROR_MESSAGES)) {
      if (error.message.includes(code)) {
        return code;
      }
    }
  }
  
  // Check response headers (if available)
  if (error.response?.headers?.['x-vercel-error']) {
    return error.response.headers['x-vercel-error'];
  }
  
  return null;
}

/**
 * Handle Vercel error with user-friendly message
 */
export function handleVercelError(error, defaultMessage = "An error occurred") {
  const errorCode = extractVercelErrorCode(error);
  const statusCode = error.status || error.response?.status || error.statusCode;
  
  if (errorCode) {
    return getVercelErrorMessage(errorCode, statusCode);
  }
  
  // Fallback to status code-based message
  return getVercelErrorMessage(null, statusCode);
}






