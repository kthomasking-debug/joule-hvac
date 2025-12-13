// src/navConfig.js
import { lazy } from "react";

// Lazy load all page components for code splitting and faster initial load
const LandingPage = lazy(() => import("./pages/LandingPage"));
const SevenDayCostForecaster = lazy(() =>
  import("./pages/SevenDayCostForecaster")
);
const HeatPumpEnergyFlow = lazy(() => import("./pages/HeatPumpEnergyFlow"));
const SystemPerformanceAnalyzer = lazy(() =>
  import("./pages/SystemPerformanceAnalyzer")
);
const GasVsHeatPump = lazy(() => import("./pages/GasVsHeatPump"));
const HeatPumpChargingCalc = lazy(() => import("./pages/HeatPumpChargingCalc"));
const CalculationMethodology = lazy(() =>
  import("./pages/CalculationMethodology")
);
const HomeDashboard = lazy(() => import("./pages/Home"));
const MissionControlSimple = lazy(() => import("./pages/MissionControlSimple"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const ThermostatStrategyAnalyzer = lazy(() =>
  import("./pages/ThermostatStrategyAnalyzer")
);
const MonthlyBudgetPlanner = lazy(() => import("./pages/MonthlyBudgetPlanner"));
const ProfessionalMode = lazy(() => import("./pages/ProfessionalMode"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const AskJouleHelp = lazy(() => import("./pages/AskJouleHelp"));
const ContactorDemo = lazy(() => import("./pages/ContactorDemo"));
const SmartThermostatDemo = lazy(() => import("./pages/SmartThermostatDemo"));
const AirQualityHMI = lazy(() => import("./pages/AirQualityHMI"));
const AgentConsole = lazy(() => import("./pages/AgentConsole"));
const UpgradeROIAnalyzer = lazy(() => import("./pages/UpgradeROIAnalyzer"));
const AskJouleCommandCenter = lazy(() =>
  import("./pages/AskJouleCommandCenter")
);
const HeatPumpGuide = lazy(() => import("./pages/HeatPumpGuide"));
const ThermostatDiagrams = lazy(() => import("./pages/ThermostatDiagrams"));
const SmartThermostatBuildGuide = lazy(() =>
  import("./pages/SmartThermostatBuildGuide")
);
const MarkdownPage = lazy(() => import("./pages/MarkdownPage"));
const Upgrades = lazy(() => import("./pages/Upgrades"));
const DocumentationSetupGuides = lazy(() =>
  import("./pages/DocumentationSetupGuides")
);
const Analysis = lazy(() => import("./pages/Analysis"));
const Control = lazy(() => import("./pages/Control"));
const Hardware = lazy(() => import("./pages/Hardware"));
const Checkout = lazy(() => import("./pages/Checkout"));
const SummerACIssues = lazy(() => import("./pages/SummerACIssues"));
const ForecastDebug = lazy(() => import("./pages/ForecastDebug"));
const BudgetDebug = lazy(() => import("./pages/BudgetDebug"));

import {
  Home as HomeIcon,
  Calendar,
  TrendingUp,
  Search,
  BarChart2,
  Activity,
  Zap,
  FileText,
  Settings as SettingsIcon,
  Bot,
  Thermometer,
  Box,
  Wind,
  Server,
  ShoppingCart,
  Heart,
  Bug,
} from "lucide-react";

export const routes = [
  {
    path: "/",
    name: "Landing",
    label: "Home",
    icon: HomeIcon,
    Component: LandingPage,
    exact: true,
    showInNav: false, // Don't show landing page in nav
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Joule Landing Page",
  },
  // ===== THE GOLDEN PATH: 5 MAIN TABS =====
  {
    path: "/mission-control",
    name: "Home Health",
    label: "Home Health",
    icon: Heart,
    Component: MissionControlSimple,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description:
      "Simple, friendly heat pump status — no engineering degree required",
  },
  {
    path: "/home",
    name: "Mission Control",
    label: "Mission Control",
    icon: HomeIcon,
    Component: HomeDashboard,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Energy dashboard & overview",
  },
  {
    path: "/analysis",
    name: "Analysis",
    label: "Analysis",
    icon: BarChart2,
    Component: Analysis,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Forecast, budget, compare, and analyzer",
  },
  {
    path: "/analysis/forecast",
    name: "Forecast",
    label: "Forecast",
    icon: Calendar,
    Component: Analysis,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "7-day cost forecast",
  },
  {
    path: "/analysis/budget",
    name: "Budget",
    label: "Budget",
    icon: TrendingUp,
    Component: Analysis,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Monthly budget planning",
  },
  {
    path: "/analysis/compare",
    name: "Compare",
    label: "Compare",
    icon: Search,
    Component: Analysis,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Gas vs Heat Pump comparison",
  },
  {
    path: "/analysis/analyzer",
    name: "Analyzer",
    label: "Analyzer",
    icon: BarChart2,
    Component: Analysis,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "System performance analysis",
  },
  {
    path: "/control",
    name: "Climate",
    label: "Climate",
    icon: Thermometer,
    Component: Control,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Thermostat and air quality control",
  },
  {
    path: "/control/thermostat",
    name: "Thermostat",
    label: "Thermostat",
    icon: Thermometer,
    Component: Control,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Smart thermostat control",
  },
  {
    path: "/control/air-quality",
    name: "Air Quality",
    label: "Air Quality",
    icon: Wind,
    Component: Control,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Dehumidifier and air purifier control",
  },
  {
    path: "/summer/ac-issues",
    name: "SummerACIssues",
    label: "AC Troubleshooting",
    icon: Wind,
    Component: SummerACIssues,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description:
      "Summer AC troubleshooting - sticky house, high humidity, short cycling",
  },
  {
    path: "/hardware",
    name: "Docs",
    label: "Docs",
    icon: FileText,
    Component: Hardware,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Documentation and knowledge base",
  },
  {
    path: "/config",
    name: "Settings",
    label: "Settings",
    icon: SettingsIcon,
    Component: SettingsPage,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "App settings",
  },
  // ===== LEGACY ROUTES (Hidden but kept for backward compatibility) =====
  {
    path: "/dashboard",
    name: "Dashboard",
    label: "Dashboard",
    icon: BarChart2,
    Component: HomeDashboard,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Energy dashboard & overview - redirects to /home",
  },
  {
    path: "/app",
    name: "Thermostat",
    label: "Thermostat",
    icon: HomeIcon,
    Component: SmartThermostatDemo,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Smart thermostat control - redirects to /control/thermostat",
  },
  {
    path: "/cost-forecaster",
    name: "Forecast",
    label: "Forecast",
    icon: Calendar,
    Component: SevenDayCostForecaster,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "7-day cost forecast - redirects to /analysis/forecast",
  },
  {
    path: "/monthly-budget",
    name: "Budget",
    label: "Budget",
    icon: TrendingUp,
    Component: MonthlyBudgetPlanner,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Monthly budget planning - redirects to /analysis/budget",
  },
  {
    path: "/air-quality",
    name: "Air Quality",
    label: "Air Quality",
    icon: Wind,
    Component: AirQualityHMI,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description:
      "Dehumidifier and air purifier control - redirects to /control/air-quality",
  },
  {
    path: "/settings",
    name: "Settings",
    label: "Settings",
    icon: SettingsIcon,
    Component: SettingsPage,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "App settings - redirects to /config",
  },
  // ===== HIDDEN/ADVANCED TOOLS (Not in main nav) =====
  {
    path: "/cost-comparison",
    name: "Compare",
    label: "Compare",
    icon: Search,
    Component: GasVsHeatPump,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Gas vs Heat Pump comparison - use /analysis/compare",
  },
  {
    path: "/thermostat-analyzer",
    name: "Thermostat",
    label: "Thermostat",
    icon: Search,
    Component: ThermostatStrategyAnalyzer,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Thermostat strategy analysis - hidden",
  },
  {
    path: "/performance-analyzer",
    name: "Analyzer",
    label: "Analyzer",
    icon: BarChart2,
    Component: SystemPerformanceAnalyzer,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "System performance analysis - use /analysis/analyzer",
  },
  {
    path: "/energy-flow",
    name: "Flow",
    label: "Flow",
    icon: Activity,
    Component: HeatPumpEnergyFlow,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Energy flow visualization - hidden (too nerdy)",
  },
  {
    path: "/charging-calculator",
    name: "Charge",
    label: "Charge",
    icon: Zap,
    Component: HeatPumpChargingCalc,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "A/C charging calculator - hidden (installer tool)",
  },
  {
    path: "/methodology",
    name: "Method",
    label: "Method",
    icon: FileText,
    Component: CalculationMethodology,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Calculation methodology - hidden",
  },
  {
    path: "/contactor-demo",
    name: "Contactors",
    label: "Contactor Demo",
    icon: Zap,
    Component: ContactorDemo,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Live contactor animation - hidden (dev tool)",
  },
  {
    path: "/ask-joule-help",
    name: "Help",
    label: "Ask Joule Help",
    Component: AskJouleHelp,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Ask Joule user manual and commands",
  },
  {
    path: "/professional",
    name: "Professional",
    label: "Professional",
    Component: ProfessionalMode,
    showInNav: false,
    hideInNav: true,
    inMobileNav: false,
    inPrimaryNav: false,
  },
  {
    path: "/onboarding",
    name: "Onboarding",
    label: "Onboarding",
    Component: Onboarding,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
  },
  {
    path: "/upgrade-roi",
    name: "Upgrades",
    label: "Upgrades",
    icon: TrendingUp,
    Component: UpgradeROIAnalyzer,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Upgrade ROI analyzer - hidden",
  },
  {
    path: "/ask-joule-command-center",
    name: "Ask Joule Command Center",
    label: "Ask Joule Command Center",
    icon: FileText,
    Component: AskJouleCommandCenter,
    showInNav: false,
    hideInNav: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Command history, export, and review for Ask Joule",
  },
  {
    path: "/heat-pump-guide",
    name: "Heat Pump Guide",
    label: "Heat Pump Guide",
    icon: Thermometer,
    Component: HeatPumpGuide,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Understanding your heat pump - moved to footer/help",
  },
  {
    path: "/documentation-setup-guides",
    name: "Documentation & Setup Guides",
    label: "Docs",
    icon: FileText,
    Component: DocumentationSetupGuides,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Complete guides - moved to /hardware",
  },
  {
    path: "/thermostat-diagrams",
    name: "Drawings",
    label: "Drawings",
    icon: Box,
    Component: ThermostatDiagrams,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Wiring diagrams - moved to footer/help",
  },
  {
    path: "/smart-thermostat-build-guide",
    name: "Smart Thermostat Build Guide",
    label: "Build Guide",
    icon: FileText,
    Component: SmartThermostatBuildGuide,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Build guide - moved to footer/help",
  },
  {
    path: "/docs/:filename",
    name: "Markdown Viewer",
    label: "Documentation",
    Component: MarkdownPage,
    showInNav: false,
    hideInNav: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Markdown document viewer",
  },
  {
    path: "/upgrades",
    name: "Upgrades Shop",
    label: "Shop",
    icon: Zap,
    Component: Upgrades,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Joule Monitor & Bridge products - moved to /hardware",
  },
  {
    path: "/checkout",
    name: "Checkout",
    label: "Checkout",
    icon: ShoppingCart,
    Component: Checkout,
    showInNav: false,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Checkout page with sales questions",
  },
  // ===== DEBUG PAGES (Uses Ecobee target temp directly via Joule Bridge) =====
  {
    path: "/analysis/forecast-debug",
    name: "Forecast Debug",
    label: "Forecast Debug",
    icon: Bug,
    Component: ForecastDebug,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: false,
    description: "7-day forecast using Ecobee target temp directly (no scheduling)",
  },
  {
    path: "/analysis/budget-debug",
    name: "Budget Debug",
    label: "Budget Debug",
    icon: Bug,
    Component: BudgetDebug,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: false,
    description: "Annual budget using Ecobee target temp directly (no scheduling)",
  },
];

// Synchronize header and mobile nav with the routes array
export const headerNav = routes.filter((r) => r.showInNav && !r.hideInNav);
export const mobileNav = routes.filter(
  (r) => (r.showInNav || r.showInMoreMenu) && !r.hideInNav
);

export default routes;
