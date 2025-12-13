import { useState, useEffect } from "react";
import { isDemoMode, loadDemoData, hasProAccess } from "../utils/demoMode";

/**
 * Hook to manage demo mode state
 * Returns:
 * - isDemo: boolean - whether we're in demo mode
 * - demoData: object - demo data if in demo mode
 * - proAccess: object - { hasAccess, source } for Pro features
 * - loading: boolean - whether data is loading
 */
export function useDemoMode() {
  const [isDemo, setIsDemo] = useState(true);
  const [demoData, setDemoData] = useState(null);
  const [proAccess, setProAccess] = useState({
    hasAccess: false,
    source: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkMode() {
      setLoading(true);

      // Check if we're in demo mode (now async to check Bridge)
      const demo = await isDemoMode();
      setIsDemo(demo);

      // If demo mode, load demo data
      if (demo) {
        const data = await loadDemoData();
        setDemoData(data);
      } else {
        setDemoData(null);
      }

      // Check Pro access (for Bridge hardware or Pro code)
      const access = await hasProAccess();
      setProAccess(access);

      setLoading(false);
    }

    checkMode();

    // Re-check demo mode periodically (every 10 seconds) to catch Bridge connections
    const checkInterval = setInterval(() => {
      checkMode();
    }, 10000);

    // Re-check Pro access periodically (every 30 seconds) for Bridge presence
    const proAccessInterval = setInterval(() => {
      hasProAccess().then(setProAccess);
    }, 30000);

    return () => {
      clearInterval(checkInterval);
      clearInterval(proAccessInterval);
    };
  }, []);

  // Re-check demo mode when localStorage changes (e.g., after Ecobee connection)
  useEffect(() => {
    const handleStorageChange = async () => {
      const demo = await isDemoMode();
      setIsDemo(demo);
      if (demo) {
        const data = await loadDemoData();
        setDemoData(data);
      } else {
        setDemoData(null);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    // Also listen for custom events (for same-tab updates)
    window.addEventListener("ecobee-connection-changed", handleStorageChange);
    window.addEventListener("joule-bridge-connection-changed", handleStorageChange);
    window.addEventListener("demo-mode-changed", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "ecobee-connection-changed",
        handleStorageChange
      );
      window.removeEventListener(
        "joule-bridge-connection-changed",
        handleStorageChange
      );
      window.removeEventListener("demo-mode-changed", handleStorageChange);
    };
  }, []);

  return {
    isDemo,
    demoData,
    proAccess,
    loading,
  };
}
