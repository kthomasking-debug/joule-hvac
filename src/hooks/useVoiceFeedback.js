// src/hooks/useVoiceFeedback.js
// Provides TTS (text-to-speech) with LLM humanization via Groq

import { useState, useCallback, useRef } from "react";

export default function useVoiceFeedback() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef(null);
  const groqApiKey = localStorage.getItem("groqApiKey");

  // Humanize technical text via Groq LLM before speaking
  const humanize = useCallback(
    async (technicalText) => {
      if (!groqApiKey) return technicalText;

      try {
        const response = await fetch(
          "https://api.groq.com/openai/v1/chat/completions",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${groqApiKey}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a helpful home energy assistant. Rewrite technical energy data into simple, relatable terms a homeowner would understand. Be concise (1-2 sentences max). Use everyday comparisons.",
                },
                {
                  role: "user",
                  content: `Rewrite this for a homeowner: "${technicalText}"`,
                },
              ],
              temperature: 0.7,
              max_tokens: 100,
            }),
          }
        );

        const data = await response.json();
        return data.choices?.[0]?.message?.content || technicalText;
      } catch (error) {
        console.warn("Humanization failed, using original text:", error);
        return technicalText;
      }
    },
    [groqApiKey]
  );

  // Speak text with optional humanization
  const speak = useCallback(
    async (text, shouldHumanize = false) => {
      if (!("speechSynthesis" in window)) {
        console.warn("Text-to-speech not supported");
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const textToSpeak = shouldHumanize ? await humanize(text) : text;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.rate = 0.9; // Slightly slower for clarity
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [humanize]
  );

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return {
    speak,
    stop,
    isSpeaking,
    humanize,
  };
}
