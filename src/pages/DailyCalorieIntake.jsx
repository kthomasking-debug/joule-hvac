import React, { useEffect, useMemo, useState } from "react";
import { Scale, TrendingDown, TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const CALORIE_PROFILES_STORAGE_KEY = "dailyCalorieProfilesV1";
const CALORIE_ACTIVE_PROFILE_STORAGE_KEY = "dailyCalorieActiveProfileId";
const WELLNESS_GLOBAL_USER_NAME_KEY = "wellnessGlobalUserName";
const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
const MEAL_TYPE_OPTIONS = ["breakfast", "lunch", "dinner", "snack", "beverage"];
const ALMOND_CALORIES_PER_CUP = 828;

const ACTIVITY_PRESETS = {
  sedentary: { label: "Sedentary", steps: 2000, description: "Little to no exercise" },
  light: { label: "Lightly Active", steps: 5000, description: "1-3 days/week exercise" },
  moderate: { label: "Moderately Active", steps: 8000, description: "3-5 days/week exercise" },
  veryActive: { label: "Very Active", steps: 12000, description: "6-7 days/week exercise" },
  extreme: { label: "Extremely Active", steps: 15000, description: "Very intense exercise" },
};

const DEFAULT_FORM = {
  unitSystem: "imperial",
  heightCm: "177.8",
  heightFeet: "5",
  heightInches: "10",
  weight: "93",
  steps: "1000",
  age: "43",
  sex: "female",
  goal: "maintain",
  currentCalories: "800",
};

// RDA/AI values based on NIH DRI tables (2020 revision)
// Sources: https://ods.od.nih.gov, https://www.dietaryguidelines.gov
function getDailyNutrientTargets(age, sex) {
  const ageNum = Math.max(1, Number(age) || 30);
  const sexNorm = String(sex).toLowerCase();
  const isFemale = sexNorm === "female";

  // Age bracket helpers
  const is14to18 = ageNum >= 14 && ageNum <= 18;
  const is19to50 = ageNum >= 19 && ageNum <= 50;
  const is51plus = ageNum >= 51;

  return {
    vitamins: [
      {
        name: "Vitamin A",
        unit: "mcg RAE",
        rda: is14to18 ? (isFemale ? 700 : 900) : is19to50 ? (isFemale ? 700 : 900) : (isFemale ? 700 : 900),
        note: "Supports vision, immune function, skin",
      },
      {
        name: "Vitamin C",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 65 : 75) : (isFemale ? 75 : 90),
        note: "Antioxidant, collagen synthesis, immune support",
      },
      {
        name: "Vitamin D",
        unit: "mcg",
        rda: is51plus ? 20 : 15,
        note: "Bone health, immune function, mood regulation",
      },
      {
        name: "Vitamin E",
        unit: "mg",
        rda: 15,
        note: "Antioxidant, cell protection",
      },
      {
        name: "Vitamin K",
        unit: "mcg",
        rda: isFemale ? 90 : 120,
        note: "(AI) Blood clotting, bone metabolism",
      },
      {
        name: "B1 (Thiamine)",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 1.0 : 1.2) : (isFemale ? 1.1 : 1.2),
        note: "Energy metabolism, nerve function",
      },
      {
        name: "B2 (Riboflavin)",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 1.0 : 1.3) : (isFemale ? 1.1 : 1.3),
        note: "Energy production, red blood cells",
      },
      {
        name: "B3 (Niacin)",
        unit: "mg NE",
        rda: is14to18 ? (isFemale ? 14 : 16) : (isFemale ? 14 : 16),
        note: "DNA repair, energy metabolism",
      },
      {
        name: "B6",
        unit: "mg",
        rda: is51plus ? (isFemale ? 1.5 : 1.7) : 1.3,
        note: "Amino acid metabolism, neurotransmitters",
      },
      {
        name: "B12",
        unit: "mcg",
        rda: 2.4,
        note: "Nerve health, red blood cells, DNA synthesis",
      },
      {
        name: "Folate",
        unit: "mcg DFE",
        rda: 400,
        note: "Cell division, DNA synthesis",
      },
    ],
    minerals: [
      {
        name: "Calcium",
        unit: "mg",
        rda: is14to18 ? 1300 : is51plus ? (isFemale ? 1200 : 1000) : 1000,
        note: "Bone/tooth structure, muscle, nerve signaling",
      },
      {
        name: "Iron",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 15 : 11) : is19to50 ? (isFemale ? 18 : 8) : 8,
        note: "Oxygen transport, energy production",
      },
      {
        name: "Magnesium",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 360 : 410) : is19to50 ? (isFemale ? 310 : 400) : (isFemale ? 320 : 420),
        note: "Enzyme reactions, muscle, nerve, blood sugar",
      },
      {
        name: "Phosphorus",
        unit: "mg",
        rda: is14to18 ? 1250 : 700,
        note: "Bones, teeth, energy metabolism (ATP)",
      },
      {
        name: "Potassium",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 2300 : 3000) : is19to50 ? (isFemale ? 2600 : 3400) : (isFemale ? 2600 : 3400),
        note: "(AI) Fluid balance, blood pressure, muscle",
      },
      {
        name: "Sodium",
        unit: "mg",
        rda: 1500,
        note: "(AI) Fluid balance, nerve/muscle function",
      },
      {
        name: "Zinc",
        unit: "mg",
        rda: is14to18 ? (isFemale ? 9 : 11) : (isFemale ? 8 : 11),
        note: "Immune function, wound healing, protein synthesis",
      },
      {
        name: "Selenium",
        unit: "mcg",
        rda: is14to18 ? 55 : 55,
        note: "Antioxidant, thyroid hormone metabolism",
      },
      {
        name: "Copper",
        unit: "mcg",
        rda: is14to18 ? 890 : 900,
        note: "Iron metabolism, connective tissue, nerves",
      },
      {
        name: "Manganese",
        unit: "mg",
        rda: isFemale ? 1.8 : 2.3,
        note: "(AI) Bone formation, carbohydrate metabolism",
      },
      {
        name: "Iodine",
        unit: "mcg",
        rda: is14to18 ? 150 : 150,
        note: "Thyroid hormone production",
      },
    ],
  };
}

function createProfile(name = "User 1") {
  return {
    id: `calorie-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    form: { ...DEFAULT_FORM },
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString(),
    weightHistory: [],
    mealLog: [],
  };
}

function localDateKey(value) {
  const date = value ? new Date(value) : new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseQuantityToken(token) {
  const value = String(token || "").trim();
  if (!value) return NaN;
  if (/^\d+\/\d+$/.test(value)) {
    const [num, den] = value.split("/").map(Number);
    if (den > 0) return num / den;
  }
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : NaN;
}

function extractCupAmount(text) {
  const source = String(text || "").toLowerCase();
  const match = source.match(/(\d+\/\d+|\d*\.?\d+)\s*cups?\b/);
  if (!match) return NaN;
  return parseQuantityToken(match[1]);
}

function normalizeFoodEstimate({ text, items, notes }) {
  const normalizedItems = Array.isArray(items) ? [...items] : [];
  let normalizedNotes = String(notes || "").trim();

  const lowerText = String(text || "").toLowerCase();
  const mentionsAlmond = /\balmonds?\b/.test(lowerText);

  if (mentionsAlmond) {
    const cups = extractCupAmount(text);
    if (Number.isFinite(cups) && cups > 0) {
      const correctedAlmondCalories = Math.round(cups * ALMOND_CALORIES_PER_CUP);
      const almondIndex = normalizedItems.findIndex((item) => /\balmonds?\b/.test(String(item?.food || "").toLowerCase()));
      if (almondIndex >= 0) {
        normalizedItems[almondIndex] = {
          ...normalizedItems[almondIndex],
          estimatedCalories: correctedAlmondCalories,
        };
      } else {
        normalizedItems.push({
          food: "Almonds",
          estimatedCalories: correctedAlmondCalories,
        });
      }

      const adjustmentNote = `Portion sanity check applied: almonds use ~${ALMOND_CALORIES_PER_CUP} kcal per cup.`;
      normalizedNotes = normalizedNotes
        ? `${normalizedNotes} ${adjustmentNote}`
        : adjustmentNote;
    }
  }

  const normalizedTotal = normalizedItems.reduce((sum, item) => {
    return sum + Math.max(0, Number(item?.estimatedCalories) || 0);
  }, 0);

  return {
    items: normalizedItems,
    totalCalories: Math.max(0, Math.round(normalizedTotal)),
    notes: normalizedNotes || "Estimated from typical serving sizes; adjust portions if needed.",
  };
}

function loadProfiles() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(CALORIE_PROFILES_STORAGE_KEY) || "[]"
    );
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
        .filter((p) => p && p.id && p.name)
        .map((p) => ({
          id: p.id,
          name: p.name,
          form: { ...DEFAULT_FORM, ...(p.form || {}) },
          createdAt: p.createdAt || new Date().toISOString(),
          lastModified: p.lastModified || new Date().toISOString(),
          weightHistory: Array.isArray(p.weightHistory) ? p.weightHistory : [],
          mealLog: Array.isArray(p.mealLog) ? p.mealLog : [],
        }));
    }
  } catch {
    // Ignore bad localStorage data and use a fresh default profile.
  }
  return [createProfile("User 1")];
}

function calculateDailyCalories({
  height,
  weight,
  steps = 0,
  age = 30,
  sex = "male",
  unitSystem = "imperial",
  goal = "maintain",
  currentCalories,
}) {
  const heightNum = Number(height);
  const weightNum = Number(weight);
  const stepsNum = Math.max(0, Number(steps) || 0);
  const ageNum = Math.max(1, Number(age) || 30);

  if (!Number.isFinite(heightNum) || !Number.isFinite(weightNum)) {
    return {
      error: true,
      message: "Height and weight must be valid numbers.",
    };
  }

  const heightCm =
    unitSystem === "metric" ? heightNum : Math.max(0, heightNum) * 2.54;
  const weightKg =
    unitSystem === "metric" ? weightNum : Math.max(0, weightNum) * 0.453592;

  if (heightCm <= 0 || weightKg <= 0) {
    return {
      error: true,
      message: "Height and weight must be greater than zero.",
    };
  }

  const warnings = [];
  if (unitSystem === "metric") {
    if (heightNum < 120 || heightNum > 230)
      warnings.push("Height looks outside a typical adult range (120-230 cm)");
    if (weightNum < 35 || weightNum > 230)
      warnings.push("Weight looks outside a typical adult range (35-230 kg)");
  } else {
    if (heightNum < 48 || heightNum > 90)
      warnings.push("Height looks outside a typical adult range (48-90 in)");
    if (weightNum < 80 || weightNum > 500)
      warnings.push("Weight looks outside a typical adult range (80-500 lb)");
  }
  if (ageNum < 16 || ageNum > 90)
    warnings.push("Age is outside a typical adult range (16-90)");
  if (stepsNum > 40000)
    warnings.push("Steps value is unusually high; double-check daily step count");
  if (stepsNum < 1000)
    warnings.push("Very low step count may underestimate daily energy needs if this is not a typical day");

  const currentCaloriesNum = Number(currentCalories);
  if (Number.isFinite(currentCaloriesNum) && currentCaloriesNum > 0) {
    if (currentCaloriesNum < 1000) {
      warnings.push("Current intake appears very low; this may be unsafe for many adults without clinical supervision");
    } else if (currentCaloriesNum < 1200) {
      warnings.push("Current intake is below 1200 kcal/day; consider clinician guidance if sustained");
    }
    if (currentCaloriesNum > 5000) {
      warnings.push("Current intake is unusually high; re-check entry value");
    }
  }

  const sexNormalized = String(sex).toLowerCase();
  const sexOffset = sexNormalized === "female" ? -161 : 5;
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageNum + sexOffset;

  let activityMultiplier = 1.2;
  if (stepsNum >= 12000) activityMultiplier = 1.75;
  else if (stepsNum >= 10000) activityMultiplier = 1.6;
  else if (stepsNum >= 7500) activityMultiplier = 1.45;
  else if (stepsNum >= 5000) activityMultiplier = 1.35;

  const maintenanceCalories = bmr * activityMultiplier;

  const goalNormalized = String(goal).toLowerCase();
  let adjustment = 0;
  if (goalNormalized === "lose") adjustment = -500;
  if (goalNormalized === "gain") adjustment = 300;

  const recommendedCalories = Math.max(1200, maintenanceCalories + adjustment);
  const heightM = heightCm / 100;
  const bmi = heightM > 0 ? weightKg / (heightM * heightM) : 0;
  const bmiCategory = classifyBmi(bmi);
  const weightLb = weightKg * 2.20462;
  const proteinPerLb =
    goalNormalized === "lose" ? 1.0 : goalNormalized === "gain" ? 0.9 : 0.8;
  const fatRatio =
    goalNormalized === "maintain" ? 0.3 : goalNormalized === "lose" ? 0.28 : 0.27;
  const proteinG = Math.round(weightLb * proteinPerLb);
  const fatG = Math.round((recommendedCalories * fatRatio) / 9);
  const carbsG = Math.max(
    0,
    Math.round((recommendedCalories - proteinG * 4 - fatG * 9) / 4)
  );

  if (recommendedCalories < 1400)
    warnings.push("Estimated calories are low; verify values and consider professional guidance");

  return {
    success: true,
    bmr: Math.round(bmr),
    activityMultiplier,
    bmi: Number(bmi.toFixed(1)),
    bmiCategory: bmiCategory.label,
    maintenanceCalories: Math.round(maintenanceCalories),
    recommendedCalories: Math.round(recommendedCalories),
    macroTargets: {
      proteinG,
      carbsG,
      fatG,
    },
    warnings,
  };
}

function classifyBmi(bmi) {
  const value = Number(bmi);
  if (!Number.isFinite(value) || value <= 0) {
    return { label: "-", toneClass: "text-gray-700 dark:text-gray-300" };
  }
  if (value < 18.5) {
    return { label: "Underweight", toneClass: "text-amber-700 dark:text-amber-300" };
  }
  if (value < 25) {
    return { label: "Normal", toneClass: "text-green-700 dark:text-green-300" };
  }
  if (value < 30) {
    return { label: "Overweight", toneClass: "text-orange-700 dark:text-orange-300" };
  }
  return { label: "Obese", toneClass: "text-red-700 dark:text-red-300" };
}

function getActivityFromSteps(steps) {
  const stepsNum = Math.max(0, Number(steps) || 0);
  if (stepsNum >= 12000) return { key: "veryActive", label: "Very Active", multiplier: 1.75 };
  if (stepsNum >= 10000) return { key: "veryActive", label: "Very Active", multiplier: 1.6 };
  if (stepsNum >= 7500) return { key: "moderate", label: "Moderately Active", multiplier: 1.45 };
  if (stepsNum >= 5000) return { key: "light", label: "Lightly Active", multiplier: 1.35 };
  return { key: "sedentary", label: "Sedentary", multiplier: 1.2 };
}

function getProfileConfidence(form, result) {
  const isMetric = form.unitSystem === "metric";
  const heightValue = isMetric
    ? Number(form.heightCm)
    : (Math.max(0, Number(form.heightFeet) || 0) * 12) + Math.max(0, Number(form.heightInches) || 0);
  const weightValue = Number(form.weight);
  const stepsValue = Number(form.steps);
  const ageValue = Number(form.age);
  const currentCaloriesValue = Number(form.currentCalories);

  const checks = [
    Number.isFinite(heightValue) && heightValue > 0,
    Number.isFinite(weightValue) && weightValue > 0,
    Number.isFinite(stepsValue) && stepsValue >= 0,
    Number.isFinite(ageValue) && ageValue > 0,
    form.sex === "male" || form.sex === "female",
    form.goal === "maintain" || form.goal === "lose" || form.goal === "gain",
    Number.isFinite(currentCaloriesValue) && currentCaloriesValue > 0,
  ];

  const validCount = checks.filter(Boolean).length;
  const completenessRatio = validCount / checks.length;
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const warningCount = warnings.length;

  // Weight warnings by severity so clinically concerning inputs reduce confidence more.
  const warningPenalty = warnings.reduce((total, warning) => {
    const text = String(warning || "").toLowerCase();
    if (text.includes("unsafe") || text.includes("clinical supervision")) return total + 0.14;
    if (text.includes("very low") || text.includes("below 1200")) return total + 0.1;
    if (text.includes("unusually high") || text.includes("outside a typical adult range")) return total + 0.08;
    return total + 0.06;
  }, 0);

  let score = completenessRatio;
  if (result?.error) score -= 0.45;
  score -= Math.min(0.45, warningPenalty);

  const boundedScore = Math.max(0, Math.min(1, score));

  let label = "Low";
  if (boundedScore >= 0.8 && warningCount <= 2) label = "High";
  else if (boundedScore >= 0.6) label = "Medium";

  const colorClass =
    label === "High"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
      : label === "Medium"
        ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
        : "bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200";

  const detail = `${Math.round(completenessRatio * 100)}% fields valid; ${warningCount} plausibility warning${warningCount === 1 ? "" : "s"}.`;

  return {
    label,
    colorClass,
    detail,
    scorePercent: Math.round(boundedScore * 100),
  };
}

export default function DailyCalorieIntake() {
  const [profiles, setProfiles] = useState(() => loadProfiles());
  const [activeProfileId, setActiveProfileId] = useState(() => {
    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    const loadedProfiles = loadProfiles();

    if (globalUserName) {
      const existingProfile = loadedProfiles.find((p) => p.name === globalUserName);
      if (existingProfile) {
        return existingProfile.id;
      }
    }

    const savedId = localStorage.getItem(CALORIE_ACTIVE_PROFILE_STORAGE_KEY);
    if (savedId && loadedProfiles.some((p) => p.id === savedId)) return savedId;
    return loadedProfiles[0].id;
  });
  const [saveMessage, setSaveMessage] = useState("");
  const [showDualUnits, setShowDualUnits] = useState(false);
  const [loggedWeight, setLoggedWeight] = useState("");
  const [foodDescription, setFoodDescription] = useState("");
  const [foodEstimateLoading, setFoodEstimateLoading] = useState(false);
  const [foodEstimateError, setFoodEstimateError] = useState("");
  const [foodEstimateResult, setFoodEstimateResult] = useState(null);
  const [mealType, setMealType] = useState("meal");

  // Auto-create or switch to global wellness user if set
  useEffect(() => {
    const globalUserName = localStorage.getItem(WELLNESS_GLOBAL_USER_NAME_KEY);
    if (!globalUserName) return;

    setProfiles((prevProfiles) => {
      const existingProfile = prevProfiles.find((p) => p.name === globalUserName);
      if (existingProfile) {
        setActiveProfileId(existingProfile.id);
        setForm({ ...DEFAULT_FORM, ...(existingProfile.form || {}) });
        return prevProfiles;
      }

      // Create new profile with global user name
      const newProfile = createProfile(globalUserName);
      setActiveProfileId(newProfile.id);
      return [...prevProfiles, newProfile];
    });
  }, []);

  const activeProfile = useMemo(() => {
    return profiles.find((p) => p.id === activeProfileId) || profiles[0];
  }, [profiles, activeProfileId]);

  const [form, setForm] = useState(() => activeProfile?.form || { ...DEFAULT_FORM });

  useEffect(() => {
    localStorage.setItem(CALORIE_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  useEffect(() => {
    localStorage.setItem(CALORIE_ACTIVE_PROFILE_STORAGE_KEY, activeProfileId);
  }, [activeProfileId]);

  const result = useMemo(() => {
    const imperialTotalInches =
      (Math.max(0, Number(form.heightFeet) || 0) * 12) +
      Math.max(0, Number(form.heightInches) || 0);

    const heightForCalc =
      form.unitSystem === "metric" ? form.heightCm : imperialTotalInches;

    return calculateDailyCalories({
      ...form,
      height: heightForCalc,
    });
  }, [form]);

  const activityFromSteps = useMemo(() => getActivityFromSteps(form.steps), [form.steps]);
  const exactPresetMatch = useMemo(() => {
    return Object.entries(ACTIVITY_PRESETS).find(([, preset]) => String(preset.steps) === String(form.steps)) || null;
  }, [form.steps]);

  const setField = (key, value) => {
    setSaveMessage("");
    setForm((prev) => {
      const nextForm = { ...prev, [key]: value };
      setProfiles((prevProfiles) =>
        prevProfiles.map((profile) =>
          profile.id === activeProfileId
            ? { ...profile, form: { ...nextForm }, lastModified: new Date().toISOString() }
            : profile
        )
      );
      return nextForm;
    });
  };

  const estimateFoodCaloriesWithGroq = async () => {
    const text = foodDescription.trim();
    if (!text) {
      setFoodEstimateError("Describe what you ate first.");
      setFoodEstimateResult(null);
      return;
    }

    const groqApiKey = (localStorage.getItem("groqApiKey") || import.meta.env?.VITE_GROQ_API_KEY || "").trim();
    if (!groqApiKey) {
      setFoodEstimateError("Groq API key not found. Add it in Settings/Onboarding first.");
      setFoodEstimateResult(null);
      return;
    }

    setFoodEstimateLoading(true);
    setFoodEstimateError("");

    try {
      const model = (localStorage.getItem("groqModel") || DEFAULT_GROQ_MODEL).trim() || DEFAULT_GROQ_MODEL;
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            {
              role: "system",
              content: "You estimate calories for logged foods. Return only strict JSON with this schema: {\"totalCalories\": number, \"items\": [{\"food\": string, \"estimatedCalories\": number}], \"notes\": string}. No markdown and no extra keys.",
            },
            {
              role: "user",
              content: `Estimate calories for: ${text}`,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq API error ${response.status}: ${errorText.slice(0, 200)}`);
      }

      const payload = await response.json();
      const content = payload?.choices?.[0]?.message?.content || "";

      const jsonStart = content.indexOf("{");
      const jsonEnd = content.lastIndexOf("}");
      const jsonText = jsonStart >= 0 && jsonEnd > jsonStart
        ? content.slice(jsonStart, jsonEnd + 1)
        : content;
      const parsed = JSON.parse(jsonText);

      const items = Array.isArray(parsed?.items)
        ? parsed.items
            .map((item) => ({
              food: String(item?.food || "Food item").trim() || "Food item",
              estimatedCalories: Math.max(0, Math.round(Number(item?.estimatedCalories) || 0)),
            }))
            .filter((item) => item.estimatedCalories > 0)
        : [];
      const normalized = normalizeFoodEstimate({
        text,
        items,
        notes: parsed?.notes,
      });
      const fallbackParsedTotal = Math.max(0, Math.round(Number(parsed?.totalCalories) || 0));
      const totalCalories = normalized.totalCalories > 0 ? normalized.totalCalories : fallbackParsedTotal;

      if (!Number.isFinite(totalCalories) || totalCalories <= 0) {
        throw new Error("Could not parse a valid calorie estimate from Groq response.");
      }

      setFoodEstimateResult({
        totalCalories,
        items: normalized.items,
        notes: normalized.notes,
      });
      setFoodEstimateError("");
    } catch (error) {
      setFoodEstimateResult(null);
      setFoodEstimateError(error?.message || "Failed to estimate calories.");
    } finally {
      setFoodEstimateLoading(false);
    }
  };

  const hasUnsavedChanges = useMemo(() => {
    const savedForm = { ...DEFAULT_FORM, ...(activeProfile?.form || {}) };
    const currentForm = { ...DEFAULT_FORM, ...form };
    return JSON.stringify(savedForm) !== JSON.stringify(currentForm);
  }, [activeProfile, form]);

  const saveFormToActiveUser = () => {
    if (!activeProfileId) return;

    setProfiles((prevProfiles) =>
      prevProfiles.map((profile) =>
        profile.id === activeProfileId 
          ? { ...profile, form: { ...form }, lastModified: new Date().toISOString() } 
          : profile
      )
    );
    setSaveMessage(`Saved changes to ${activeProfile?.name || "active user"}.`);
  };

  const resetToSavedProfile = () => {
    if (!activeProfile?.form) return;
    setForm({ ...DEFAULT_FORM, ...activeProfile.form });
    setSaveMessage("Reverted unsaved changes.");
  };

  const applyActivityPreset = (presetKey) => {
    setField("steps", ACTIVITY_PRESETS[presetKey].steps.toString());
    setSaveMessage(`Activity set to ${ACTIVITY_PRESETS[presetKey].label}.`);
  };

  const quickAdjustCalories = (delta) => {
    const current = Number(form.currentCalories) || 0;
    const newValue = Math.max(800, current + delta);
    setField("currentCalories", newValue.toString());
  };

  const addWeightLog = () => {
    const weightNum = Number(loggedWeight);
    if (!Number.isFinite(weightNum) || weightNum <= 0) {
      setSaveMessage("Please enter a valid weight.");
      return;
    }
    setProfiles((prev) =>
      prev.map((p) =>
        p.id === activeProfileId
          ? {
              ...p,
              weightHistory: [
                { date: new Date().toISOString().split("T")[0], weight: weightNum },
                ...p.weightHistory,
              ].slice(0, 52),
            }
          : p
      )
    );
    setLoggedWeight("");
    setSaveMessage("Weight logged.");
  };

  const mealLog = useMemo(() => {
    if (!Array.isArray(activeProfile?.mealLog)) return [];
    return [...activeProfile.mealLog].sort((a, b) => {
      return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
    });
  }, [activeProfile]);

  const todayMealCalories = useMemo(() => {
    const today = localDateKey();
    return mealLog
      .filter((entry) => localDateKey(entry?.createdAt) === today)
      .reduce((sum, entry) => sum + (Number(entry?.totalCalories) || 0), 0);
  }, [mealLog]);

  const addEstimatedMealToLog = () => {
    if (!foodEstimateResult?.totalCalories || !activeProfileId) {
      setFoodEstimateError("Estimate food calories first.");
      return;
    }

    const entry = {
      id: `meal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: new Date().toISOString(),
      mealType,
      description: foodDescription.trim(),
      totalCalories: Number(foodEstimateResult.totalCalories) || 0,
      items: Array.isArray(foodEstimateResult.items) ? foodEstimateResult.items : [],
      notes: foodEstimateResult.notes || "",
    };

    setProfiles((prev) => prev.map((p) => {
      if (p.id !== activeProfileId) return p;
      return {
        ...p,
        mealLog: [entry, ...(Array.isArray(p.mealLog) ? p.mealLog : [])].slice(0, 200),
        lastModified: new Date().toISOString(),
      };
    }));

    setSaveMessage(`Added ${entry.totalCalories} kcal to ${mealType} log.`);
  };

  const removeMealLogEntry = (entryId) => {
    if (!entryId || !activeProfileId) return;
    setProfiles((prev) => prev.map((p) => {
      if (p.id !== activeProfileId) return p;
      return {
        ...p,
        mealLog: (Array.isArray(p.mealLog) ? p.mealLog : []).filter((entry) => entry.id !== entryId),
        lastModified: new Date().toISOString(),
      };
    }));
  };

  const appendEstimateToCurrentCalories = () => {
    if (!foodEstimateResult?.totalCalories) {
      setFoodEstimateError("Estimate food calories first.");
      return;
    }
    const current = Number(form.currentCalories) || 0;
    const appended = current + Number(foodEstimateResult.totalCalories);
    setField("currentCalories", String(Math.round(appended)));
    setSaveMessage(`Added ${foodEstimateResult.totalCalories} kcal to current calories.`);
  };

  const setCurrentCaloriesFromTodayMealLog = () => {
    setField("currentCalories", String(Math.round(todayMealCalories)));
    setSaveMessage(`Set current calories to today's meal log total (${Math.round(todayMealCalories)} kcal).`);
  };

  const getGoalBasedCalories = () => {
    if (result.error) return null;
    const goal = String(form.goal).toLowerCase();
    if (goal === "lose") return Math.max(1200, result.maintenanceCalories - 500);
    if (goal === "gain") return result.maintenanceCalories + 300;
    return result.maintenanceCalories;
  };

  const weightProjectionData = useMemo(() => {
    if (result.error) return [];

    const currentCaloriesNum = Number(form.currentCalories);
    if (!Number.isFinite(currentCaloriesNum) || currentCaloriesNum <= 0) return [];

    const startWeightInput = Number(form.weight);
    if (!Number.isFinite(startWeightInput) || startWeightInput <= 0) return [];

    const startWeightLb =
      form.unitSystem === "metric" ? startWeightInput * 2.20462 : startWeightInput;

    const calorieDelta = currentCaloriesNum - result.maintenanceCalories;
    const poundsPerDay = calorieDelta / 3500;

    const points = [];
    for (let day = 0; day <= 84; day += 7) {
      const projectedLb = startWeightLb + poundsPerDay * day;
      const projectedDisplay =
        form.unitSystem === "metric" ? projectedLb / 2.20462 : projectedLb;

      points.push({
        day,
        weekLabel: `W${Math.round(day / 7)}`,
        weight: Number(projectedDisplay.toFixed(1)),
      });
    }
    return points;
  }, [form.currentCalories, form.unitSystem, form.weight, result]);

  const currentCaloriesNum = Number(form.currentCalories);
  const calorieDelta = !result.error && Number.isFinite(currentCaloriesNum)
    ? Math.round(currentCaloriesNum - result.maintenanceCalories)
    : 0;

  const liveMath = useMemo(() => {
    if (result.error) return null;

    const heightInches =
      form.unitSystem === "metric"
        ? Number(form.heightCm) / 2.54
        : Math.max(0, Number(form.heightFeet) || 0) * 12 +
          Math.max(0, Number(form.heightInches) || 0);
    const heightCm = heightInches * 2.54;
    const heightM = heightCm / 100;
    const weightInput = Number(form.weight);
    const weightKg =
      form.unitSystem === "metric" ? weightInput : weightInput * 0.453592;
    const weightLb = weightKg * 2.20462;
    const age = Math.max(1, Number(form.age) || 30);
    const sexNormalized = String(form.sex).toLowerCase();
    const sexOffset = sexNormalized === "female" ? -161 : 5;
    const bmrRaw = 10 * weightKg + 6.25 * heightCm - 5 * age + sexOffset;

    const currentCalories = Number(form.currentCalories) || 0;
    const delta = currentCalories - result.maintenanceCalories;
    const poundsPerDay = delta / 3500;
    const poundsPerWeek = poundsPerDay * 7;
    const kilogramsPerWeek = poundsPerWeek / 2.20462;
    const optimalBmiMin = 18.5;
    const optimalBmiMax = 24.9;
    const optimalBmiTarget = 22.0;
    const optimalWeightMinKg = heightM > 0 ? optimalBmiMin * heightM * heightM : 0;
    const optimalWeightMaxKg = heightM > 0 ? optimalBmiMax * heightM * heightM : 0;
    const optimalWeightTargetKg = heightM > 0 ? optimalBmiTarget * heightM * heightM : 0;
    const optimalWeightMinLb = optimalWeightMinKg * 2.20462;
    const optimalWeightMaxLb = optimalWeightMaxKg * 2.20462;
    const optimalWeightTargetLb = optimalWeightTargetKg * 2.20462;

    return {
      heightInches: Number(heightInches.toFixed(2)),
      heightCm: Number(heightCm.toFixed(2)),
      weightKg: Number(weightKg.toFixed(3)),
      weightLb: Number(weightLb.toFixed(2)),
      age,
      sexOffset,
      bmrRaw: Number(bmrRaw.toFixed(2)),
      activityMultiplier: result.activityMultiplier,
      maintenanceCalories: result.maintenanceCalories,
      currentCalories: Math.round(currentCalories),
      calorieDelta: Math.round(delta),
      poundsPerWeek: Number(poundsPerWeek.toFixed(2)),
      kilogramsPerWeek: Number(kilogramsPerWeek.toFixed(2)),
      optimalBmiMin,
      optimalBmiMax,
      optimalBmiTarget,
      optimalWeightMinKg: Number(optimalWeightMinKg.toFixed(2)),
      optimalWeightMaxKg: Number(optimalWeightMaxKg.toFixed(2)),
      optimalWeightTargetKg: Number(optimalWeightTargetKg.toFixed(2)),
      optimalWeightMinLb: Number(optimalWeightMinLb.toFixed(1)),
      optimalWeightMaxLb: Number(optimalWeightMaxLb.toFixed(1)),
      optimalWeightTargetLb: Number(optimalWeightTargetLb.toFixed(1)),
    };
  }, [form, result]);

  const recommendationConfidence = useMemo(() => {
    return getProfileConfidence(form, result);
  }, [form, result]);

  const bmiToneClass = useMemo(() => {
    return classifyBmi(result?.bmi).toneClass;
  }, [result]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
      <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/20 p-6">
        <div className="flex items-center gap-3 mb-2">
          <Scale className="w-7 h-7 text-amber-700 dark:text-amber-300" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Daily Calorie Intake Tool
          </h1>
        </div>
        <p className="text-gray-700 dark:text-gray-300">
          Estimate maintenance and target calories from height, weight, and daily steps.
        </p>
      </div>

      {activeProfile && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
          <span className="text-sm text-gray-500 dark:text-gray-400">Saving to:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 text-sm font-semibold">{activeProfile.name}</span>
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">Manage users in Wellness Hub</span>
        </div>
      )}

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-6 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={saveFormToActiveUser}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${
              hasUnsavedChanges
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-gray-400 cursor-not-allowed"
            }`}
          >
            Save Changes to User
          </button>
          <button
            type="button"
            onClick={resetToSavedProfile}
            disabled={!hasUnsavedChanges}
            className={`px-4 py-2 rounded-lg font-semibold ${
              hasUnsavedChanges
                ? "bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600"
                : "bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
            }`}
          >
            Reset Unsaved
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
          </span>
        </div>
        {saveMessage && (
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{saveMessage}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
          <span
            className="text-sm text-gray-700 dark:text-gray-300 cursor-help"
            title="Display units controls whether supporting numbers are shown only in your current system or in both metric and imperial units."
          >
            Display Units:
          </span>
          <button
            type="button"
            onClick={() => setShowDualUnits(!showDualUnits)}
            className={`px-3 py-1 rounded-lg text-sm font-medium ${
              showDualUnits
                ? "bg-indigo-600 text-white"
                : "bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200"
            }`}
            title="Toggle whether result summaries show only your selected unit system or both metric and imperial conversions."
          >
            {showDualUnits ? "Both Units" : "Current Unit"}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Choose the measurement system used for your body measurements and calorie inputs." className="cursor-help">Unit System</span>
            <select
              value={form.unitSystem}
              onChange={(e) => setField("unitSystem", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="imperial">Imperial (in, lb)</option>
              <option value="metric">Metric (cm, kg)</option>
            </select>
          </label>
          {form.unitSystem === "metric" ? (
            <label className="text-sm text-gray-700 dark:text-gray-300">
              <span title="Height is used in BMI and BMR calculations. Enter your standing height without shoes." className="cursor-help">Height (cm)</span>
              <input
                type="number"
                min="1"
                value={form.heightCm}
                onChange={(e) => setField("heightCm", e.target.value)}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
              />
            </label>
          ) : (
            <div className="text-sm text-gray-700 dark:text-gray-300">
              <span title="Height is used in BMI and BMR calculations. Enter your standing height in feet and inches." className="cursor-help">Height (ft/in)</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min="0"
                  placeholder="Feet"
                  value={form.heightFeet}
                  onChange={(e) => setField("heightFeet", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
                <input
                  type="number"
                  min="0"
                  max="11"
                  placeholder="Inches"
                  value={form.heightInches}
                  onChange={(e) => setField("heightInches", e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                />
              </div>
            </div>
          )}
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Current body weight is used for BMI, calorie needs, and macro targets." className="cursor-help">Weight ({form.unitSystem === "metric" ? "kg" : "lb"})</span>
            <input
              type="number"
              min="1"
              max={form.unitSystem === "metric" ? "300" : "700"}
              value={form.weight}
              onChange={(e) => setField("weight", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Average daily steps act as the activity input for estimating maintenance calories." className="cursor-help">Steps / day</span>
            <input
              type="number"
              min="0"
              max="50000"
              value={form.steps}
              onChange={(e) => setField("steps", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
            <span className="block mt-1 text-xs text-gray-500 dark:text-gray-400">Presets auto-highlight only when steps exactly match a preset value.</span>
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-help" title="Activity presets quickly set a typical daily step count for calorie estimation.">Activity Presets</p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {exactPresetMatch
              ? `Preset matched: ${exactPresetMatch[1].label} (${exactPresetMatch[1].steps.toLocaleString()} steps/day)`
              : `Custom steps (${(Number(form.steps) || 0).toLocaleString()}/day) -> estimated activity: ${activityFromSteps.label} (${activityFromSteps.multiplier}x)`}
          </p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {Object.entries(ACTIVITY_PRESETS).map(([key, preset]) => {
              const isActive = String(form.steps) === String(preset.steps);
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyActivityPreset(key)}
                  className={`px-2 py-2 rounded-lg text-xs font-medium border ${
                    isActive
                      ? "bg-blue-600 text-white border-blue-600 dark:bg-blue-500 dark:border-blue-500"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"
                  }`}
                  title={preset.description}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Age affects basal metabolic rate in the calorie model." className="cursor-help">Age</span>
            <input
              type="number"
              min="1"
              max="120"
              value={form.age}
              onChange={(e) => setField("age", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Sex selects the Mifflin-St Jeor offset used in the BMR formula." className="cursor-help">Sex</span>
            <select
              value={form.sex}
              onChange={(e) => setField("sex", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Goal shifts the calorie recommendation toward maintenance, loss, or gain." className="cursor-help">Goal</span>
            <select
              value={form.goal}
              onChange={(e) => setField("goal", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            >
              <option value="maintain">Maintain</option>
              <option value="lose">Lose</option>
              <option value="gain">Gain</option>
            </select>
          </label>
          <label className="text-sm text-gray-700 dark:text-gray-300">
            <span title="Current calories per day is your estimated actual intake and is used for weight-change projection against maintenance." className="cursor-help">Current Calories / day</span>
            <input
              type="number"
              min="1"
              max="10000"
              value={form.currentCalories}
              onChange={(e) => setField("currentCalories", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
            />
          </label>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-help" title="Quick calorie adjustments change the current daily intake field without editing it manually.">Quick Calorie Adjustments</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => quickAdjustCalories(-500)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 text-sm hover:bg-red-200 dark:hover:bg-red-800 font-medium"
              title="Subtract 500 kcal/day from your current intake estimate."
            >
              <TrendingDown className="w-4 h-4" /> -500 cal
            </button>
            <button
              type="button"
              onClick={() => quickAdjustCalories(300)}
              className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200 text-sm hover:bg-green-200 dark:hover:bg-green-800 font-medium"
              title="Add 300 kcal/day to your current intake estimate."
            >
              <TrendingUp className="w-4 h-4" /> +300 cal
            </button>
            <button
              type="button"
              onClick={() => {
                const suggested = getGoalBasedCalories();
                if (suggested) setField("currentCalories", Math.round(suggested).toString());
                setSaveMessage("Set to goal-based target.");
              }}
              className="px-3 py-2 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 text-sm hover:bg-indigo-200 dark:hover:bg-indigo-800 font-medium"
              title="Set current calories to the model's goal-based target for maintain, lose, or gain."
            >
              Goal Target
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-violet-200 dark:border-violet-800 bg-violet-50/60 dark:bg-violet-950/20 p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white cursor-help" title="This uses your saved Groq key to estimate calories from a plain-language food description.">Food Calories (Groq Estimate)</h2>
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Describe what you ate and this will estimate total calories using your saved Groq API key.
        </p>
        <label className="text-sm text-gray-700 dark:text-gray-300">
          <span title="Meal type labels the entry in your meal log so you can separate snacks, meals, and beverages." className="cursor-help">Meal Type</span>
          <select
            value={mealType}
            onChange={(e) => setMealType(e.target.value)}
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
          >
            <option value="meal">Meal</option>
            {MEAL_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option[0].toUpperCase() + option.slice(1)}</option>
            ))}
          </select>
        </label>
        <textarea
          value={foodDescription}
          onChange={(e) => setFoodDescription(e.target.value)}
          placeholder="Example: 2 scrambled eggs, 2 slices bacon, 1 cup oatmeal with banana and honey"
          rows={4}
          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={estimateFoodCaloriesWithGroq}
            disabled={foodEstimateLoading}
            className={`px-4 py-2 rounded-lg text-white font-semibold ${foodEstimateLoading ? "bg-violet-400 cursor-not-allowed" : "bg-violet-600 hover:bg-violet-700"}`}
            title="Send your food description to Groq and return a calorie estimate plus item breakdown."
          >
            {foodEstimateLoading ? "Estimating..." : "Estimate Food Calories"}
          </button>
          {foodEstimateResult && (
            <button
              type="button"
              onClick={addEstimatedMealToLog}
              className="px-4 py-2 rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200 hover:bg-indigo-200 dark:hover:bg-indigo-800 font-medium"
              title="Save the current estimate as a timestamped entry in today's meal log."
            >
              Add To Meal Log
            </button>
          )}
          {foodEstimateResult && (
            <button
              type="button"
              onClick={appendEstimateToCurrentCalories}
              className="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200 hover:bg-emerald-200 dark:hover:bg-emerald-800 font-medium"
              title="Add the estimated calories to the current daily intake field."
            >
              Add To Current Calories/day
            </button>
          )}
        </div>
        {foodEstimateError && (
          <p className="text-sm text-red-700 dark:text-red-300">{foodEstimateError}</p>
        )}
        {foodEstimateResult && (
          <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-white/80 dark:bg-gray-900/50 p-4 space-y-2 text-sm text-gray-800 dark:text-gray-200">
            <p>
              Estimated total: <strong>{foodEstimateResult.totalCalories} kcal</strong>
            </p>
            {foodEstimateResult.items.length > 0 && (
              <div>
                {foodEstimateResult.items.map((item, idx) => (
                  <p key={`${item.food}-${idx}`}>{item.food}: {item.estimatedCalories} kcal</p>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-600 dark:text-gray-400">{foodEstimateResult.notes}</p>
          </div>
        )}

        <div className="rounded-lg border border-violet-200 dark:border-violet-800 bg-white/60 dark:bg-gray-900/40 p-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <p className="text-sm text-gray-800 dark:text-gray-200">
              Today from meal log: <strong>{todayMealCalories} kcal</strong>
            </p>
            <button
              type="button"
              onClick={setCurrentCaloriesFromTodayMealLog}
              className="px-3 py-1.5 rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-200 hover:bg-sky-200 dark:hover:bg-sky-800 text-xs font-medium"
              title="Replace the current daily calorie field with the sum of today's logged meal entries."
            >
              Set Current Calories From Today
            </button>
          </div>
          {mealLog.length === 0 ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">No meal entries yet.</p>
          ) : (
            <div className="space-y-2 max-h-56 overflow-auto">
              {mealLog.slice(0, 12).map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-md border border-violet-100 dark:border-violet-900 px-3 py-2 flex items-start justify-between gap-2 text-xs text-gray-700 dark:text-gray-300"
                >
                  <div>
                    <p>
                      <strong>{String(entry.mealType || "meal").toUpperCase()}</strong> · {new Date(entry.createdAt).toLocaleString([], { month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </p>
                    <p>{entry.description || "(no description)"}</p>
                    <p><strong>{Math.round(Number(entry.totalCalories) || 0)} kcal</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeMealLogEntry(entry.id)}
                    className="px-2 py-1 rounded border border-red-300 dark:border-red-800 text-red-700 dark:text-red-300"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50/70 dark:bg-green-950/20 p-6 space-y-3">
        {result.error ? (
          <p className="text-red-700 dark:text-red-300 font-medium">{result.message}</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-lg text-gray-900 dark:text-white">
                Recommended Calories: <strong>{result.recommendedCalories} kcal/day</strong>
              </p>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${recommendationConfidence.colorClass}`}
                title={`Recommendation confidence ${recommendationConfidence.scorePercent}%. ${recommendationConfidence.detail}`}
              >
                Confidence: {recommendationConfidence.label}
              </span>
            </div>
            {recommendationConfidence.label === "Low" && (
              <p className="text-xs text-amber-700 dark:text-amber-300">
                Confidence can improve by using a realistic current calorie value and double-checking height, weight, and typical daily steps.
              </p>
            )}
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Formula breakdown: <strong>{result.bmr}</strong> (BMR) x <strong>{result.activityMultiplier}</strong> (activity) = <strong>{result.maintenanceCalories}</strong> maintenance kcal/day; goal adjustment applied: <strong>{String(form.goal).toLowerCase() === "lose" ? "-500" : String(form.goal).toLowerCase() === "gain" ? "+300" : "0"}</strong> kcal/day (minimum target floor: 1200).
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Maintenance: {result.maintenanceCalories} kcal/day {showDualUnits && `(${(result.maintenanceCalories * 4.184).toFixed(0)} kJ/day)`} | BMR: {result.bmr} kcal/day | Activity: {result.activityMultiplier}x
            </p>
            <p className={`text-sm ${bmiToneClass}`}>
              BMI: <strong>{Number.isFinite(result.bmi) ? result.bmi.toFixed(1) : "-"}</strong> ({result.bmiCategory || "-"})
            </p>
            {liveMath && (
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Optimal BMI: <strong>{liveMath.optimalBmiMin.toFixed(1)}-{liveMath.optimalBmiMax.toFixed(1)}</strong> (target {liveMath.optimalBmiTarget.toFixed(1)}) | Optimal weight: <strong>{form.unitSystem === "metric" ? `${liveMath.optimalWeightMinKg.toFixed(1)}-${liveMath.optimalWeightMaxKg.toFixed(1)} kg` : `${liveMath.optimalWeightMinLb.toFixed(1)}-${liveMath.optimalWeightMaxLb.toFixed(1)} lb`}</strong>
              </p>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Macro Targets
                </p>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Protein <strong>{result.macroTargets.proteinG}g</strong> | Carbs <strong>{result.macroTargets.carbsG}g</strong> | Fat <strong>{result.macroTargets.fatG}g</strong>
                </p>
              </div>
              <div className="w-full min-w-[180px] h-[180px]">
                <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "Protein", value: result.macroTargets.proteinG * 4 },
                        { name: "Carbs", value: result.macroTargets.carbsG * 4 },
                        { name: "Fat", value: result.macroTargets.fatG * 9 },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={60}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#ef4444" />
                      <Cell fill="#f59e0b" />
                      <Cell fill="#3b82f6" />
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            {result.warnings.length > 0 && (
              <div className="mt-2 text-sm text-amber-700 dark:text-amber-300">
                {result.warnings.map((w) => (
                  <p key={w}>- {w}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50/70 dark:bg-blue-950/20 p-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Weight Tracking & Projection
          </h2>
          <div className="flex items-center gap-2">
            <input
              type="number"
              placeholder="Weight"
              value={loggedWeight}
              onChange={(e) => setLoggedWeight(e.target.value)}
              className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm w-24"
            />
            <button
              type="button"
              onClick={addWeightLog}
              className="px-3 py-1 rounded-lg bg-blue-600 text-white text-sm hover:bg-blue-700 font-medium"
            >
              Log
            </button>
          </div>
        </div>
        {activeProfile?.weightHistory && activeProfile.weightHistory.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Recent logs:</strong> {activeProfile.weightHistory.slice(0, 3).map((w) => `${w.weight} on ${w.date}`).join(" | ")}
          </div>
        )}
        <p className="text-sm text-gray-700 dark:text-gray-300">
          Based on current intake of <strong>{Number.isFinite(currentCaloriesNum) ? Math.round(currentCaloriesNum) : 0} kcal/day</strong> vs maintenance ({result.error ? "-" : result.maintenanceCalories} kcal/day),
          projected daily difference is <strong>{calorieDelta >= 0 ? `+${calorieDelta}` : calorieDelta} kcal/day</strong>.
        </p>

        {weightProjectionData.length > 1 ? (
          <div className="w-full h-72 min-w-0 min-h-[18rem]">
            <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
              <LineChart data={weightProjectionData} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#9ca3af" opacity={0.25} />
                <XAxis dataKey="weekLabel" />
                <YAxis
                  tickFormatter={(value) => `${value}${form.unitSystem === "metric" ? " kg" : " lb"}`}
                />
                <Tooltip
                  formatter={(value) => [`${value} ${form.unitSystem === "metric" ? "kg" : "lb"}`, "Projected weight"]}
                  labelFormatter={(label) => `Week ${String(label).replace("W", "")}`}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Enter a valid current daily calorie intake to view projection.
          </p>
        )}
      </div>

      <div className="rounded-xl border border-teal-200 dark:border-teal-800 bg-teal-50/40 dark:bg-teal-950/10 p-6 space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Daily Vitamins &amp; Minerals
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          RDA/AI targets from NIH Dietary Reference Intakes — adjusted for age {form.age || "–"}, sex {form.sex || "–"}.
          AI = Adequate Intake (no established RDA). These are daily targets, not what this calorie plan provides.
        </p>
        {(() => {
          const targets = getDailyNutrientTargets(form.age, form.sex);
          const NutrientRow = ({ name, unit, rda, note }) => (
            <tr className="border-b border-teal-100 dark:border-teal-900 hover:bg-teal-50/50 dark:hover:bg-teal-950/20">
              <td className="py-1.5 pr-3 font-medium text-gray-800 dark:text-gray-200 whitespace-nowrap">{name}</td>
              <td className="py-1.5 pr-3 text-right text-gray-700 dark:text-gray-300 whitespace-nowrap tabular-nums">{rda} {unit}</td>
              <td className="py-1.5 text-gray-500 dark:text-gray-400 text-xs">{note}</td>
            </tr>
          );
          return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-200 mb-2">Vitamins</p>
                <table className="w-full text-sm">
                  <tbody>
                    {targets.vitamins.map((v) => (
                      <NutrientRow key={v.name} {...v} />
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <p className="text-sm font-semibold text-teal-800 dark:text-teal-200 mb-2">Minerals</p>
                <table className="w-full text-sm">
                  <tbody>
                    {targets.minerals.map((m) => (
                      <NutrientRow key={m.name} {...m} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })()}
      </div>

      <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/10 p-6 space-y-3">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Live Math
        </h2>
        {liveMath ? (
          <div className="text-sm text-gray-700 dark:text-gray-300 space-y-2">
            <p><strong>Height conversion:</strong> {liveMath.heightInches} in = {liveMath.heightCm} cm</p>
            <p><strong>Weight conversion:</strong> {liveMath.weightLb} lb = {liveMath.weightKg} kg</p>
            <p><strong>BMI:</strong> {Number.isFinite(result.bmi) ? result.bmi.toFixed(1) : "-"} ({result.bmiCategory || "-"})</p>
            <p><strong>Optimal BMI range:</strong> {liveMath.optimalBmiMin.toFixed(1)}-{liveMath.optimalBmiMax.toFixed(1)} (target {liveMath.optimalBmiTarget.toFixed(1)})</p>
            <p><strong>Optimal weight range at your height:</strong> {liveMath.optimalWeightMinLb.toFixed(1)}-{liveMath.optimalWeightMaxLb.toFixed(1)} lb ({liveMath.optimalWeightMinKg.toFixed(1)}-{liveMath.optimalWeightMaxKg.toFixed(1)} kg)</p>
            <p><strong>Target weight (BMI {liveMath.optimalBmiTarget.toFixed(1)}):</strong> {liveMath.optimalWeightTargetLb.toFixed(1)} lb ({liveMath.optimalWeightTargetKg.toFixed(1)} kg)</p>
            <p><strong>BMR formula (Mifflin-St Jeor):</strong> 10×kg + 6.25×cm - 5×age + sexOffset</p>
            <p><strong>BMR numbers:</strong> 10×{liveMath.weightKg} + 6.25×{liveMath.heightCm} - 5×{liveMath.age} + ({liveMath.sexOffset}) = {liveMath.bmrRaw}</p>
            <p><strong>Maintenance calories:</strong> BMR × activity = {Math.round(liveMath.bmrRaw)} × {liveMath.activityMultiplier} = {liveMath.maintenanceCalories} kcal/day</p>
            <p><strong>Calorie delta:</strong> current {liveMath.currentCalories} - maintenance {liveMath.maintenanceCalories} = {liveMath.calorieDelta} kcal/day</p>
            <p><strong>Projected weight rate:</strong> ({liveMath.calorieDelta} ÷ 3500) × 7 = {liveMath.poundsPerWeek} lb/week ({liveMath.kilogramsPerWeek} kg/week)</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-gray-400">Enter valid values to see live calculations.</p>
        )}
      </div>
    </div>
  );
}
