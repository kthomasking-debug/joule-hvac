/**
 * Sales FAQ Knowledge Base
 * Structured presales questions and answers for Ask Joule Sales Engineer capability
 * Used for RAG (Retrieval-Augmented Generation) in Ask Joule
 */

// eBay store URL - update this with your actual eBay store URL when launching
export const EBAY_STORE_URL = "https://www.ebay.com/usr/firehousescorpions";

/**
 * Sales FAQ – written like a friend who knows HVAC and hates subscriptions
 */
export const SALES_FAQ = [
  // Compatibility – the questions everyone asks first
  {
    keywords: ["nest", "google nest", "nest thermostat", "works with nest"],
    question: "Will this work with my Google Nest?",
    answer:
      "Not yet — and I'll tell you exactly why so it doesn't feel like a dodge. Nest only allows control through their cloud (which adds 3–12 seconds of delay). Joule protects your compressor with millisecond-accurate logic, so we currently only support Ecobee's local HomeKit API. A cloud-bridge version for Nest (and others) is on the roadmap for 2026. If you have a Nest and want to be notified the second it lands, drop your email on the waitlist — no spam, I promise.",
    category: "compatibility",
  },
  {
    keywords: ["honeywell", "t6", "t9", "t10"],
    question: "What about Honeywell (T6, T9, etc.)?",
    answer:
      "Same story as Nest — Honeywell's API is cloud-only and too slow for the short-cycle protection we're religious about. Ecobee is currently the only thermostat that lets us run everything locally and instantly. Honeywell support is also planned for the 2026 cloud-bridge version.",
    category: "compatibility",
  },
  {
    keywords: ["ecobee", "works with ecobee", "ecobee compatible"],
    question: "So it definitely works with Ecobee?",
    answer:
      "100%. Every Ecobee model with HomeKit support is fully compatible. Monitor tier = automatic daily data pull. Bridge tier = full local control, Siri, HomeKit automations, works even if the internet dies.",
    category: "compatibility",
  },
  {
    keywords: ["homekit", "siri", "apple home", "apple homekit"],
    question: "Does it work with Apple HomeKit and Siri?",
    answer:
      "Yes and it's glorious. The Bridge shows up as a native HomeKit device. \"Hey Siri, set the living room to 72\" works instantly and completely offline. No cloud, no lag, no creepy listening.",
    category: "compatibility",
  },
  {
    keywords: ["internet", "offline", "no wifi", "works without internet"],
    question: "Will it still work if my internet goes down?",
    answer:
      "Bridge tier = yes, 100% offline after initial setup. Schedules, short-cycle protection, Siri — everything keeps running. Monitor tier needs internet for the daily cloud sync, but the Bridge literally doesn't care if the apocalypse takes out the ISP.",
    category: "compatibility",
  },
  {
    keywords: ["home assistant", "ha"],
    question: "Can I use this with Home Assistant?",
    answer:
      "Absolutely. The Bridge exposes a proper local HomeKit device, so just add the HomeKit Controller integration in HA and you get full read/write access. A lot of us on the team run HA ourselves.",
    category: "compatibility",
  },

  // Money – the part everyone is afraid to ask
  {
    keywords: ["price", "cost", "how much", "pricing"],
    question: "Okay, but how much is it actually?",
    answer:
      "• Free tier → $0 forever (manual CSV analysis)\n• Monitor tier → $20/year (auto daily data from Ecobee)\n• Bridge tier → $129 one-time (hardware + full local control, no subscription ever)\nThat's it. No surprise fees, no \"pro plan\" upsell later.",
    category: "pricing",
  },
  {
    keywords: ["subscription", "monthly", "recurring", "hidden fee"],
    question: "Please tell me there's no subscription...",
    answer:
      "I hate subscriptions too. The Bridge is a true one-time $129 purchase. You own it, you keep it, updates are free forever. The only subscription in the entire product line is the optional $20/year Monitor tier if you want automatic cloud graphs without lifting a finger.",
    category: "pricing",
  },
  {
    keywords: ["why", "expensive", "just a pi", "raspberry pi zero"],
    question: "It's literally a Raspberry Pi — why $129?",
    answer:
      "Fair question! You're paying for ~150 hours of obsessive HVAC control logic, bulletproof short-cycle protection, a custom real-time OS image, an industrial aluminum case that doesn't melt, and the fact that it just works out of the box. If you're a tinkerer who wants to spend three weekends writing your own, more power to you — but most people tell us the $129 is cheaper than their time.",
    category: "pricing",
  },
  {
    keywords: ["refund", "return", "money back"],
    question: "What if I don't like it?",
    answer:
      "eBay Money Back Guarantee has you covered for 30 days. If it doesn't do what we say, send it back — full refund, no restocking fee, no weird questions. We've got 100% positive feedback so far because we actually stand behind it.",
    category: "pricing",
  },

  // Hardware & Shipping – remove the fear
  {
    keywords: ["box", "included", "comes with", "what do i get"],
    question: "What actually shows up at my door?",
    answer:
      "• Raspberry Pi Zero 2 W in a machined aluminum case (looks legit, not 3D-printed)\n• Pre-flashed 32GB SD card with Joule OS\n• USB-C power cable\nJust add any 5V USB phone charger you already own. Ten-minute setup, no soldering, no swearing.",
    category: "hardware",
  },
  {
    keywords: ["install", "installation", "setup", "hard"],
    question: "Is installation scary?",
    answer:
      "If you can swap a light switch, you can install Joule. It wires into the same 24V thermostat wires your Ecobee is already using. Color-coded guide, pictures, and I personally answer eBay messages within a few hours if you get stuck.",
    category: "hardware",
  },

  // Shipping Questions
  {
    keywords: [
      "ship",
      "shipping",
      "delivery",
      "how long",
      "when will it arrive",
    ],
    question: "How long does shipping take?",
    answer:
      "Shipping times vary by location. We ship from the United States. Domestic orders typically arrive in 3-7 business days. International shipping times vary. Check the eBay listing for specific shipping options and estimated delivery dates.",
    category: "shipping",
  },
  {
    keywords: ["canada", "ship to canada", "international", "outside us"],
    question: "Do you ship to Canada?",
    answer:
      "Yes, we ship internationally including Canada. Shipping costs and delivery times will be calculated at checkout on eBay. International buyers are responsible for any customs duties or import fees.",
    category: "shipping",
  },
  {
    keywords: ["international shipping", "outside usa", "europe", "uk"],
    question: "Do you ship internationally?",
    answer:
      "We currently ship to the US and Canada via eBay's Global Shipping Program. For other international orders, please check the eBay listing for availability.",
    category: "shipping",
  },
  {
    keywords: ["australia", "ship to australia"],
    question: "Do you ship to Australia?",
    answer:
      "We currently ship to the US and Canada via eBay's Global Shipping Program. For other international orders, please check the eBay listing for availability.",
    category: "shipping",
  },

  // Features Questions
  {
    keywords: ["features", "what can it do", "capabilities", "what does it do"],
    question: "What features does Joule offer?",
    answer:
      "Joule provides: Automatic heat loss analysis, efficiency tracking, cost forecasting, thermostat control (Bridge tier), HomeKit integration, offline operation (Bridge tier), and CSV data analysis. Features vary by tier - see the product comparison on the upgrades page.",
    category: "features",
  },
  {
    keywords: ["monitoring", "automatic", "daily", "data collection"],
    question: "How does automatic monitoring work?",
    answer:
      "The Monitor tier automatically collects daily data from your Ecobee thermostat via the cloud API. This data is analyzed to track heat loss trends, efficiency scores, and system performance over time. No manual CSV uploads needed.",
    category: "features",
  },
  {
    keywords: ["local control", "offline", "no cloud", "privacy"],
    question: "What does 'local control' mean?",
    answer:
      "Local control means everything runs on your Joule Bridge hardware in your home. No data goes to the cloud, no internet required for operation, and you have complete privacy and sovereignty over your system. Schedules and automations run even if your internet goes down.",
    category: "features",
  },
  {
    keywords: ["gaming", "gaming rig", "gaming pc", "gpu", "gtx 1650", "nvidia", "local llm", "run on my pc"],
    question: "Can I run the AI on my gaming PC?",
    answer:
      "Yes! The app runs on the Pi 24/7 — forecasts, thermostat control, dashboards. When your gaming rig is on, run Ollama and Joule uses your GPU for Ask Joule and the bill auditor. Minimum: GTX 1650 (4 GB) or RX 6400 (4 GB). Recommended: RTX 3060 (8 GB) or RX 6600 XT (8 GB). No Groq API key when the PC is on. When it's off, use Groq or just the forecasts.",
    category: "features",
  },

  // Trust & Scam-Worry Busters
  {
    keywords: ["scam", "legit", "real company", "trust"],
    question: "Is this actually real or just some guy in a garage?",
    answer:
      "Real company, real humans, real 100% positive eBay feedback. We ship from Georgia, USA. Every unit is built, flashed, and tested by me (yes, literally me) before it goes in the box. Buy with confidence — eBay's buyer protection has your back.",
    category: "trust",
  },
  {
    keywords: ["phone", "call", "telephone"],
    question: "Can I actually talk to a human?",
    answer:
      "eBay messages or email is how we keep response times under a few hours (and keep a paper trail). I answer every single message myself — usually while drinking coffee and watching compressor runtimes.",
    category: "support",
  },

  {
    keywords: ["c-wire", "c wire", "common wire"],
    question: "Do I need a C-wire?",
    answer:
      "Your Ecobee needs one (you probably already have it). The Joule Bridge itself just wants a USB wall wart — zero vampire draw, zero wiring headaches.",
    category: "technical",
  },
  {
    keywords: ["5ghz", "5g wifi", "only 5ghz"],
    question: "My router is 5GHz only — am I screwed?",
    answer:
      "Nope! Almost every \"5GHz only\" router still broadcasts 2.4GHz — it's usually just hidden. I'll walk you through unhiding the 2.4GHz SSID in 30 seconds, or you can use your phone's hotspot for setup and then forget it.",
    category: "technical",
  },
  {
    keywords: [
      "home assistant",
      "ha",
      "works with home assistant",
      "home assistant integration",
    ],
    question: "Can I use it with Home Assistant?",
    answer:
      "Yes! The Joule Bridge exposes a local API you can tap into. It also works as a HomeKit Controller, which can be integrated with Home Assistant using the HomeKit Controller integration for full control.",
    category: "compatibility",
  },
  {
    keywords: [
      "apple homekit",
      "homekit",
      "siri",
      "apple home",
      "works with homekit",
    ],
    question: "Does it work with Apple HomeKit?",
    answer:
      "Yes, it acts as a HomeKit Controller. You can control your Ecobee thermostat through Apple Home app, Siri voice commands, and HomeKit automations. This works completely offline with no cloud required.",
    category: "compatibility",
  },

  // Pre-Sale Objections - Money Questions
  {
    keywords: [
      "subscription",
      "monthly subscription",
      "yearly subscription",
      "recurring",
      "monthly fee",
      "annual fee",
      "ongoing cost",
    ],
    question: "Is there a subscription?",
    answer:
      "NO. One-time purchase. The Joule Bridge is $129 with no recurring fees, no subscriptions, and no monthly costs. Once you buy it, you own it completely. Software updates are included at no additional charge.",
    category: "pricing",
  },
  {
    keywords: [
      "return policy",
      "returns",
      "can i return",
      "return window",
      "refund policy",
      "money back",
    ],
    question: "What is the return policy?",
    answer:
      "30 Days via eBay. All purchases are covered by eBay's Money Back Guarantee. If you're not satisfied, you can return the item within 30 days for a full refund. Contact us through eBay messages to initiate a return.",
    category: "pricing",
  },
  {
    keywords: [
      "bulk discount",
      "bulk pricing",
      "multiple units",
      "discount",
      "deal",
      "special pricing",
    ],
    question: "Do you offer bulk discounts?",
    answer:
      "Message us. For bulk orders (typically 5+ units), we can offer volume discounts. Please contact us through eBay messages with your quantity and we'll provide a custom quote.",
    category: "pricing",
  },

  // Comparison – why this instead of X
  {
    keywords: ["ecobee app", "why not just use ecobee", "ecobee enough"],
    question: "Why not just stick with the Ecobee app?",
    answer:
      "Ecobee's app is great for basic control, but it will happily let your compressor short-cycle itself to death. Joule stops that cold (pun intended) with sub-second local logic. Also: works offline, better schedules, no cloud dependency, and I don't sell your data.",
    category: "comparison",
  },

  // Gentle upsell / fallback
  {
    keywords: [], // catch-all for anything not matched above
    question: "I still have a weird question...",
    answer:
      `Fire it at me! I answer every single eBay message personally and way too fast. Hit the "Contact seller" button here: ${EBAY_STORE_URL}`,
    category: "support",
  },
];

/**
 * Detect if a query has sales intent
 * @param {string} query - User's query
 * @returns {boolean} - True if query appears sales-related
 */
export function hasSalesIntent(query) {
  if (!query || typeof query !== "string") return false;

  const q = query.toLowerCase();

  // Explicitly ignore energy-bill questions — those belong to the fun HVAC Joule, not sales
  const energyBillBlocklist = [
    /bill.*(?:heat|cool|energy|electric)/i,
    /cost.*(?:this month|this year)/i,
  ];
  if (energyBillBlocklist.some((p) => p.test(q))) return false;

  const salesTriggers = [
    "buy",
    "purchase",
    "price",
    "cost",
    "ship",
    "refund",
    "return",
    "warranty",
    "compatible",
    "nest",
    "ecobee",
    "homekit",
    "subscription",
    "install",
    "c-?wire",
    "5ghz",
    "scam",
    "real",
    "how much",
    "box",
    "include",
    "gaming",
    "gaming pc",
    "gpu",
    "gtx",
  ];

  return salesTriggers.some((trigger) => q.includes(trigger));
}

export function searchSalesFAQ(query) {
  if (!query) return null;

  const lower = query.toLowerCase();

  const matches = SALES_FAQ.map((faq) => {
    let score = 0;
    for (const kw of faq.keywords) {
      if (lower.includes(kw)) score += 2;
    }
    if (lower.includes(faq.question.toLowerCase().slice(0, 30)))
      score += 5; // strong question match
    return { faq, score };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  return matches[0]?.faq || null;
}

export function getSalesFallbackResponse() {
  return `That one's too specific for the FAQ — but I love weird questions. Message me directly on eBay (I usually reply in <2 hours, even on weekends): ${EBAY_STORE_URL}`;
}
