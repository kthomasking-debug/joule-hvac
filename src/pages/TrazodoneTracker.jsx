import React from "react";
import MedicationHalfLifeTracker from "../components/MedicationHalfLifeTracker";

export default function TrazodoneTracker() {
  return (
    <MedicationHalfLifeTracker
      title="Trazodone Tracker"
      subtitle="Track trazodone doses over time using a configurable half-life model."
      storagePrefix="trazodoneTracker"
      halfLifeOptions={[5, 7, 9]}
      defaultHalfLifeHours={7}
      defaultDoseMg={50}
      showToleranceTracking
      toleranceMaxReduction={0.28}
      toleranceTauDays={10}
      toleranceReductionLabel="Estimated sedative adaptation"
    />
  );
}
