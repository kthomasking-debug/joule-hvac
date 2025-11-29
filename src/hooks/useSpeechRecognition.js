import { useEffect, useRef, useState, useCallback } from "react";

export function useSpeechRecognition({
  lang = "en-US",
  continuous = true,
  interim = true,
  autoRestart = true,
  onFinal,
  onInterim,
  onError,
  maxAutoRestarts = 12,
  autoStopOnFinal = false,
}) {
  const recognitionRef = useRef(null);
  const [supported, setSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState(null);
  const manualStopRef = useRef(false);
  const [restartCount, setRestartCount] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    setSupported(true);
    const rec = new SR();
    rec.lang = lang;
    rec.continuous = continuous;
    rec.interimResults = interim;
    rec.onstart = () => setIsListening(true);
    rec.onend = () => {
      setIsListening(false);
      if (
        autoRestart &&
        !manualStopRef.current &&
        restartCount < maxAutoRestarts
      ) {
        setRestartCount((c) => c + 1);
        // brief delay to avoid rapid loop if permission denied
        setTimeout(() => {
          try {
            rec.start();
          } catch {
            // Ignore recognition start errors
          }
        }, 400);
      }
    };
    rec.onerror = (e) => {
      const code = e.error || "speech-error";
      setError(code);
      onError?.(code);
      setIsListening(false);
    };
    rec.onresult = (e) => {
      let agg = "";
      for (let i = 0; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        agg += chunk;
        if (!e.results[i].isFinal) onInterim?.(chunk);
      }
      const full = agg.trim();
      setTranscript(full);
      const final = e.results[e.results.length - 1];
      if (final && final.isFinal) {
        onFinal?.(full);
        if (autoStopOnFinal) {
          // Prevent auto-restart loop after final result
          manualStopRef.current = true;
          try {
            rec.stop();
          } catch {
            // Ignore recognition stop errors
          }
        }
      }
    };
    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    };
  }, [
    lang,
    continuous,
    interim,
    autoRestart,
    onFinal,
    onInterim,
    onError,
    restartCount,
    maxAutoRestarts,
  ]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    manualStopRef.current = false;
    try {
      rec.start();
    } catch {
      /* ignore */
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    manualStopRef.current = true;
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }, []);

  return {
    supported,
    isListening,
    transcript,
    error,
    restartCount,
    startListening: start,
    stopListening: stop,
  };
}
