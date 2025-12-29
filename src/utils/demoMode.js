/**
 * Demo Mode vs Live Mode State Management
 *
 * Default State (Demo Mode):
 * - Checks localStorage for 'ecobeeRefreshToken' or 'ecobeeAccessToken'
 * - If NULL: Loads demoData.json (fake optimized house data)
 * - Shows banner: "Viewing Demo Data. Connect your Ecobee to see real stats."
 *
 * Live Mode:
 * - User authenticates via Ecobee OAuth
 * - App saves refresh_token to localStorage
 * - Stops loading demoData.json, starts fetching from /api/ecobee
 */

/**
 * Check if we're in demo mode (no Ecobee connection)
 * Also checks for Joule Bridge connection
 */
export async function isDemoMode() {
  try {
    // Check for manual override to disable demo mode
    const demoModeDisabled = localStorage.getItem("demoModeDisabled");
    if (demoModeDisabled === "true") {
      return false; // User manually disabled demo mode
    }

    const refreshToken = localStorage.getItem("ecobeeRefreshToken");
    const accessToken = localStorage.getItem("ecobeeAccessToken");
    const apiKey = localStorage.getItem("ecobeeApiKey");

    // If we have a refresh token or valid access token + API key, we're in live mode
    if (refreshToken || (accessToken && apiKey)) {
      return false;
    }

    // Check for Joule Bridge connection
    try {
      const bridgeUrl = localStorage.getItem("jouleBridgeUrl") || import.meta.env.VITE_JOULE_BRIDGE_URL;
      if (!bridgeUrl) {
        // No bridge URL configured, skip check
        return true;
      }
      const response = await fetch(`${bridgeUrl}/api/paired`, {
        signal: AbortSignal.timeout(2000), // 2 second timeout
      });
      if (response.ok) {
        const data = await response.json();
        // If we have paired devices, we're not in demo mode
        if (data.devices && data.devices.length > 0) {
          return false;
        }
      }
    } catch (error) {
      // Bridge not available - that's fine, continue with demo mode check
    }

    return true;
  } catch (error) {
    console.warn("Error checking demo mode:", error);
    return true; // Default to demo mode on error
  }
}

/**
 * Set manual demo mode override
 */
export function setDemoModeDisabled(disabled) {
  if (disabled) {
    localStorage.setItem("demoModeDisabled", "true");
  } else {
    localStorage.removeItem("demoModeDisabled");
  }
  // Trigger a re-check by dispatching an event
  window.dispatchEvent(new Event("demo-mode-changed"));
}

/**
 * Check if demo mode is manually disabled
 */
export function isDemoModeManuallyDisabled() {
  return localStorage.getItem("demoModeDisabled") === "true";
}

/**
 * Load demo data from public/demoData.json
 */
export async function loadDemoData() {
  try {
    const response = await fetch("/demoData.json");
    if (!response.ok) {
      throw new Error(`Failed to load demo data: ${response.status}`);
    }
    const data = await response.json();
    return {
      ...data,
      source: "demo",
      isDemo: true,
    };
  } catch (error) {
    console.error("Error loading demo data:", error);
    // Return minimal demo data as fallback
    return {
      source: "demo",
      isDemo: true,
      thermostat: {
        identifier: "demo-thermostat-001",
        name: "Demo Home",
        temperature: 72.0,
        humidity: 45,
        targetHeatTemp: 70,
        targetCoolTemp: 74,
        mode: "auto",
        fanMode: "auto",
        isAway: false,
        equipmentStatus: "idle",
      },
      efficiency: {
        heatLossFactor: 850,
        efficiencyScore: 87,
        monthlySavings: 42.5,
        annualSavings: 510.0,
        optimizationStatus: "optimal",
      },
    };
  }
}

/**
 * Check if Joule Bridge is available on local network
 * Checks the configured bridge URL from localStorage
 */
export async function checkBridgePresence() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    // Check the configured bridge URL from localStorage
    const bridgeUrl = localStorage.getItem("jouleBridgeUrl") || import.meta.env.VITE_JOULE_BRIDGE_URL;
    if (!bridgeUrl) {
      // No bridge URL configured, skip check
      return false;
    }
    
    const response = await fetch(`${bridgeUrl}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    
    if (response.ok) {
      return true;
    }
    
    return false;
  } catch (error) {
    // Network error means bridge is not present or not reachable
    // This is expected when running locally - suppress console errors
    // Only log if it's not a name resolution or network error
    if (error.name !== 'AbortError' && 
        !error.message?.includes('ERR_NAME_NOT_RESOLVED') &&
        !error.message?.includes('Failed to fetch') &&
        !error.message?.includes('NetworkError')) {
      console.debug('Bridge presence check:', error.message);
    }
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Check if user has Pro access
 * - Bridge hardware presence (auto-unlock)
 * - Pro code validation
 */
export async function hasProAccess() {
  // First check for Bridge hardware
  const bridgePresent = await checkBridgePresence();
  if (bridgePresent) {
    return { hasAccess: true, source: "bridge" };
  }

  // Then check for Pro code
  try {
    const proCode = localStorage.getItem("proCode");
    if (proCode) {
      // Simple validation - for MVP, just check if it exists
      // In production, this would validate against a server
      const validCodes = [
        "PRO-7734",
        "PRO-2024",
        "PRO-DEMO",
        // Add more codes as needed
      ];

      if (validCodes.includes(proCode.toUpperCase())) {
        return { hasAccess: true, source: "code" };
      }
    }
  } catch (error) {
    console.warn("Error checking Pro access:", error);
  }

  return { hasAccess: false, source: null };
}

/**
 * Set Pro code
 */
export function setProCode(code) {
  try {
    localStorage.setItem("proCode", code.toUpperCase().trim());
    return true;
  } catch (error) {
    console.error("Error setting Pro code:", error);
    return false;
  }
}

/**
 * Clear Pro code
 */
export function clearProCode() {
  try {
    localStorage.removeItem("proCode");
    return true;
  } catch (error) {
    console.error("Error clearing Pro code:", error);
    return false;
  }
}
