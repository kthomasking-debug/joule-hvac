// src/components/UnitSystemToggle.jsx

import React from "react";
import { UNIT_SYSTEMS, useUnitSystem } from "../lib/units";

export default function UnitSystemToggle({ className = "" }) {
  const { unitSystem, setUnitSystem } = useUnitSystem();

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <span className="text-xs text-slate-400 whitespace-nowrap">Units</span>
      <div className="inline-flex rounded-full border border-slate-700 bg-slate-900 p-0.5 text-xs">
        <button
          type="button"
          onClick={() => setUnitSystem(UNIT_SYSTEMS.US)}
          className={
            "px-3 py-1 rounded-full transition " +
            (unitSystem === UNIT_SYSTEMS.US
              ? "bg-slate-100 text-slate-900 font-semibold"
              : "text-slate-300 hover:bg-slate-800")
          }
        >
          US
        </button>
        <button
          type="button"
          onClick={() => setUnitSystem(UNIT_SYSTEMS.INTL)}
          className={
            "px-3 py-1 rounded-full transition " +
            (unitSystem === UNIT_SYSTEMS.INTL
              ? "bg-slate-100 text-slate-900 font-semibold"
              : "text-slate-300 hover:bg-slate-800")
          }
        >
          International
        </button>
      </div>
    </div>
  );
}






