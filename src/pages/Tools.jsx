import React from "react";
import { Link } from "react-router-dom";
import { Calculator, Cable, Settings as SettingsIcon, Wrench, FileAudio, Network, FileText, Image, MessageSquare, Server } from "lucide-react";

/**
 * Tools Index Page
 * Lists all available tools
 */
export default function Tools() {
  const tools = [
    {
      path: "/tools/energyplus",
      name: "EnergyPlus Load Calc",
      label: "EnergyPlus Load Calculator",
      icon: Calculator,
      description: "ACCA Manual J-compliant load calcs using DOE EnergyPlus. Get your BTUs, tons, and sizing right the first time. No more guessing on SEER, HSPF, or AFUE ratings.",
      color: "blue",
    },
    {
      path: "/tools/wiring-diagram",
      name: "Wiring Diagram Generator",
      label: "Wiring Diagram Generator",
      icon: Cable,
      description: "Generate ASCII wiring diagrams for Ecobee thermostat installs. Handles PEK setups, heat pump configs, conventional systems, and all that jazz. No C-wire? No problem.",
      color: "green",
    },
    {
      path: "/tools/equipment-settings",
      name: "Equipment Settings Guide",
      label: "Equipment Settings Guide",
      icon: SettingsIcon,
      description: "Answers to equipment compatibility Qs and config guides. Boiler setups, heat pump settings, aux heat thresholds - all the deets you need to dial it in.",
      color: "purple",
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
      path: "/tools/audio-transcription",
      name: "Audio Transcription",
      label: "Audio Transcription",
      icon: FileAudio,
      description: "Upload WAV files and convert them to text using OpenAI Whisper API. Perfect for transcribing phone calls, meetings, or voice notes.",
      color: "purple",
    },
    {
      path: "/tools/ip-lookup",
      name: "IP Lookup",
      label: "IP Lookup",
      icon: Network,
      description: "Reverse IP address lookup tool. Get location, ISP, timezone, and network information for any IP address.",
      color: "blue",
    },
    {
      path: "/tools/pdf-to-text",
      name: "PDF to Text",
      label: "PDF to Text",
      icon: FileText,
      description: "Extract text from PDF files. Works entirely in your browser - no data is sent to any server. Perfect for converting PDFs to text format.",
      color: "green",
    },
    {
      path: "/tools/image-to-ascii",
      name: "Image to ASCII Converter",
      label: "Image to ASCII Converter",
      icon: Image,
      description: "Convert images to ASCII art. Perfect for extracting diagrams from manuals and adding them to the RAG database. All processing happens in your browser.",
      color: "blue",
    },
    {
      path: "/tools/image-to-text",
      name: "Image to Text (OCR)",
      label: "Image to Text (OCR)",
      icon: FileText,
      description: "Extract text from images and screenshots using OCR. Perfect for extracting text from PDF images, screenshots, or scanned documents. All processing happens in your browser.",
      color: "purple",
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
      name: "Bridge Admin",
      label: "Bridge Admin",
      icon: Server,
      description: "Remote bridge administration and troubleshooting. View diagnostics, logs, system info, and perform remote actions like OTA updates and restarts.",
      color: "orange",
    },
  ];

  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400",
    green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400",
    orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400",
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {tools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.path}
              to={tool.path}
              className={`block rounded-lg border p-6 transition-all hover:shadow-lg ${colorClasses[tool.color]}`}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg bg-white dark:bg-gray-800 ${colorClasses[tool.color].split(' ')[0]} border`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {tool.label}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {tool.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

