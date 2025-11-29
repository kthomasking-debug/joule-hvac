// src/hooks/useVoiceHMI.js
// Orchestrates voice interaction state, transcript, insights, and sentiment

import { useState, useCallback, useRef } from "react";

export default function useVoiceHMI() {
  // Detect test environment
  const isWebDriver = typeof navigator !== "undefined" && navigator.webdriver;

  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [currentInsight, setCurrentInsight] = useState(null);
  const [sentiment] = useState("neutral"); // sentiment placeholder
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(() => {
    try {
      return localStorage.getItem("askJouleTts") === "on";
    } catch {
      return true;
    }
  });

  const recognitionRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const listenTimeoutRef = useRef(null);
  const silenceStartRef = useRef(null);

  // Voice listening duration (seconds, from settings or default 5)
  let listenSeconds = 5;
  try {
    const stored = localStorage.getItem("askJouleListenSeconds");
    if (stored && !isNaN(Number(stored))) listenSeconds = Number(stored);
  } catch (err) {
    // Ignore localStorage errors
    console.warn("Failed to read listen seconds setting:", err);
  }

  const startListening = useCallback(() => {
    // Skip in test environment
    if (isWebDriver) {
      console.log(
        "[useVoiceHMI] Test environment detected; skipping voice initialization"
      );
      return;
    }

    setIsListening(true);
    setTranscript("");
    setInterimTranscript("");

    if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      recognitionRef.current = rec;

      rec.onresult = (event) => {
        let final = "";
        let interim = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const piece = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += piece + " ";
          else interim += piece;
        }
        setTranscript((prev) => prev + final);
        setInterimTranscript(interim);
        if (final && final.trim()) {
          try {
            rec.stop();
          } catch {
            /* swallow early stop */
          }
        }
      };
      rec.onerror = (e) => {
        console.error("Speech recognition error", e.error);
        setIsListening(false);
      };
      rec.onend = () => {
        setIsListening(false);
        setInterimTranscript("");
      };
      rec.start();
      // Fallback timeout after N seconds (from settings)
      if (listenTimeoutRef.current) clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = setTimeout(() => {
        try {
          rec.stop();
        } catch {
          /* swallow timeout stop */
        }
      }, listenSeconds * 1000);
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        audioContextRef.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        analyserRef.current = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
        analyserRef.current.fftSize = 256;
        const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
        const tick = () => {
          analyserRef.current.getByteFrequencyData(dataArray);
          const avg = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setAudioLevel(avg / 255);
          if (isListening) requestAnimationFrame(tick);
        };
        if (isListening) tick();
      })
      .catch((err) => console.error("Microphone access denied", err));
  }, [isListening, isWebDriver, listenSeconds]);

  const stopListening = useCallback(() => {
    setIsListening(false);
    setInterimTranscript("");

    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (listenTimeoutRef.current) {
      clearTimeout(listenTimeoutRef.current);
      listenTimeoutRef.current = null;
    }
    silenceStartRef.current = null;
  }, []);

  const showInsight = useCallback((insight) => {
    setCurrentInsight(insight);
  }, []);

  const dismissInsight = useCallback(() => {
    setCurrentInsight(null);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const processVoiceQuery = useCallback(
    async (query) => {
      if (!query || query.trim().length === 0) return;

      setIsProcessing(true);
      stopListening();

      try {
        // Check if query should route to backend agent
        const lowerQuery = query.toLowerCase();
        if (
          lowerQuery.includes("agent run") ||
          lowerQuery.includes("autonomous")
        ) {
          // Route to backend agent instead of client-side Groq
          const response = await fetch("/api/agent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ goal: query }),
          });

          if (!response.ok) {
            throw new Error(`Agent endpoint returned ${response.status}`);
          }

          // Collect streamed events
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let finalOutput = null;

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const parts = buffer.split("\n\n");
            buffer = parts.pop();
            for (const chunk of parts) {
              const line = chunk.trim();
              if (!line.startsWith("data:")) continue;
              try {
                const evt = JSON.parse(line.slice(5));
                if (evt.type === "final") finalOutput = evt.output;
              } catch (err) {
                console.warn("Agent SSE parse error:", err.message);
              }
            }
          }

          // Show final output
          const summary = finalOutput
            ? `Completed in ${finalOutput.meta?.durationMs || 0}ms. Steps: ${
                finalOutput.steps?.map((s) => s.tool).join(", ") || "none"
              }.`
            : "Agent completed.";

          showInsight({
            title: "Agent Result",
            message: summary,
            sentiment: "calm",
          });

          if (ttsEnabled && "speechSynthesis" in window) {
            try {
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(summary);
              utterance.rate = 1.0;
              utterance.onstart = () => setIsSpeaking(true);
              utterance.onend = () => setIsSpeaking(false);
              utterance.onerror = () => setIsSpeaking(false);
              window.speechSynthesis.speak(utterance);
            } catch (e) {
              console.error("Speech synthesis error:", e);
              setIsSpeaking(false);
            }
          }

          resetTranscript();
          setIsProcessing(false);
          return;
        }

        // Import the Groq integration dynamically
        const { askJouleFallback } = await import("../lib/groqAgent");

        // Get Groq API key from localStorage
        const groqApiKey = localStorage.getItem("groqApiKey") || "";
        const groqModel =
          localStorage.getItem("groqModel") || "llama-3.1-8b-instant";

        // Call Groq API for AI response
        const result = await askJouleFallback(query, groqApiKey, groqModel);

        if (result.error) {
          // Handle missing API key or other errors
          const errorMessage = result.needsSetup
            ? "Please add your Groq API key in Settings to use voice AI features."
            : result.message || "Sorry, I had trouble processing your request.";

          showInsight({
            title: result.needsSetup ? "API Key Required" : "Error",
            message: errorMessage,
            sentiment: "urgent",
          });
        } else {
          const answer =
            result.response || result.message || "I processed your request.";

          // Show insight with the AI response
          showInsight({
            title: "Voice Response",
            message: answer,
            sentiment: "calm",
          });

          // Speak the response (respect TTS preference)
          if (ttsEnabled && "speechSynthesis" in window) {
            try {
              // Cancel any existing speech first
              window.speechSynthesis.cancel();
              const utterance = new SpeechSynthesisUtterance(answer);
              utterance.rate = 1.0;
              utterance.pitch = 1.0;
              utterance.volume = 1.0;
              utterance.onstart = () => setIsSpeaking(true);
              utterance.onend = () => setIsSpeaking(false);
              utterance.onerror = () => setIsSpeaking(false);
              window.speechSynthesis.speak(utterance);
            } catch (e) {
              console.error("Speech synthesis error:", e);
              setIsSpeaking(false);
            }
          }
        }

        resetTranscript();
      } catch (error) {
        console.error("Voice query processing error:", error);
        showInsight({
          title: "Error",
          message:
            "Sorry, I had trouble processing your request. Please try again.",
          sentiment: "urgent",
        });
      } finally {
        setIsProcessing(false);
      }
    },
    [stopListening, showInsight, resetTranscript, ttsEnabled]
  );

  return {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    currentInsight,
    sentiment,
    isProcessing,
    isSpeaking,
    ttsEnabled,
    startListening,
    stopListening,
    showInsight,
    dismissInsight,
    resetTranscript,
    processVoiceQuery,
    stopSpeaking: () => {
      try {
        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {
        // swallow speech cancellation errors
        console.warn("Speech cancellation error (ignored):", e);
      }
      setIsSpeaking(false);
    },
    toggleTts: () => {
      setTtsEnabled((prev) => {
        const next = !prev;
        try {
          localStorage.setItem("askJouleTts", next ? "on" : "off");
        } catch (e) {
          console.warn("Failed to persist TTS setting (ignored):", e);
        }
        // If turning off while speaking, cancel immediately
        if (!next) {
          try {
            window.speechSynthesis.cancel();
          } catch (e) {
            console.warn("Speech cancellation error (ignored):", e);
          }
          setIsSpeaking(false);
        }
        return next;
      });
    },
  };
}
