import React, { useState } from "react";
import useAgentRunner from "../hooks/useAgentRunner";
import { Bot, Sparkles, Clock, Cpu, Zap, Database } from "lucide-react";

export default function AgentConsole() {
  const { events, isRunning, lastFinal, run, abort } = useAgentRunner();
  const [goal, setGoal] = useState("");
  const [rememberSettings, setRememberSettings] = useState(true);

  const examplePrompts = [
    {
      icon: Zap,
      text: "Show me joule score upgrade analysis",
      category: "Analysis",
    },
    {
      icon: Clock,
      text: "What time is it and get CPU temperature",
      category: "System",
    },
    {
      icon: Database,
      text: "Remember my heat pump is 2 tons and list memory",
      category: "Memory",
    },
    {
      icon: Sparkles,
      text: "Joule score efficiency improvement suggestions",
      category: "Optimization",
    },
  ];

  const handleRun = () => {
    const settingsSnapshot = rememberSettings
      ? window.__APP_SETTINGS__ || null
      : null;
    run(goal, settingsSnapshot);
  };

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-3">
          <Bot className="text-purple-600 dark:text-purple-400" size={32} />
          <h1 className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            🤖 Autonomous AI Agent
          </h1>
        </div>
        <p className="text-sm text-purple-800 dark:text-purple-200">
          Intelligent backend agent that plans tasks, executes tools, and
          remembers context. Watch it work in real-time as it streams planning
          and execution events.
        </p>
      </div>

      {/* Example Prompts */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          💡 Try These Examples
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {examplePrompts.map((prompt, i) => {
            const Icon = prompt.icon;
            return (
              <button
                key={i}
                onClick={() => setGoal(prompt.text)}
                className="text-left p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-400 dark:hover:border-purple-600 transition-colors"
              >
                <div className="flex items-start gap-2">
                  <Icon
                    className="text-purple-500 dark:text-purple-400 flex-shrink-0 mt-0.5"
                    size={16}
                  />
                  <div>
                    <div className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                      {prompt.category}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {prompt.text}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Input Section */}
      <div className="space-y-3">
        <label className="block">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">
            🎯 Agent Goal
          </span>
          <textarea
            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            rows={3}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe what you want the agent to do... (e.g., 'Analyze my joule score and suggest upgrades')"
          />
        </label>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={rememberSettings}
              onChange={(e) => setRememberSettings(e.target.checked)}
              className="rounded"
            />
            Include system settings in context
          </label>

          <div className="flex gap-3">
            <button
              onClick={handleRun}
              disabled={isRunning || !goal.trim()}
              className="px-6 py-2 rounded-lg bg-purple-600 text-white font-semibold disabled:opacity-50 hover:bg-purple-700 transition-colors flex items-center gap-2"
            >
              <Bot size={16} />
              {isRunning ? "Running..." : "Run Agent"}
            </button>
            <button
              onClick={abort}
              disabled={!isRunning}
              className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50 hover:bg-red-700 transition-colors"
            >
              Stop
            </button>
          </div>
        </div>
      </div>

      {/* Event Stream */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          📡 Event Stream
        </h2>
        <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-900 max-h-96 overflow-auto">
          {events.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <Cpu className="mx-auto mb-2 opacity-50" size={32} />
              <p className="text-sm">
                No events yet. Start the agent to see real-time execution.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((e, i) => {
                if (e.type === "goal") {
                  return (
                    <div
                      key={i}
                      className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                          🎯 Goal
                        </span>
                      </div>
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        {e.goal}
                      </p>
                    </div>
                  );
                }
                if (e.type === "plan") {
                  return (
                    <div
                      key={i}
                      className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                          📋 Plan
                        </span>
                      </div>
                      <ul className="list-disc list-inside space-y-1 text-sm text-purple-900 dark:text-purple-100">
                        {e.steps?.map((step, idx) => (
                          <li key={idx} className="font-mono text-xs">
                            {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                }
                if (e.type === "tool_call") {
                  return (
                    <div
                      key={i}
                      className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">
                          🔧 Calling Tool
                        </span>
                        <span className="font-mono text-xs text-yellow-900 dark:text-yellow-100">
                          {e.tool}
                        </span>
                      </div>
                    </div>
                  );
                }
                if (e.type === "tool_result") {
                  const output = e.output;
                  return (
                    <div
                      key={i}
                      className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-green-700 dark:text-green-300">
                          ✅ Tool Result
                        </span>
                        <span className="font-mono text-xs text-green-900 dark:text-green-100">
                          {e.tool}
                        </span>
                      </div>
                      {e.tool === "getJouleAnalysis" &&
                      output.jouleScore !== undefined ? (
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-4">
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                Joule Score:
                              </span>
                              <span className="ml-2 font-bold text-green-700 dark:text-green-300">
                                {output.jouleScore}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                SEER:
                              </span>
                              <span className="ml-2 font-semibold">
                                {output.seer}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600 dark:text-gray-400">
                                HSPF:
                              </span>
                              <span className="ml-2 font-semibold">
                                {output.hspf}
                              </span>
                            </div>
                          </div>
                          {output.upgrades && output.upgrades.length > 0 && (
                            <div className="mt-3 pt-2 border-t border-green-200 dark:border-green-800">
                              <div className="text-xs font-semibold text-green-700 dark:text-green-300 mb-2">
                                💡 Upgrade Suggestions:
                              </div>
                              {output.upgrades.map((upgrade, idx) => (
                                <div
                                  key={idx}
                                  className="mb-2 p-2 bg-white dark:bg-gray-800 rounded text-xs"
                                >
                                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                                    {upgrade.type}
                                  </div>
                                  <div className="text-gray-600 dark:text-gray-400">
                                    {upgrade.from} → {upgrade.to} (Projected
                                    Score: {upgrade.projectedScore}, Savings:{" "}
                                    {upgrade.estimatedSavingsPct}%)
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : e.tool === "getJouleScore" &&
                        output.jouleScore !== undefined ? (
                        <div className="text-sm space-y-1">
                          <div>
                            Joule Score:{" "}
                            <span className="font-bold text-green-700 dark:text-green-300">
                              {output.jouleScore}
                            </span>
                          </div>
                          <div>
                            SEER: {output.seer} (Component:{" "}
                            {output.seerComponent})
                          </div>
                          <div>
                            HSPF: {output.hspf} (Component:{" "}
                            {output.hspfComponent})
                          </div>
                        </div>
                      ) : e.tool === "getCpuThermostatTemp" &&
                        output.mainF !== undefined ? (
                        <div className="text-sm">
                          Temperature:{" "}
                          <span className="font-bold">{output.mainF}°F</span> (
                          {output.source})
                        </div>
                      ) : e.tool === "getTime" && output.time ? (
                        <div className="text-sm">
                          Current Time:{" "}
                          <span className="font-mono">
                            {new Date(output.time).toLocaleString()}
                          </span>
                        </div>
                      ) : e.tool === "rememberFact" ? (
                        <div className="text-sm">
                          <span className="text-green-700 dark:text-green-300">
                            ✓ Fact stored
                          </span>{" "}
                          ({output.count} total facts)
                        </div>
                      ) : e.tool === "listFacts" && output.facts ? (
                        <div className="text-sm">
                          <div className="font-semibold mb-1">
                            Stored Facts ({output.facts.length}):
                          </div>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            {output.facts.slice(0, 5).map((fact, idx) => (
                              <li key={idx}>{fact.fact}</li>
                            ))}
                            {output.facts.length > 5 && (
                              <li className="text-gray-500">
                                ... and {output.facts.length - 5} more
                              </li>
                            )}
                          </ul>
                        </div>
                      ) : (
                        <pre className="text-xs bg-white dark:bg-gray-800 p-2 rounded overflow-x-auto">
                          {JSON.stringify(output, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                }
                if (e.type === "final") {
                  return (
                    <div
                      key={i}
                      className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-300 dark:border-indigo-700 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">
                          ✨ Completed
                        </span>
                        <span className="text-xs text-gray-500">
                          ({e.output?.meta?.durationMs || 0}ms)
                        </span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        Executed {e.output?.steps?.length || 0} step(s)
                      </div>
                    </div>
                  );
                }
                if (e.type === "error" || e.type === "tool_error") {
                  return (
                    <div
                      key={i}
                      className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-red-700 dark:text-red-300">
                          ❌ Error
                        </span>
                      </div>
                      <p className="text-sm text-red-900 dark:text-red-100">
                        {e.message || JSON.stringify(e.output || e)}
                      </p>
                    </div>
                  );
                }
                // Fallback for unknown event types
                return (
                  <div
                    key={i}
                    className="bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-2"
                  >
                    <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      {e.type}
                    </span>
                    <pre className="text-xs mt-1 overflow-x-auto">
                      {JSON.stringify(e, null, 2)}
                    </pre>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Final Summary */}
      {lastFinal ? (
        <div className="p-5 rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-2 border-green-300 dark:border-green-700">
          <h2 className="font-semibold text-green-900 dark:text-green-100 mb-3 flex items-center gap-2">
            <Sparkles size={20} />✅ Agent Completed Successfully
          </h2>
          <pre className="whitespace-pre-wrap text-xs bg-white dark:bg-gray-900 p-3 rounded border border-green-200 dark:border-green-800 overflow-x-auto">
            {JSON.stringify(lastFinal, null, 2)}
          </pre>
        </div>
      ) : null}

      {/* Capabilities */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4">
        <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          🧠 Current Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-blue-800 dark:text-blue-200">
          <div>
            • <strong>getTime</strong> - Current timestamp
          </div>
          <div>
            • <strong>getCpuThermostatTemp</strong> - System temperature
          </div>
          <div>
            • <strong>getJouleScore</strong> - Basic efficiency score
          </div>
          <div>
            • <strong>getJouleAnalysis</strong> - Score + upgrade suggestions
          </div>
          <div>
            • <strong>rememberFact</strong> - Store information
          </div>
          <div>
            • <strong>listFacts</strong> - Recall stored facts
          </div>
        </div>
        <p className="text-xs text-blue-700 dark:text-blue-300 mt-3 italic">
          💡 Tip: Use keywords like "upgrade", "analysis", or "improve" to
          trigger the advanced Joule analysis tool.
        </p>
      </div>
    </div>
  );
}
