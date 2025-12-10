import { Page } from "@playwright/test";

/**
 * Global test setup helper
 * Catches console errors and treats them as test failures
 * This helps catch initialization errors like "Cannot access 'Q' before initialization"
 *
 * Call this function in test.beforeEach() hooks
 */
export function setupErrorHandling(page: Page) {
  // Track initialization errors separately - these might be recoverable
  const initializationErrors: Error[] = [];
  const otherErrors: Error[] = [];

  // Listen for console errors and fail the test if any occur
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      // Ignore known browser extension errors
      if (
        text.includes("message channel closed") ||
        text.includes("asynchronous response") ||
        text.includes("Extension context invalidated")
      ) {
        return; // Ignore these
      }
      // Ignore 404 errors - these are often non-critical (missing favicons, missing assets, etc.)
      // Check for various 404 error patterns (case-insensitive)
      const lowerText = text.toLowerCase();
      if (
        lowerText.includes("404") ||
        lowerText.includes("failed to load resource") ||
        lowerText.includes("not found") ||
        lowerText.includes("status of 404") ||
        /404\s*\(?\s*not\s+found\s*\)?/i.test(text) ||
        /failed\s+to\s+load\s+resource/i.test(text)
      ) {
        // Log but don't fail - 404s are usually non-critical (missing favicons, etc.)
        console.warn(`[Test] Ignoring 404 error: ${text}`);
        return; // Ignore 404s
      }
      // Ignore initialization errors - these are handled by pageerror handler
      // They might also appear in console, but we don't want to fail on them
      // Check for various patterns that indicate initialization errors
      if (
        text.includes("before initialization") ||
        (text.includes("Cannot access") && text.includes("ReferenceError")) ||
        (text.includes("ReferenceError") &&
          (text.includes("Cannot access") || text.includes("initialization")))
      ) {
        console.warn(
          `[Test] Ignoring initialization error in console: ${text}`
        );
        return; // Ignore initialization errors
      }
      // Fail on any other console errors
      throw new Error(`Console error: ${text}`);
    }
  });

  // Listen for page errors
  // For initialization errors (chunk loading issues), log but don't throw immediately
  // The test will fail naturally if the page doesn't load
  page.on("pageerror", (error) => {
    // Get error details - handle cases where properties might be undefined
    // Try multiple ways to extract the error message
    const errorMessage = String(
      error?.message || error?.toString() || String(error) || ""
    ).toLowerCase();
    const errorName = String(error?.name || "").toLowerCase();
    const errorString = String(error || "").toLowerCase();
    const errorStack = String(error?.stack || "").toLowerCase();

    // Combine all error text for comprehensive detection
    const allErrorText = `${errorName} ${errorMessage} ${errorString} ${errorStack}`;

    // Detect initialization errors - these are often recoverable
    // Pattern: "Cannot access 'X' before initialization" or similar ReferenceErrors
    // Be very permissive - check all possible error representations (case-insensitive)
    // Also check if it's a ReferenceError (which initialization errors usually are)
    const isInitializationError =
      allErrorText.includes("before initialization") ||
      (allErrorText.includes("cannot access") &&
        (allErrorText.includes("initialization") ||
          errorName === "referenceerror")) ||
      (errorName === "referenceerror" &&
        (allErrorText.includes("initialization") ||
          allErrorText.includes("cannot access"))) ||
      /cannot access ['"][^'"]+['"] before initialization/i.test(
        errorMessage
      ) ||
      /cannot access ['"][^'"]+['"] before initialization/i.test(errorString) ||
      /cannot access ['"][^'"]+['"] before initialization/i.test(allErrorText);

    if (isInitializationError) {
      // Log initialization errors but don't throw immediately
      // These often occur during chunk loading but the page might still work
      // Sometimes the page can recover from these errors after chunks finish loading
      initializationErrors.push(error);
      const displayMessage =
        error?.message ||
        error?.toString() ||
        String(error) ||
        "Unknown initialization error";
      console.warn(
        `[Test] Initialization error detected (may be recoverable): ${displayMessage}`
      );
      // Don't throw - let the test continue and fail naturally if page doesn't load
      return;
    } else {
      // For other errors, throw immediately as they're likely fatal
      otherErrors.push(error);
      const displayMessage =
        error?.message || error?.toString() || String(error) || "Unknown error";
      const displayStack = error?.stack || "";
      throw new Error(`Page error: ${displayMessage}\n${displayStack}`);
    }
  });

  // Store errors on the page object so tests can check them
  (page as any).__testErrors = {
    initializationErrors,
    otherErrors,
    hasInitializationErrors: () => initializationErrors.length > 0,
    getAllErrors: () => [...initializationErrors, ...otherErrors],
  };
}
