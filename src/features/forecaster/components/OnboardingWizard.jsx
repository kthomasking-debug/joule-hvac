/**
 * OnboardingWizard - First-Time User Onboarding Modal
 * Extracted from SevenDayCostForecaster for maintainability
 * 
 * Handles the 5-step onboarding flow:
 * 0. Welcome
 * 1. Location
 * 2. Building & HVAC System
 * 3. Groq API Key (Optional)
 * 4. Review & Complete
 */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  MapPin,
  Home,
  Thermometer,
  Zap,
} from "lucide-react";
import {
  inputClasses,
  fullInputClasses,
  selectClasses,
} from "../../../lib/uiClasses";
import needsCommaBetweenCityAndState from "../../../utils/validateLocation";

// Welcome themes configuration
const WELCOME_THEMES = {
  mountains: { file: "welcome/mountains.jpg", label: "Mountains" },
  forest: { file: "welcome/forest.jpg", label: "Forest" },
  ocean: { file: "welcome/ocean.jpg", label: "Ocean" },
  cabin: { file: "welcome/cabin.jpg", label: "Cabin" },
  custom: { file: null, label: "Custom" },
};

const buildPublicPath = (file) => {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${file}`;
};

const OnboardingWizard = ({
  // Visibility
  show,
  onSkip, // Kept for backward compatibility; backdrop now uses onDismiss
  onDismiss, // Optional: non-destructive close (defaults to no-op)
  onComplete,
  // Step management
  currentStep,
  setStep,
  totalSteps = 5,
  hvacSubstep,
  setHvacSubstep,
  autoAdvanceOnboarding,
  setAutoAdvanceOnboarding,
  // Location state
  cityName,
  setCityName,
  foundLocationName,
  onCitySearch,
  forecastLoading,
  dispatch,
  ui,
  // Building state
  squareFeet,
  setSquareFeet,
  homeShape,
  setHomeShape,
  ceilingHeight,
  setCeilingHeight,
  insulationLevel,
  setInsulationLevel,
  globalHomeElevation,
  setHomeElevation,
  // HVAC system state
  primarySystem,
  setPrimarySystem,
  capacity,
  setCapacity,
  efficiency,
  setEfficiency,
  hspf2,
  setHspf2,
  afue,
  setAfue,
  coolingSystem,
  setCoolingSystem,
  coolingCapacity,
  setCoolingCapacity,
  // API Key
  groqApiKey,
  setGroqApiKey,
  // Theme
  welcomeTheme,
  customHeroUrl,
  // Utility rates
  utilityCost,
  gasCost,
  // Handlers
  onNext,
  onBack,
}) => {
  if (!show) return null;

  // Handle location step next button logic
  const handleLocationNext = () => {
    if (!cityName.trim()) {
      alert("⚠️ Please enter your location first.");
      return;
    }
    if (!foundLocationName) {
      const needsComma = needsCommaBetweenCityAndState(cityName);
      if (needsComma) {
        const message = 'Please separate city and state with a comma (example: "Denver, CO").';
        dispatch({ type: "SET_UI_FIELD", field: "error", value: message });
        window.alert(message);
        return;
      }
      dispatch({ type: "SET_UI_FIELD", field: "error", value: null });
      setAutoAdvanceOnboarding(true);
      onCitySearch();
    } else {
      onNext();
    }
  };

  // Handle city validation and search
  // Enter key now calls handleLocationNext for consistency with Next button
  const handleCityKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleLocationNext();
    }
  };

  // Non-destructive dismiss handler (just closes, doesn't skip onboarding)
  const handleDismiss = onDismiss || (() => {});

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding setup"
      onClick={handleDismiss}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[99vh] flex flex-col relative dark:border dark:border-gray-700 m-2"
        onClick={(e) => e.stopPropagation()}
        style={{ height: "calc(100vh - 1rem)" }}
      >
        <div className="overflow-y-auto flex-1 p-6 pb-20 min-h-0">
          {/* Progress indicator */}
          <div
            className="flex items-center justify-center gap-2 mb-6"
            aria-label={`Step ${Math.min(currentStep + 1, totalSteps)} of ${totalSteps}`}
          >
            {Array.from({ length: totalSteps }).map((_, step) => (
              <div
                key={step}
                className={`h-2 w-16 rounded-full transition-all ${
                  step <= Math.min(currentStep, totalSteps - 1)
                    ? "bg-blue-600"
                    : "bg-gray-200 dark:bg-gray-700"
                }`}
              />
            ))}
          </div>

          {/* Step 0: Welcome */}
          {currentStep === 0 && (
            <WelcomeStep
              welcomeTheme={welcomeTheme}
              customHeroUrl={customHeroUrl}
              onNext={onNext}
            />
          )}

          {/* Step 1: Location */}
          {currentStep === 1 && (
            <LocationStep
              cityName={cityName}
              setCityName={(value) => dispatch({ type: "SET_LOCATION_FIELD", field: "cityName", value })}
              foundLocationName={foundLocationName}
              forecastLoading={forecastLoading}
              error={ui?.error}
              onKeyDown={handleCityKeyDown}
              onNext={handleLocationNext}
              totalSteps={totalSteps}
              currentStep={currentStep}
            />
          )}

          {/* Step 2: Building & HVAC */}
          {currentStep === 2 && (
            <BuildingHvacStep
              hvacSubstep={hvacSubstep}
              setHvacSubstep={setHvacSubstep}
              squareFeet={squareFeet}
              setSquareFeet={setSquareFeet}
              homeShape={homeShape}
              setHomeShape={setHomeShape}
              ceilingHeight={ceilingHeight}
              setCeilingHeight={setCeilingHeight}
              insulationLevel={insulationLevel}
              setInsulationLevel={setInsulationLevel}
              globalHomeElevation={globalHomeElevation}
              setHomeElevation={setHomeElevation}
              primarySystem={primarySystem}
              setPrimarySystem={setPrimarySystem}
              capacity={capacity}
              setCapacity={setCapacity}
              efficiency={efficiency}
              setEfficiency={setEfficiency}
              hspf2={hspf2}
              setHspf2={setHspf2}
              afue={afue}
              setAfue={setAfue}
              coolingSystem={coolingSystem}
              setCoolingSystem={setCoolingSystem}
              coolingCapacity={coolingCapacity}
              setCoolingCapacity={setCoolingCapacity}
              onNext={onNext}
              onBack={() => setStep(1)}
              totalSteps={totalSteps}
              currentStep={currentStep}
            />
          )}

          {/* Step 3: API Key (Optional) */}
          {currentStep === 3 && (
            <ApiKeyStep
              groqApiKey={groqApiKey}
              setGroqApiKey={setGroqApiKey}
              onNext={onNext}
              onBack={() => setStep(2)}
              currentStep={currentStep}
              totalSteps={totalSteps}
            />
          )}

          {/* Step 4: Review & Complete */}
          {currentStep === 4 && (
            <ReviewStep
              foundLocationName={foundLocationName}
              squareFeet={squareFeet}
              capacity={capacity}
              primarySystem={primarySystem}
              hspf2={hspf2}
              efficiency={efficiency}
              afue={afue}
              groqApiKey={groqApiKey}
              utilityCost={utilityCost}
              gasCost={gasCost}
              onComplete={onComplete}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
};

// Step 0: Welcome
const WelcomeStep = ({ welcomeTheme, customHeroUrl, onNext }) => (
  <div className="text-center">
    <div className="rounded-2xl overflow-hidden mb-6 border dark:border-gray-800 h-48 md:h-56">
      {welcomeTheme === "custom" ? (
        customHeroUrl ? (
          <img
            src={customHeroUrl}
            alt="Custom welcome background"
            className="w-full h-full object-cover"
            loading="eager"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
            Welcome
          </div>
        )
      ) : (
        <img
          src={WELCOME_THEMES[welcomeTheme]?.file ? buildPublicPath(WELCOME_THEMES[welcomeTheme].file) : ""}
          fetchpriority="high"
          alt={`${WELCOME_THEMES[welcomeTheme]?.label} calming background`}
          className="w-full h-full object-cover"
          loading="eager"
        />
      )}
    </div>
    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1">
      Welcome — take a breath
    </h2>
    <p className="text-lg text-gray-500 dark:text-gray-400 mb-4">
      to the Energy Cost Forecaster
    </p>
    <p className="sr-only">Welcome to Energy Cost Forecaster</p>
    <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-6 max-w-xl mx-auto">
      We'll guide you step by step. No rush, no jargon—just a simple path to understanding your energy costs.
    </p>

    <p className="text-xs text-gray-500 dark:text-gray-400 mb-6">
      Uses sensible defaults. You'll still confirm your home details for accurate estimates.
    </p>

    <p className="text-xs text-gray-500 dark:text-gray-400 mt-6 mb-6">
      Want to change this image later?{" "}
      <Link
        to="/settings#personalization"
        className="underline text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
      >
        Customize in Settings
      </Link>
    </p>

    <button onClick={onNext} className="btn btn-primary px-8 py-3 text-lg">
      Let's Begin
    </button>
  </div>
);

// Step 1: Location
const LocationStep = ({
  cityName,
  setCityName,
  foundLocationName,
  forecastLoading,
  error,
  onKeyDown,
  onNext,
  totalSteps,
  currentStep,
}) => (
  <div className="text-center">
    <div className="mb-4">
      <MapPin size={48} className="mx-auto text-blue-600 dark:text-blue-400" />
    </div>
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
      STEP {Math.min(currentStep + 1, totalSteps)} OF {totalSteps}
    </p>
    <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
      Where do you live?
    </h2>
    <p className="text-base text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
      We use this for local weather and utility rate data.
    </p>

    <div className="bg-blue-50 dark:bg-blue-950 dark:border dark:border-blue-800 rounded-xl p-6 mb-6">
      <input
        type="text"
        value={cityName}
        onChange={(e) => setCityName(e.target.value)}
        placeholder="Enter city, state (e.g., Denver, CO or Atlanta, GA)"
        className={fullInputClasses}
        onKeyDown={onKeyDown}
        aria-invalid={!!error}
        aria-describedby={error ? "city-input-error" : undefined}
      />
      <p className="text-xs text-gray-600 dark:text-gray-300 mb-3">
        Format: <span className="font-semibold">City, State</span> (e.g., <span className="italic">Denver, CO</span>).{" "}
        <span className="font-semibold">Include a comma</span> between city and state for best results.
      </p>

      {error && (
        <div
          id="city-input-error"
          className="flex items-center gap-2 mt-3 mb-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/40 dark:border-red-700 dark:text-red-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v2m0 4h.01M21 12c0 4.97-4.03 9-9 9s-9-4.03-9-9 4.03-9 9-9 9 4.03 9 9z"
            />
          </svg>
          <span className="text-sm font-medium">{error}</span>
        </div>
      )}
      {foundLocationName && !forecastLoading && (
        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg dark:bg-green-900/30 dark:border-green-700">
          <p className="text-green-800 text-sm dark:text-green-400">✓ Found: {foundLocationName}</p>
        </div>
      )}
    </div>

    <button
      onClick={onNext}
      disabled={forecastLoading}
      className="btn btn-primary px-8 py-3 text-lg disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {forecastLoading ? "Loading..." : "Next →"}
    </button>
  </div>
);

// Step 2: Building & HVAC (simplified - shows the structure)
const BuildingHvacStep = ({
  hvacSubstep,
  setHvacSubstep,
  squareFeet,
  setSquareFeet,
  homeShape,
  setHomeShape,
  ceilingHeight,
  setCeilingHeight,
  insulationLevel,
  setInsulationLevel,
  globalHomeElevation,
  setHomeElevation,
  primarySystem,
  setPrimarySystem,
  capacity,
  setCapacity,
  efficiency,
  setEfficiency,
  hspf2,
  setHspf2,
  afue,
  setAfue,
  coolingSystem,
  setCoolingSystem,
  coolingCapacity,
  setCoolingCapacity,
  onNext,
  onBack,
  totalSteps,
  currentStep,
}) => (
  <div className="text-center">
    <div className="mb-4">
      {hvacSubstep === 1 ? (
        <Home size={48} className="mx-auto text-blue-600 dark:text-blue-400" />
      ) : (
        <Thermometer size={48} className="mx-auto text-blue-600 dark:text-blue-400" />
      )}
    </div>
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">STEP {Math.min(currentStep + 1, totalSteps)} OF {totalSteps}</p>
    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
      {hvacSubstep === 1 ? "Tell us about your home" : "Tell us about your HVAC system"}
    </h2>
    <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">Part {hvacSubstep} of 2</p>
    <div className="flex items-center justify-center gap-2 mb-4">
      {[1, 2].map((step) => (
        <div
          key={step}
          className={`h-1.5 w-16 rounded-full ${step <= hvacSubstep ? "bg-blue-600" : "bg-gray-300 dark:bg-gray-700"}`}
        />
      ))}
    </div>

    <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-5 mb-4 text-left">
      {hvacSubstep === 1 ? (
        <BuildingSubstep
          squareFeet={squareFeet}
          setSquareFeet={setSquareFeet}
          homeShape={homeShape}
          setHomeShape={setHomeShape}
          ceilingHeight={ceilingHeight}
          setCeilingHeight={setCeilingHeight}
          insulationLevel={insulationLevel}
          setInsulationLevel={setInsulationLevel}
          globalHomeElevation={globalHomeElevation}
          setHomeElevation={setHomeElevation}
          onNext={() => setHvacSubstep(2)}
          onBack={onBack}
        />
      ) : (
        <HvacSubstep
          primarySystem={primarySystem}
          setPrimarySystem={setPrimarySystem}
          capacity={capacity}
          setCapacity={setCapacity}
          efficiency={efficiency}
          setEfficiency={setEfficiency}
          hspf2={hspf2}
          setHspf2={setHspf2}
          afue={afue}
          setAfue={setAfue}
          coolingSystem={coolingSystem}
          setCoolingSystem={setCoolingSystem}
          coolingCapacity={coolingCapacity}
          setCoolingCapacity={setCoolingCapacity}
          onNext={onNext}
          onBack={() => setHvacSubstep(1)}
        />
      )}
    </div>
  </div>
);

// Building substep
const BuildingSubstep = ({
  squareFeet,
  setSquareFeet,
  homeShape,
  setHomeShape,
  ceilingHeight,
  setCeilingHeight,
  insulationLevel,
  setInsulationLevel,
  globalHomeElevation,
  setHomeElevation,
  onNext,
  onBack,
}) => (
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-100 mb-2">Home Size</label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="800"
          max="4000"
          step="100"
          value={squareFeet}
          onChange={(e) => setSquareFeet(Number(e.target.value))}
          className="flex-grow"
        />
        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 min-w-[120px]">
          {squareFeet.toLocaleString()} sq ft
        </span>
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Building Type</label>
        <select value={homeShape} onChange={(e) => setHomeShape(Number(e.target.value))} className={selectClasses}>
          <option value={1.1}>Ranch / Single-Story</option>
          <option value={0.9}>Two-Story</option>
          <option value={1.0}>Split-Level</option>
          <option value={1.25}>Cabin / A-Frame</option>
          <option value={1.15}>Manufactured Home</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Affects surface area exposure</p>
      </div>
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Ceiling Height</label>
        <select value={ceilingHeight} onChange={(e) => setCeilingHeight(Number(e.target.value))} className={selectClasses}>
          <option value={8}>8 feet (standard)</option>
          <option value={9}>9 feet</option>
          <option value={10}>10 feet</option>
          <option value={12}>12 feet (vaulted)</option>
          <option value={16}>16+ feet (cathedral)</option>
        </select>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Average ceiling height</p>
      </div>
    </div>
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">
        How well insulated is your home?
      </label>
      <select value={insulationLevel} onChange={(e) => setInsulationLevel(Number(e.target.value))} className={selectClasses}>
        <option value={1.4}>Poor (older home, drafty)</option>
        <option value={1.0}>Average (typical home)</option>
        <option value={0.65}>Good (well-insulated, newer)</option>
      </select>
    </div>
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-100 mb-2">Elevation</label>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="8000"
          step="100"
          value={globalHomeElevation || 0}
          onChange={(e) => setHomeElevation(Number(e.target.value))}
          className="flex-grow"
        />
        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400 min-w-[120px]">
          {(globalHomeElevation || 0).toLocaleString()} ft
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        Higher elevation increases heating costs (thinner air, less efficient heat pumps)
      </p>
    </div>
    <div className="flex gap-3 justify-center pt-2">
      <button onClick={onBack} className="btn btn-outline px-6 py-3">← Back</button>
      <button onClick={onNext} className="btn btn-primary px-8 py-3 text-lg">Next →</button>
    </div>
  </div>
);

// HVAC substep (simplified)
const HvacSubstep = ({
  primarySystem,
  setPrimarySystem,
  capacity,
  setCapacity,
  efficiency,
  setEfficiency,
  hspf2,
  setHspf2,
  afue,
  setAfue,
  coolingSystem,
  setCoolingSystem,
  coolingCapacity,
  setCoolingCapacity,
  onNext,
  onBack,
}) => (
  <div className="space-y-6">
    <div>
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-2">Primary Heating System</label>
      <div className="inline-flex rounded-lg border-2 border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-800 p-1">
        <button
          onClick={() => setPrimarySystem("heatPump")}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            primarySystem === "heatPump"
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          ⚡ Heat Pump
        </button>
        <button
          onClick={() => setPrimarySystem("gasFurnace")}
          className={`px-6 py-2 rounded-md font-semibold transition-all ${
            primarySystem === "gasFurnace"
              ? "bg-blue-600 text-white shadow-md"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          }`}
        >
          🔥 Gas Furnace
        </button>
      </div>
    </div>

    {primarySystem === "heatPump" && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">Capacity (kBTU)</label>
          <select value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} className={selectClasses}>
            {[18, 24, 30, 36, 42, 48, 60].map((bt) => (
              <option key={bt} value={bt}>{bt}k BTU ({(bt / 12).toFixed(1)} tons)</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">HSPF2</label>
          <input
            type="number"
            min={6}
            max={13}
            step={0.1}
            value={hspf2}
            onChange={(e) => setHspf2(Math.min(13, Math.max(6, Number(e.target.value))))}
            className={inputClasses}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300 mb-1">SEER2</label>
          <input
            type="number"
            min={13}
            max={22}
            step={1}
            value={efficiency}
            onChange={(e) => setEfficiency(Math.min(22, Math.max(13, Number(e.target.value))))}
            className={inputClasses}
          />
        </div>
      </div>
    )}

    {primarySystem === "gasFurnace" && (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Furnace Efficiency (AFUE)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.60"
              max="0.99"
              step="0.01"
              value={typeof afue === "number" ? afue : 0.95}
              onChange={(e) => setAfue(Math.min(0.99, Math.max(0.6, Number(e.target.value))))}
              className="flex-grow"
            />
            <span className="text-xl font-bold text-blue-600 dark:text-blue-400 min-w-[90px]">
              {Math.round((afue ?? 0.95) * 100)}%
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Typical range: 60%–99%. Default 95%.</p>
        </div>
      </div>
    )}

    <div className="flex gap-3 justify-center pt-2">
      <button onClick={onBack} className="btn btn-outline px-6 py-3">← Back</button>
      <button onClick={onNext} className="btn btn-primary px-8 py-3 text-lg">Next →</button>
    </div>
  </div>
);

// Step 3: API Key
const ApiKeyStep = ({ groqApiKey, setGroqApiKey, onNext, onBack, currentStep, totalSteps = 5 }) => (
  <div className="text-center">
    <div className="mb-3">
      <Zap size={40} className="mx-auto text-purple-600 dark:text-purple-400" />
    </div>
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">STEP {Math.min(currentStep + 1, totalSteps)} OF {totalSteps}</p>
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Enable Ask Joule AI (Optional)</h2>
    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-2">
      Ask Joule is your AI assistant for natural language queries like "What if I had a 10 HSPF system?" or "Set winter to 68".
    </p>
    <p className="text-xs text-purple-600 dark:text-purple-400 font-semibold mb-4">
      ✨ This step is completely optional — you can skip if you don't need AI features.
    </p>

    <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 rounded-xl shadow-md p-5 mb-4 text-left border-2 border-purple-200 dark:border-purple-800">
      <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
        <span>🔑</span> Free Groq API Key
      </h3>
      <p className="text-xs text-gray-700 dark:text-gray-300 mb-3">
        Groq provides <strong className="text-purple-600 dark:text-purple-400">free API access</strong> with generous limits. Get your key in 60 seconds:
      </p>
      <ol className="space-y-1.5 text-xs text-gray-700 dark:text-gray-300 mb-3 list-decimal list-inside">
        <li>
          Visit{" "}
          <a
            href="https://console.groq.com/keys"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
          >
            console.groq.com/keys
          </a>{" "}
          (opens in new tab)
        </li>
        <li>Sign up with Google/GitHub (takes 30 seconds)</li>
        <li>Click "Create API Key" and copy it</li>
        <li>Paste it below or save it in Settings later</li>
      </ol>
      <input
        type="password"
        value={groqApiKey || ""}
        onChange={(e) => setGroqApiKey(e.target.value)}
        placeholder="Paste your Groq API key here (optional)"
        className={fullInputClasses}
      />
    </div>

    <div className="flex gap-3 justify-center">
      <button onClick={onBack} className="btn btn-outline px-6 py-3">← Back</button>
      <button onClick={onNext} className="btn btn-primary px-8 py-3 text-lg">
        {groqApiKey ? "Next →" : "Skip for now →"}
      </button>
    </div>
  </div>
);

// Step 4: Review
const ReviewStep = ({
  foundLocationName,
  squareFeet,
  capacity,
  primarySystem,
  hspf2,
  efficiency,
  afue,
  groqApiKey,
  utilityCost,
  gasCost,
  onComplete,
  onBack,
}) => {
  const navigate = useNavigate();

  const handleStartTour = () => {
    // Clear the tour completion flag so the tour will start
    try {
      localStorage.removeItem("dashboardTourCompleted");
    } catch (err) {
      console.warn("Failed to clear tour flag", err);
    }
    // Complete onboarding first
    onComplete();
    // Navigate to home page - FeatureTour will automatically start
    setTimeout(() => {
      navigate("/");
    }, 100);
  };

  return (
    <div className="text-center">
      <div className="mb-3 text-5xl">✅</div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">You're All Set!</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
        Here's what we've gathered. You can adjust these anytime in Settings.
      </p>

      <div className="bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-blue-950 rounded-xl shadow-md p-5 mb-4 text-left border-2 border-gray-200 dark:border-gray-700">
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">📍 Location</span>
            <span className="font-semibold text-gray-900 dark:text-white">{foundLocationName || "Not set"}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">🏠 Home Size</span>
            <span className="font-semibold text-gray-900 dark:text-white">{squareFeet?.toLocaleString()} sq ft</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">⚡ System</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {primarySystem === "heatPump"
                ? `Heat Pump ${capacity ?? 36}k BTU (HSPF2: ${hspf2 ?? 9.0}, SEER2: ${efficiency ?? 16})`
                : `Gas Furnace (AFUE: ${Math.round((afue ?? 0.95) * 100)}%)`}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">💡 Electricity Rate</span>
            <span className="font-semibold text-gray-900 dark:text-white">${utilityCost?.toFixed(3) || "N/A"}/kWh</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-600 dark:text-gray-400">🔑 Ask Joule AI</span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {groqApiKey ? "Enabled ✓" : "Skipped"}
            </span>
          </li>
        </ul>
      </div>

      <div className="flex gap-3 justify-center">
        <button onClick={onBack} className="btn btn-outline px-6 py-3">← Back</button>
        <button onClick={onComplete} className="btn btn-primary px-8 py-3 text-lg">Go to Overview</button>
      </div>

      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl shadow-md p-6 mt-6 text-center border-2 border-blue-200 dark:border-blue-800">
        <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">Want a quick tour of all the features?</p>
        <button
          onClick={handleStartTour}
          className="btn btn-outline px-6 py-2 text-sm"
        >
          Start Feature Tour →
        </button>
      </div>
    </div>
  );
};

export default OnboardingWizard;

