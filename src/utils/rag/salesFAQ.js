/**
 * Sales FAQ Knowledge Base
 * Structured presales questions and answers for Ask Joule Sales Engineer capability
 * Used for RAG (Retrieval-Augmented Generation) in Ask Joule
 */

// eBay store URL - update this with your actual eBay store URL when launching
export const EBAY_STORE_URL = "https://www.ebay.com/usr/firehousescorpions";

/**
 * Sales FAQ Database
 * Organized by category for easy maintenance and expansion
 */
export const SALES_FAQ = [
  // Compatibility Questions
  {
    keywords: [
      "nest",
      "google nest",
      "nest thermostat",
      "works with nest",
      "nest learning",
    ],
    question: "Does this work with Nest thermostats?",
    answer:
      "ProStat is purpose-built for the Ecobee architecture. We don't support other thermostats because they don't give us the data fidelity we need to save you money. Ecobee provides robust local HomeKit integration (zero cloud fees), instant CSV downloads, and the data quality our algorithms require. Have a Nest? Join the waitlist - we'll add support if there's enough demand.",
    category: "compatibility",
  },
  {
    keywords: ["honeywell t6", "honeywell", "t6"],
    question: "Does this work with Honeywell T6?",
    answer:
      "ProStat is purpose-built for Ecobee. We focus on Ecobee because it provides superior data fidelity and local HomeKit integration without cloud dependencies. Have a Honeywell? Join the waitlist - we'll add support if there's enough demand (500+ signups).",
    category: "compatibility",
  },
  {
    keywords: [
      "ecobee",
      "works with ecobee",
      "ecobee compatible",
      "ecobee support",
    ],
    question: "Does this work with Ecobee?",
    answer:
      "Yes! ProStat fully supports Ecobee thermostats. The Monitor tier automatically collects daily data from your Ecobee, and the Bridge tier provides full local control via HomeKit.",
    category: "compatibility",
  },
  {
    keywords: ["venstar", "works with venstar", "venstar compatible"],
    question: "Does this work with Venstar thermostats?",
    answer:
      "ProStat is purpose-built for Ecobee. We focus on Ecobee because it provides superior data fidelity. Have a Venstar? Join the waitlist - we'll add support if there's enough demand (500+ signups).",
    category: "compatibility",
  },
  {
    keywords: ["homekit", "siri", "apple homekit", "works with homekit"],
    question: "Does this work with HomeKit and Siri?",
    answer:
      "Yes! The ProStat Bridge tier includes full HomeKit support. You can control your thermostat with Siri voice commands and integrate with Apple Home automations. This works completely offline - no cloud required.",
    category: "compatibility",
  },
  {
    keywords: [
      "internet",
      "offline",
      "no internet",
      "works without internet",
      "no wifi",
    ],
    question: "Does this work without internet?",
    answer:
      "The ProStat Bridge tier works completely offline - no internet or WiFi required. All control and scheduling happens locally. The Monitor tier requires internet for cloud data collection, but the Bridge tier is fully autonomous.",
    category: "compatibility",
  },
  {
    keywords: ["home assistant", "ha", "works with home assistant"],
    question: "Does this work with Home Assistant?",
    answer:
      "The ProStat Bridge exposes a local HomeKit interface, which can be integrated with Home Assistant using the HomeKit Controller integration. This allows full control from Home Assistant.",
    category: "compatibility",
  },

  // Pricing Questions
  {
    keywords: [
      "monthly fee",
      "subscription",
      "monthly cost",
      "recurring",
      "monthly subscription",
    ],
    question: "Is there a monthly subscription fee?",
    answer:
      "No. The ProStat Bridge ($129) is a one-time purchase. It processes data locally on your device, so there are no cloud server costs for us to pass on to you.",
    category: "pricing",
  },
  {
    keywords: ["annual fee", "yearly fee"],
    question: "Is there an annual fee?",
    answer:
      "The Free tier has no fees. The Monitor tier is $20/year (not monthly). The Bridge tier is a one-time purchase of $129 with no recurring fees. Only the Monitor tier has an annual subscription.",
    category: "pricing",
  },
  {
    keywords: ["why", "why is it", "raspberry pi", "just a pi", "expensive"],
    question: "Why is it $129 if it's just a Raspberry Pi?",
    answer:
      "You are paying for the specialized HVAC logic software, the pre-configured OS, the aluminum industrial case, and the plug-and-play convenience. It saves you ~100 hours of coding and setup.",
    category: "pricing",
  },
  {
    keywords: ["free", "free tier", "what's free", "free features"],
    question: "What's included in the free tier?",
    answer:
      "The Free tier includes: Manual CSV upload & analysis, heat loss calculation (BTU/hr/°F), system balance point analysis, efficiency percentile ranking, and CSV export. No automatic monitoring is included in the free tier.",
    category: "pricing",
  },
  {
    keywords: ["cost", "price", "how much", "pricing", "what does it cost"],
    question: "How much does it cost?",
    answer:
      "Free tier: $0 (CSV analyzer). Monitor tier: $20/year (automatic cloud monitoring). Bridge tier: $129 one-time (complete local control with hardware included).",
    category: "pricing",
  },
  {
    keywords: ["refund", "return", "money back", "warranty", "guarantee"],
    question: "What's your refund policy?",
    answer:
      "All purchases are made through eBay, which provides eBay Money Back Guarantee protection. If the item doesn't match the description, you're eligible for a full refund. Please contact us through eBay messaging for any issues.",
    category: "pricing",
  },

  // Hardware Questions
  {
    keywords: [
      "what's in the box",
      "included",
      "comes with",
      "hardware",
      "what do i get",
    ],
    question: "What's included in the box?",
    answer:
      "The ProStat Bridge includes: The Raspberry Pi Zero 2 W unit in a premium aluminum case, a pre-flashed 32GB SD card with ProStat OS, and a USB power cable. You just need a standard USB power brick.",
    category: "hardware",
  },
  {
    keywords: ["warranty", "guarantee", "return policy", "defect"],
    question: "Is there a warranty?",
    answer:
      "Yes, we offer a 30-day return window via eBay Buyer Protection for hardware defects. The software is provided as-is with lifetime updates.",
    category: "hardware",
  },
  {
    keywords: [
      "installation",
      "install",
      "setup",
      "how to install",
      "difficult",
    ],
    question: "How difficult is installation?",
    answer:
      "The ProStat Bridge is designed for DIY installation. It connects to your existing thermostat wiring (standard 24VAC). Step-by-step instructions are included, and we provide support through eBay messaging. Basic electrical knowledge is helpful but not required.",
    category: "hardware",
  },
  {
    keywords: ["raspberry pi", "rpi", "what hardware", "controller"],
    question: "What hardware does the Bridge use?",
    answer:
      "The ProStat Bridge uses a Raspberry Pi-based controller that's pre-configured and ready to use. You don't need to install any software or configure the Pi - it comes fully set up and tested.",
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
    question: "What features does ProStat offer?",
    answer:
      "ProStat provides: Automatic heat loss analysis, efficiency tracking, cost forecasting, thermostat control (Bridge tier), HomeKit integration, offline operation (Bridge tier), and CSV data analysis. Features vary by tier - see the product comparison on the upgrades page.",
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
      "Local control means everything runs on your ProStat Bridge hardware in your home. No data goes to the cloud, no internet required for operation, and you have complete privacy and sovereignty over your system. Schedules and automations run even if your internet goes down.",
    category: "features",
  },
];

/**
 * Detect if a query has sales intent
 * @param {string} query - User's query
 * @returns {boolean} - True if query appears sales-related
 */
export function hasSalesIntent(query) {
  if (!query || typeof query !== "string") return false;

  const lowerQuery = query.toLowerCase();
  const salesKeywords = [
    "buy",
    "purchase",
    "cost",
    "price",
    "pricing",
    "how much",
    "ship",
    "shipping",
    "delivery",
    "refund",
    "return",
    "warranty",
    "works with",
    "compatible",
    "compatibility",
    "support",
    "nest",
    "ecobee",
    "homekit",
    "siri",
    "monthly",
    "fee",
    "subscription",
    "free",
    "what's included",
    "in the box",
    "hardware",
    "install",
    "installation",
    "setup",
    "features",
    "what can it do",
    "capabilities",
    "mini-split",
    "minisplit",
    "discount",
    "bulk",
    "firewall",
    "port",
  ];

  return salesKeywords.some((keyword) => lowerQuery.includes(keyword));
}

/**
 * Search the sales FAQ for matching questions
 * @param {string} query - User's query
 * @returns {Object|null} - Matching FAQ entry or null
 */
export function searchSalesFAQ(query) {
  if (!query || typeof query !== "string") return null;

  const lowerQuery = query.toLowerCase();

  // Score each FAQ entry based on keyword matches
  const scored = SALES_FAQ.map((faq) => {
    const matchCount = faq.keywords.reduce((count, keyword) => {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        return count + 1;
      }
      return count;
    }, 0);

    // Also check if the question text matches
    const questionMatch = lowerQuery.includes(faq.question.toLowerCase())
      ? 2
      : 0;

    return {
      ...faq,
      score: matchCount + questionMatch,
    };
  });

  // Sort by score (highest first) and return the best match
  scored.sort((a, b) => b.score - a.score);

  // Return the best match if it has a score > 0
  return scored[0]?.score > 0 ? scored[0] : null;
}

/**
 * Get a fallback response when no FAQ match is found
 * @returns {string} - Default response directing to eBay
 */
export function getSalesFallbackResponse() {
  return `I don't have the specific answer for that. Please message the lead engineer directly on eBay for a custom response: ${EBAY_STORE_URL}`;
}
