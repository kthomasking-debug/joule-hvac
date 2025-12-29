import React, { useState, useEffect } from "react";
import Joyride from "react-joyride";
import { useLocation } from "react-router-dom";

/**
 * FeatureTour Component
 * 
 * Provides a guided tour of the Dashboard using react-joyride.
 * - Only runs once (stored in localStorage)
 * - Uses Beacon style (pulsing dot) to start
 * - Targets key Dashboard features
 */
const FeatureTour = () => {
  const location = useLocation();
  const [run, setRun] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Check if tour should run - only after onboarding is completed
  useEffect(() => {
    try {
      const tourCompleted = localStorage.getItem("dashboardTourCompleted");
      const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";
      const isHomePage = location.pathname === "/" || location.pathname === "/home";
      
      // Only run tour if:
      // 1. Tour hasn't been completed
      // 2. Onboarding has been completed
      // 3. We're on the home page
      if (!tourCompleted && hasCompletedOnboarding && isHomePage) {
        let retryCount = 0;
        const maxRetries = 10; // Maximum 5 seconds of retries (10 * 500ms)
        
        // Wait for target elements to be mounted before starting tour
        const checkTargetsAndStart = () => {
          const targets = [
            "#active-intelligence-feed-tour-target",
            "#system-status-tour-target",
            "#ask-joule-tour-target"
          ];
          
          const allTargetsExist = targets.every(selector => {
            const element = document.querySelector(selector);
            return element !== null;
          });
          
          if (allTargetsExist) {
            setRun(true);
          } else if (retryCount < maxRetries) {
            // Retry after a short delay if targets aren't ready
            retryCount++;
            setTimeout(checkTargetsAndStart, 500);
          } else {
            // Silently skip tour if targets don't exist - this is expected on some pages
            // Only log in DEV mode with a debug-level message
            if (import.meta.env.DEV && import.meta.env.VITE_DEBUG_FEATURE_TOUR === 'true') {
              console.debug("FeatureTour: Target elements not found after retries, skipping tour");
            }
          }
        };
        
        // Initial delay to let page render, then check for targets
        const timer = setTimeout(checkTargetsAndStart, 2000);
        return () => clearTimeout(timer);
      }
    } catch (error) {
      console.warn("Failed to check tour completion status", error);
    }
  }, [location.pathname]);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      if (typeof window !== "undefined") {
        setIsDarkMode(document.documentElement.classList.contains("dark"));
      }
    };

    checkDarkMode();

    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Tour steps - targeting Dashboard elements
  const steps = [
    {
      target: "#active-intelligence-feed-tour-target",
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">Active Intelligence Feed</h3>
          <p>
            This feed shows real-time logic and system events. It displays when Joule detects
            short cycling, optimizations, and other intelligent decisions happening in the background.
          </p>
        </div>
      ),
      placement: "bottom",
      disableBeacon: false,
    },
    {
      target: "#system-status-tour-target",
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">System Status</h3>
          <p>
            This card shows your current system status and temperature. Joule monitors for short cycle
            detection - when your system turns on and off too frequently, which wastes energy and
            reduces equipment lifespan.
          </p>
        </div>
      ),
      placement: "bottom",
    },
    {
      target: "#ask-joule-tour-target",
      content: (
        <div>
          <h3 className="font-bold text-lg mb-2">Ask Joule</h3>
          <p>
            Ask Joule is your AI HVAC engineer. Ask questions like "What if I had a 10 HSPF system?"
            or give commands like "Set winter to 68". It understands natural language and can help
            optimize your system settings.
          </p>
        </div>
      ),
      placement: "bottom",
    },
  ];

  // Dynamic styles based on theme
  const joyrideStyles = {
    options: {
      primaryColor: "#3b82f6",
      zIndex: 10000,
      arrowColor: isDarkMode ? "#1f2937" : "#ffffff",
    },
    tooltip: {
      backgroundColor: isDarkMode ? "#1f2937" : "#ffffff",
      color: isDarkMode ? "#f9fafb" : "#111827",
      borderRadius: "12px",
      fontSize: "15px",
      padding: "20px",
      maxWidth: "400px",
      lineHeight: "1.5",
      boxShadow: "0 10px 40px rgba(0, 0, 0, 0.3)",
    },
    tooltipTitle: {
      color: isDarkMode ? "#ffffff" : "#000000",
      fontSize: "18px",
      fontWeight: "bold",
      marginBottom: "8px",
    },
    tooltipContent: {
      color: isDarkMode ? "#e5e7eb" : "#374151",
      fontSize: "15px",
      lineHeight: "1.6",
      padding: "4px 0",
    },
    tooltipFooter: {
      marginTop: "16px",
      paddingTop: "16px",
      borderTop: `1px solid ${isDarkMode ? "#374151" : "#e5e7eb"}`,
    },
    buttonNext: {
      backgroundColor: "#3b82f6",
      color: "#ffffff",
      borderRadius: "8px",
      padding: "10px 20px",
      fontSize: "14px",
      fontWeight: "600",
      border: "none",
      cursor: "pointer",
    },
    buttonBack: {
      color: "#3b82f6",
      marginRight: "10px",
      fontSize: "14px",
      fontWeight: "600",
      padding: "10px 16px",
      backgroundColor: "transparent",
      border: "none",
      cursor: "pointer",
    },
    buttonSkip: {
      color: isDarkMode ? "#9ca3af" : "#6b7280",
      fontSize: "14px",
      padding: "10px 16px",
      backgroundColor: "transparent",
      border: "none",
      cursor: "pointer",
    },
    overlay: {
      backgroundColor: "rgba(0, 0, 0, 0.8)",
    },
    spotlight: {
      border: "3px solid #60a5fa",
      borderRadius: "16px",
      boxShadow:
        "0 0 0 9999px rgba(0, 0, 0, 0.8), 0 0 40px rgba(96, 165, 250, 0.7)",
    },
    beacon: {
      inner: {
        backgroundColor: "#3b82f6",
      },
      outer: {
        backgroundColor: "#3b82f6",
        opacity: 0.3,
      },
    },
  };

  const handleTourCallback = (data) => {
    const { status, action, type } = data;

    // Suppress "Target not mounted" errors - these are expected during initial render
    if (type === "step:not_found" || type === "target_not_found") {
      // Silently handle missing targets - we check for them before starting
      return;
    }

    // Mark tour as completed when finished or skipped
    if (status === "finished" || status === "skipped") {
      try {
        localStorage.setItem("dashboardTourCompleted", "true");
      } catch (error) {
        console.warn("Failed to save tour completion", error);
      }
      setRun(false);
    }

    // Log tour progress for debugging (but not target errors)
    if (import.meta.env.DEV && type !== "step:not_found" && type !== "target_not_found") {
      console.log("Tour event:", { status, action, step: data.index, type });
    }
  };

  // Only show tour on home/dashboard page (not on home-health or other pages)
  if (location.pathname !== "/" && location.pathname !== "/home") {
    return null;
  }
  
  // Don't attempt tour on home-health or other simplified pages that don't have tour targets
  if (location.pathname === "/home-health") {
    return null;
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      scrollToFirstStep={true}
      disableOverlayClose={false}
      spotlightClicks={false}
      spotlightPadding={8}
      scrollOffset={100}
      scrollDuration={400}
      disableScrolling={false}
      floaterProps={{
        disableAnimation: false,
        disableFlip: false,
        disableShift: false,
        styles: {
          floater: {
            filter: "drop-shadow(0 10px 30px rgba(0, 0, 0, 0.3))",
          },
          arrow: {
            length: 12,
            spread: 16,
          },
        },
      }}
      disableScrollParentFix={true}
      styles={joyrideStyles}
      locale={{
        back: "Back",
        close: "Close",
        last: "Finish",
        next: "Next",
        skip: "Skip Tour",
      }}
      callback={handleTourCallback}
    />
  );
};

export default FeatureTour;

