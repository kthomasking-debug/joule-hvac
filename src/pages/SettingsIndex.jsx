import React from 'react';
import { Link } from 'react-router-dom';
import { Home, Zap, DollarSign, ThermometerSun, Server, ArrowRight, Settings as SettingsIcon } from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs';

const settingsSections = [
  {
    id: 'home-setup',
    path: '/settings/home-setup',
    label: 'Home Setup',
    number: '1',
    icon: Home,
    description: 'Tell Joule about your home so estimates match reality.',
    color: 'blue',
  },
  {
    id: 'system-config',
    path: '/settings/system-config',
    label: 'System Configuration',
    number: '2',
    icon: Zap,
    description: 'Describe your HVAC system so Joule can model it accurately.',
    note: 'This section does not control your equipment — it only affects calculations.',
    color: 'purple',
  },
  {
    id: 'costs-rates',
    path: '/settings/costs-rates',
    label: 'Costs & Rates',
    number: '3',
    icon: DollarSign,
    description: 'Set utility rates and pricing preferences',
    color: 'green',
  },
  {
    id: 'thermostat',
    path: '/settings/thermostat',
    label: 'Thermostat Preferences',
    number: '4',
    icon: ThermometerSun,
    description: 'Describe your typical thermostat preferences (for estimates only)',
    color: 'orange',
  },
  {
    id: 'bridge-ai',
    path: '/settings/bridge-ai',
    label: 'Bridge & AI',
    number: '5',
    icon: Server,
    description: 'Connect hardware and configure AI features',
    color: 'cyan',
  },
];

const colorClasses = {
  blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  green: 'bg-green-500/20 text-green-400 border-green-500/30',
  orange: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cyan: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
};

export default function SettingsIndex() {
  return (
    <div className="min-h-screen bg-[#050B10]">
      <div className="w-full px-6 lg:px-8 py-6">
        <Breadcrumbs />
        
        {/* Page Header */}
        <header className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center">
              <SettingsIcon className="w-6 h-6 text-slate-300" />
            </div>
            <h1 className="text-[32px] font-bold text-[#FFFFFF]">
              Settings
            </h1>
          </div>
          <p className="text-sm text-[#A7B0BA] mb-1">
            Set up how Joule <strong>models</strong> your home, system, and energy costs.
          </p>
          <p className="text-xs text-[#7C8894] italic">
            These settings are used for estimates and analysis. Joule does not change your thermostat schedule or comfort settings.
          </p>
          <p className="text-xs text-[#7C8894] mt-2">
            <strong>Joule estimates and explains — it doesn't override your comfort or control your home.</strong>
          </p>
        </header>

        {/* Settings Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {settingsSections.map((section) => {
            const Icon = section.icon;
            const colorClass = colorClasses[section.color];
            const isComingSoon = section.id === 'bridge-ai';
            
            return (
              <Link
                key={section.id}
                to={isComingSoon ? "#" : section.path}
                onClick={(e) => {
                  if (isComingSoon) {
                    e.preventDefault();
                  }
                }}
                className={`group bg-[#0C1118] border border-slate-800 rounded-xl p-6 transition-all ${
                  isComingSoon
                    ? "opacity-50 cursor-not-allowed"
                    : "hover:border-slate-700 hover:bg-slate-900/50"
                }`}
                title={isComingSoon ? "Coming Soon" : section.description}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl ${colorClass} flex items-center justify-center border ${isComingSoon ? "opacity-50" : ""}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold ${isComingSoon ? "text-[#7C8894]" : "text-[#A7B0BA]"}`}>{section.number}</span>
                        <h2 className={`text-xl font-bold transition-colors ${
                          isComingSoon
                            ? "text-[#7C8894]"
                            : "text-[#E8EDF3] group-hover:text-white"
                        }`}>
                          {section.label}
                        </h2>
                      </div>
                      <p className={`text-sm ${isComingSoon ? "text-[#7C8894]" : "text-[#A7B0BA]"}`}>
                        {section.description}
                      </p>
                      {section.note && (
                        <p className="text-xs text-[#7C8894] italic mt-1">
                          {section.note}
                        </p>
                      )}
                    </div>
                  </div>
                  {!isComingSoon && (
                    <ArrowRight className="w-5 h-5 text-slate-600 group-hover:text-slate-400 group-hover:translate-x-1 transition-all" />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}


