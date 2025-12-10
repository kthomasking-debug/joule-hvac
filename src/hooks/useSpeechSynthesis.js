import { useEffect, useRef, useState, useCallback } from "react";

// Lazy load pre-generated TTS module to avoid breaking if file doesn't exist
let preGeneratedTTSModule = null;
async function loadPreGeneratedTTS() {
  if (preGeneratedTTSModule) return preGeneratedTTSModule;
  try {
    preGeneratedTTSModule = await import("../lib/preGeneratedTTS");
    return preGeneratedTTSModule;
  } catch (error) {
    console.warn("Pre-generated TTS module not available:", error);
    return null;
  }
}

// ElevenLabs TTS integration
// API key can be overridden via environment variable or localStorage
const ELEVENLABS_API_KEY = import.meta.env.VITE_ELEVENLABS_API_KEY || 
  (typeof localStorage !== 'undefined' ? localStorage.getItem('elevenLabsApiKey') : null) ||
  null; // Set to null to disable ElevenLabs if no key is available

// Function to get voice ID from localStorage or use default
function getElevenLabsVoiceId() {
  try {
    const savedVoiceId = localStorage.getItem("elevenLabsVoiceId");
    if (savedVoiceId) {
      return savedVoiceId;
    }
  } catch (e) {
    // Ignore localStorage errors
  }
  // Default to Absintha (Dark Voice Alchemy)
  // If this doesn't work, the voice ID can be found via the ElevenLabs API
  // and set in localStorage with key "elevenLabsVoiceId"
  return "pNInz6obpgDQGcFmaJgB"; // Placeholder - will be auto-detected or set manually
}

// Auto-detect Absintha voice on first load
let voiceIdCache = null;
let voiceIdLoading = null;

async function initializeAbsinthaVoice() {
  if (voiceIdCache) return voiceIdCache;
  if (voiceIdLoading) return voiceIdLoading;
  
  // Check localStorage first
  try {
    const saved = localStorage.getItem("elevenLabsVoiceId");
    if (saved) {
      voiceIdCache = saved;
      return saved;
    }
  } catch (e) {
    // Ignore
  }
  
  // Try to find Absintha voice
  voiceIdLoading = findVoiceIdByName("Absintha", ELEVENLABS_API_KEY).then((voiceId) => {
    if (voiceId) {
      voiceIdCache = voiceId;
      try {
        localStorage.setItem("elevenLabsVoiceId", voiceId);
      } catch (e) {
        // Ignore
      }
      return voiceId;
    }
    // Fallback to default if not found
    return getElevenLabsVoiceId();
  });
  
  return voiceIdLoading;
}

// Function to fetch available voices from ElevenLabs API
async function fetchElevenLabsVoices(apiKey = ELEVENLABS_API_KEY) {
  // Don't make the request if no API key is provided
  if (!apiKey || apiKey.trim() === '') {
    return [];
  }
  
  // Basic validation: ElevenLabs API keys should start with "sk_"
  if (!apiKey.startsWith('sk_')) {
    return [];
  }
  
  try {
    const response = await fetch("https://api.elevenlabs.io/v1/voices", {
      method: "GET",
      headers: {
        "xi-api-key": apiKey,
      },
    });
    if (response.ok) {
      const data = await response.json();
      return data.voices || [];
    } else if (response.status === 401) {
      // Invalid API key - silently fail and don't log to console
      return [];
    }
  } catch (error) {
    // Silently fail - don't log network errors to console
    // The browser will still show the error in Network tab, but we won't spam console
  }
  return [];
}

// Function to find voice ID by name
async function findVoiceIdByName(voiceName, apiKey = ELEVENLABS_API_KEY) {
  const voices = await fetchElevenLabsVoices(apiKey);
  const voice = voices.find(
    (v) =>
      v.name.toLowerCase().includes(voiceName.toLowerCase()) ||
      v.name.toLowerCase().includes("absintha")
  );
  return voice?.voice_id || null;
}

async function speakWithElevenLabs(text, apiKey = ELEVENLABS_API_KEY, voiceId = null) {
  // Get voice ID (use provided, or try to initialize Absintha, or fallback)
  let finalVoiceId = voiceId;
  if (!finalVoiceId) {
    // Try to get from cache or initialize
    if (voiceIdCache) {
      finalVoiceId = voiceIdCache;
    } else {
      // Initialize on first use (non-blocking)
      initializeAbsinthaVoice().then((id) => {
        voiceIdCache = id;
      });
      // Use default for now, will use cached value on next call
      finalVoiceId = getElevenLabsVoiceId();
    }
  }
  try {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${finalVoiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`ElevenLabs API error: ${response.status}`);
    }

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    
    return new Promise((resolve, reject) => {
      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        resolve();
      };
      audio.onerror = (error) => {
        URL.revokeObjectURL(audioUrl);
        reject(error);
      };
      audio.play();
    });
  } catch (error) {
    console.warn("ElevenLabs TTS failed, falling back to browser TTS:", error);
    throw error;
  }
}

export function useSpeechSynthesis(options = {}) {
  // Check localStorage for TTS engine preference (reactive to changes)
  const [useElevenLabsState, setUseElevenLabsState] = useState(() => {
    try {
      const useBrowserTTS = localStorage.getItem("useBrowserTTS");
      return useBrowserTTS !== "true"; // If useBrowserTTS is true, useElevenLabs should be false
    } catch {
      return true; // Default to ElevenLabs
    }
  });

  // Listen for changes to the preference
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === "useBrowserTTS") {
        const useBrowserTTS = e.newValue === "true";
        setUseElevenLabsState(!useBrowserTTS);
      }
    };
    
    const handleTTSEngineChange = () => {
      try {
        const useBrowserTTS = localStorage.getItem("useBrowserTTS") === "true";
        setUseElevenLabsState(!useBrowserTTS);
      } catch {
        // Ignore errors
      }
    };
    
    // Listen for storage events (from other tabs/windows)
    window.addEventListener("storage", handleStorageChange);
    // Listen for custom event (from same tab)
    window.addEventListener("ttsEngineChanged", handleTTSEngineChange);
    
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("ttsEngineChanged", handleTTSEngineChange);
    };
  }, []);

  const {
    enabled = true,
    defaultRate = 1.0,
    defaultPitch = 1.0,
    defaultLang = "en-US",
    personality = "friendly",
    useElevenLabs: useElevenLabsOption = useElevenLabsState, // Use state or override from options
  } = options;
  
  // Use the state value if not overridden by options
  const useElevenLabs = useElevenLabsOption !== undefined ? useElevenLabsOption : useElevenLabsState;

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
      // Removed hardcoded pleasantries - let the AI speak for itself
      // The AI (Llama) is smart enough to be polite on its own
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
    // Also stop ElevenLabs audio if playing
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    speakingRef.current = false;
    currentUtterRef.current = null;
    setIsSpeaking(false);
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
  const audioRef = useRef(null); // For ElevenLabs audio playback
  const usingElevenLabsRef = useRef(false); // Track if ElevenLabs is currently playing

  // Check if speech synthesis is supported
  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Initialize Absintha voice on mount (non-blocking)
  useEffect(() => {
    // Only initialize if we have a valid API key
    if (useElevenLabs && ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.startsWith('sk_') && !voiceIdCache) {
      initializeAbsinthaVoice().catch(() => {
        // Silently fail - will use default voice ID or browser TTS
      });
    }
  }, [useElevenLabs]);

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
  // BUT: Don't cancel if we're navigating (TTS should continue during navigation)
  useEffect(() => {
    return () => {
      // Check if there's a pending TTS message in sessionStorage
      // If so, don't cancel - let it continue during navigation
      const hasPendingTTS = sessionStorage.getItem('askJoule_pendingTTS');
      const pendingTimestamp = sessionStorage.getItem('askJoule_pendingTTS_timestamp');
      
      // Only cancel if there's no pending TTS, or if it's older than 5 seconds (stale)
      if (!hasPendingTTS || (pendingTimestamp && Date.now() - parseInt(pendingTimestamp) > 5000)) {
        if (
          isSupported &&
          window.speechSynthesis &&
          window.speechSynthesis.speaking
        ) {
          window.speechSynthesis.cancel();
        }
      } else {
        // Clear the pending TTS flag after a delay to allow it to continue
        // The new page will handle continuing the TTS if needed
        setTimeout(() => {
          sessionStorage.removeItem('askJoule_pendingTTS');
          sessionStorage.removeItem('askJoule_pendingTTS_timestamp');
        }, 100);
      }
    };
  }, [isSupported]);

  // Speak text function
  const speak = useCallback(
    async (text, options = {}) => {
      // Check both the parent's enabled prop (enabledRef) AND internal state (isEnabled)
      // Both must be true for speech to work
      if (!enabledRef.current || !isEnabled || !text) return Promise.resolve();

      // Cancel any ongoing speech (both browser TTS and ElevenLabs)
      // Do this FIRST before anything else to prevent overlapping audio
      if (isSupported) {
        window.speechSynthesis.cancel();
      }
      
      // Aggressively stop any existing ElevenLabs audio
      if (audioRef.current) {
        try {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          // Remove all event listeners to prevent callbacks
          audioRef.current.onended = null;
          audioRef.current.onerror = null;
          audioRef.current.onpause = null;
          // Revoke the URL if we have it stored
          if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
            URL.revokeObjectURL(audioRef.current.src);
          }
        } catch (e) {
          // Ignore errors during cleanup
        }
        audioRef.current = null;
      }
      usingElevenLabsRef.current = false; // Reset flag

      // Clean text for better speech (remove emojis, special chars, markdown)
      // This cleaning is used for both ElevenLabs and browser TTS
      const cleanText = text
        .replace(/[✓✅❌💡🎯⚡]/gu, "") // Remove common emojis
        .replace(/ℹ️/gu, "") // Remove info emoji separately due to variation selector
        // Replace markdown formatting with pauses for natural speech
        .replace(/\*\*/g, ", ") // Replace bold markers (**) with comma pause
        .replace(/\*/g, ", ") // Replace italic markers (*) with comma pause (short silence)
        .replace(/`/g, "") // Remove code markers (`)
        .replace(/#/g, "") // Remove header markers (#)
        .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1") // Convert links [text](url) to just "text"
        // Replace symbols with spoken equivalents
        .replace(/→/g, " to ") // Right arrow → "to"
        .replace(/←/g, " from ") // Left arrow → "from"
        .replace(/~/g, "about ") // Tilde → "about"
        .replace(/±/g, " plus or minus ") // Plus-minus → "plus or minus"
        .replace(/×/g, " times ") // Multiplication → "times"
        .replace(/÷/g, " divided by ") // Division → "divided by"
        .replace(/≈/g, " approximately ") // Approximately → "approximately"
        .replace(/≤/g, " less than or equal to ") // Less than or equal → "less than or equal to"
        .replace(/≥/g, " greater than or equal to ") // Greater than or equal → "greater than or equal to"
        .replace(/≠/g, " not equal to ") // Not equal → "not equal to"
        .replace(/↑/g, " up ") // Up arrow → "up"
        .replace(/↓/g, " down ") // Down arrow → "down"
        // Phonetic hacks for correct pronunciation
        .replace(/Joule/gi, "Jool") // "Joule" → "Jool" (rhymes with "pool")
        .replace(/ASHRAE/gi, "Ash Ray") // "ASHRAE" → "Ash Ray" (rhymes with "Trash Day")
        .replace(/\bISO\b/gi, "I S O") // Pronounce ISO as letters
        .replace(/\bDOE\b/gi, "D O E") // Pronounce DOE as letters (Department of Energy)
        .replace(/\bBTU\b/gi, "B T U") // Pronounce BTU as letters
        // Replace "BTU/hr" with "BTU per hour" (must come before general "/" replacement)
        .replace(/\bBTU\s*\/\s*hr\b/gi, "B T U per hour")
        .replace(/\bHSPF\b/gi, "H S P F") // Pronounce HSPF as letters
        .replace(/\bSEER\b/gi, "S E E R") // Pronounce SEER as letters
        .replace(/\bAFUE\b/gi, "A F U E") // Pronounce AFUE as letters
        .replace(/\bCOP\b/gi, "C O P") // Coefficient of Performance
        .replace(/\bEER\b/gi, "E E R") // Energy Efficiency Ratio
        .replace(/\bNREL\b/gi, "N R E L") // National Renewable Energy Laboratory
        .replace(/\bTMY3\b/gi, "T M Y 3") // Typical Meteorological Year 3
        .replace(/\bHERS\b/gi, "H E R S") // Home Energy Rating System
        .replace(/\bHVAC\b/gi, "H V A C") // Heating, Ventilation, Air Conditioning
        // Format currency for speech: $X.XX → "X dollars and XX cents" or "XX cents"
        .replace(/\$(\d+)\.(\d{2})\b/g, (match, dollars, cents) => {
          const dollarsNum = parseInt(dollars, 10);
          const centsNum = parseInt(cents, 10);
          if (dollarsNum === 0) {
            return centsNum === 0 ? "0 dollars" : `${centsNum} cent${centsNum === 1 ? '' : 's'}`;
          } else if (centsNum === 0) {
            return `${dollarsNum} dollar${dollarsNum === 1 ? '' : 's'}`;
          } else {
            return `${dollarsNum} dollar${dollarsNum === 1 ? '' : 's'} and ${centsNum} cent${centsNum === 1 ? '' : 's'}`;
          }
        })
        .replace(/\$(\d+)\b/g, "$1 dollars") // Handle whole dollar amounts without decimals
        // Replace negative numbers first (before range replacements)
        // Only match negative numbers at word boundaries or start of string, not in compound words
        .replace(/(^|\s)-(\d+)/g, "$1negative $2") // Negative numbers: "-5" → "negative 5" (only at start or after whitespace)
        // Replace dashes with "to" for ranges (before unit replacements to preserve unit symbols)
        // Only match actual numeric ranges, not compound words like "larger-scale" or "multi-zone"
        // Pattern 1: Number ranges with units attached (e.g., "32-40°F", "5-10°C", "85-95%")
        .replace(/(\d+)\s*-\s*(\d+)(°[CF]|°|%)/gi, "$1 to $2$3")
        // Pattern 2: Number ranges with units after space (e.g., "2-4 kW", "5-15 kW", "32-40 degrees")
        .replace(/(\d+)\s*-\s*(\d+)\s+(kW|BTU|kBTU|degrees?|percent|°[CF])/gi, "$1 to $2 $3")
        // Pattern 3: Number ranges with units before dash (e.g., "$10-20", "2-3x")
        .replace(/(\$|x|×)(\d+)\s*-\s*(\d+)/gi, "$1$2 to $3")
        // Pattern 4: Simple number ranges (e.g., "32-40", "5-10", "85-95")
        // Match number-number only when followed by end of string, punctuation, or whitespace (not word chars)
        // This ensures we don't match compound words like "heat-pump" or "multi-zone"
        .replace(/(\d+)\s*-\s*(\d+)(?=\s|$|[.,;:!?])/g, "$1 to $2")
        // Now replace unit symbols (after range processing)
        .replace(/°F/g, " degrees Fahrenheit")
        // Don't replace dashes in compound words (e.g., "larger-scale", "multi-zone", "high-efficiency", "heat-pump")
        // These are handled by leaving them as-is (the dash will be read naturally by TTS)
        .replace(/(\d+)\s*HSPF/gi, "$1 H S P F") // Handle HSPF with numbers (e.g., "9 HSPF")
        .replace(/(\d+)\s*SEER/gi, "$1 S E E R") // Handle SEER with numbers
        .replace(/(\d+)\s*AFUE/gi, "$1 A F U E") // Handle AFUE with numbers
        .replace(/(\d+)\s*COP/gi, "$1 C O P") // Handle COP with numbers
        .replace(/(\d+)\s*EER/gi, "$1 E E R") // Handle EER with numbers
        .replace(/kBTU/gi, "thousand B T U")
        // Handle "BTU/hr" with numbers (e.g., "314 BTU/hr")
        .replace(/(\d+)\s*BTU\s*\/\s*hr\b/gi, "$1 B T U per hour")
        .replace(/sq\s*ft/gi, "square feet")
        .trim();

      if (!cleanText) return;

      // FALLBACK CHAIN: Pre-generated → Browser TTS (for dynamic) → ElevenLabs → Browser TTS (fallback)
      
      // Step 1: Check for pre-generated audio (offline, instant, no API costs)
      try {
        const preGeneratedModule = await loadPreGeneratedTTS();
        if (preGeneratedModule) {
          const hasDynamic = preGeneratedModule.hasDynamicContent(cleanText);
          
          // If text has dynamic content, skip pre-generated and use Browser TTS
          if (!hasDynamic) {
            const preGeneratedPath = await preGeneratedModule.findPreGeneratedAudio(cleanText);
            if (preGeneratedPath) {
              setIsSpeaking(true);
              
              // Cancel any browser TTS
              if (isSupported) {
                window.speechSynthesis.cancel();
              }
              
              // Play pre-generated audio
              const audio = new Audio(preGeneratedPath);
              audioRef.current = audio;
              
              await new Promise((resolve, reject) => {
                const cleanup = () => {
                  if (audioRef.current === audio) {
                    audioRef.current = null;
                  }
                  setIsSpeaking(false);
                };
                
                audio.onended = () => {
                  cleanup();
                  resolve();
                };
                
                audio.onerror = (error) => {
                  cleanup();
                  reject(error);
                };
                
                audio.onpause = () => {
                  setIsSpeaking(false);
                };
                
                audio.play().catch(reject);
              });
              
              return Promise.resolve(); // Successfully played pre-generated audio
            }
          }
        }
      } catch (error) {
        console.warn("Pre-generated audio failed, falling back:", error);
        // Continue to next fallback
      }

      // Step 2: If text has dynamic content (numbers, variables), use Browser TTS
      // This avoids API costs for responses like "The temperature is 72 degrees"
      let hasDynamic = false;
      try {
        const preGeneratedModule = await loadPreGeneratedTTS();
        if (preGeneratedModule) {
          hasDynamic = preGeneratedModule.hasDynamicContent(cleanText);
        } else {
          // Fallback: simple check for numbers if module not available
          hasDynamic = /\d+/.test(cleanText);
        }
      } catch {
        // Fallback: simple check for numbers if module not available
        hasDynamic = /\d+/.test(cleanText);
      }
      
      if (hasDynamic) {
        if (!isSupported) {
          console.warn("Speech synthesis not supported in this browser");
          setIsSpeaking(false);
          return Promise.resolve();
        }
        
        // Use browser TTS for dynamic content
        const utterance = new SpeechSynthesisUtterance(
          personalityWrap(cleanText)
        );

        utterance.rate = options.rate || 1.0;
        utterance.pitch = options.pitch || 1.0;
        utterance.volume = options.volume || 1.0;

        if (voice) {
          utterance.voice = voice;
        }

        // Return a promise that resolves when TTS finishes
        return new Promise((resolve) => {
          utterance.onstart = () => {
            setIsSpeaking(true);
          };

          utterance.onend = () => {
            setIsSpeaking(false);
            utteranceRef.current = null;
            resolve(); // Resolve when speech ends
          };

          utterance.onerror = (event) => {
            // "interrupted" is expected when speech is cancelled - don't log it as an error
            if (event.error !== "interrupted") {
              console.warn("Speech synthesis error:", event.error);
            }
            setIsSpeaking(false);
            utteranceRef.current = null;
            // Resolve even on error so navigation can proceed
            resolve();
          };

          utteranceRef.current = utterance;
          window.speechSynthesis.speak(utterance);
        });
      }

      // Step 3: Try ElevenLabs API (for non-dynamic content without pre-generated audio)
      // Only try if we have a valid API key
      if (useElevenLabs && ELEVENLABS_API_KEY && ELEVENLABS_API_KEY.startsWith('sk_')) {
        // Double-check: if ElevenLabs is already playing, don't start another
        if (usingElevenLabsRef.current || audioRef.current) {
          console.warn("ElevenLabs audio already playing, skipping new request");
          return;
        }
        
        // Cancel any browser TTS that might be playing
        if (isSupported) {
          window.speechSynthesis.cancel();
        }
        
        try {
          setIsSpeaking(true);
          usingElevenLabsRef.current = true; // Mark that we're using ElevenLabs
          
          // Apply text cleaning and formatting for ElevenLabs
          const formattedText = personalityWrap(cleanText);
          
          const voiceId = getElevenLabsVoiceId();
          const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
              method: "POST",
              headers: {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVENLABS_API_KEY,
              },
              body: JSON.stringify({
                text: formattedText,
                model_id: "eleven_flash_v2", // Flash model for low latency (~75ms)
                voice_settings: {
                  stability: 0.5,
                  similarity_boost: 0.75,
                },
                output_format: "mp3_44100_128", // Optimized format for faster streaming
              }),
            }
          );

          if (response.ok) {
            // Start playing audio as soon as we get the response (streaming approach)
            // Create audio element immediately and load the blob URL
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            // Final check: make sure no other audio started while we were fetching
            if (audioRef.current) {
              URL.revokeObjectURL(audioUrl);
              return; // Another audio already started
            }
            
            const audio = new Audio();
            audioRef.current = audio;
            
            // Ensure browser TTS is stopped before playing ElevenLabs audio
            if (isSupported) {
              window.speechSynthesis.cancel();
            }
            
            // Set up audio source and start playing immediately
            audio.src = audioUrl;
            audio.preload = "auto"; // Preload for faster start
            
            await new Promise((resolve, reject) => {
              const cleanup = () => {
                URL.revokeObjectURL(audioUrl);
                if (audioRef.current === audio) {
                  audioRef.current = null;
                }
                setIsSpeaking(false);
                usingElevenLabsRef.current = false;
              };
              
              let hasStarted = false;
              let fallbackTimeout = null;
              
              const startPlayback = () => {
                if (hasStarted) return;
                hasStarted = true;
                if (fallbackTimeout) {
                  clearTimeout(fallbackTimeout);
                  fallbackTimeout = null;
                }
                audio.play().catch((error) => {
                  cleanup();
                  reject(error);
                });
              };
              
              // Start playing as soon as enough data is loaded (don't wait for full load)
              audio.oncanplay = startPlayback; // Fires when enough data is loaded to start playing
              audio.oncanplaythrough = startPlayback; // Fires when entire audio can play without buffering
              
              audio.onended = () => {
                cleanup();
                resolve();
              };
              audio.onerror = (error) => {
                cleanup();
                reject(error);
              };
              audio.onpause = () => {
                setIsSpeaking(false);
                usingElevenLabsRef.current = false;
              };
              
              // Load the audio (triggers oncanplay/oncanplaythrough)
              audio.load();
              
              // Fallback: if events don't fire quickly, try playing after a short delay
              fallbackTimeout = setTimeout(() => {
                if (!hasStarted && audio.readyState >= 2) { // HAVE_CURRENT_DATA
                  startPlayback();
                }
              }, 150);
            });
            
            return Promise.resolve(); // Successfully used ElevenLabs, exit early - DO NOT continue to browser TTS
          } else {
            throw new Error(`ElevenLabs API error: ${response.status}`);
          }
        } catch (error) {
          // Fall through to browser TTS if ElevenLabs fails
          console.warn("ElevenLabs TTS failed, using browser TTS:", error);
          // Make sure we don't have both playing - ensure ElevenLabs audio is stopped
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current = null;
          }
          usingElevenLabsRef.current = false;
        }
      }

      // Fallback to browser speechSynthesis
      // ONLY if ElevenLabs is NOT currently active
      if (usingElevenLabsRef.current) {
        return Promise.resolve(); // Don't use browser TTS if ElevenLabs is active
      }
      
      if (!isSupported) {
        console.warn("Speech synthesis not supported in this browser");
        setIsSpeaking(false);
        return Promise.resolve();
      }

      // Return a promise that resolves when TTS finishes
      return new Promise((resolve) => {
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
          resolve(); // Resolve promise when speech ends
        };

        utterance.onerror = (event) => {
          // "interrupted" is expected when speech is cancelled - don't log it as an error
          if (event.error !== "interrupted") {
            console.warn("Speech synthesis error:", event.error);
          }
          setIsSpeaking(false);
          utteranceRef.current = null;
          resolve(); // Resolve even on error so navigation can proceed
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
      });
    },
    [isSupported, voice, isEnabled, useElevenLabs] // Include isEnabled and useElevenLabs so function updates when they change
  );

  // Stop speaking
  const stop = useCallback(() => {
    // Stop browser TTS
    if (isSupported) {
      window.speechSynthesis.cancel();
    }
    // Stop ElevenLabs audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
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
