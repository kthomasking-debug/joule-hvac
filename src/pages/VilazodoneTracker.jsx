import React from "react";
import MedicationHalfLifeTracker from "../components/MedicationHalfLifeTracker";

export default function VilazodoneTracker() {
  return (
    <MedicationHalfLifeTracker
      title="Vilazodone Tracker"
      subtitle="Track vilazodone doses over time using a configurable half-life model."
      storagePrefix="vilazodoneTracker"
      halfLifeOptions={[20, 25, 30]}
      defaultHalfLifeHours={25}
      showToleranceTracking
      toleranceMaxReduction={0.15}
      toleranceTauDays={18}
      toleranceReductionLabel="Estimated sedative adaptation"
    />
  );
}
