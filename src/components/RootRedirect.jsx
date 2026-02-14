import React from "react";
import { Navigate } from "react-router-dom";

/**
 * At "/" (root): redirect to /home (if onboarding complete) or /onboarding.
 * Landing page moved to src/for-later/ for use as a separate website later.
 */
export default function RootRedirect() {
  const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";

  if (hasCompletedOnboarding) {
    return <Navigate to="/home" replace />;
  }

  return <Navigate to="/onboarding" replace />;
}
