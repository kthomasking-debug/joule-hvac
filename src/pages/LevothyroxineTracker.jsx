import React from "react";
import MedicationHalfLifeTracker from "../components/MedicationHalfLifeTracker";

export default function LevothyroxineTracker() {
  return (
    <MedicationHalfLifeTracker
      title="Levothyroxine Tracker"
      subtitle="Track levothyroxine doses over time using a configurable half-life model."
      storagePrefix="levothyroxineTracker"
      halfLifeOptions={[144, 168, 192]}
      defaultHalfLifeHours={168}
      showToleranceTracking
      toleranceMaxReduction={0.12}
      toleranceTauDays={30}
      toleranceReductionLabel="Estimated activation adaptation"
    />
  );
}
