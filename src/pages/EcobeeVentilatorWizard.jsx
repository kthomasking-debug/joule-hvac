import React, { useState } from "react";
import { WiringWizard, EcobeeMenuSimulator } from "./EcobeeVentilatorExplainer";

/**
 * Ecobee Ventilator Wiring Wizard & Menu Simulator
 * - Interactive wiring wizard that recommends the right approach
 * - Fake Ecobee menu navigation simulator
 * - Parts suggestions and red flags
 */

const EcobeeVentilatorWizard = () => {
  const [wizard, setWizard] = useState({
    deviceType: "FRESH_AIR_DAMPER",
    controlInput: "UNKNOWN",
    hasDedicatedVentTerminals: false,
    hasSpareConductors: false,
    usesPEK: true,
    wantsIndependentMinutesPerHour: true,
    wantsVentToRunWithHVAC: true,
    voltageSource: "AIR_HANDLER_R_C",
  });

  const page = "font-sans p-4.5 text-slate-900 dark:text-slate-100";

  return (
    <div className={page}>
      <div className="border border-gray-300 dark:border-gray-600 rounded-2xl p-4 bg-gradient-to-b from-blue-50 to-white dark:from-blue-900/20 dark:to-gray-800 mb-6">
        <div>
          <div className="text-3xl font-black">Ecobee Ventilator Setup Wizard</div>
          <div className="opacity-80 mt-1.5 text-lg">
            Interactive wiring recommendations + Ecobee menu simulator
          </div>
          <div className="opacity-70 mt-2">
            Answer questions about your setup → get personalized wiring recommendations, parts lists, and step-by-step Ecobee configuration guidance.
          </div>
        </div>
      </div>

      <div className="grid gap-6">
        <WiringWizard value={wizard} onChange={setWizard} />

        <div className="border border-gray-300 dark:border-gray-600 rounded-2xl p-4 bg-gradient-to-b from-green-50 to-white dark:from-green-900/20 dark:to-gray-800">
          <div className="text-xl font-black mb-4">Ecobee Settings Navigation Simulator</div>
          <EcobeeMenuSimulator />
        </div>
      </div>

      <div className="mt-6 opacity-75 text-sm">
        This wizard helps you determine the optimal wiring approach for your whole-home ventilator with Ecobee Premium.
        Always verify with your device manual and local electrical codes.
      </div>
    </div>
  );
};

export default EcobeeVentilatorWizard;