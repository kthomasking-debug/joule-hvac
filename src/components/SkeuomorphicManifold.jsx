import React from 'react';
import { Plus, Minus } from 'lucide-react';

/**
 * SkeuomorphicManifold Component
 * 
 * A faithful digital replica of a Fieldpiece manifold gauge, featuring:
 * - Vibrant yellow construction-grade body
 * - Blue LCD-style display with 7-segment font numbers
 * - Tactile gray control buttons with 3D effects
 * - Real-time value calculations
 */

export const SkeuomorphicManifold = ({
  method,
  onMethodChange,
  suctionPressure,
  setSuctionPressure,
  suctionTemp,
  setSuctionTemp,
  liquidLinePressure,
  setLiquidLinePressure,
  liquidLineTemp,
  setLiquidLineTemp,
  targetSuperheat,
  calculations,
  onSaveReading,
  onShowPTChart,
}) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      {/* Manifold Body */}
      <div className="relative w-full max-w-md">
        {/* Yellow Body with Shadow */}
        <div className="bg-gradient-to-b from-yellow-300 via-yellow-400 to-yellow-500 rounded-3xl shadow-2xl border-8 border-gray-800 overflow-hidden">
          
          {/* Black Rubber Top Bezel */}
          <div className="bg-black/40 h-2" />
          
          {/* LCD Display Screen */}
          <div className="bg-gradient-to-b from-blue-900 to-blue-950 p-6 mx-4 mt-4 rounded-xl border-4 border-gray-900 shadow-inner">
            <style>{`
              @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap');
              .dseg-font {
                font-family: 'Orbitron', 'Courier New', monospace;
                letter-spacing: 0.1em;
                font-weight: 900;
                text-shadow: 0 0 10px rgba(103, 232, 249, 0.5);
              }
            `}</style>
            
            {/* Display Grid: Left | Center | Right */}
            <div className="grid grid-cols-3 gap-2 text-center mb-2">
              {/* Left Section */}
              <div className="bg-blue-950/50 rounded-lg p-2">
                <div className="dseg-font text-3xl font-black text-cyan-300 tracking-wider">
                  {method === 'superheat' 
                    ? calculations.actualSuperheat?.toFixed(1) || '0.0'
                    : calculations.targetTemp?.toFixed(1) || '0.0'
                  }
                  <span className="text-lg">°F</span>
                </div>
                <div className="text-xs font-bold text-cyan-200 uppercase mt-1">
                  {method === 'superheat' ? 'SH' : 'REQ'}
                </div>
              </div>

              {/* Center Section */}
              <div className="bg-blue-950/50 rounded-lg p-2">
                <div className="dseg-font text-3xl font-black text-cyan-300 tracking-wider">
                  {method === 'superheat' ? suctionPressure : liquidLinePressure}
                </div>
                <div className="text-xs font-bold text-cyan-200 uppercase mt-1">PSIG</div>
              </div>

              {/* Right Section */}
              <div className="bg-blue-950/50 rounded-lg p-2">
                <div className="dseg-font text-3xl font-black text-cyan-300 tracking-wider">
                  {method === 'superheat' ? targetSuperheat : suctionTemp}
                  <span className="text-lg">°F</span>
                </div>
                <div className="text-xs font-bold text-cyan-200 uppercase mt-1">
                  {method === 'superheat' ? 'TSH' : 'SLT'}
                </div>
              </div>
            </div>

            {/* Status Line */}
            <div className="bg-blue-950/70 rounded-lg p-2 text-center">
              <div className={`dseg-font text-lg font-bold uppercase tracking-wide ${
                calculations.statusLevel === 'good' ? 'text-green-400' :
                calculations.statusLevel === 'caution' ? 'text-yellow-400' :
                'text-red-400'
              }`}>
                {calculations.chargeStatus}
              </div>
            </div>
          </div>

          {/* Control Panel */}
          <div className="bg-gradient-to-b from-yellow-400 to-yellow-500 p-6 space-y-4">
            
            {/* Top Row: Refrigerant Selector Buttons */}
            <div className="grid grid-cols-3 gap-2">
              <button
                className="bg-gradient-to-b from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-900 font-bold py-2 px-3 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-gray-600"
                onClick={() => {/* Prev refrigerant */}}
              >
                ▲ REF
              </button>
              <button
                className="bg-gradient-to-b from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-bold py-2 px-3 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-blue-700"
                onClick={onShowPTChart}
              >
                PT CHART
              </button>
              <button
                className="bg-gradient-to-b from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-900 font-bold py-2 px-3 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-gray-600"
                onClick={() => {/* Next refrigerant */}}
              >
                ▼ REF
              </button>
            </div>

            {/* Method Toggle */}
            <div className="flex gap-2">
              <button
                className={`flex-1 font-bold py-3 px-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 ${
                  method === 'subcooling'
                    ? 'bg-gradient-to-b from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white border-green-700'
                    : 'bg-gradient-to-b from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-900 border-gray-600'
                }`}
                onClick={() => onMethodChange('subcooling')}
              >
                SC
              </button>
              <button
                className={`flex-1 font-bold py-3 px-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 ${
                  method === 'superheat'
                    ? 'bg-gradient-to-b from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white border-green-700'
                    : 'bg-gradient-to-b from-gray-300 to-gray-400 hover:from-gray-400 hover:to-gray-500 text-gray-900 border-gray-600'
                }`}
                onClick={() => onMethodChange('superheat')}
              >
                SH
              </button>
            </div>

            {/* Main Control Buttons: +/- Pressure and Temp */}
            <div className="space-y-3">
              {/* Pressure Controls */}
              <div className="flex gap-2 items-center">
                <button
                  className="bg-gradient-to-b from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold p-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-red-700"
                  onClick={() => method === 'superheat' ? setSuctionPressure(Math.max(0, suctionPressure - 5)) : setLiquidLinePressure(Math.max(0, liquidLinePressure - 5))}
                  aria-label="Decrease pressure"
                >
                  <Minus size={24} strokeWidth={3} />
                </button>
                <div className="flex-1 text-center">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Pressure</div>
                  <input
                    type="number"
                    value={method === 'superheat' ? suctionPressure : liquidLinePressure}
                    onChange={(e) => method === 'superheat' ? setSuctionPressure(Number(e.target.value)) : setLiquidLinePressure(Number(e.target.value))}
                    className="w-full dseg-font text-2xl font-bold text-center text-gray-900 bg-white border-2 border-gray-700 rounded py-1 px-2"
                  />
                </div>
                <button
                  className="bg-gradient-to-b from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-bold p-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-green-700"
                  onClick={() => method === 'superheat' ? setSuctionPressure(suctionPressure + 5) : setLiquidLinePressure(liquidLinePressure + 5)}
                  aria-label="Increase pressure"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </div>

              {/* Temperature Controls */}
              <div className="flex gap-2 items-center">
                <button
                  className="bg-gradient-to-b from-red-400 to-red-500 hover:from-red-500 hover:to-red-600 text-white font-bold p-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-red-700"
                  onClick={() => method === 'superheat' ? setSuctionTemp(suctionTemp - 5) : setLiquidLineTemp(liquidLineTemp - 5)}
                  aria-label="Decrease temperature"
                >
                  <Minus size={24} strokeWidth={3} />
                </button>
                <div className="flex-1 text-center">
                  <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">Temperature</div>
                  <input
                    type="number"
                    value={method === 'superheat' ? suctionTemp : liquidLineTemp}
                    onChange={(e) => method === 'superheat' ? setSuctionTemp(Number(e.target.value)) : setLiquidLineTemp(Number(e.target.value))}
                    className="w-full dseg-font text-2xl font-bold text-center text-gray-900 bg-white border-2 border-gray-700 rounded py-1 px-2"
                  />
                </div>
                <button
                  className="bg-gradient-to-b from-green-400 to-green-500 hover:from-green-500 hover:to-green-600 text-white font-bold p-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-green-700"
                  onClick={() => method === 'superheat' ? setSuctionTemp(suctionTemp + 5) : setLiquidLineTemp(liquidLineTemp + 5)}
                  aria-label="Increase temperature"
                >
                  <Plus size={24} strokeWidth={3} />
                </button>
              </div>
            </div>

            {/* Bottom Buttons: Save and Enter */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                className="bg-gradient-to-b from-gray-400 to-gray-500 hover:from-gray-500 hover:to-gray-600 text-white font-bold py-3 px-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-gray-700 uppercase text-sm"
                onClick={() => {/* Alarm / History */}}
              >
                📋 History
              </button>
              <button
                className="bg-gradient-to-b from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold py-3 px-4 rounded-lg shadow-lg active:shadow-inner active:scale-95 transition-all border-b-4 border-blue-800 uppercase text-sm"
                onClick={onSaveReading}
              >
                ⏎ Enter
              </button>
            </div>
          </div>

          {/* Black Rubber Bottom Bezel */}
          <div className="bg-black/40 h-2" />
        </div>

        {/* Manifold Shadow/Depth */}
        <div className="absolute -inset-2 bg-gray-900 rounded-3xl -z-10 blur-xl opacity-50" />
      </div>
    </div>
  );
};

export default SkeuomorphicManifold;
