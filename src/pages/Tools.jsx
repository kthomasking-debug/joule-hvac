import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Calculator, Cable, Settings as SettingsIcon, Wrench, FileAudio, Network, FileText, Image, MessageSquare, Server, Chrome, Search, MapPin, Thermometer, Moon, Gauge, X, Zap } from "lucide-react";

/**
 * Tools Index Page
 * Lists all available tools
 */
export default function Tools() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  
  // Tools that require onboarding completion
  const requiresOnboarding = [
    "/tools/heat-pump-vs-gas-furnace",
    "/tools/city-cost-comparison",
  ];
  
  const handleToolClick = (e, toolPath) => {
    // Check if this tool requires onboarding
    if (requiresOnboarding.includes(toolPath)) {
      const hasCompletedOnboarding = localStorage.getItem("hasCompletedOnboarding") === "true";
      
      if (!hasCompletedOnboarding) {
        e.preventDefault();
        navigate("/onboarding");
        return;
      }
    }
  };

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
          color: "green",
        },
        {
          path: "/tools/ecobee-settings-sandbox",
          name: "Ecobee Settings Sandbox",
          label: "Ecobee Settings Sandbox",
          icon: SettingsIcon,
          description: "Virtual playground for Ecobee Premium installation settings and thresholds. See which settings appear/disappear based on equipment configuration.",
          color: "purple",
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
          color: "green",
        },
        {
          path: "/tools/ecobee-aux-heat-simulator",
          name: "Ecobee Aux Heat Simulator",
          label: "Ecobee Aux Heat Simulator",
          icon: Thermometer,
          description: "Interactive simulator for heat pump auxiliary heat decision logic. Shows when aux heat engages based on temperature differentials and system settings.",
          color: "orange",
        },
        {
          path: "/tools/ecobee-replay-last-night",
          name: "Replay Last Night",
          label: "Replay Last Night: Aux Heat Simulator",
          icon: Zap,
          description: "See why 'Aux starts at 40°F' nukes your bill. Compare AUTO vs MANUAL staging thresholds and find the sweet spot where your house still holds setpoint.",
          color: "orange",
        },
        {
          path: "/tools/hvac-static-pressure",
          name: "Static Pressure Analyzer",
          label: "HVAC Static Pressure Analyzer",
          icon: Gauge,
          description: "Analyze how ductwork static pressure affects furnace performance, efficiency, and blower motor lifespan. Interactive tool to understand pressure impact.",
          color: "orange",
        },
        {
          path: "/tools/comfort-setting-strangeness-fix",
          name: "Comfort Setting Strangeness Fix",
          label: "Comfort Setting Strangeness Fix",
          icon: Moon,
          description: "Interactive guide explaining why sensor participation changes early in Ecobee schedules, with simulations and fixes.",
          color: "purple",
        },
      ],
    },
    {
      title: "Cost Comparison",
      description: "Compare costs between systems and locations",
      tools: [
        {
          path: "/tools/heat-pump-vs-gas-furnace",
          name: "Heat Pump vs Gas Furnace Cost",
          label: "Heat Pump vs Gas Furnace Cost",
          icon: Search,
          description: "Compare heat pump vs gas furnace costs for your home and climate. See which system saves you more money based on your utility rates and usage patterns.",
          color: "blue",
        },
        {
          path: "/tools/city-cost-comparison",
          name: "City Cost Comparison",
          label: "City Cost Comparison",
          icon: MapPin,
          description: "Compare heating and cooling costs between different cities and climates. See how location affects your energy bills.",
          color: "green",
        },
      ],
    },
    {
      title: "Troubleshooting & Support",
      description: "Diagnostic tools and support resources",
      comingSoon: true,
      tools: [
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
          color: "blue",
        },
        {
          path: "/tools/bridge-support",
          name: "Bridge Diagnostics",
          label: "Bridge Diagnostics",
          icon: Server,
          description: "Self-service diagnostics and troubleshooting. Check status, view logs, system info, and perform basic maintenance tasks.",
          color: "orange",
        },
      ],
    },
    {
      title: "Electrical",
      description: "Electrical wiring and troubleshooting tools",
      tools: [
        {
          path: "/tools/two-way-switch-explainer",
          name: "Two-Way Switch Explainer",
          label: "Two-Way Switch Explainer",
          icon: Cable,
          description: "Interactive explainer for 3-way switch wiring, phantom voltage, neutral connections, and NEC code references.",
          color: "orange",
        },
        {
          path: "/tools/two-way-switch-wiring-visualizer",
          name: "Two-Way Switch Wiring Visualizer",
          label: "Two-Way Switch Wiring Visualizer",
          icon: Cable,
          description: "Animated visualizer showing 3-way switch contacts, traveler voltage states, ASCII diagrams, induction formulas, and NEC references.",
          color: "orange",
        },
      ],
    },
    {
      title: "Search Engine",
      description: "Search HVAC knowledge base and documentation",
      tools: [
        {
          path: "/tools/knowledge-base-search",
          name: "Knowledge Base Search",
          label: "Search Knowledge Base",
          icon: Search,
          description: "Ask questions about Manual J, load calculations, sizing, or HVAC engineering standards. Includes information from user-uploaded PDFs.",
          color: "purple",
        },
      ],
    },
  ];

  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400",
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
          HVAC calculation, wiring, and troubleshooting tools
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
          <div key={sectionIndex}>
            <div className="mb-4">
              <h2 className={`text-2xl font-semibold mb-1 ${
                section.comingSoon 
                  ? "text-gray-400 dark:text-gray-600" 
                  : "text-gray-900 dark:text-white"
              }`}>
                {section.title}
              </h2>
              <p className={`text-sm ${
                section.comingSoon 
                  ? "text-gray-400 dark:text-gray-600" 
                  : "text-gray-600 dark:text-gray-400"
              }`}>
                {section.description}
              </p>
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
                        handleToolClick(e, tool.path);
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

