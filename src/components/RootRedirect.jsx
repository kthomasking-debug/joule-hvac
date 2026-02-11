import React from "react";
import { Navigate } from "react-router-dom";
import LandingPage from "../pages/LandingPage";

/**
 * Detect if the app is loaded from the Joule Bridge (local network).
 * Bridge users have bought the device and should never see the sales landing page.
 */
function isBridgeOrigin() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  if (host === "joule-bridge.local") return true;
  // Private IP ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
  if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
  if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\.\d+\.\d+$/.test(host)) return true;
  return false;
}

/**
 * At "/" (root): show LandingPage for web visitors, or redirect bridge users
 * to onboarding (if not complete) or /home (Mission Control).
 *
 * Session override: if onboarding is complete (per-origin localStorage),
 * always go to /home — covers remote access via tunnel/DuckDNS.
 *
 * ?bridge=1: treat as bridge origin (debug/support).
 */
export default function RootRedirect() {
  const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";
  const params = new URLSearchParams(window.location.search);
  const forceBridge = params.get("bridge") === "1";

  if (hasCompletedOnboarding) {
    return <Navigate to="/home" replace />;
  }

  if (isBridgeOrigin() || forceBridge) {
    return <Navigate to="/onboarding" replace />;
  }

  return <LandingPage />;
}
