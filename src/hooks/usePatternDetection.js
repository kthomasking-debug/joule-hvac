// src/hooks/usePatternDetection.js
// Watches learning events and triggers acknowledgment when patterns emerge

import { useState, useEffect } from "react";
import { getThermostatLearningEvents } from "./useThermostatLearning";

function detectPatterns(events) {
  const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentEvents = events.filter(
    (e) => new Date(e.ts).getTime() >= twoWeeksAgo
  );

  // Detect morning warmup pattern
  const morningWarmups = recentEvents.filter(
    (e) =>
      e.kind === "winter" && e.hour >= 5 && e.hour <= 8 && e.next > e.prev + 1
  );

  const byHour = new Map();
  for (const e of morningWarmups) {
    const key = e.hour;
    byHour.set(key, (byHour.get(key) || []).concat(e));
  }

  // Check for consistent pattern (3+ occurrences at same hour)
  for (const [hour, occurrences] of byHour.entries()) {
    if (occurrences.length >= 3) {
      const avgDelta =
        occurrences.reduce((sum, e) => sum + (e.next - e.prev), 0) /
        occurrences.length;

      return {
        type: "morning-warmup",
        hour,
        period: "AM",
        delta: Math.round(avgDelta),
        description: `You often turn up the heat around ${hour}:00 AM`,
        details: {
          action: `Increase temperature by ${Math.round(
            avgDelta
          )}°F at ${hour}:00 AM`,
          frequency: occurrences.length,
          period: "last 2 weeks",
        },
        automation: {
          hour,
          delta: Math.round(avgDelta),
        },
      };
    }
  }

  // Detect evening setback pattern
  const eveningSetbacks = recentEvents.filter(
    (e) =>
      e.kind === "winter" && e.hour >= 21 && e.hour <= 23 && e.next < e.prev - 1
  );

  const byEveningHour = new Map();
  for (const e of eveningSetbacks) {
    const key = e.hour;
    byEveningHour.set(key, (byEveningHour.get(key) || []).concat(e));
  }

  for (const [hour, occurrences] of byEveningHour.entries()) {
    if (occurrences.length >= 3) {
      const avgDelta =
        occurrences.reduce((sum, e) => sum + (e.prev - e.next), 0) /
        occurrences.length;

      return {
        type: "evening-setback",
        hour,
        period: "PM",
        delta: Math.round(avgDelta),
        description: `You often lower the heat around ${
          hour === 12 ? 12 : hour % 12
        }:00 PM`,
        details: {
          action: `Decrease temperature by ${Math.round(avgDelta)}°F at ${
            hour === 12 ? 12 : hour % 12
          }:00 PM`,
          frequency: occurrences.length,
          period: "last 2 weeks",
        },
        automation: {
          hour,
          delta: -Math.round(avgDelta),
        },
      };
    }
  }

  return null;
}

export default function usePatternDetection() {
  const [detectedPattern, setDetectedPattern] = useState(null);
  const [acknowledgedPatterns, setAcknowledgedPatterns] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("acknowledgedPatterns") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    const events = getThermostatLearningEvents();
    const pattern = detectPatterns(events);

    if (pattern && !acknowledgedPatterns.includes(pattern.type)) {
      setDetectedPattern(pattern);
    }
  }, []); // Run once on mount

  const acknowledgePattern = (pattern, accepted) => {
    const updated = [...acknowledgedPatterns, pattern.type];
    setAcknowledgedPatterns(updated);
    localStorage.setItem("acknowledgedPatterns", JSON.stringify(updated));

    if (accepted && pattern.automation) {
      // Store automation rule
      try {
        const rules = JSON.parse(
          localStorage.getItem("automationRules") || "[]"
        );
        rules.push({
          type: pattern.type,
          ...pattern.automation,
          createdAt: new Date().toISOString(),
        });
        localStorage.setItem("automationRules", JSON.stringify(rules));
      } catch (e) {
        console.error("Failed to save automation rule:", e);
      }
    }

    setDetectedPattern(null);
  };

  return {
    pattern: detectedPattern,
    acknowledgePattern,
  };
}
