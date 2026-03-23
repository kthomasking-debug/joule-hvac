import React from "react";
import MedicationHalfLifeTracker from "../components/MedicationHalfLifeTracker";

export default function DoxylamineTracker() {
  return (
    <MedicationHalfLifeTracker
      title="Doxylamine Tracker"
      subtitle="Track doxylamine doses over time using a configurable half-life model."
      storagePrefix="doxylamineTracker"
      halfLifeOptions={[8, 10, 12]}
      defaultHalfLifeHours={10}
      defaultDoseMg={25}
      showToleranceTracking
      toleranceMaxReduction={0.25}
      toleranceTauDays={8}
      toleranceReductionLabel="Estimated sedative adaptation"
    />
  );
}
