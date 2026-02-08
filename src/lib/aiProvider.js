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

const DEFAULT_LOCAL_AI_BASE_URL = "http://192.168.0.108:11434/v1";

/**
 * Check if any AI backend is available (Groq API key or local Ollama configured)
 * Uses same defaults as getAIConfig() so Settings "Local AI connected" and bill auditor stay in sync.
 */
export function isAIAvailable() {
  if (typeof window === "undefined") return false;
  const provider = localStorage.getItem(AI_PROVIDER_KEY) || AI_PROVIDERS.GROQ;
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
  const provider = localStorage.getItem(AI_PROVIDER_KEY) || AI_PROVIDERS.GROQ;
  if (provider === AI_PROVIDERS.LOCAL) {
    const baseUrl = (localStorage.getItem(LOCAL_AI_BASE_URL_KEY) || DEFAULT_LOCAL_AI_BASE_URL).trim();
    const model = (localStorage.getItem(LOCAL_AI_MODEL_KEY) || "llama3:latest").trim();
    return { provider: AI_PROVIDERS.LOCAL, baseUrl, model };
  }
  const apiKey = (localStorage.getItem("groqApiKey") || "").trim();
  const model = localStorage.getItem("groqModel") || "llama-3.3-70b-versatile";
  return { provider: AI_PROVIDERS.GROQ, apiKey, model };
}

/**
 * Call OpenAI-compatible chat completions endpoint (works with Groq and Ollama)
 */
export async function callChatCompletions({ url, apiKey, model, messages, temperature = 0.1, maxTokens = 500 }) {
  const headers = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
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
    throw new Error(`LLM request failed: ${response.status} ${text}`);
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
    url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
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
    throw err;
  }
  clearTimeout(timeoutId);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM request failed: ${response.status} ${text}`);
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
    throw new Error(
      `Reading stream failed: ${streamErr.message}. If this happens on Windows, try F12 → Console and report the error.`
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
    const url = config.baseUrl.replace(/\/$/, "") + "/chat/completions";
    return callChatCompletions({
      url,
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
 * Fetch available models from Ollama (GET /api/tags)
 */
export async function fetchOllamaModels(baseUrl) {
  const u = new URL(baseUrl || "http://192.168.0.108:11434/v1");
  const tagsUrl = `${u.origin}/api/tags`;
  const res = await fetch(tagsUrl);
  if (!res.ok) throw new Error(`Ollama models fetch failed: ${res.status}`);
  const data = await res.json();
  const models = data.models || [];
  return models.map((m) => ({ id: m.name, name: m.name, object: "model" }));
}
