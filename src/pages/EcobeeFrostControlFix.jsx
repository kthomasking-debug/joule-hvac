import React, { useState } from 'react';
import { AlertCircle, CheckCircle, ChevronRight, Settings, Thermometer, Droplets } from 'lucide-react';

export default function EcobeeFrostControlFix() {
  const [currentStep, setCurrentStep] = useState(0);
  const [acOvercooling, setAcOvercooling] = useState(true);
  const [showFrostControl, setShowFrostControl] = useState(false);

  const steps = [
    {
      title: "The Problem",
      icon: AlertCircle,
      color: "bg-red-500",
      content: (
        <div className="space-y-4">
          <div className="bg-red-900/20 dark:bg-red-900/30 border-2 border-red-700 dark:border-red-600 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-3 text-red-700 dark:text-red-400">Missing Settings</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">The Frost Control window rating screen has disappeared from your Ecobee Premium thermostat.</p>
            <div className="bg-gray-900 dark:bg-gray-800 rounded p-4 border border-red-700 dark:border-red-600">
              <p className="font-semibold mb-2 text-gray-100 dark:text-gray-200">What you're missing:</p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span className="text-gray-300 dark:text-gray-400">Window rating selection</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span className="text-gray-300 dark:text-gray-400">Automatic humidity adjustment based on outdoor temperature</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-red-500 mt-1">✗</span>
                  <span className="text-gray-300 dark:text-gray-400">Frost protection controls</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "The Solution",
      icon: CheckCircle,
      color: "bg-green-500",
      content: (
        <div className="space-y-4">
          <div className="bg-green-900/20 dark:bg-green-900/30 border-2 border-green-700 dark:border-green-600 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-3 text-green-700 dark:text-green-400">Simple Fix</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-4">This is a known bug in Ecobee. The frost control settings are hidden when AC Overcooling is turned ON.</p>
            <div className="bg-gray-900 dark:bg-gray-800 rounded p-4 border border-green-700 dark:border-green-600">
              <p className="font-semibold mb-3 text-center text-lg text-gray-100 dark:text-gray-200">Turn OFF AC Overcooling</p>
              <div className="flex items-center justify-center gap-4 py-4">
                <div className="text-center">
                  <div className="bg-red-900/40 dark:bg-red-900/50 rounded-full p-3 mb-2 inline-block">
                    <span className="text-2xl">❌</span>
                  </div>
                  <p className="text-sm font-medium text-gray-100 dark:text-gray-200">AC Overcooling ON</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Frost control hidden</p>
                </div>
                <ChevronRight className="text-gray-500 dark:text-gray-400" size={32} />
                <div className="text-center">
                  <div className="bg-green-900/40 dark:bg-green-900/50 rounded-full p-3 mb-2 inline-block">
                    <span className="text-2xl">✅</span>
                  </div>
                  <p className="text-sm font-medium text-gray-100 dark:text-gray-200">AC Overcooling OFF</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Frost control appears</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Interactive Demo",
      icon: Settings,
      color: "bg-blue-500",
      content: (
        <div className="space-y-4">
          <div className="bg-blue-900/20 dark:bg-blue-900/30 border-2 border-blue-700 dark:border-blue-600 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4 text-blue-700 dark:text-blue-400">Try It Yourself</h3>
            <p className="text-gray-700 dark:text-gray-300 mb-6">Toggle the AC Overcooling setting to see how it affects the Frost Control options:</p>
            
            <div className="bg-gray-900 dark:bg-gray-800 rounded-lg p-6 border-2 border-gray-700 dark:border-gray-600">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-700 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <Thermometer className="text-blue-400 dark:text-blue-500" size={24} />
                  <span className="font-semibold text-gray-100 dark:text-gray-200">AC Overcooling</span>
                </div>
                <button
                  onClick={() => {
                    setAcOvercooling(!acOvercooling);
                    setShowFrostControl(acOvercooling);
                  }}
                  className={`relative w-16 h-8 rounded-full transition-colors ${
                    acOvercooling ? 'bg-red-500' : 'bg-green-500'
                  }`}
                >
                  <div
                    className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${
                      acOvercooling ? 'translate-x-0' : 'translate-x-8'
                    }`}
                  />
                </button>
              </div>

              <div className={`transition-all duration-500 ${showFrostControl ? 'opacity-100 max-h-96' : 'opacity-30 max-h-96 pointer-events-none'}`}>
                <div className="flex items-center gap-3 mb-4">
                  <Droplets className="text-blue-400 dark:text-blue-500" size={24} />
                  <span className="font-semibold text-gray-100 dark:text-gray-200">Frost Control Settings</span>
                  {!showFrostControl && (
                    <span className="text-xs bg-red-900/60 dark:bg-red-900/80 text-red-300 dark:text-red-400 px-2 py-1 rounded">HIDDEN</span>
                  )}
                </div>
                
                <div className="space-y-4 bg-gray-800 dark:bg-gray-900 p-4 rounded">
                  <div>
                    <label className="block text-sm font-medium text-gray-200 dark:text-gray-300 mb-2">Window Rating</label>
                    <select className="w-full p-2 border border-gray-600 dark:border-gray-700 rounded bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200" disabled={!showFrostControl}>
                      <option>Double Pane</option>
                      <option>Triple Pane</option>
                      <option>Single Pane</option>
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-200 dark:text-gray-300 mb-2">Min Humidity</label>
                      <input type="number" className="w-full p-2 border border-gray-600 dark:border-gray-700 rounded bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200" value="35" disabled={!showFrostControl} readOnly />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-200 dark:text-gray-300 mb-2">Max Humidity</label>
                      <input type="number" className="w-full p-2 border border-gray-600 dark:border-gray-700 rounded bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200" value="45" disabled={!showFrostControl} readOnly />
                    </div>
                  </div>
                </div>
              </div>

              {!showFrostControl && (
                <div className="mt-4 bg-yellow-900/30 dark:bg-yellow-900/40 border border-yellow-700 dark:border-yellow-600 rounded p-3 text-sm text-yellow-600 dark:text-yellow-400">
                  Turn OFF AC Overcooling to see Frost Control settings
                </div>
              )}
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Step-by-Step",
      icon: Settings,
      color: "bg-purple-500",
      content: (
        <div className="space-y-4">
          <div className="bg-purple-900/20 dark:bg-purple-900/30 border-2 border-purple-700 dark:border-purple-600 rounded-lg p-6">
            <h3 className="font-bold text-lg mb-4 text-purple-700 dark:text-purple-400">How to Fix on Your Thermostat</h3>
            <div className="space-y-3">
              {[
                { step: 1, text: "Go to MENU on your Ecobee" },
                { step: 2, text: "Select SETTINGS" },
                { step: 3, text: "Select INSTALLATION SETTINGS" },
                { step: 4, text: "Select EQUIPMENT" },
                { step: 5, text: "Find AC OVERCOOLING" },
                { step: 6, text: "Turn AC OVERCOOLING to OFF" },
                { step: 7, text: "Go back to HUMIDIFIER settings" },
                { step: 8, text: "Frost Control options now appear!" }
              ].map((item) => (
                <div key={item.step} className="flex items-start gap-4 bg-gray-900 dark:bg-gray-800 p-4 rounded-lg border border-purple-700 dark:border-purple-600">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-600 dark:bg-purple-700 text-white rounded-full flex items-center justify-center font-bold">
                    {item.step}
                  </div>
                  <p className="text-gray-100 dark:text-gray-300 pt-1">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gray-900 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 dark:bg-gray-850 rounded-2xl shadow-2xl overflow-hidden border border-gray-700 dark:border-gray-800">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white">
            <h1 className="text-3xl font-bold mb-2">Ecobee Frost Control Missing?</h1>
            <p className="text-blue-100">Visual guide to restore your frost control settings</p>
          </div>

          <div className="flex border-b bg-gray-900 dark:bg-gray-900 border-gray-700 dark:border-gray-800">
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <button
                  key={idx}
                  onClick={() => setCurrentStep(idx)}
                  className={`flex-1 p-4 flex flex-col items-center gap-2 transition-all ${
                    currentStep === idx
                      ? 'bg-gray-800 dark:bg-gray-800 border-b-4 border-blue-600'
                      : 'hover:bg-gray-900 dark:hover:bg-gray-850'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full ${step.color} flex items-center justify-center ${currentStep === idx ? 'scale-110' : 'scale-100'} transition-transform`}>
                    <Icon className="text-white" size={20} />
                  </div>
                  <span className={`text-sm font-medium ${currentStep === idx ? 'text-gray-100 dark:text-gray-100' : 'text-gray-400 dark:text-gray-500'}`}>
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="p-8">
            {steps[currentStep].content}
          </div>

          <div className="p-6 bg-gray-900 dark:bg-gray-900 border-t border-gray-700 dark:border-gray-800 flex justify-between">
            <button
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
              className="px-6 py-2 rounded-lg bg-gray-700 dark:bg-gray-800 text-gray-100 dark:text-gray-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-600 dark:hover:bg-gray-700 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}
              disabled={currentStep === steps.length - 1}
              className="px-6 py-2 rounded-lg bg-blue-600 dark:bg-blue-700 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors"
            >
              Next
            </button>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 dark:bg-gray-850 rounded-lg p-6 shadow-lg border border-gray-700 dark:border-gray-800">
          <h3 className="font-bold text-lg mb-3 flex items-center gap-2 text-gray-100 dark:text-gray-100">
            <AlertCircle className="text-orange-500" size={24} />
            Important Note
          </h3>
          <p className="text-gray-300 dark:text-gray-400">
            This is a known bug that Ecobee acknowledged over a year ago but hasn't fixed yet. If this workaround doesn't work, contact Ecobee support at <span className="font-mono bg-gray-900 dark:bg-gray-900 text-gray-100 dark:text-gray-200 px-2 py-1 rounded">1-877-932-6233</span> and reference the missing frost control feature.
          </p>
        </div>
      </div>
    </div>
  );
}
