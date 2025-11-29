// Parse action buttons from AI responses and execute actions

export function parseActionButtons(responseText) {
  const actions = [];

  // Detect common actionable phrases in responses
  const patterns = [
    {
      regex: /(?:upgrade|replace|change|update).*(?:SEER|HSPF|efficiency)/i,
      action: "updateSettings",
      label: "⚙️ Update Settings",
      params: { page: "/settings" },
    },
    {
      regex: /(?:check|view|see|show).*(?:forecast|weather|temperature)/i,
      action: "navigate",
      label: "🌡️ View Forecast",
      params: { page: "/cost-forecaster" },
    },
    {
      regex: /(?:compare|comparison).*(?:system|furnace|heat pump)/i,
      action: "navigate",
      label: "⚖️ Compare Systems",
      params: { page: "/cost-comparison" },
    },
    {
      regex: /(?:analyze|check|review).*(?:thermostat|data|performance)/i,
      action: "navigate",
      label: "📊 Analyze Performance",
      params: { page: "/performance-analyzer" },
    },
    {
      regex: /(?:schedule|program|set).*(?:thermostat|temperature|setback)/i,
      action: "navigate",
      label: "⏰ Set Schedule",
      params: { page: "/thermostat-analyzer" },
    },
    {
      regex: /(?:calculate|charging|refrigerant|subcool|superheat)/i,
      action: "navigate",
      label: "🧪 Charging Calculator",
      params: { page: "/charging-calculator" },
    },
    {
      regex: /(?:balance point|thermal factor|energy flow)/i,
      action: "navigate",
      label: "📐 Energy Flow",
      params: { page: "/energy-flow" },
    },
  ];

  patterns.forEach((pattern) => {
    if (pattern.regex.test(responseText)) {
      actions.push({
        type: pattern.action,
        label: pattern.label,
        params: pattern.params,
      });
    }
  });

  // Deduplicate by label
  const unique = Array.from(new Map(actions.map((a) => [a.label, a])).values());

  return unique.slice(0, 3); // Max 3 action buttons
}

export function executeAction(action, navigate) {
  const { type, params } = action;

  switch (type) {
    case "navigate":
      if (params.page && navigate) {
        navigate(params.page);
      }
      break;

    case "updateSettings":
      if (params.page && navigate) {
        navigate(params.page);
      }
      break;

    case "share":
      if (params.text && navigator.share) {
        navigator
          .share({
            title: "Ask Joule Response",
            text: params.text,
          })
          .catch(() => {
            // Fallback handled by calling component
          });
      }
      break;

    default:
      console.warn("Unknown action type:", type);
  }
}
