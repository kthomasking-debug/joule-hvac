import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EBAY_STORE_URL } from "../utils/rag/salesFAQ";
import {
  Zap,
  Shield,
  TrendingUp,
  DollarSign,
  CheckCircle2,
  XCircle,
  Crown,
  ArrowRight,
  HelpCircle,
  ExternalLink,
  ThermometerSun,
  Activity,
  BarChart3,
} from "lucide-react";
import CollapsibleSection from "../components/CollapsibleSection";

// Demo Cost Estimate Card Component (with dummy data)
const DemoCostCard = () => {
  const [indoorTemp, setIndoorTemp] = useState(70);
  const [mode, setMode] = useState("heating"); // "heating" or "cooling"
  
  // Dummy data for demo - realistic seasonal costs
  const demoData = useMemo(() => {
    // Base monthly cost varies by mode
    const baseMonthlyCost = mode === "heating" ? 120 : 80; // Cooling typically costs less
    
    // Temperature impact: each degree away from ideal adds cost
    const idealTemp = mode === "heating" ? 68 : 76;
    const tempDiff = Math.abs(idealTemp - indoorTemp);
    const tempMultiplier = mode === "heating" ? 8 : 6; // Heating costs more per degree
    
    // Calculate monthly cost with temperature adjustment
    const monthlyCost = baseMonthlyCost + (tempDiff * tempMultiplier);
    
    // Weekly cost (monthly / 4.3 weeks)
    const weeklyCost = monthlyCost / 4.3;
    
    // Annual cost (monthly * 12)
    const annualCost = monthlyCost * 12;
    
    // Savings calculation: compare to baseline
    const baselineTemp = mode === "heating" ? 72 : 74;
    const baselineCost = baseMonthlyCost + (Math.abs(idealTemp - baselineTemp) * tempMultiplier);
    const currentCost = monthlyCost;
    const monthlySavings = Math.max(0, baselineCost - currentCost);
    const annualSavings = monthlySavings * 12;
    
    return {
      weekly: weeklyCost,
      monthly: monthlyCost,
      annual: annualCost,
      savings: annualSavings,
    };
  }, [indoorTemp, mode]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-8 border-2 border-blue-200 dark:border-blue-700 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            7-Day Cost Forecast
          </h3>
        </div>
        {/* Mode Toggle */}
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg p-1 border border-gray-300 dark:border-gray-600">
          <button
            onClick={() => setMode("heating")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === "heating"
                ? "bg-blue-600 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Heating
          </button>
          <button
            onClick={() => setMode("cooling")}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              mode === "cooling"
                ? "bg-orange-500 text-white"
                : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
          >
            Cooling
          </button>
        </div>
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Indoor Temperature: {indoorTemp}°F
          {mode === "cooling" && (
            <span className="ml-2 text-xs text-gray-500">
              (Lower = more cooling cost, but better humidity control)
            </span>
          )}
        </label>
        <input
          type="range"
          min={mode === "heating" ? "65" : "70"}
          max={mode === "heating" ? "75" : "80"}
          value={indoorTemp}
          onChange={(e) => setIndoorTemp(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{mode === "heating" ? "65°F" : "70°F"}</span>
          <span>{mode === "heating" ? "75°F" : "80°F"}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Week</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${demoData.weekly.toFixed(0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Month</p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${demoData.monthly.toFixed(0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">This Year</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${demoData.annual.toFixed(0)}
          </p>
        </div>
      </div>

      {demoData.savings > 0 && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
          <p className="text-sm text-green-800 dark:text-green-200">
            💰 Potential savings: <strong>${demoData.savings.toFixed(0)}/year</strong> at {indoorTemp}°F
          </p>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center italic">
        Interactive demo • Drag the slider to see real-time cost updates
      </p>
    </div>
  );
};

const LandingPage = () => {
  const navigate = useNavigate();
  const [faqOpen, setFaqOpen] = useState({});

  const toggleFaq = (index) => {
    setFaqOpen((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-blue-600 via-indigo-700 to-purple-800 text-white py-20 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold mb-4 leading-tight">
            The Operating System<br />Your HVAC Deserves
          </h1>
          <p className="text-xl md:text-2xl mb-6 text-blue-100 font-semibold max-w-3xl mx-auto">
            Explains what your heat pump is doing, whether it's wasting money, and what to change — in plain language.
          </p>
          <p className="text-lg mb-4 text-blue-200 max-w-2xl mx-auto">
            Your Ecobee is smart. Joule makes it brilliant.
          </p>
          <div className="mb-6 inline-block px-4 py-2 bg-blue-500/30 backdrop-blur-sm rounded-full border border-blue-400/50">
            <p className="text-base font-medium">
              Typical user saves <strong className="text-white">$180–$480/year</strong> vs. default ecobee schedule
            </p>
          </div>
          <div className="mb-6 inline-block px-4 py-2 bg-emerald-500/30 backdrop-blur-sm rounded-full border border-emerald-400/50">
            <p className="text-base font-medium">
              Pi runs the app 24/7. <strong className="text-white">Gaming rig?</strong> Min: GTX 1650 / RX 6400 (4 GB). Rec: RTX 3060 / RX 6600 XT (8 GB).
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <a
              href="#pricing"
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl"
            >
              View Pricing & Order Bridge
            </a>
            <button
              onClick={() => navigate("/onboarding")}
              className="px-8 py-4 bg-transparent border-2 border-white/50 text-white rounded-lg font-semibold text-lg hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              Launch App <ArrowRight size={20} />
            </button>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-gray-900 dark:text-white">
            See It In Action
          </h2>
          <p className="text-center text-lg text-gray-700 dark:text-gray-300 mb-6 font-medium max-w-3xl mx-auto">
            Here's your week: Joule compares heat pump vs gas and flags days you overpaid.
          </p>
          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
            💡 <strong>Try it:</strong> Drag the slider to see how cost changes with temperature
          </p>
          <div className="max-w-3xl mx-auto">
            <DemoCostCard />
          </div>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4 max-w-2xl mx-auto">
            <strong>The average American home spends $2,000/year on heating and cooling (DOE).</strong> Lowering your AC by 2°F can save $15-30/month, but humidity control matters more for comfort.
          </p>
          
          {/* Primary CTA after demo */}
          <div className="mt-12 text-center">
            <a
              href={EBAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-xl transition-colors shadow-xl hover:shadow-2xl"
            >
              Buy Joule Bridge – $129
            </a>
            <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">
              Secure checkout on eBay • Buyer protection & easy returns
            </p>
          </div>
        </div>
      </section>

      {/* CHUNK 2: Why it's good (heat-pump-nerd proof) */}
      <section className="py-12 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">
            How Joule Works
          </h2>
          
          {/* Merged: 3 Steps with punchy benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">1</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Connect</h3>
              <p className="text-base text-gray-700 dark:text-gray-300 font-medium">
                Read your Ecobee data, no rewiring.
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">2</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Analyze</h3>
              <p className="text-base text-gray-700 dark:text-gray-300 font-medium">
                Simulate your house using real physics.
              </p>
            </div>
            <div className="text-center">
              <div className="w-20 h-20 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">3</span>
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">Optimize</h3>
              <p className="text-base text-gray-700 dark:text-gray-300 font-medium">
                Get one change that cuts strip heat.
              </p>
            </div>
          </div>
          
          {/* Collapsible: By The Numbers */}
          <CollapsibleSection 
            title="The Smart Thermostat Advantage (Data & Numbers)" 
            defaultExpanded={false}
            className="mb-6"
          >
            <p className="text-center text-gray-600 dark:text-gray-400 mb-6 italic">
              Don't take our word for it—here's what the data shows:
            </p>
            
            {/* Hero Stat - Centered */}
            <div className="mb-8">
              <div className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl p-8 border-2 border-green-300 dark:border-green-600 shadow-xl max-w-md mx-auto">
                <div className="text-6xl font-extrabold text-green-600 dark:text-green-400 mb-3 text-center">$180</div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mb-2 text-center">Annual Savings</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 text-center">ENERGY STAR average for homes with smart controls</p>
              </div>
            </div>
            
            {/* Supporting Stats - Smaller, Muted */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-100 dark:border-green-800/50">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">23%</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Average Energy Savings</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Department of Energy</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-100 dark:border-green-800/50">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">3-5 Years</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Extended Equipment Life</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">HVAC industry data</p>
              </div>
              <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-green-100 dark:border-green-800/50">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">8 Months</div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payback Period</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bridge tier ROI</p>
              </div>
            </div>
          </CollapsibleSection>
        </div>
      </section>

      {/* CHUNK 3: How to buy + objections */}
      {/* Pricing Section */}
      <section id="pricing" className="py-12 px-4 bg-gradient-to-br from-purple-50/60 to-pink-50/60 dark:from-purple-950/80 dark:to-pink-950/80">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <Crown className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
              Joule Product Tiers
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Choose the plan that fits your needs
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Starter Tier - Analyzer */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col opacity-75 relative">
              <div className="absolute top-2 right-2 bg-gray-500 text-white text-xs font-bold px-2 py-1 rounded">Current</div>
              <div className="flex items-center justify-between mb-3 min-h-[3rem] mt-6">
                <h4 className="font-bold text-lg text-gray-600 dark:text-gray-400">Starter</h4>
                <span className="text-2xl font-extrabold text-gray-500 dark:text-gray-500 leading-tight">$0</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 font-semibold">Analyzer</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">Manual CSV upload • Lead magnet</p>
              <ul className="space-y-2 text-sm flex-grow mb-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">Manual CSV upload & analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">Heat loss calculation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">Efficiency analysis</span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle size={14} className="text-gray-300 dark:text-gray-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-400 dark:text-gray-500">No hardware control</span>
                </li>
              </ul>
              <button
                onClick={() => navigate("/onboarding")}
                className="mt-auto w-full px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg font-semibold text-base transition-colors"
              >
                Get Started Free
              </button>
            </div>

            {/* Smart Tier - Controller */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg border-2 border-amber-400 dark:border-amber-600 p-6 relative flex flex-col shadow-xl">
              <div className="absolute top-2 left-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">POPULAR</div>
              <div className="flex items-center justify-between mb-3 min-h-[3rem] mt-6">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white">Smart</h4>
                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 leading-tight whitespace-nowrap">$129</span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1 font-semibold">Controller</p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-4">One-time purchase • Pi Zero 2 W • The standard brain</p>
              <ul className="space-y-2 text-sm flex-grow mb-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Everything in Starter tier</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Pi Zero 2 W hardware included</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Local control & short cycle protection</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Full thermostat control</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 dark:text-gray-300">Works completely offline</span>
                </li>
              </ul>
              <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-200 text-center">
                  ROI: 3-8 months based on DOE smart thermostat savings averages
                </p>
              </div>
              <a
                href={EBAY_STORE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto w-full px-6 py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl text-center block"
              >
                Buy on eBay – $129
              </a>
              <p className="mt-2 text-[11px] text-amber-100/80 dark:text-amber-200/60 text-center">
                Secure checkout on eBay. Buyer protection & easy returns.
              </p>
              
              {/* Testimonial in pricing section */}
              <div className="mt-6 pt-6 border-t border-amber-200 dark:border-amber-700">
                <p className="text-sm text-gray-700 dark:text-gray-300 italic mb-2">
                  "I was skeptical, but Joule nailed my December bill within 5%."
                </p>
                <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">— Lisa from Georgia</p>
              </div>
            </div>

            {/* Pro Tier - AI Core */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 relative flex flex-col opacity-60">
              <div className="absolute top-2 left-2 bg-violet-500 text-white text-xs font-bold px-2 py-1 rounded">COMING SOON</div>
              <div className="flex items-center justify-between mb-3 min-h-[3rem] mt-6">
                <h4 className="font-bold text-lg text-gray-500 dark:text-gray-500">Pro</h4>
                <span className="text-2xl font-extrabold text-gray-400 dark:text-gray-600 leading-tight whitespace-nowrap">$299</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-1 font-semibold">The AI Core</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mb-4">Coming Soon • Pi 5 16GB • The genius brain</p>
              <ul className="space-y-2 text-sm flex-grow mb-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">Everything in Smart tier</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">Pi 5 16GB hardware included</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">Voice control (Local Whisper)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">LLM intelligence (on-device)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 size={14} className="text-green-500 dark:text-green-600 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-600 dark:text-gray-400">100% air-gapped operation</span>
                </li>
              </ul>
              <button
                disabled
                className="mt-auto w-full px-6 py-3 bg-gray-400 dark:bg-gray-600 text-white rounded-lg font-semibold text-base cursor-not-allowed opacity-50 text-center block"
              >
                Coming Soon
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-10 text-gray-900 dark:text-white">
            Real Results from Real Homes
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4 italic leading-relaxed">
                "My AC stopped short-cycling and my July bill dropped by $27."
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">— Lisa from Georgia</p>
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-xl p-8 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
              <p className="text-lg text-gray-700 dark:text-gray-300 mb-4 italic leading-relaxed">
                "The humidity alerts alone are worth it. My house finally feels comfortable in summer."
              </p>
              <p className="text-base font-semibold text-gray-900 dark:text-white">— Mike from Texas</p>
            </div>
          </div>
        </div>
      </section>

      {/* Ask Joule Pre-Sales Support Box */}
      <section className="py-12 px-4 bg-gradient-to-br from-slate-900 to-slate-950">
        <div className="max-w-6xl mx-auto">
          <div className="mt-12 max-w-3xl mx-auto bg-slate-950 border border-slate-800 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <h3 className="text-lg md:text-xl font-semibold text-slate-50 mb-1">
                Questions before you buy?
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                Ask Joule about compatibility, installation, or what your bill might look like —
                in plain language, no sales script.
              </p>
              <ul className="space-y-1.5 text-xs md:text-sm text-slate-400">
                <li>• Will this work with my existing thermostat and wiring?</li>
                <li>• How hard is the Bridge install if I've never touched HVAC before?</li>
                <li>• What happens if I replace my thermostat later?</li>
                <li>• Is it safe for my heat pump, strips, or gas furnace?</li>
              </ul>
            </div>

            <div className="flex flex-col justify-center md:items-end gap-2">
              <button
                type="button"
                onClick={() => navigate("/?openAskJoule=true")}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition-colors"
              >
                Ask Joule a question
              </button>
              <p className="text-[11px] text-slate-400 max-w-xs md:text-right">
                We'll answer with real physics and real data — or tell you if it's not a good fit.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(-1)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  Will this break my HVAC system?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[-1] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[-1] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    No. Joule is designed to protect your system, not break it. The Free tier is read-only and only provides analysis. The Smart tier adds control, but all actions are logged and reversible. We follow industry-standard safety protocols.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(-2)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  Do I need special hardware?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[-2] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[-2] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    <strong>Free tier:</strong> No hardware needed. Just upload your thermostat's CSV data.
                  </p>
                  <p>
                    <strong>Smart tier:</strong> Includes a Raspberry Pi Zero 2 W that connects to your Ecobee. Everything you need comes in the box. No technical skills required — we provide step-by-step setup.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  Is this safe? Can it damage my HVAC system?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[0] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[0] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    Absolutely safe. Joule is read-only by default. It monitors your system and provides recommendations, but never makes changes without your explicit approval. The Bridge tier adds control capabilities, but all actions are logged and reversible.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(1)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  Does it work with Nest or other thermostats?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[1] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[1] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    <strong>Not yet. Joule is engineered exclusively for Ecobee.</strong>
                  </p>
                  <p className="mb-2">
                    Why? Because Ecobee allows Local Control via HomeKit. This lets Joule react in milliseconds to protect your compressor, without relying on the cloud. Nest and others rely on slow cloud APIs that lag by seconds—too slow for our hardware protection logic.
                  </p>
                  <p>
                    <strong>Have a Nest?</strong> <a href="#waitlist" className="text-blue-600 dark:text-blue-400 underline">Join the Waitlist</a>. We are building a cloud-bridge version for 2026.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(2)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  What if I don't have an Ecobee?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[2] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[2] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    You can still use the Intelligence Engine.
                  </p>
                  <p className="mb-2">
                    Any thermostat that exports data (CSV) works with our Free Analyzer. Upload your data to get your Heat Loss Score, Balance Point, and Efficiency Grade instantly.
                  </p>
                  <p>
                    For Automatic Monitoring & Control, you need an Ecobee. The Joule Bridge requires Ecobee's local API to run its protection logic.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(3)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  How much will I actually save?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[3] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[3] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    While results vary by home size, insulation, and local energy rates, the Department of Energy reports smart thermostat users save an average of 10-23% on heating and cooling costs.
                  </p>
                  <p className="mb-2">
                    For the average American home spending $2,000/year (DOE data), that's $200-$460 in annual savings. Bridge tier pays for itself in 3-8 months.
                  </p>
                  <p className="text-sm italic">
                    Sources: Department of Energy, ENERGY STAR
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(4)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  How accurate are the cost predictions?
                </span>
                <HelpCircle className={`w-5 h-5 text-gray-500 transition-transform ${faqOpen[4] ? 'rotate-180' : ''}`} />
              </button>
              {faqOpen[4] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    Physics-Grade Accuracy.
                  </p>
                  <p className="mb-2">
                    We don't guess based on 'similar homes.' We calculate your home's unique Thermal Decay Rate (how fast it loses heat per hour). By combining this physics model with your local utility rates and hyperlocal weather forecasts, Joule predicts your bill within 5-8% variance.
                  </p>
                  <p>
                    Bonus: We flag 'Weather Anomalies' (like Polar Vortex events) before they hit your wallet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300 py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">Joule</h3>
              <p className="text-sm">
                The operating system your HVAC deserves. Intelligent climate control for your home.
              </p>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Community</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a
                    href="https://reddit.com/r/hvac"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white flex items-center gap-1"
                  >
                    Reddit Community <ExternalLink size={14} />
                  </a>
                </li>
                <li>
                  <a
                    href="https://github.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white flex items-center gap-1"
                  >
                    GitHub <ExternalLink size={14} />
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-bold mb-4">Resources</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link to="/docs/PRODUCT-TIERS.md" className="hover:text-white">
                    Product Tiers
                  </Link>
                </li>
                <li>
                  <Link to="/docs/INSTALLATION-GUIDE.md" className="hover:text-white">
                    Installation Guide
                  </Link>
                </li>
                <li>
                  <Link to="/app" className="hover:text-white">
                    Launch App
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} Joule. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

