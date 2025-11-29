// contextResolver.js
// Enhanced pronoun resolution and multi-turn conversation support
// Looks for last interaction to substitute pronouns and handle follow-ups

export function resolvePronouns(text, history) {
  if (!text) return text;
  const lower = text.toLowerCase();

  // Check for follow-up phrases
  if (
    /^(tell me more|explain|more details?|expand|elaborate|why|how so)/i.test(
      lower
    )
  ) {
    // Get the last user question from history
    if (history.length > 0) {
      const lastInteraction = history[history.length - 1];
      if (lastInteraction.raw) {
        return `${lastInteraction.raw} - ${text}`;
      }
    }
    return text;
  }

  // Original pronoun resolution
  if (!/(\bit\b|\bthat\b)/.test(lower)) return text; // nothing to resolve

  let referent = null;
  // Walk history backwards to locate last actionable state
  for (let i = history.length - 1; i >= 0; i--) {
    const h = history[i];
    if (
      h.intent === "setTemperature" ||
      h.intent === "increaseTemperature" ||
      h.intent === "decreaseTemperature"
    ) {
      referent = `temperature`;
      break;
    }
    if (h.intent === "setMode") {
      referent = "mode";
      break;
    }
    // Also check for any recent topic in the response
    if (h.response && i === history.length - 1) {
      // Extract likely topics from the last response
      if (/SEER|efficiency rating/i.test(h.response)) {
        referent = "SEER rating";
        break;
      }
      if (/HSPF|heating efficiency/i.test(h.response)) {
        referent = "HSPF";
        break;
      }
      if (/balance point/i.test(h.response)) {
        referent = "balance point";
        break;
      }
    }
  }

  if (!referent) return text;
  // Replace 'it' or 'that' with referent
  return text.replace(/\b(it|that)\b/gi, referent);
}

export default resolvePronouns;
