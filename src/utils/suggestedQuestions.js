// Contextual question suggestions for Ask Joule

export const commonQuestions = [
  { text: "Comprehensive analysis", category: "agentic", icon: "🔍" },
  { text: "What can I save?", category: "savings", icon: "💰" },
  { text: "What's my balance point?", category: "analysis", icon: "⚖️" },
  {
    text: "Calculate my charging targets",
    category: "calculator",
    icon: "🧪",
  },
  { text: "What's my heat loss factor?", category: "analysis", icon: "📊" },
  { text: "Compare heat pump vs gas", category: "comparison", icon: "⚡" },
  { text: "Setback savings calculator", category: "calculator", icon: "💡" },
  { text: "What's my system efficiency?", category: "analysis", icon: "📈" },
  {
    text: "How much will heating cost this month?",
    category: "forecast",
    icon: "📅",
  },
  { text: "What's my thermal factor?", category: "analysis", icon: "🌡️" },
  {
    text: "Should I upgrade my system?",
    category: "recommendation",
    icon: "💡",
  },
  {
    text: "What's the best temperature for sleep?",
    category: "comfort",
    icon: "😴",
  },
  {
    text: "How do I prevent short cycling?",
    category: "troubleshooting",
    icon: "⚠️",
  },
  {
    text: "What's my ROI on a new heat pump?",
    category: "savings",
    icon: "💵",
  },
  { text: "When should I use aux heat?", category: "operation", icon: "🔥" },
  {
    text: "What's my energy flow breakdown?",
    category: "analysis",
    icon: "📊",
  },
  {
    text: "How do I optimize my schedule?",
    category: "optimization",
    icon: "⏰",
  },
];

export const pageSpecificQuestions = {
  "/": [
    { text: "Comprehensive analysis", icon: "🔍" },
    { text: "What can I save this month?", icon: "💰" },
    { text: "Show my energy flow", icon: "📊" },
    { text: "How efficient is my system?", icon: "⚡" },
  ],
  "/cost-forecaster": [
    { text: "Cost forecast for next week", icon: "📅" },
    { text: "What will heating cost this week?", icon: "🌡️" },
    { text: "When should I switch to aux heat?", icon: "🔥" },
    { text: "What's the coldest day predicted?", icon: "❄️" },
  ],
  "/cost-comparison": [
    { text: "Analyze my system costs", icon: "🔍" },
    { text: "Which system saves more money?", icon: "💵" },
    { text: "What's the ROI of upgrading to 18 SEER?", icon: "📈" },
    { text: "Compare my current vs new system", icon: "⚖️" },
  ],
  "/energy-flow": [
    { text: "Full system analysis", icon: "🔍" },
    { text: "What's my balance point?", icon: "⚖️" },
    { text: "How much energy goes to heating?", icon: "🔥" },
    { text: "Explain my thermal factor", icon: "📐" },
  ],
  "/charging-calculator": [
    { text: "Calculate charging for R-410A at 85°F", icon: "🧪" },
    { text: "What's target subcooling for R-32?", icon: "🎯" },
    { text: "Check superheat targets", icon: "📏" },
  ],
  "/performance-analyzer": [
    { text: "Analyze my system performance", icon: "🔍" },
    { text: "What's my heat loss factor?", icon: "📊" },
    { text: "Calculate system performance", icon: "⚡" },
    { text: "Show my thermal factor", icon: "📐" },
  ],
  "/thermostat-analyzer": [
    { text: "All my savings opportunities", icon: "💰" },
    { text: "Calculate setback savings", icon: "💰" },
    { text: "What's the best sleep setback?", icon: "😴" },
    { text: "Optimize my schedule", icon: "⏰" },
  ],
  "/settings": [
    { text: "Set my location to Denver", icon: "📍" },
    { text: "Update my SEER to 16", icon: "⚡" },
    { text: "Change utility cost to $0.12/kWh", icon: "💵" },
  ],
  "/checkout": [
    { text: "Is this a real company?", icon: "🏢" },
    { text: "Where do you ship from?", icon: "📍" },
    { text: "Is there a subscription?", icon: "💰" },
    { text: "Does it work with HomeKit?", icon: "🍎" },
    { text: "What is the return policy?", icon: "↩️" },
    { text: "Does it need a C-Wire?", icon: "🔌" },
    { text: "Do you have a phone number?", icon: "📞" },
    { text: "Does it work with 5GHz WiFi?", icon: "📶" },
    { text: "Can I use it with Home Assistant?", icon: "🏠" },
    { text: "Are these just 3D printed?", icon: "🏭" },
  ],
  "/upgrades": [
    { text: "Is there a subscription?", icon: "💰" },
    { text: "What thermostats are compatible?", icon: "🔌" },
    { text: "Do you ship to Canada?", icon: "📍" },
    { text: "What's included in the box?", icon: "📦" },
    { text: "Is there a monthly fee?", icon: "💳" },
    { text: "Does it work with HomeKit?", icon: "🍎" },
    { text: "What is the return policy?", icon: "↩️" },
    { text: "How difficult is installation?", icon: "🔧" },
  ],
  "/control/thermostat": [
    { text: "What's the status?", icon: "📊" },
    { text: "What's the current temperature?", icon: "🌡️" },
    { text: "Is the system running?", icon: "⚡" },
    { text: "What's the current mode?", icon: "🔄" },
    { text: "What's the target temperature?", icon: "🎯" },
    { text: "What's my system efficiency?", icon: "📈" },
    { text: "How much will heating cost this month?", icon: "📅" },
    { text: "What's my balance point?", icon: "⚖️" },
    { text: "What's the best temperature for sleep?", icon: "😴" },
    { text: "How do I prevent short cycling?", icon: "⚠️" },
    { text: "When should I use aux heat?", icon: "🔥" },
    { text: "How do I optimize my schedule?", icon: "⏰" },
    { text: "What can I save?", icon: "💰" },
    { text: "What's my heat loss factor?", icon: "📊" },
  ],
};

export function getSuggestedQuestions(pathname = "/") {
  // Return page-specific questions if available, otherwise common questions
  const pageQuestions = pageSpecificQuestions[pathname] || [];

  if (pageQuestions.length > 0) {
    return pageQuestions;
  }

  // Return a random subset of common questions
  return commonQuestions.slice(0, 3);
}

export function getRandomTip() {
  const tips = [
    "🔍 Try 'Comprehensive analysis' to run all tools at once",
    "💡 Ask me to calculate your balance point",
    "🧪 I can calculate A/C charging targets for any refrigerant",
    "📊 Try 'What's my heat loss factor?' for performance metrics",
    "⚡ Ask me to compare heat pump vs gas costs",
    "🌡️ I can estimate heating costs from weather forecasts",
    "🎯 Say 'Calculate setback savings' for thermostat strategies",
    "📈 Ask about your system's thermal factor",
    "💰 Say 'All my savings' to see every savings opportunity",
    "📅 Ask for a 'cost forecast' to predict next week's bills",
  ];

  return tips[Math.floor(Math.random() * tips.length)];
}
