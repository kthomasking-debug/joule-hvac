import React, { useState, useEffect } from "react";
import { AlertTriangle, Info, ChevronDown } from "lucide-react";
import { queryRAGForManualJHeatLoss } from "../utils/heatLossResolution";

const TypicalBuildingFallbackCard = ({
  squareFeet,
  fallbackHeatLoss,
  onUploadBetterFile,
  userSettings = {},
}) => {
  const [ragResult, setRagResult] = useState(null);
  const [loadingRAG, setLoadingRAG] = useState(true);

  useEffect(() => {
    // Query RAG for Manual J data
    queryRAGForManualJHeatLoss(userSettings).then((result) => {
      setRagResult(result);
      setLoadingRAG(false);
    });
  }, [userSettings]);
  const [showDetails, setShowDetails] = useState(false);
  const deltaT = 70; // indoor-outdoor difference for explanation
  
  // Use RAG result if available, otherwise fallback
  const heatLossFactor = ragResult?.success ? ragResult.heatLossFactor : fallbackHeatLoss;
  const btuAt70 = Math.round(heatLossFactor * deltaT);
  const hasRAGData = ragResult?.success && ragResult.source !== 'none';

  return (
    <div className="bg-[#0C1118] border border-amber-500/40 rounded-xl p-5 mb-4 space-y-3">
      {/* Header */}
      <div className="flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-300 mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold text-amber-100">
            We couldn't find a long "coast down" period
          </h2>
          <p className="mt-1 text-xs text-[#A7B0BA]">
            To measure your heat loss from data, Joule needs a few hours where the heat is off and the house is drifting down. Your file doesn't have a long enough "off" stretch to do that.
          </p>
        </div>
      </div>

      {/* What the system does now */}
      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
        <p className="text-xs font-semibold text-slate-100 mb-2">
          Here's what Joule will do instead:
        </p>
        <ul className="list-disc list-inside text-xs text-[#A7B0BA] space-y-1">
          <li>Use your onboarding answers (home size, age, insulation, equipment)</li>
          <li>Look for any Manual J / design report details in your account</li>
          <li>Fit a "design heat loss" and convert it into BTU/hr/°F for your house</li>
        </ul>
      </div>

      {/* RAG result or fallback message */}
      {loadingRAG ? (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
          <p className="text-xs text-[#A7B0BA]">Checking your onboarding data...</p>
        </div>
      ) : hasRAGData ? (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-100 mb-2">
            Using design data instead of drift test
          </p>
          <p className="text-xs text-[#A7B0BA] mb-2">
            Based on your onboarding and design info, Joule will use:
          </p>
          <div className="bg-slate-900 rounded p-2 space-y-1">
            <p className="text-xs text-slate-200">
              <span className="font-semibold">Estimated building heat loss:</span>
            </p>
            <ul className="list-disc list-inside text-xs text-[#A7B0BA] ml-2 space-y-0.5">
              <li>≈ {heatLossFactor.toLocaleString()} BTU/hr/°F</li>
              <li>≈ {btuAt70.toLocaleString()} BTU/hr at a 70°F temperature difference</li>
            </ul>
          </div>
          <p className="text-xs text-[#7C8894] mt-2">
            You can always override this later in Settings → Home Setup → Building Characteristics.
          </p>
        </div>
      ) : (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-slate-100 mb-2">
            We couldn't find a design heat loss number either
          </p>
          <p className="text-xs text-[#A7B0BA] mb-2">
            Joule couldn't see a Manual J report or a clear "design heat loss" in your onboarding answers.
          </p>
          <p className="text-xs text-[#A7B0BA] mb-2">
            For now, we'll use a conservative building heat loss based on your square footage and home type. You can tighten this up later by:
          </p>
          <ul className="list-disc list-inside text-xs text-[#A7B0BA] space-y-1 ml-2">
            <li>Uploading a night with the heat fully OFF for 3–4 hours</li>
            <li>Or entering a number from a Manual J / design report in Settings</li>
          </ul>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap gap-3">
        {onUploadBetterFile && (
          <button
            type="button"
            onClick={onUploadBetterFile}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors border border-slate-700"
          >
            Back to upload another file
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            // Continue with estimated heat loss - this will be handled by parent
            if (onUploadBetterFile) {
              // If we have a callback, we can dismiss or continue
              // For now, just allow the analysis to proceed
            }
          }}
          className="px-4 py-2 rounded-lg bg-[#1E4CFF] hover:bg-blue-500 text-xs font-semibold text-white transition-colors"
        >
          Continue with estimated heat loss
        </button>
      </div>
      <p className="text-[11px] text-[#7C8894]">
        You can review or change this in Settings later.
      </p>

      {/* Nerdy details */}
      <button
        type="button"
        onClick={() => setShowDetails((s) => !s)}
        className="flex items-center gap-1 text-[11px] text-[#7C8894] hover:text-slate-200 transition-colors"
      >
        <Info className="w-3 h-3" />
        <span>{showDetails ? "Hide" : "Show"} technical details</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${showDetails ? 'rotate-180' : ''}`} />
      </button>

      {showDetails && (
        <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-[11px] text-[#9BA7B6] space-y-1.5">
          <p>
            • Coast-down analysis failed: there was no continuous period of at
            least 3 hours with the heating system off, so Joule couldn't safely
            fit a cooling curve for your house.
          </p>
          <p>
            • Instead, Joule used a heat-loss factor of{" "}
            <span className="font-mono text-slate-100">
              {heatLossFactor.toLocaleString()} BTU/hr/°F
            </span>
            {hasRAGData ? (
              <> based on design data and Manual J methodology.</>
            ) : (
              <> for a typical detached home around{" "}
              {squareFeet.toLocaleString()} sq ft.</>
            )}
          </p>
          <p>
            • That's about{" "}
            <span className="font-mono text-slate-100">
              {btuAt70.toLocaleString()} BTU/hr
            </span>{" "}
            at a 70°F indoor–outdoor difference.
          </p>
        </div>
      )}
    </div>
  );
};

export default TypicalBuildingFallbackCard;

