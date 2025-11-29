import { useEffect, useRef, useState, useCallback } from "react";

export function useSpeechSynthesis(options = {}) {
  const {
    enabled = true,
    defaultRate = 1.0,
    defaultPitch = 1.0,
    defaultLang = "en-US",
    personality = "friendly",
  } = options;

  const synthRef = useRef(
    typeof window !== "undefined" ? window.speechSynthesis : null
  );
  const enabledRef = useRef(enabled);
  const lastUtterRef = useRef("");
  const speakingRef = useRef(false);
  const currentUtterRef = useRef(null);

  const [voices, setVoices] = useState(() =>
    synthRef.current ? synthRef.current.getVoices() : []
  );
  const [voiceName, setVoiceName] = useState(() =>
    typeof window === "undefined"
      ? ""
      : localStorage.getItem("ttsVoiceName") || ""
  );
  const [rate, setRate] = useState(() => {
    if (typeof window === "undefined") return defaultRate;
    const r = parseFloat(localStorage.getItem("ttsVoiceRate"));
    return Number.isFinite(r) ? r : defaultRate;
  });
  const [pitch, setPitch] = useState(() => {
    if (typeof window === "undefined") return defaultPitch;
    const p = parseFloat(localStorage.getItem("ttsVoicePitch"));
    return Number.isFinite(p) ? p : defaultPitch;
  });

  useEffect(
    () => () => {
      /* unmount */
    },
    []
  );
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    try {
      localStorage.setItem("ttsVoiceRate", String(rate));
    } catch (e) {
      void e; /* ignore */
    }
  }, [rate]);
  useEffect(() => {
    try {
      localStorage.setItem("ttsVoicePitch", String(pitch));
    } catch (e) {
      void e; /* ignore */
    }
  }, [pitch]);
  useEffect(() => {
    if (voiceName) {
      try {
        localStorage.setItem("ttsVoiceName", voiceName);
      } catch (e) {
        void e; /* ignore */
      }
    }
  }, [voiceName]);

  useEffect(() => {
    function updateVoices() {
      if (!synthRef.current) return;
      setVoices(synthRef.current.getVoices());
    }
    updateVoices();
    if (
      typeof window !== "undefined" &&
      window.speechSynthesis &&
      typeof window.speechSynthesis.addEventListener === "function"
    ) {
      window.speechSynthesis.addEventListener("voiceschanged", updateVoices);
      return () =>
        window.speechSynthesis &&
        typeof window.speechSynthesis.removeEventListener === "function"
          ? window.speechSynthesis.removeEventListener(
              "voiceschanged",
              updateVoices
            )
          : undefined;
    }
  }, []);

  const getVoice = useCallback(() => {
    if (!voiceName) return null;
    return voices.find((v) => v.name === voiceName) || null;
  }, [voices, voiceName]);

  const personalityWrap = useCallback(
    (text) => {
      if (!text) return "";
      if (personality === "friendly") return `Sure thing! ${text}`;
      if (personality === "warm") return `Absolutely. ${text}`;
      if (personality === "concise")
        return String(text).replace(/\s+/g, " ").trim();
      return text;
    },
    [personality]
  );

  const cancel = useCallback(() => {
    try {
      synthRef.current?.cancel();
    } catch (e) {
      void e; /* ignore */
    }
    speakingRef.current = false;
    currentUtterRef.current = null;
  }, []);

  // The speak function is implemented later (lower in this file) to leverage
  // local state like isEnabled/isSpeaking and available voice selection.
  // Removing earlier duplicate to prevent redeclaration errors.

  // speakImmediate should be defined after the main speak implementation so it
  // references the definitive speak function.
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isEnabled, setIsEnabled] = useState(() => {
    try {
      return localStorage.getItem("askJouleSpeechEnabled") === "true";
    } catch {
      return false;
    }
  });
  const [voice, setVoice] = useState(null);
  const [availableVoices, setAvailableVoices] = useState([]);
  const utteranceRef = useRef(null);

  // Check if speech synthesis is supported
  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Load available voices
  useEffect(() => {
    if (!isSupported) return;

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);

      // Try to select a good default voice (prefer English)
      if (!voice && voices.length > 0) {
        const savedVoice = localStorage.getItem("askJouleVoice");
        let selectedVoice = null;

        if (savedVoice) {
          selectedVoice = voices.find((v) => v.name === savedVoice);
        }

        if (!selectedVoice) {
          // Prefer British English (en-GB) voices for a more formal/JARVIS vibe
          // Then prefer UK English, then any English, then fallback to first available
          selectedVoice =
            // First: British English (en-GB) - most formal/smart sounding
            voices.find(
              (v) =>
                v.lang === "en-GB" &&
                (v.name.toLowerCase().includes("male") ||
                  v.name.toLowerCase().includes("uk") ||
                  v.name.toLowerCase().includes("british"))
            ) ||
            voices.find((v) => v.lang === "en-GB") ||
            // Second: UK English variants
            voices.find(
              (v) =>
                v.lang.startsWith("en") &&
                (v.name.toLowerCase().includes("uk") ||
                  v.name.toLowerCase().includes("british") ||
                  v.name.toLowerCase().includes("england"))
            ) ||
            // Third: Any English male voice (deeper/more authoritative)
            voices.find(
              (v) =>
                v.lang.startsWith("en") &&
                v.name.toLowerCase().includes("male")
            ) ||
            // Fourth: Any English voice
            voices.find((v) => v.lang.startsWith("en")) ||
            // Fallback: First available voice
            voices[0];
        }

        setVoice(selectedVoice);
      }
    };

    loadVoices();

    // Voices may load asynchronously
    if (
      window.speechSynthesis &&
      window.speechSynthesis.onvoiceschanged !== undefined
    ) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if (
        window.speechSynthesis &&
        window.speechSynthesis.onvoiceschanged !== undefined
      ) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [isSupported, voice]);

  // Stop any ongoing speech when component unmounts
  useEffect(() => {
    return () => {
      if (
        isSupported &&
        window.speechSynthesis &&
        window.speechSynthesis.speaking
      ) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSupported]);

  // Speak text function
  const speak = useCallback(
    (text, options = {}) => {
      // Check both the parent's enabled prop (enabledRef) AND internal state (isEnabled)
      // Both must be true for speech to work
      if (!isSupported || !enabledRef.current || !isEnabled || !text) return;

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      // Clean text for better speech (remove emojis, special chars)
      const cleanText = text
        .replace(/[✓✅❌💡🎯⚡]/gu, "") // Remove common emojis
        .replace(/ℹ️/gu, "") // Remove info emoji separately due to variation selector
        .replace(/\$(\d+)/g, "$1 dollars") // Say "dollars" instead of just the number
        .replace(/°F/g, " degrees Fahrenheit")
        .replace(/(\d+)\s*HSPF/gi, "$1 H S P F")
        .replace(/(\d+)\s*SEER/gi, "$1 S E E R")
        .replace(/(\d+)\s*AFUE/gi, "$1 A F U E")
        .replace(/kBTU/gi, "thousand B T U")
        .replace(/sq\s*ft/gi, "square feet")
        .trim();

      if (!cleanText) return;

      const utterance = new SpeechSynthesisUtterance(
        personalityWrap(cleanText)
      );

      // Apply options
      utterance.rate = options.rate || 1.0;
      utterance.pitch = options.pitch || 1.0;
      utterance.volume = options.volume || 1.0;

      if (voice) {
        utterance.voice = voice;
      }

      // Set up event handlers
      utterance.onstart = () => {
        setIsSpeaking(true);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utterance.onerror = (event) => {
        console.warn("Speech synthesis error:", event.error);
        setIsSpeaking(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [isSupported, voice, isEnabled] // Include isEnabled so function updates when toggleEnabled changes it
  );

  // Stop speaking
  const stop = useCallback(() => {
    if (!isSupported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [isSupported]);

  // Pause speaking
  const pause = useCallback(() => {
    if (!isSupported || !window.speechSynthesis.speaking) return;
    window.speechSynthesis.pause();
  }, [isSupported]);

  // Resume speaking
  const resume = useCallback(() => {
    if (!isSupported || !window.speechSynthesis.paused) return;
    window.speechSynthesis.resume();
  }, [isSupported]);

  // Toggle enabled state
  const toggleEnabled = useCallback(() => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    try {
      localStorage.setItem("askJouleSpeechEnabled", newState.toString());
    } catch (err) {
      console.warn("Failed to save speech enabled state:", err);
    }

    // Stop speaking if disabling
    if (!newState && isSpeaking) {
      stop();
    }
  }, [isEnabled, isSpeaking, stop]);

  // Change voice
  const changeVoice = useCallback(
    (voiceName) => {
      const selectedVoice = availableVoices.find((v) => v.name === voiceName);
      if (selectedVoice) {
        setVoice(selectedVoice);
        try {
          localStorage.setItem("askJouleVoice", voiceName);
        } catch (err) {
          console.warn("Failed to save voice preference:", err);
        }
      }
    },
    [availableVoices]
  );

  const speakImmediate = useCallback(
    (text, opts) => speak(text, opts),
    [speak]
  );

  return {
    speak,
    speakImmediate,
    cancel,
    stop,
    pause,
    resume,
    voices,
    setVoiceName,
    voiceName,
    rate,
    setRate,
    pitch,
    setPitch,
    lastUtterText: lastUtterRef.current,
    speaking: speakingRef.current,
    isSpeaking,
    isEnabled,
    toggleEnabled,
    isSupported: typeof window !== "undefined" && "speechSynthesis" in window,
    availableVoices: voices,
    voice: getVoice(),
    changeVoice,
  };
}

export default useSpeechSynthesis;
