import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, X, Coffee, Pill, Thermometer, Heart } from "lucide-react";

const wellnessSection = {
  title: "Wellness",
  description: "Personal health and lifestyle tracking tools",
  tools: [
    {
      path: "/tools/caffeine-tracker",
      name: "Caffeine Tracker",
      label: "Caffeine Tracker",
      icon: Coffee,
      description: "Track green tea, Earl Grey black tea, and coffee intake using your body weight to estimate active caffeine and adenosine receptor impact.",
      color: "green",
    },
    {
      path: "/tools/clonazepam-tracker",
      name: "Clonazepam Tracker",
      label: "Clonazepam Tracker",
      icon: Pill,
      description: "Track clonazepam dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
    },
    {
      path: "/tools/vilazodone-tracker",
      name: "Vilazodone Tracker",
      label: "Vilazodone Tracker",
      icon: Pill,
      description: "Track vilazodone dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
    },
    {
      path: "/tools/lamotrigine-tracker",
      name: "Lamotrigine Tracker",
      label: "Lamotrigine Tracker",
      icon: Pill,
      description: "Track lamotrigine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
    },
    {
      path: "/tools/doxylamine-tracker",
      name: "Doxylamine Tracker",
      label: "Doxylamine Tracker",
      icon: Pill,
      description: "Track doxylamine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
    },
    {
      path: "/tools/trazodone-tracker",
      name: "Trazodone Tracker",
      label: "Trazodone Tracker",
      icon: Pill,
      description: "Track trazodone dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
    },
    {
      path: "/tools/levothyroxine-tracker",
      name: "Levothyroxine Tracker",
      label: "Levothyroxine Tracker",
      icon: Pill,
      description: "Track levothyroxine dose timing and estimated active amount over time using a configurable half-life model.",
      color: "purple",
    },
    {
      path: "/tools/medication-visual-models",
      name: "Medication Visual Models",
      label: "Medication Visual Models",
      icon: Thermometer,
      description: "Animated visual model cards for clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine.",
      color: "purple",
    },
    {
      path: "/tools/medication-mix-model",
      name: "Medication Mix Model",
      label: "Medication Mix Model",
      icon: Thermometer,
      description: "Estimate combined CNS load from clonazepam, doxylamine, vilazodone, lamotrigine, trazodone, levothyroxine, and caffeine using your existing tracker logs.",
      color: "purple",
    },
  ],
};

const colorClasses = {
  blue: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400",
  green: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600 dark:text-green-400",
  purple: "bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/30 text-purple-600 dark:text-purple-400",
  orange: "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-700 hover:bg-orange-100 dark:hover:bg-orange-900/30 text-orange-600 dark:text-orange-400",
};

export default function WellnessTools() {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTools = useMemo(() => {
    if (!searchQuery.trim()) return wellnessSection.tools;
    const query = searchQuery.toLowerCase();
    return wellnessSection.tools.filter((tool) =>
      tool.name.toLowerCase().includes(query) ||
      tool.label.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Heart className="w-7 h-7 text-fuchsia-600 dark:text-fuchsia-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Wellness Hub</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">Medication and caffeine tracking, interaction modeling, and wellness visualizations.</p>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search wellness tools by name or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
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
        {searchQuery && filteredTools.length === 0 && (
          <p className="text-gray-600 dark:text-gray-400 mt-4 text-center">
            No wellness tools found matching "{searchQuery}".
          </p>
        )}
      </div>

      <div className="mb-4">
        <h2 className="text-2xl font-semibold mb-1 text-gray-900 dark:text-white">{wellnessSection.title}</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400">{wellnessSection.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredTools.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.path}
              to={tool.path}
              className={`block rounded-lg border p-6 transition-all hover:shadow-lg ${colorClasses[tool.color]}`}
              title={tool.description}
            >
              <div className="flex items-start gap-4">
                <div className={`p-3 rounded-lg border bg-white dark:bg-gray-800 ${colorClasses[tool.color].split(" ")[0]}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-white">{tool.label}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{tool.description}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
