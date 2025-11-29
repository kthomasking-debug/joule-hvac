import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
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

// Demo Cost Estimate Card Component (with dummy data)
const DemoCostCard = () => {
  const [indoorTemp, setIndoorTemp] = useState(70);

  // Dummy data for demo
  const demoData = useMemo(() => {
    const baseCost = 120;
    const tempDiff = Math.abs(70 - indoorTemp);
    const weeklyCost = baseCost + tempDiff * 2.5;
    const monthlyCost = weeklyCost * 4.3;
    const annualCost = monthlyCost * 12;

    return {
      weekly: weeklyCost,
      monthly: monthlyCost,
      annual: annualCost,
      savings: Math.max(0, (72 - indoorTemp) * 15),
    };
  }, [indoorTemp]);

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-xl p-6 border-2 border-blue-200 dark:border-blue-700 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <DollarSign className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          7-Day Cost Forecast
        </h3>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Indoor Temperature: {indoorTemp}°F
        </label>
        <input
          type="range"
          min="65"
          max="75"
          value={indoorTemp}
          onChange={(e) => setIndoorTemp(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>65°F</span>
          <span>75°F</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            This Week
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${demoData.weekly.toFixed(0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            This Month
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            ${demoData.monthly.toFixed(0)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
            This Year
          </p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            ${demoData.annual.toFixed(0)}
          </p>
        </div>
      </div>

      {demoData.savings > 0 && (
        <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-3">
          <p className="text-sm text-green-800 dark:text-green-200">
            💰 Potential savings:{" "}
            <strong>${demoData.savings.toFixed(0)}/year</strong> at {indoorTemp}
            °F
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
          <h1 className="text-5xl md:text-6xl font-extrabold mb-6 leading-tight">
            The Operating System
            <br />
            Your HVAC Deserves
          </h1>
          <p className="text-xl md:text-2xl mb-4 text-blue-100">
            Your Ecobee is dumb. ProStat is the brain.
          </p>
          <p className="text-lg mb-8 text-blue-200 max-w-2xl mx-auto">
            Stop short cycling. Predict bills. Protect your lungs. Take control
            of your home's climate with intelligence, not guesswork.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate("/onboarding")}
              className="px-8 py-4 bg-white text-blue-600 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
            >
              Launch App <ArrowRight size={20} />
            </button>
            <a
              href="#pricing"
              className="px-8 py-4 bg-blue-700 hover:bg-blue-800 rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
            >
              View Pricing
            </a>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-4 text-gray-900 dark:text-white">
            See It In Action
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
            Watch your heating costs update in real-time as you adjust the
            temperature
          </p>
          <DemoCostCard />
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
            Why ProStat?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center mb-4">
                <Activity className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                Stop Short Cycling
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Detect and prevent compressor damage from rapid on/off cycles.
                Your equipment lasts longer, your bills go down.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                Predict Bills
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                See your heating costs before they happen. Adjust your
                thermostat with confidence, knowing exactly what it costs.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border-2 border-gray-200 dark:border-gray-700 shadow-lg">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-white">
                Protect Lungs
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor air quality and humidity. Get alerts when conditions
                threaten your family's health.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section
        id="pricing"
        className="py-16 px-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950"
      >
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <Crown className="w-12 h-12 text-purple-600 dark:text-purple-400 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4 text-gray-900 dark:text-white">
              ProStat Product Tiers
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Choose the plan that fits your needs
            </p>
            <Link
              to="/upgrades"
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors shadow-lg hover:shadow-xl"
            >
              View All Upgrades
              <ArrowRight size={18} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-gray-300 dark:border-gray-600 p-6 flex flex-col">
              <div className="flex items-center justify-between mb-3 min-h-[3rem]">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                  Free
                </h4>
                <span className="text-2xl font-extrabold text-gray-900 dark:text-white leading-tight">
                  $0
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 font-semibold">
                CSV Analyzer
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                For DIY homeowners and one-time analysis
              </p>
              <ul className="space-y-2 text-sm flex-grow mb-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Manual CSV upload & analysis
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Heat loss calculation
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Efficiency analysis
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle
                    size={16}
                    className="text-gray-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-500 dark:text-gray-500">
                    No automatic monitoring
                  </span>
                </li>
              </ul>
              <button
                onClick={() => navigate("/onboarding")}
                className="mt-auto w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl"
              >
                Get Started Free
              </button>
            </div>

            {/* Monitor Tier */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border-2 border-blue-400 dark:border-blue-600 p-6 relative flex flex-col">
              <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded">
                POPULAR
              </div>
              <div className="flex items-center justify-between mb-3 min-h-[3rem]">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                  Monitor
                </h4>
                <div className="text-right">
                  <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400 leading-tight whitespace-nowrap">
                    $20
                  </span>
                  <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                    /year
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-semibold">
                ProStat Monitor
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                Annual subscription • Automatic cloud monitoring
              </p>
              <ul className="space-y-2 text-sm flex-grow mb-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Everything in Free tier
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Automatic daily data collection
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Daily heat loss analysis
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Trend tracking & alerts
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <XCircle
                    size={16}
                    className="text-gray-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-500 dark:text-gray-500">
                    No hardware control
                  </span>
                </li>
              </ul>
              <Link
                to="/upgrades"
                className="mt-auto w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl text-center block"
              >
                Subscribe - $20/year
              </Link>
            </div>

            {/* Bridge Tier */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950 dark:to-orange-950 rounded-lg border-2 border-amber-400 dark:border-amber-600 p-6 relative flex flex-col">
              <div className="absolute top-2 right-2 bg-amber-600 text-white text-xs font-bold px-2 py-1 rounded">
                PREMIUM
              </div>
              <div className="flex items-center justify-between mb-3 min-h-[3rem]">
                <h4 className="font-bold text-lg text-gray-900 dark:text-white">
                  Bridge
                </h4>
                <span className="text-2xl font-extrabold text-amber-600 dark:text-amber-400 leading-tight whitespace-nowrap">
                  $129
                </span>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-1 font-semibold">
                ProStat Bridge
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                One-time purchase • Complete control
              </p>
              <ul className="space-y-2 text-sm flex-grow mb-4">
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Everything in Monitor tier
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    ProStat Bridge hardware included (pre-configured)
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Local HomeKit control
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Full thermostat control
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                  />
                  <span className="text-gray-700 dark:text-gray-300">
                    Works completely offline
                  </span>
                </li>
              </ul>
              <Link
                to="/upgrades"
                className="mt-auto w-full px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-lg transition-colors shadow-lg hover:shadow-xl text-center block"
              >
                Buy Now - $129
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900 dark:text-white">
            Frequently Asked Questions
          </h2>

          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <button
                onClick={() => toggleFaq(0)}
                className="w-full p-4 flex items-center justify-between text-left"
              >
                <span className="font-semibold text-gray-900 dark:text-white">
                  Is this safe? Can it damage my HVAC system?
                </span>
                <HelpCircle
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    faqOpen[0] ? "rotate-180" : ""
                  }`}
                />
              </button>
              {faqOpen[0] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    Absolutely safe. ProStat is read-only by default. It
                    monitors your system and provides recommendations, but never
                    makes changes without your explicit approval. The Bridge
                    tier adds control capabilities, but all actions are logged
                    and reversible.
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
                <HelpCircle
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    faqOpen[1] ? "rotate-180" : ""
                  }`}
                />
              </button>
              {faqOpen[1] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p className="mb-2">
                    <strong>
                      ProStat is purpose-built for the Ecobee architecture.
                    </strong>{" "}
                    We don't support inferior thermostats because they don't
                    give us the data fidelity we need to save you money.
                  </p>
                  <p className="mb-2">
                    Ecobee provides robust local HomeKit integration (zero cloud
                    fees, zero approval), instant CSV downloads for our Free
                    tier, and the data quality our algorithms require.
                  </p>
                  <p>
                    <strong>Have a Nest?</strong>{" "}
                    <a
                      href="#waitlist"
                      className="text-blue-600 dark:text-blue-400 underline"
                    >
                      Join the waitlist
                    </a>{" "}
                    - we'll add support if there's enough demand.
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
                <HelpCircle
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    faqOpen[2] ? "rotate-180" : ""
                  }`}
                />
              </button>
              {faqOpen[2] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    No problem! The Free tier lets you upload CSV exports from
                    any thermostat. Export your data, upload it to ProStat, and
                    get the same powerful analysis. The Monitor tier requires
                    Ecobee for automatic daily analysis.
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
                  How accurate are the cost predictions?
                </span>
                <HelpCircle
                  className={`w-5 h-5 text-gray-500 transition-transform ${
                    faqOpen[3] ? "rotate-180" : ""
                  }`}
                />
              </button>
              {faqOpen[3] && (
                <div className="px-4 pb-4 text-gray-600 dark:text-gray-400">
                  <p>
                    Our predictions use real-time weather data, your home's
                    actual heat loss characteristics (calculated from your
                    data), and current utility rates. Most users see accuracy
                    within 5-10% of actual bills. The more data you provide, the
                    more accurate it gets.
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
              <h3 className="text-white font-bold mb-4">ProStat</h3>
              <p className="text-sm">
                The operating system your HVAC deserves. Intelligent climate
                control for your home.
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
                  <Link
                    to="/docs/PRODUCT-TIERS.md"
                    className="hover:text-white"
                  >
                    Product Tiers
                  </Link>
                </li>
                <li>
                  <Link
                    to="/docs/INSTALLATION-GUIDE.md"
                    className="hover:text-white"
                  >
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
            <p>
              &copy; {new Date().getFullYear()} ProStat. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
