/**
 * AI Provider utilities - supports Groq cloud and local (Ollama/OpenAI-compatible) LLMs
 */

const AI_PROVIDER_KEY = "aiProvider";
const LOCAL_AI_BASE_URL_KEY = "localAIBaseUrl";
const LOCAL_AI_MODEL_KEY = "localAIModel";

export const AI_PROVIDERS = {
  GROQ: "groq",
  LOCAL: "local",
};

const DEFAULT_LOCAL_AI_BASE_URL = "https://unexpected-helena-houston-develop.trycloudflare.com/v1";

/**
 * Extract and normalize the Ollama base URL.
 * - If user pastes a Joule share link (e.g. http://localhost:5173/?ollamaUrl=...), extract the ollamaUrl param.
 * - If URL has no path (e.g. https://xxx.trycloudflare.com), append /v1 so chat/completions works.
 */
export function sanitizeOllamaBaseUrl(input) {
  if (!input || typeof input !== "string") return input;
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  try {
    let result = trimmed;
    // Extract from full page URL with ollamaUrl param
    if (trimmed.includes("?ollamaUrl=") || trimmed.includes("&ollamaUrl=") || trimmed.includes("?ollama=") || trimmed.includes("&ollama=")) {
      const url = new URL(trimmed);
      const extracted = url.searchParams.get("ollamaUrl") || url.searchParams.get("ollama");
      if (extracted?.trim()) result = extracted.trim();
    }
    // Ollama's OpenAI-compatible API is at /v1/chat/completions. If URL has no path, add /v1.
    const u = new URL(result);
    if (!u.pathname || u.pathname === "/") {
      u.pathname = "/v1";
      result = u.toString().replace(/\/$/, "");
    }
    return result;
  } catch {
    return trimmed;
  }
}

/** Return a user-friendly message for Groq 429 rate limit; otherwise return null. */
function friendlyMessageForGroqError(status) {
  if (status !== 429) return null;
  return "Groq rate limit reached. Switch to Local LLM (Ollama) in Settings → Bridge & AI, or upgrade your Groq subscription at https://console.groq.com/settings/billing";
}

/** Convert raw LLM errors into user-friendly messages with what to do. */
function friendlyMessageForLLMError(err, config) {
  const msg = (err?.message || String(err)).toLowerCase();
  const isLocal = config?.provider === AI_PROVIDERS.LOCAL;

  if (isLocal) {
    if (msg.includes("network") || msg.includes("connection") || msg.includes("failed to fetch") || msg.includes("cors") || msg.includes("connection lost") || msg.includes("connection refused")) {
      return "Couldn't reach your Local AI. Check that Ollama is running, the address in Settings → Bridge & AI is correct (e.g. https://xxx.trycloudflare.com/v1), and the Cloudflare tunnel is up. Then try again.";
    }
    if (msg.includes("500") || msg.includes("502") || msg.includes("internal server")) {
      return "Local AI server error. Restart Ollama and cloudflared (if using a tunnel), then try again. If it persists, check Settings → Bridge & AI for the correct address.";
    }
  } else {
    if (msg.includes("500") || msg.includes("502") || msg.includes("503")) {
      return "Groq API is temporarily unavailable. Try again in a moment, or switch to Local AI in Settings → Bridge & AI.";
    }
  }

  return null;
}

/**
 * Check if any AI backend is available (Groq API key or local Ollama configured)
 * Uses same defaults as getAIConfig() so Settings "Local AI connected" and bill auditor stay in sync.
 */
export function isAIAvailable() {
  if (typeof window === "undefined") return false;
  const provider = localStorage.getItem(AI_PROVIDER_KEY) || AI_PROVIDERS.LOCAL;
  if (provider === AI_PROVIDERS.LOCAL) {
    const baseUrl = (localStorage.getItem(LOCAL_AI_BASE_URL_KEY) || DEFAULT_LOCAL_AI_BASE_URL).trim();
    return baseUrl.length > 0;
  }
  const groqKey = (localStorage.getItem("groqApiKey") || "").trim();
  return groqKey.length > 0;
}

/**
 * Get current AI configuration for making LLM requests
 */
export function getAIConfig() {
  const provider = localStorage.getItem(AI_PROVIDER_KEY) || AI_PROVIDERS.LOCAL;
  if (provider === AI_PROVIDERS.LOCAL) {
    const raw = (localStorage.getItem(LOCAL_AI_BASE_URL_KEY) || DEFAULT_LOCAL_AI_BASE_URL).trim();
    const baseUrl = sanitizeOllamaBaseUrl(raw) || raw;
    const model = (localStorage.getItem(LOCAL_AI_MODEL_KEY) || "llama3:latest").trim();
    return { provider: AI_PROVIDERS.LOCAL, baseUrl, model };
  }
  const apiKey = (localStorage.getItem("groqApiKey") || "").trim();
  const model = localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
  return { provider: AI_PROVIDERS.GROQ, apiKey, model };
}

/**
 * Return { url, target } for chat/completions.
 * In dev, when Local AI URL is cross-origin, uses proxy (target = baseUrl for X-LLM-Target header).
 */
function getChatCompletionsUrl(config) {
  if (config.provider !== AI_PROVIDERS.LOCAL) return null;
  const baseUrl = config.baseUrl.replace(/\/$/, "");
  const useProxy =
    typeof window !== "undefined" &&
    import.meta.env?.DEV &&
    (() => {
      try {
        return new URL(baseUrl).origin !== window.location.origin;
      } catch {
        return false;
      }
    })();
  if (useProxy) {
    return {
      url: `${window.location.origin}/api/llm-proxy/chat/completions`,
      target: baseUrl,
    };
  }
  return { url: baseUrl + "/chat/completions", target: null };
}

/**
 * Call OpenAI-compatible chat completions endpoint (works with Groq and Ollama)
 * @param {string} target - When using dev proxy, the base URL for X-LLM-Target header
 */
export async function callChatCompletions({ url, apiKey, model, messages, temperature = 0.1, maxTokens = 500, target }) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (target) {
    headers["X-LLM-Target"] = target;
  }
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model || "llama3:latest",
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    const friendly = friendlyMessageForGroqError(response.status) || friendlyMessageForLLMError(new Error(`${response.status} ${text}`), getAIConfig());
    throw new Error(friendly || `LLM request failed: ${response.status} ${text}`);
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (content == null) {
    throw new Error("No content in LLM response");
  }
  return content;
}

/**
 * Call LLM with streaming - yields text chunks via onChunk callback as they arrive.
 * Returns the full accumulated text when done.
 */
export async function callLLMStreaming({
  messages,
  temperature = 0.1,
  maxTokens = 500,
  onChunk = () => {},
}) {
  const config = getAIConfig();
  let url;
  let headers = { "Content-Type": "application/json" };
  let body;

  if (config.provider === AI_PROVIDERS.LOCAL) {
    const urlInfo = getChatCompletionsUrl(config);
    url = urlInfo.url;
    if (urlInfo.target) {
      headers["X-LLM-Target"] = urlInfo.target;
    }
    body = {
      model: config.model || "llama3:latest",
      messages,
      stream: true,
      temperature,
      max_tokens: maxTokens,
    };
  } else {
    url = "https://api.groq.com/openai/v1/chat/completions";
    headers.Authorization = `Bearer ${config.apiKey}`;
    body = {
      model: config.model || "llama-3.3-70b-versatile",
      messages,
      stream: true,
      temperature,
      max_tokens: maxTokens,
    };
  }

  // Local Ollama (especially on slow GPU/remote) can take minutes for first token and full response
  const timeoutMs = config.provider === AI_PROVIDERS.LOCAL ? 360000 : 60000; // 6 min local, 1 min Groq
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") {
      throw new Error(
        config.provider === AI_PROVIDERS.LOCAL
          ? "Local AI didn't respond in time (6 min). Check that Ollama is running and the address in Settings is correct. Slow GPUs may need longer."
          : "Request timed out. Try again."
      );
    }
    const friendly = friendlyMessageForLLMError(err, config);
    throw new Error(friendly || err.message);
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    const friendly = friendlyMessageForGroqError(response.status) || friendlyMessageForLLMError(new Error(`${response.status} ${text}`), config);
    throw new Error(friendly || `LLM request failed: ${response.status} ${text}`);
  }

  if (!response.body) {
    throw new Error(
      "Streaming not supported (no response body). Try a different browser or disable streaming."
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === "data: [DONE]") continue;
        if (trimmed.startsWith("data: ")) {
          try {
            const json = JSON.parse(trimmed.slice(6));
            const content = json.choices?.[0]?.delta?.content;
            if (content) {
              fullText += content;
              onChunk(content);
            }
          } catch {
            // Skip malformed chunks
          }
        }
      }
    }
  } catch (streamErr) {
    if (import.meta.env?.DEV) {
      console.error("[aiProvider] Streaming read error:", streamErr);
    }
    const isAbort = streamErr?.name === "AbortError" || /aborted/i.test(streamErr?.message || "");
    const hint = isAbort
      ? "This often happens when you left the page or navigated away before the response finished."
      : "If this happens on Windows, try F12 → Console and report the error.";
    throw new Error(
      `Reading stream failed: ${streamErr.message}. ${hint}`
    );
  }

  return fullText;
}

/**
 * Call LLM (Groq or local Ollama) with current config - use for bill parsing, analysis, etc.
 */
export async function callLLM({ messages, temperature = 0.1, maxTokens = 500 }) {
  const config = getAIConfig();
  if (config.provider === AI_PROVIDERS.LOCAL) {
    const urlInfo = getChatCompletionsUrl(config);
    return callChatCompletions({
      url: urlInfo.url,
      target: urlInfo.target,
      apiKey: null,
      model: config.model,
      messages,
      temperature,
      maxTokens,
    });
  }
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model || "llama-3.3-70b-versatile",
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error: ${response.status} ${text}`);
  }
  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

/**
 * Warm the local LLM (Ollama) by sending a tiny prompt. Loads the model into VRAM
 * before the user's first real request, eliminating 5-20s cold-start latency.
 * No-op for Groq (cloud has no cold start). Fire-and-forget — never blocks UI.
 */
const WARM_DEBOUNCE_MS = 5 * 60 * 1000; // 5 minutes
const WARM_STORAGE_KEY = "llmLastWarmedAt";

export function warmLLM() {
  if (typeof window === "undefined") return;
  const config = getAIConfig();
  if (config.provider !== AI_PROVIDERS.LOCAL) return;

  const last = parseInt(sessionStorage.getItem(WARM_STORAGE_KEY) || "0", 10);
  if (Date.now() - last < WARM_DEBOUNCE_MS) return;

  const urlInfo = getChatCompletionsUrl(config);
  const body = JSON.stringify({
    model: config.model || "llama3:latest",
    messages: [{ role: "user", content: "Ready." }],
    stream: false,
    temperature: 0,
    max_tokens: 2,
  });

  const headers = { "Content-Type": "application/json" };
  if (urlInfo.target) headers["X-LLM-Target"] = urlInfo.target;
  fetch(urlInfo.url, {
    method: "POST",
    headers,
    body,
  })
    .then(() => sessionStorage.setItem(WARM_STORAGE_KEY, String(Date.now())))
    .catch(() => {});
}

/**
 * Fetch available models from Ollama (GET /api/tags).
 * In dev, when baseUrl is cross-origin, uses proxy to avoid CORS.
 */
export async function fetchOllamaModels(baseUrl) {
  const raw = (baseUrl || DEFAULT_LOCAL_AI_BASE_URL).trim();
  const base = sanitizeOllamaBaseUrl(raw);
  const u = new URL(base);
  const useProxy =
    typeof window !== "undefined" &&
    import.meta.env?.DEV &&
    u.origin !== window.location.origin;
  const tagsUrl = useProxy
    ? `${window.location.origin}/api/llm-proxy/api/tags`
    : `${u.origin}/api/tags`;
  const headers = useProxy ? { "X-LLM-Target": u.origin } : {};
  const res = await fetch(tagsUrl, { headers });
  if (!res.ok) throw new Error(`Ollama models fetch failed: ${res.status}`);
  const data = await res.json();
  const models = data.models || [];
  return models.map((m) => ({ id: m.name, name: m.name, object: "model" }));
}
