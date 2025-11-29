// Hook for proactive agent features
// Runs background monitoring and provides daily briefings

import React, { useState, useEffect, useCallback } from 'react';
import { checkProactiveAlerts, generateDailyBriefing } from '../lib/groqAgent.js';

/**
 * Hook that provides proactive agent features:
 * - Periodic system health checks
 * - Daily briefings
 * - Alert notifications
 */
export function useProactiveAgent(thermostatData = null, userSettings = null) {
  const [alerts, setAlerts] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const [lastCheck, setLastCheck] = useState(null);
  const [isChecking, setIsChecking] = useState(false);

  // Check for alerts - use refs to avoid dependency issues
  const thermostatDataRef = React.useRef(thermostatData);
  const userSettingsRef = React.useRef(userSettings);
  
  // Update refs when props change
  React.useEffect(() => {
    thermostatDataRef.current = thermostatData;
    userSettingsRef.current = userSettings;
  }, [thermostatData, userSettings]);

  const checkAlerts = useCallback(async () => {
    setIsChecking(true);
    try {
      const result = await checkProactiveAlerts(thermostatDataRef.current, userSettingsRef.current);
      if (result.hasAlerts) {
        setAlerts(result.alerts);
      } else {
        setAlerts([]);
      }
      setLastCheck(new Date().toISOString());
    } catch (error) {
      console.error('Failed to check proactive alerts:', error);
    } finally {
      setIsChecking(false);
    }
  }, []); // Empty deps - use refs instead

  // Generate daily briefing
  const getBriefing = useCallback(async () => {
    try {
      const result = await generateDailyBriefing();
      if (result.success) {
        setBriefing(result.briefing);
        return result.message;
      }
    } catch (error) {
      console.error('Failed to generate briefing:', error);
    }
    return null;
  }, []);

  // Check if it's morning (7-9 AM) and we haven't shown briefing today
  const shouldShowBriefing = useCallback(() => {
    const now = new Date();
    const hour = now.getHours();
    const lastBriefingDate = localStorage.getItem('lastBriefingDate');
    const today = now.toISOString().split('T')[0];
    
    return hour >= 7 && hour < 9 && lastBriefingDate !== today;
  }, []);

  // Auto-check alerts every hour
  useEffect(() => {
    // Only check if we have data and haven't checked recently
    if (!thermostatData && !userSettings) {
      return; // Skip if no data available
    }
    
    // Initial check
    checkAlerts();
    
    // Then check every hour
    const interval = setInterval(() => {
      checkAlerts();
    }, 60 * 60 * 1000); // 1 hour

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount, not when checkAlerts changes

  // Auto-show briefing in the morning
  useEffect(() => {
    if (shouldShowBriefing()) {
      getBriefing().then(message => {
        if (message) {
          // Store that we showed briefing today
          localStorage.setItem('lastBriefingDate', new Date().toISOString().split('T')[0]);
          // Could trigger a notification here
          console.log('Daily briefing:', message);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only check once on mount

  return {
    alerts,
    briefing,
    lastCheck,
    isChecking,
    checkAlerts,
    getBriefing,
    hasAlerts: alerts.length > 0,
  };
}

