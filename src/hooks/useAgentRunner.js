import { useState, useRef, useCallback } from "react";
import { runAgentClient } from "../lib/agentClient";

// useAgentRunner: runs agent client-side (no server needed!)
// Provides: events[], run(goal, settings?), abort(), isRunning, lastFinal
export function useAgentRunner() {
  const [events, setEvents] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [lastFinal, setLastFinal] = useState(null);
  const abortRef = useRef(null);

  const run = useCallback(async (goal, settings) => {
    if (!goal) return;
    // Abort any previous run
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setEvents([]);
    setIsRunning(true);
    setLastFinal(null);

    try {
      // Run agent client-side using async generator
      for await (const event of runAgentClient(
        goal,
        settings,
        controller.signal
      )) {
        if (controller.signal.aborted) break;

        setEvents((prev) => [...prev, event]);
        if (event.type === "final") {
          setLastFinal(event.output);
        }
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        setEvents((prev) => [...prev, { type: "error", message: err.message }]);
      }
    } finally {
      setIsRunning(false);
    }
  }, []);

  const abort = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return { events, isRunning, lastFinal, run, abort };
}

export default useAgentRunner;
