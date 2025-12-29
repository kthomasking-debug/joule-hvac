import React, { useState } from "react";
import { AlertCircle, ChevronRight, CheckCircle2, XCircle, HelpCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Friendly onboarding guide for when device is paired but offline
 * Replaces scary error messages with step-by-step help
 */
export default function DeviceOfflineGuide({ onClose, showAutoReconnect = true }) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: "What's happening?",
      content: (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Your Ecobee is paired with the bridge, but it's not responding right now. This usually happens after the bridge restarts.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Good news:</strong> The bridge will automatically try to reconnect. Most of the time, it fixes itself within 30 seconds!
          </p>
        </div>
      ),
    },
    {
      title: "Why does this happen?",
      content: (
        <div className="space-y-2">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            After a server restart, the connection info might need to be refreshed. Common reasons:
          </p>
          <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
            <li>Device IP address changed (DHCP renewal)</li>
            <li>Network wasn't ready when bridge started</li>
            <li>Connection info needs to be refreshed</li>
          </ul>
        </div>
      ),
    },
    {
      title: "What to do",
      content: (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
              Step 1: Wait 30 seconds
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-300">
              The bridge is automatically trying to reconnect. Give it a moment!
            </p>
          </div>
          
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-2">
              Step 2: If it doesn't reconnect
            </p>
            <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
              Go to Settings → Joule Bridge Settings and follow these steps:
            </p>
            <ol className="text-xs text-amber-800 dark:text-amber-300 ml-4 list-decimal space-y-1">
              <li>Click <strong>"Unpair"</strong> if a device is shown</li>
              <li>Click <strong>"Discover"</strong> to find your Ecobee</li>
              <li>Enter the <strong>8-digit pairing code</strong> from your Ecobee screen</li>
              <li>Click <strong>"Pair"</strong> and wait up to 45 seconds</li>
            </ol>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
              <strong>Where to find the code:</strong> Ecobee Menu → Settings → Installation Settings → HomeKit
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-800 shadow-lg">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <HelpCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Device Offline - Let's Fix It!
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Step-by-step guide to reconnect your Ecobee
            </p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XCircle className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2 mb-4">
        {steps.map((_, index) => (
          <React.Fragment key={index}>
            <button
              onClick={() => setCurrentStep(index)}
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                index === currentStep
                  ? "bg-blue-600 text-white"
                  : index < currentStep
                  ? "bg-green-500 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
              }`}
            >
              {index < currentStep ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                index + 1
              )}
            </button>
            {index < steps.length - 1 && (
              <div
                className={`h-1 flex-1 rounded ${
                  index < currentStep
                    ? "bg-green-500"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Current Step Content */}
      <div className="mb-4">
        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3">
          {steps[currentStep].title}
        </h4>
        {steps[currentStep].content}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4 border-t border-blue-200 dark:border-blue-800">
        <button
          onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
          disabled={currentStep === 0}
          className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-2">
          {showAutoReconnect && (
            <div className="px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-xs text-green-800 dark:text-green-200">
                <CheckCircle2 className="w-3 h-3 inline mr-1" />
                Auto-reconnect active
              </p>
            </div>
          )}
          <Link
            to="/config#joule-bridge"
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Go to Settings
            <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>

        <button
          onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
          disabled={currentStep === steps.length - 1}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick Help */}
      <div className="mt-4 pt-4 border-t border-blue-200 dark:border-blue-800">
        <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
          💡 <strong>Tip:</strong> The bridge will keep trying to reconnect automatically. You can continue using the app with default settings while it reconnects.
        </p>
      </div>
    </div>
  );
}


