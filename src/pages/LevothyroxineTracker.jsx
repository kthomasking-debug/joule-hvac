import React from "react";
import MedicationHalfLifeTracker from "../components/MedicationHalfLifeTracker";

export default function LevothyroxineTracker() {
  return (
    <MedicationHalfLifeTracker
      title="Levothyroxine Tracker"
      subtitle="Track levothyroxine doses over time using a configurable half-life model. Doses are shown in micrograms (mcg)."
      storagePrefix="levothyroxineTracker"
      halfLifeOptions={[144, 168, 192]}
      defaultHalfLifeHours={168}
      defaultDoseMg={25}
      doseUnit="mcg"
      doseStep="12.5"
      doseMin="12.5"
      showToleranceTracking
      toleranceMaxReduction={0.12}
      toleranceTauDays={30}
      toleranceReductionLabel="Estimated activation adaptation"
    />
  );
}
