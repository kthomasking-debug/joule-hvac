import React from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { DollarSign, Calendar, BarChart3, ArrowLeft } from "lucide-react";

export default function BudgetHub() {
  const navigate = useNavigate();
  let hasCompletedOnboarding = false;
  try {
    const ctx = useOutletContext();
    hasCompletedOnboarding = ctx?.hasCompletedOnboarding ?? false;
  } catch {}

  const go = (path) => {
    if (!hasCompletedOnboarding) {
      navigate("/onboarding?rerun=true");
    } else {
      navigate(path);
    }
  };

  const now = new Date();
  const lastMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const lastYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const actions = [
    {
      label: "Analyze last month's HVAC bill",
      description: "Compare last month's bill to your forecast — flags overuse, weather effects, and inefficiencies. Runs onboarding setup if needed.",
      icon: Calendar,
      iconColor: "text-orange-400",
      borderColor: "border-orange-500/40 hover:border-orange-400/60",
      gradientFrom: "from-orange-600/20",
      gradientTo: "to-amber-700/20",
      path: `/analysis/monthly?month=${lastMonth}&year=${lastYear}`,
    },
    {
      label: "Estimate this month's HVAC bill",
      description: "See what this month's bill is on track to cost based on weather, usage patterns, and your system. Runs onboarding setup if needed.",
      icon: DollarSign,
      iconColor: "text-emerald-400",
      borderColor: "border-emerald-500/40 hover:border-emerald-400/60",
      gradientFrom: "from-emerald-600/20",
      gradientTo: "to-teal-700/20",
      path: `/analysis/monthly?month=${now.getMonth() + 1}&year=${now.getFullYear()}`,
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">
      {/* Header */}
      <div className="space-y-1">
        <button
          onClick={() => navigate("/home")}
          className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Mission Control
        </button>
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-500/20">
            <BarChart3 className="w-8 h-8 text-orange-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Budget</h1>
            <p className="text-[#A7B0BA] text-sm">HVAC bill analysis and monthly cost forecasting</p>
          </div>
        </div>
      </div>

      {/* Action Cards */}
      <div className="space-y-4">
        {actions.map(({ label, description, icon: Icon, iconColor, borderColor, gradientFrom, gradientTo, path }) => (
          <button
            key={label}
            onClick={() => go(path)}
            className={`w-full text-left bg-gradient-to-br ${gradientFrom} ${gradientTo} border-2 ${borderColor} rounded-2xl p-6 transition-colors`}
          >
            <div className="flex items-center gap-3 mb-2">
              <Icon className={`w-7 h-7 ${iconColor}`} />
              <h2 className="text-lg font-semibold text-white">{label}</h2>
            </div>
            <p className="text-sm text-[#A7B0BA]">{description}</p>
          </button>
        ))}
      </div>

      <p className="text-xs text-center text-gray-500 dark:text-gray-600">
        Bill analysis uses your onboarding data — home size, insulation, and system type. You can re-run onboarding anytime from Mission Control settings.
      </p>
    </div>
  );
}
