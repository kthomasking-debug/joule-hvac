/**
 * Utility functions for fetching and managing Groq models
 */

/**
 * Fetches available models from Groq API
 * @param {string} apiKey - Groq API key
 * @returns {Promise<Array>} Array of available model objects
 */
export async function fetchGroqModels(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error("API key is required");
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch models: ${response.status} ${errorText}`
      );
    }

    const data = await response.json();
    return data.data || [];
  } catch (error) {
    console.error("Error fetching Groq models:", error);
    throw error;
  }
}

/**
 * Suggests a good model from the available models
 * Prioritizes fast models for better user experience
 * @param {Array} models - Array of model objects from Groq API
 * @returns {string|null} Suggested model ID or null if no models available
 */
export function suggestModel(models) {
  if (!models || models.length === 0) {
    return null;
  }

  // Priority order for model suggestions (most powerful first, appropriate for Ask Joule)
  // Default to llama-3.3-70b-versatile as the most powerful appropriate model
  const priorityModels = [
    "llama-3.3-70b-versatile", // Most powerful - default for Ask Joule
    "llama-3.1-8b-instant", // Fast alternative
    "meta-llama/llama-guard-4-12b", // Safety/guard model
    "llama-3.1-70b-versatile", // High quality (if still available, may be deprecated)
    "mixtral-8x7b-32768", // Large context
    "llama-3.1-405b-reasoning", // Reasoning model
    "llama-3.2-90b-text-preview", // Latest preview
    "llama-3.2-11b-text-preview", // Latest smaller preview
  ];

  // First, try to find a priority model that's available
  for (const priorityModel of priorityModels) {
    const found = models.find((m) => m.id === priorityModel);
    if (found) {
      return priorityModel;
    }
  }

  // If no priority model found, return the first available model
  // Filter out any decommissioned models by checking if they're in the list
  const availableModels = models.filter((m) => {
    // Exclude known decommissioned models
    const decommissioned = ["llama-3.1-70b-versatile"]; // Add more as needed
    return !decommissioned.includes(m.id);
  });

  return availableModels.length > 0 ? availableModels[0].id : models[0].id;
}

/**
 * Formats a model ID into a user-friendly label
 * @param {string} modelId - Model ID from Groq API
 * @returns {string} Formatted label
 */
export function formatModelLabel(modelId) {
  if (!modelId) return "Unknown Model";

  // Remove common prefixes and format
  let label = modelId
    .replace(/^llama-/, "Llama ")
    .replace(/^mixtral-/, "Mixtral ")
    .replace(/-/g, " ")
    .replace(/\b(\d+)(b|B)\b/g, "$1B")
    .replace(/\b(\d+)(k|K)\b/g, "$1K");

  // Handle meta-llama prefix
  if (modelId.startsWith("meta-llama/")) {
    label = modelId.replace(/^meta-llama\//, "").replace(/-/g, " ");
    label = label.replace(/\b(\d+)(b|B)\b/g, "$1B");
  }
  
  // Add helpful descriptions based on model characteristics
  if (modelId.includes("guard")) {
    label += " (Safety/Guard)";
  } else if (modelId.includes("instant")) {
    label += " (Fast)";
  } else if (modelId.includes("versatile")) {
    label += " (High Quality)";
  } else if (modelId.includes("32768") || modelId.includes("large")) {
    label += " (Large Context)";
  } else if (modelId.includes("reasoning")) {
    label += " (Reasoning)";
  } else if (modelId.includes("preview")) {
    label += " (Preview)";
  }

  return label;
}

/**
 * Gets a description for a model
 * @param {string} modelId - Model ID from Groq API
 * @returns {string} Description
 */
export function getModelDescription(modelId) {
  if (!modelId) return "";

  if (modelId.includes("guard")) {
    return "Safety and content moderation model";
  } else if (modelId.includes("instant")) {
    return "Best balance of speed and quality";
  } else if (modelId.includes("versatile")) {
    return "Most powerful - best for Ask Joule (default)";
  } else if (modelId.includes("32768") || modelId.includes("large")) {
    return "Good for complex queries with large context";
  } else if (modelId.includes("reasoning")) {
    return "Optimized for complex reasoning tasks";
  } else if (modelId.includes("preview")) {
    return "Preview model - may have limitations";
  }

  return "Available Groq model";
}

