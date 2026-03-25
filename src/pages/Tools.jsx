import React, { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { Calculator, Cable, Settings as SettingsIcon, Wrench, FileAudio, Network, FileText, Image, MessageSquare, Server, Chrome, Search, MapPin, Thermometer, Moon, Gauge, X, Zap, CloudSnow, Monitor, Droplets, Coffee, Pill } from "lucide-react";

const sections = [
  {
    title: "HVAC Calculation & Sizing",
    description: "Tools for calculating heating and cooling loads",
    tools: [
      {
        path: "/tools/energyplus",
        name: "EnergyPlus Load Calc",
        label: "EnergyPlus Load Calculator",
        icon: Calculator,
        description: "ACCA Manual J-compliant load calcs using DOE EnergyPlus. Get your BTUs, tons, and sizing right the first time. No more guessing on SEER, HSPF, or AFUE ratings.",
        color: "blue",
      },
      {
        path: "/tools/ecobee-transition-planner",
        name: "Ecobee Planner",
        label: "Ecobee Planner",
        icon: Thermometer,
        description: "Visualize Ecobee schedule transitions to avoid immediate restarts. Plan your thermostat schedules to prevent short cycling and optimize comfort.",
        color: "blue",
      },
      {
        path: "/tools/ecobee-settings-sandbox",
        name: "Ecobee Settings Sandbox",
        label: "Ecobee Settings Sandbox",
        icon: SettingsIcon,
        description: "Virtual playground for Ecobee Premium installation settings and thresholds. See which settings appear/disappear based on equipment configuration.",
        color: "blue",
      },
      {
        path: "/tools/ecobee-equipment-matrix",
        name: "Ecobee Equipment Matrix",
        label: "Ecobee Equipment Matrix",
        icon: Cable,
        description: "Equipment configuration matrix with wiring diagrams for Ecobee Premium. Shows common setups, required terminals, and ASCII wiring diagrams.",
        color: "blue",
      },
      {
        path: "/tools/ecobee-ventilator-explainer",
        name: "Ecobee Ventilator Explainer",
        label: "Ecobee Ventilator Explainer",
        icon: Thermometer,
        description: "Interactive explainer for whole-home ventilator control with Ecobee Premium. Wiring diagrams, relay simulator, and settings navigation.",
        color: "blue",
      },
      {
        path: "/tools/ecobee-aux-heat-simulator",
        name: "Ecobee Aux Heat Simulator",
        label: "Ecobee Aux Heat Simulator",
        icon: Thermometer,
        description: "Interactive simulator for heat pump auxiliary heat decision logic. Shows when aux heat engages based on temperature differentials and system settings.",
        color: "blue",
      },
      {
        path: "/tools/ecobee-replay-last-night",
        name: "Replay Last Night",
        label: "Replay Last Night: Aux Heat Simulator",
        icon: Zap,
        description: "See why 'Aux starts at 40°F' nukes your bill. Compare AUTO vs MANUAL staging thresholds and find the sweet spot where your house still holds setpoint.",
        color: "blue",
      },
      {
        path: "/tools/hvac-static-pressure",
        name: "Static Pressure Analyzer",
        label: "HVAC Static Pressure Analyzer",
        icon: Gauge,
        description: "Analyze how ductwork static pressure affects furnace performance, efficiency, and blower motor lifespan. Interactive tool to understand pressure impact.",
        color: "blue",
      },
      {
        path: "/tools/comfort-setting-strangeness-fix",
        name: "Comfort Setting Strangeness Fix",
        label: "Comfort Setting Strangeness Fix",
        icon: Moon,
        description: "Interactive guide explaining why sensor participation changes early in Ecobee schedules, with simulations and fixes.",
        color: "blue",
      },
    ],
  },
  {
    title: "Troubleshooting & Support",
    description: "Diagnostic tools and support resources",
    tools: [
      {
        path: "/tools/ecobee-frost-control-fix",
        name: "Ecobee Frost Control Fix",
        label: "Ecobee Frost Control Missing?",
        icon: Thermometer,
        description: "Fix for Ecobee thermostat frost control settings disappearing. Interactive guide to resolve the AC Overcooling bug.",
        color: "orange",
      },
      {
        path: "/tools/hvac-troubleshooting",
        name: "HVAC Troubleshooting",
        label: "HVAC Troubleshooting",
        icon: Wrench,
        description: "Step-by-step troubleshooting guides for common HVAC problems. Short cycling, no heat, frozen coils, pressure switch issues - we got you covered.",
        color: "orange",
      },
      {
        path: "/tools/support-ticket",
        name: "Support Ticket",
        label: "Support Ticket",
        icon: MessageSquare,
        description: "Submit a support ticket with diagnostic information. Get help with your Joule HVAC system, bridge connection issues, or any other problems.",
        color: "orange",
      },
      {
        path: "/tools/bridge-support",
        name: "Bridge Diagnostics",
        label: "Bridge Diagnostics",
        icon: Server,
        description: "Self-service diagnostics and troubleshooting. Check status, view logs, system info, and perform basic maintenance tasks.",
        color: "orange",
      },
      {
        path: "/tools/eink-bridge-display",
        name: "Pi E-Ink Display",
        label: "Pi E-Ink Bridge Display",
        icon: Monitor,
        description: "See exactly what the Pi Zero 2 W Waveshare e-paper shows, with live bridge data and the same Status/Actions/Guide navigation.",
        color: "orange",
      },
    ],
  },
  {
    title: "Electrical & Wiring",
    description: "Electrical calculations, wire sizing, and wiring visualizers",
    tools: [
      {
        path: "/tools/generator-calculator",
        name: "Generator Fuel & Cost",
        label: "Generator Fuel & Cost Estimator",
        icon: Droplets,
        description: "Estimate Kohler 14/20 RESA propane burn rate, daily cost, and savings with interval runtime.",
        color: "amber",
      },
      {
        path: "/tools/hot-tub-wire-calculator",
        name: "Hot Tub Wire Calculator",
        label: "Hot Tub Wire Size Calculator",
        icon: Zap,
        description: "Calculate wire gauge requirements and voltage drop for hot tub installations. Verify if existing wire meets NEC code requirements.",
        color: "amber",
      },
      {
        path: "/tools/two-way-switch-wiring-visualizer",
        name: "Two-Way Switch Wiring Visualizer",
        label: "Two-Way Switch Wiring Visualizer",
        icon: Cable,
        description: "Animated visualizer showing 3-way switch contacts, traveler voltage states, ASCII diagrams, induction formulas, and NEC references.",
        color: "amber",
      },
      {
        path: "/tools/thermostat-wiring-helper",
        name: "Thermostat Wiring Helper",
        label: "Thermostat Wiring Helper",
        icon: Cable,
        description: "Interactive Ecobee wiring diagnostic to restore heat mode: identify missing W/O/B connections, system type, and safety steps.",
        color: "amber",
      },
      {
        path: "/tools/bosch-zoning-sim",
        name: "Bosch Zoning Simulator",
        label: "Bosch Zoning Simulator",
        icon: Cable,
        description: "Understand how Bosch inverter systems interact with Ecobee differential thresholds. Prevent fan-only standby cycles.",
        color: "amber",
      },
    ],
  },
  {
    title: "Data & Resources",
    description: "Knowledge base search, weather forecasts, and reference data",
    tools: [
      {
        path: "/tools/knowledge-base-search",
        name: "Knowledge Base Search",
        label: "Search Knowledge Base",
        icon: Search,
        description: "Ask questions about Manual J, load calculations, sizing, or HVAC engineering standards. Includes information from user-uploaded PDFs.",
        color: "sky",
      },
      {
        path: "/tools/snowfall-forecast",
        name: "NWS Snowfall Forecast",
        label: "Snowfall Forecast",
        icon: CloudSnow,
        description: "7-day snowfall forecast from the National Weather Service. View predicted snowfall amounts and probabilities for your location.",
        color: "sky",
      },
    ],
  },
];

const sectionStyles = {
  "HVAC Calculation & Sizing": {
    shell: "border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/15",
    title: "text-blue-900 dark:text-blue-100",
    description: "text-blue-700 dark:text-blue-300",
    badge: "border-blue-300 dark:border-blue-700 bg-blue-100/80 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  },
  "Troubleshooting & Support": {
    shell: "border-orange-200 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/15",
    title: "text-orange-900 dark:text-orange-100",
    description: "text-orange-700 dark:text-orange-300",
    badge: "border-orange-300 dark:border-orange-700 bg-orange-100/80 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  },
  "Electrical & Wiring": {
    shell: "border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/15",
    title: "text-amber-900 dark:text-amber-100",
    description: "text-amber-700 dark:text-amber-300",
    badge: "border-amber-300 dark:border-amber-700 bg-amber-100/80 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
  },
  "Data & Resources": {
    shell: "border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/15",
    title: "text-sky-900 dark:text-sky-100",
    description: "text-sky-700 dark:text-sky-300",
    badge: "border-sky-300 dark:border-sky-700 bg-sky-100/80 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300",
  },
};

/**
 * Tools Index Page
 * Lists all available tools
 */
export default function Tools() {
  const [searchQuery, setSearchQuery] = useState("");

  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400",
    amber: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30 text-amber-600 dark:text-amber-400",
    sky: "bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700 hover:bg-sky-100 dark:hover:bg-sky-900/30 text-sky-600 dark:text-sky-400",
  };

  // Flatten all tools and filter based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return sections;
    }

    const query = searchQuery.toLowerCase();
    return sections
      .map((section) => ({
        ...section,
        tools: section.tools.filter((tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.label.toLowerCase().includes(query) ||
          tool.description.toLowerCase().includes(query)
        ),
      }))
      .filter((section) => section.tools.length > 0);
  }, [searchQuery, sections]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Tools
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          HVAC calculation, wiring, troubleshooting, and wellness tools
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tools by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              title="Clear search"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
        {searchQuery && filteredSections.length === 0 && (
          <p className="text-gray-600 dark:text-gray-400 mt-4 text-center">
            No tools found matching "{searchQuery}". Try a different search term.
          </p>
        )}
      </div>

      <div className="space-y-12">
        {filteredSections.map((section, sectionIndex) => (
          <div
            key={sectionIndex}
            className={`rounded-2xl border p-5 ${sectionStyles[section.title]?.shell || "border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/20"}`}
          >
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <div>
                <h2 className={`text-2xl font-semibold mb-1 ${
                  section.comingSoon
                    ? "text-gray-400 dark:text-gray-600"
                    : sectionStyles[section.title]?.title || "text-gray-900 dark:text-white"
                }`}>
                  {section.title}
                </h2>
                <p className={`text-sm ${
                  section.comingSoon
                    ? "text-gray-400 dark:text-gray-600"
                    : sectionStyles[section.title]?.description || "text-gray-600 dark:text-gray-400"
                }`}>
                  {section.description}
                </p>
              </div>
              <span className={`ml-auto inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${sectionStyles[section.title]?.badge || "border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"}`}>
                {section.tools.length} tool{section.tools.length === 1 ? "" : "s"}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {section.tools.map((tool) => {
                const Icon = tool.icon;
                const isComingSoon = section.comingSoon;
                return (
                  <Link
                    key={tool.path}
                    to={isComingSoon ? "#" : tool.path}
                    onClick={(e) => {
                      if (isComingSoon) {
                        e.preventDefault();
                      } else {
                        return;
                      }
                    }}
                    className={`block rounded-lg border p-6 transition-all ${
                      isComingSoon
                        ? "opacity-50 cursor-not-allowed border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50"
                        : `hover:shadow-lg ${colorClasses[tool.color]}`
                    }`}
                    title={isComingSoon ? "Coming Soon" : tool.description}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg border ${
                        isComingSoon
                          ? "bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700"
                          : `bg-white dark:bg-gray-800 ${colorClasses[tool.color].split(' ')[0]}`
                      }`}>
                        <Icon className={`w-6 h-6 ${
                          isComingSoon
                            ? "text-gray-400 dark:text-gray-600"
                            : ""
                        }`} />
                      </div>
                      <div className="flex-1">
                        <h3 className={`text-xl font-semibold mb-2 ${
                          isComingSoon
                            ? "text-gray-400 dark:text-gray-600"
                            : "text-gray-900 dark:text-white"
                        }`}>
                          {tool.label}
                        </h3>
                        <p className={`text-sm ${
                          isComingSoon
                            ? "text-gray-400 dark:text-gray-600"
                            : "text-gray-600 dark:text-gray-400"
                        }`}>
                          {tool.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

