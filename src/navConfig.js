// src/navConfig.js
import SevenDayCostForecaster from "./pages/SevenDayCostForecaster";
import HeatPumpEnergyFlow from "./pages/HeatPumpEnergyFlow";
import SystemPerformanceAnalyzer from "./pages/SystemPerformanceAnalyzer";
import GasVsHeatPump from "./pages/GasVsHeatPump";
import HeatPumpChargingCalc from "./pages/HeatPumpChargingCalc";
import CalculationMethodology from "./pages/CalculationMethodology";
import HomeDashboard from "./pages/Home";
import SettingsPage from "./pages/Settings";
import ThermostatStrategyAnalyzer from "./pages/ThermostatStrategyAnalyzer";
import MonthlyBudgetPlanner from "./pages/MonthlyBudgetPlanner";
import ProfessionalMode from "./pages/ProfessionalMode";
import Onboarding from "./pages/Onboarding";
import AskJouleHelp from "./pages/AskJouleHelp";
import ContactorDemo from "./pages/ContactorDemo";
import SmartThermostatDemo from "./pages/SmartThermostatDemo";
import AgentConsole from "./pages/AgentConsole";
import UpgradeROIAnalyzer from "./pages/UpgradeROIAnalyzer";
import AskJouleCommandCenter from "./pages/AskJouleCommandCenter";
import HeatPumpGuide from "./pages/HeatPumpGuide";

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
} from "lucide-react";

export const routes = [
  {
    path: "/",
    name: "Home",
    label: "Home",
    icon: HomeIcon,
    Component: SmartThermostatDemo,
    exact: true,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Smart thermostat control",
  },
  {
    path: "/dashboard",
    name: "Dashboard",
    label: "Dashboard",
    icon: BarChart2,
    Component: HomeDashboard,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Energy dashboard & overview",
  },
  {
    path: "/cost-forecaster",
    name: "Forecast",
    label: "Forecast",
    icon: Calendar,
    Component: SevenDayCostForecaster,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "7-day cost forecast",
  },
  {
    path: "/monthly-budget",
    name: "Budget",
    label: "Budget",
    icon: TrendingUp,
    Component: MonthlyBudgetPlanner,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Monthly budget planning",
  },
  {
    path: "/agent-console",
    name: "Agent",
    label: "Agent",
    icon: Bot,
    Component: AgentConsole,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Autonomous AI agent",
  },
  {
    path: "/settings",
    name: "Settings",
    label: "Settings",
    icon: SettingsIcon,
    Component: SettingsPage,
    showInNav: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "App settings",
  },
  {
    path: "/cost-comparison",
    name: "Compare",
    label: "Compare",
    icon: Search,
    Component: GasVsHeatPump,
    isTool: true,
    inMobileNav: false,
    inPrimaryNav: true,
    description: "Gas vs Heat Pump comparison",
  },
  {
    path: "/thermostat-analyzer",
    name: "Thermostat",
    label: "Thermostat",
    icon: Search,
    Component: ThermostatStrategyAnalyzer,
    isTool: true,
    inMobileNav: false,
    inPrimaryNav: true,
    description: "Thermostat strategy analysis",
  },
  {
    path: "/performance-analyzer",
    name: "Analyze",
    label: "Analyze",
    icon: BarChart2,
    Component: SystemPerformanceAnalyzer,
    showInMoreMenu: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "System performance analysis",
  },
  {
    path: "/energy-flow",
    name: "Flow",
    label: "Flow",
    icon: Activity,
    Component: HeatPumpEnergyFlow,
    showInMoreMenu: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Energy flow visualization",
  },
  {
    path: "/charging-calculator",
    name: "Charge",
    label: "Charge",
    icon: Zap,
    Component: HeatPumpChargingCalc,
    showInMoreMenu: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "A/C charging calculator",
  },
  {
    path: "/methodology",
    name: "Method",
    label: "Method",
    icon: FileText,
    Component: CalculationMethodology,
    showInMoreMenu: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Calculation methodology",
  },
  {
    path: "/contactor-demo",
    name: "Contactors",
    label: "Contactor Demo",
    icon: Zap,
    Component: ContactorDemo,
    isTool: true,
    showInMoreMenu: true,
    inMobileNav: false,
    inPrimaryNav: true,
    description: "Live contactor animation",
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
    showInMoreMenu: true,
    inMobileNav: false,
    inPrimaryNav: false,
    description: "Upgrade ROI analyzer",
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
    showInNav: true,
    showInMoreMenu: true,
    inMobileNav: true,
    inPrimaryNav: true,
    description: "Understanding your heat pump - everything you need to know",
  },
];

// Synchronize header and mobile nav with the routes array
export const headerNav = routes.filter((r) => r.showInNav && !r.hideInNav);
export const mobileNav = routes.filter((r) => (r.showInNav || r.showInMoreMenu) && !r.hideInNav);

export default routes;
