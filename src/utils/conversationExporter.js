// Conversation export and sharing utilities for Ask Joule

export function exportConversationToJSON(history, userSettings = {}) {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: "1.0",
    userSettings: {
      location: userSettings.location || null,
      systemType: userSettings.primarySystem || null,
      seer: userSettings.efficiency || null,
      hspf: userSettings.hspf2 || null,
    },
    conversation: history.map((item) => ({
      timestamp: item.ts ? new Date(item.ts).toISOString() : null,
      intent: item.intent || "unknown",
      userInput: item.raw || "",
      response: item.response || "",
    })),
  };

  return JSON.stringify(exportData, null, 2);
}

export function exportConversationToText(history) {
  const lines = ["Ask Joule Conversation Export", "=".repeat(40), ""];

  history.forEach((item, idx) => {
    const timestamp = item.ts
      ? new Date(item.ts).toLocaleString()
      : "Unknown time";
    lines.push(`[${idx + 1}] ${timestamp}`);
    if (item.raw) lines.push(`Q: ${item.raw}`);
    if (item.response) lines.push(`A: ${item.response}`);
    lines.push("");
  });

  lines.push("=".repeat(40));
  lines.push(`Exported: ${new Date().toLocaleString()}`);

  return lines.join("\n");
}

export function downloadConversation(
  content,
  filename,
  mimeType = "text/plain"
) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }

  // Fallback for older browsers
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand("copy");
  document.body.removeChild(textarea);

  return success ? Promise.resolve() : Promise.reject(new Error("Copy failed"));
}

export function generateShareableURL(
  history,
  baseURL = window.location.origin
) {
  // Create a compressed version of the conversation for URL sharing
  const summary = history.slice(-3).map((item) => ({
    q: item.raw?.substring(0, 100),
    a: item.response?.substring(0, 200),
  }));

  const encoded = encodeURIComponent(JSON.stringify(summary));
  return `${baseURL}/ask-joule?shared=${encoded}`;
}
