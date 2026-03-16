import React from "react";
import MedicationHalfLifeTracker from "../components/MedicationHalfLifeTracker";

export default function LamotrigineTracker() {
  return (
    <MedicationHalfLifeTracker
      title="Lamotrigine Tracker"
      subtitle="Track lamotrigine doses over time using a configurable half-life model."
      storagePrefix="lamotrigineTracker"
      halfLifeOptions={[24, 29, 35]}
      defaultHalfLifeHours={29}
      showToleranceTracking
      toleranceMaxReduction={0.08}
      toleranceTauDays={24}
      toleranceReductionLabel="Estimated modulation adaptation"
    />
  );
}
