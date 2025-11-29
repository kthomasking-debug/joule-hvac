import { useEffect, useRef } from "react";

const STORAGE_KEY = "learningEvents";

function loadEvents() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveEvents(events) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(-200)));
  } catch {
    // Ignore localStorage errors
  }
}

export default function useThermostatLearning({
  winterThermostat,
  summerThermostat,
}) {
  const prevWinter = useRef();
  const prevSummer = useRef();

  useEffect(() => {
    if (prevWinter.current === undefined) {
      prevWinter.current = winterThermostat;
      return;
    }
    if (
      winterThermostat !== prevWinter.current &&
      Number.isFinite(Number(winterThermostat))
    ) {
      const now = new Date();
      const ev = {
        kind: "winter",
        prev: Number(prevWinter.current),
        next: Number(winterThermostat),
        ts: now.toISOString(),
        hour: now.getHours(),
        dow: now.getDay(),
      };
      const events = loadEvents();
      events.push(ev);
      saveEvents(events);
      prevWinter.current = winterThermostat;
    }
  }, [winterThermostat]);

  useEffect(() => {
    if (prevSummer.current === undefined) {
      prevSummer.current = summerThermostat;
      return;
    }
    if (
      summerThermostat !== prevSummer.current &&
      Number.isFinite(Number(summerThermostat))
    ) {
      const now = new Date();
      const ev = {
        kind: "summer",
        prev: Number(prevSummer.current),
        next: Number(summerThermostat),
        ts: now.toISOString(),
        hour: now.getHours(),
        dow: now.getDay(),
      };
      const events = loadEvents();
      events.push(ev);
      saveEvents(events);
      prevSummer.current = summerThermostat;
    }
  }, [summerThermostat]);
}

export function getThermostatLearningEvents() {
  return loadEvents();
}
