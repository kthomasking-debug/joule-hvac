import React, { useMemo, useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Crown, ChevronDown, ChevronUp, Volume2, VolumeX } from 'lucide-react';
import { routes } from './navConfig';
import './App.css'; // Retain any legacy specifics (can prune later)
import { Moon, Sun } from 'lucide-react';
import TermsAcceptanceModal from './components/TermsAcceptanceModal';
import { useTermsAcceptance } from './hooks/useTermsAcceptance';
import AnimatedSplash from './components/AnimatedSplash';
import AskJoule from './components/AskJoule';
import JouleFab from './components/JouleFab';
import ModeSwitcher from './components/ModeSwitcher';
import ModeToggle from './components/ModeToggle';
import { ModeProvider, useMode } from './contexts/ModeContext';
import { AIMode } from './components/AIMode';
import { ConversationProvider } from './contexts/ConversationContext';


function AppInner() {
  // Splash screen state
  const [showSplash, setShowSplash] = React.useState(true);
  // State for the "More" menu
  const [showMoreMenu, setShowMoreMenu] = React.useState(false);
  // State for desktop tools dropdown
  const [showToolsDropdown, setShowToolsDropdown] = useState(false);
  // State for Ask Joule modal
  const [isJouleModalOpen, setIsJouleModalOpen] = useState(false);

  // Terms acceptance state
  const { termsAccepted, markTermsAccepted, isLoaded } = useTermsAcceptance();
  const navigate = useNavigate();
  const { mode, setMode } = useMode();

  // All user settings in one object, persisted with useLocalStorage
  const defaultSettings = useMemo(() => ({
    capacity: 24,
    efficiency: 15,
    winterThermostat: 70,
    summerThermostat: 74,
    useDetailedAnnualEstimate: false,
    utilityCost: 0.10,
    gasCost: 1.20,
    primarySystem: 'heatPump',
    afue: 0.95,
    squareFeet: 800,
    insulationLevel: 0.65,
    homeShape: 0.9,
    ceilingHeight: 8,
    homeElevation: 0,
    energyMode: 'heating',
    solarExposure: 1.0,
    coolingSystem: 'heatPump',
    coolingCapacity: 36,
    hspf2: 9.0,
    useElectricAuxHeat: true
  }), []);
  // Replace useLocalStorage with explicit state management for userSettings
  const [userSettings, setUserSettings] = React.useState(() => {
    try {
      const stored = localStorage.getItem('userSettings');
      return stored ? JSON.parse(stored) : defaultSettings;
    } catch (_e) {
      console.warn('Failed to parse userSettings from localStorage', _e);
      return defaultSettings;
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('userSettings', JSON.stringify(userSettings));
        } catch (_e) {
      console.warn('Failed to persist userSettings', _e);
    }
  }, [userSettings]);

  // Ensure we always pass a merged object with defaults to child routes to avoid missing keys
  const mergedUserSettings = useMemo(() => ({ ...defaultSettings, ...(userSettings || {}) }), [userSettings, defaultSettings]);


  const [userLocation, setUserLocation] = useState(() => {
    try {
      const raw = localStorage.getItem('userLocation');
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  });

  // Update userLocation state when userSettings changes (e.g., when location is set via UI)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userLocation');
      const parsed = raw ? JSON.parse(raw) : null;
      setUserLocation(parsed);
    } catch (_e) {
      // ignore
    }
  }, [userSettings]);

  // On mount, if persisted userSettings are missing keys, merge default keys and persist them back.
  React.useEffect(() => {
    try {
      const merged = { ...defaultSettings, ...(userSettings || {}) };
      if (JSON.stringify(merged) !== JSON.stringify(userSettings)) {
        setUserSettings(merged);
      }
    } catch (_e) {
      console.warn('Failed to merge default user settings', _e);
    }
    // Only run once on mount for safety
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Individual state for values not in userSettings
  const [manualTemp, setManualTemp] = React.useState(32);
  const [manualHumidity, setManualHumidity] = React.useState(65);
  const [heatLossFactor, setHeatLossFactor] = React.useState(null);
  // Dark mode persisted
  const [darkMode, setDarkMode] = React.useState(() => {
    try {
      const stored = localStorage.getItem('darkMode');
      return stored ? JSON.parse(stored) : true;
    } catch (error) {
      console.warn('Failed to read darkMode setting from localStorage', error);
      return true;
    }
  });

  const toggleDarkMode = () => {
    setDarkMode(prevMode => {
      const newMode = !prevMode;
      try {
        localStorage.setItem('darkMode', JSON.stringify(newMode));
      } catch (error) {
        console.warn('Failed to persist darkMode setting', error);
      }
      return newMode;
    });
  };

  // Also persist darkMode changes via useEffect
  React.useEffect(() => {
    try {
      localStorage.setItem('darkMode', JSON.stringify(darkMode));
    } catch (error) {
      console.warn('Failed to persist dark mode setting', error);
    }
  }, [darkMode]);

  // Global mute state for all speech/audio
  const [isMuted, setIsMuted] = useState(() => {
    try {
      const saved = localStorage.getItem('globalMuted');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const toggleMute = () => {
    setIsMuted(prev => {
      const newMuted = !prev;
      try {
        localStorage.setItem('globalMuted', String(newMuted));
        // Also sync with askJouleMuted for compatibility
        localStorage.setItem('askJouleMuted', String(newMuted));
      } catch {
        // Ignore storage errors
      }
      return newMuted;
    });
  };

  // Persist mute state
  React.useEffect(() => {
    try {
      localStorage.setItem('globalMuted', String(isMuted));
      localStorage.setItem('askJouleMuted', String(isMuted));
    } catch {
      // Ignore storage errors
    }
  }, [isMuted]);

  // Restore derived values (heatLoss, tons, compressorPower) after state initializers
  const heatLoss = useMemo(() => {
    const baseBtuPerSqFt = 22.67;
    const ceilingMultiplier = 1 + (userSettings.ceilingHeight - 8) * 0.1;
    return Math.round((userSettings.squareFeet * baseBtuPerSqFt * userSettings.insulationLevel * userSettings.homeShape * ceilingMultiplier) / 1000) * 1000;
  }, [userSettings.squareFeet, userSettings.insulationLevel, userSettings.homeShape, userSettings.ceilingHeight]);

  const capacities = { 18: 1.5, 24: 2.0, 30: 2.5, 36: 3.0, 42: 3.5, 48: 4.0, 60: 5.0 };
  // Backwards compatibility: prefer explicit userSettings.capacity, otherwise fall back to coolingCapacity
  const tons = capacities[userSettings.capacity ?? userSettings.coolingCapacity];
  const compressorPower = useMemo(() => tons * 1.0 * (15 / userSettings.efficiency), [tons, userSettings.efficiency]);

  // Audit log persisted to localStorage (Ask Joule commands and edits)
  const [auditLog, setAuditLog] = React.useState(() => {
    try {
      const raw = localStorage.getItem('askJouleAuditLog');
      return raw ? JSON.parse(raw) : [];
    } catch (_e) {
      console.warn('Failed to parse askJouleAuditLog', _e);
      return [];
    }
  });

  React.useEffect(() => {
    try {
      localStorage.setItem('askJouleAuditLog', JSON.stringify(auditLog));
    } catch (_e) { /* ignore write errors */ }
  }, [auditLog]);

  // Helper to push an audit entry. Includes a small unique id.
  const pushAuditLog = (entry) => {
    const now = Date.now();
    const id = `${now}-${Math.floor(Math.random() * 99999)}`;
    const item = { id, timestamp: now, ...entry };
    setAuditLog(prev => [item, ...prev].slice(0, 250)); // Keep last 250 entries
    return item;
  };

  // Undo a change (reverts to oldValue). The caller must pass the audit entry id.
  const undoChange = (idOrWhen) => {
    const id = idOrWhen === 'last' ? (auditLog && auditLog.length > 0 ? auditLog[0].id : null) : idOrWhen;
    const entry = id ? auditLog.find(e => e.id === id) : null;
    if (!entry) return false;
    // Only undo entries that are settings updates (have key and oldValue)
    if (typeof entry.key !== 'undefined') {
      // Revert by writing the old value back into userSettings if the key maps to userSettings
      setUserSettings(prev => {
        const merged = { ...prev };
        merged[entry.key] = entry.oldValue;
        return merged;
      });
      // Push an 'undo' record for traceability
      pushAuditLog({ key: entry.key, oldValue: entry.newValue, newValue: entry.oldValue, source: 'undo', comment: `Undo ${entry.id}` });
      return true;
    }
    // For other types of audit entries, we don't support undo yet
    return false;
  };

  // Clear audit history
  const clearAuditLog = () => setAuditLog([]);

  // Helper to update a single user setting
  // Accepts optional meta param: { source: 'AskJoule' | 'ui' | 'script', comment }
  const setUserSetting = (key, value, meta = {}) => {
    setUserSettings(prev => {
      const prevValue = prev ? prev[key] : undefined;
      const next = { ...prev, [key]: value };
      // Only push if value changes
      if (JSON.stringify(prevValue) !== JSON.stringify(value)) {
        pushAuditLog({ key, oldValue: prevValue, newValue: value, source: meta.source || 'ui', comment: meta.comment || '' });
      }
      // Special handling for 'location' to keep localStorage userLocation in sync
      try {
        if (key === 'location' && typeof value === 'string') {
          const raw = localStorage.getItem('userLocation');
          const parsed = raw ? JSON.parse(raw) : {};
          parsed.city = value;
          localStorage.setItem('userLocation', JSON.stringify(parsed));
        }
      } catch (err) { /* ignore */ }
      return next;
    });
  };

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);


  // Onboarding check
  useEffect(() => {
    const onboarded = localStorage.getItem('onboarded');
    if (!onboarded && isLoaded && termsAccepted) {
      navigate('/onboarding');
    }
  }, [isLoaded, termsAccepted, navigate]);

  // Sync userLocation elevation with userSettings.homeElevation
  useEffect(() => {
    try {
      const raw = localStorage.getItem('userLocation');
      if (!raw) return;
      const loc = JSON.parse(raw);
      if (!loc || typeof loc !== 'object') return;
      if (loc.elevation !== userSettings.homeElevation) {
        loc.elevation = userSettings.homeElevation;
        localStorage.setItem('userLocation', JSON.stringify(loc));
      }
    } catch { /* ignore */ }
  }, [userSettings.homeElevation]);

  // Keep capacity and coolingCapacity keys synchronized to avoid mismatch between onboarding and settings
  useEffect(() => {
    try {
      const cap = userSettings.capacity;
      const coolCap = userSettings.coolingCapacity;
      // If they differ (or one is missing), prefer the explicitly set key and mirror it
      if (typeof cap === 'number' && cap !== coolCap) {
        setUserSettings(prev => ({ ...prev, coolingCapacity: cap }));
      } else if (typeof coolCap === 'number' && coolCap !== cap) {
        setUserSettings(prev => ({ ...prev, capacity: coolCap }));
      }
    } catch {
      // ignore
    }
  }, [userSettings.capacity, userSettings.coolingCapacity]);

  // Subscription / Pro flag (used to gate commercial features)
  const isPro = useMemo(() => {
    try {
      const stored = localStorage.getItem('userSubscription');
      if (stored) {
        const obj = JSON.parse(stored);
        if (obj && obj.isPro) return true;
      }
    } catch {
      // ignore
    }
    return localStorage.getItem('isPro') === 'true';
  }, []);

  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';
  // Hide the persistent/global AskJoule instance on pages that provide their own AskJoule component
  const ASK_JOULE_DISABLED_PATHS = ['/', '/cost-forecaster'];
  const shouldShowGlobalAskJoule = !ASK_JOULE_DISABLED_PATHS.includes(location.pathname);
  const [showAskModal, setShowAskModal] = React.useState(false);

  // Centralized onboarding redirect: When the terms are accepted and the app has loaded,
  // redirect first-time users (those who haven't completed onboarding) to /cost-forecaster.
  // This ensures consistent behavior across different entry points and avoids race conditions
  // where child components may not yet run redirect logic.
  useEffect(() => {
    if (!isLoaded || !termsAccepted) return;
    try {
      const hasCompleted = localStorage.getItem('hasCompletedOnboarding');
      const pathIsRoot = window.location.pathname === '/' || window.location.pathname === '';
      if (!hasCompleted && pathIsRoot) {
        // Hide splash if present and navigate
        setShowSplash(false);
        // Use react-router's navigate via useNavigate
        navigate('/cost-forecaster');
      }
    } catch {
      // If anything fails silently, do not block the app
      // console.warn('Onboarding redirect failed', e);
    }
  }, [isLoaded, termsAccepted, navigate]);


  // Splash screen logic
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2500); // Splash visible for 2.5s
    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return <AnimatedSplash />;
  }

  if (!isLoaded) {
    return null; // Or a loading spinner
  }

  if (!termsAccepted) {
    return <TermsAcceptanceModal onAccept={markTermsAccepted} />;
  }

  const navLinks = routes.filter(route => route.showInNav);
  const moreLinks = routes.filter(route => route.showInMoreMenu);

  const handleTempChange = e => {
    setManualTemp(parseInt(e.target.value, 10));
  };

  const handleHumidityChange = e => {
    setManualHumidity(parseInt(e.target.value, 10));
  };

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      {/* Header */}
      <header className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center">
          <NavLink to="/" className="flex items-center space-x-2">
            <img src="/icon-192.png" alt="Joule Logo" className="h-8 w-8" />
            <span className="font-bold text-lg hidden sm:inline">Joule</span>
          </NavLink>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-1">
          {navLinks.map(route => (
            <NavLink
              key={route.path}
              to={route.path}
              onClick={() => {
                // Switch to traditional mode when navigating from AI mode
                if (mode === 'ai') {
                  setMode('traditional');
                }
              }}
              className={({ isActive }) =>
                `px-3 py-2 rounded-md text-sm font-medium ${
                  isActive
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`
              }
            >
              {route.name}
            </NavLink>
          ))}
          {/* Tools Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowToolsDropdown(!showToolsDropdown)}
              className="px-3 py-2 rounded-md text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center"
            >
              Tools <ChevronDown className="w-4 h-4 ml-1" />
            </button>
            {showToolsDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg z-20">
                {routes
                  .filter(r => r.isTool)
                  .map(route => (
                    <NavLink
                      key={route.path}
                      to={route.path}
                      onClick={() => {
                        setShowToolsDropdown(false);
                        // Switch to traditional mode when navigating from AI mode
                        if (mode === 'ai') {
                          setMode('traditional');
                        }
                      }}
                      className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                      {route.name}
                    </NavLink>
                  ))}
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center space-x-2">
          {/* Global Mute Button */}
          <button
            onClick={toggleMute}
            className={`px-3 sm:px-4 py-2 rounded-lg font-semibold text-sm transition-all ${
              isMuted
                ? 'bg-red-500 hover:bg-red-600 text-white border-2 border-red-600'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
            aria-label={isMuted ? 'Unmute voice' : 'Mute voice'}
            title={isMuted ? 'Voice MUTED - Click to unmute' : 'Voice ON - Click to mute'}
          >
            {isMuted ? (
              <>
                <VolumeX size={20} className="inline sm:mr-2" />
                <span className="hidden sm:inline">MUTED</span>
              </>
            ) : (
              <>
                <Volume2 size={20} className="inline sm:mr-2" />
                <span className="hidden sm:inline">Voice</span>
              </>
            )}
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
            aria-label="Toggle dark mode"
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <ModeSwitcher />
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto p-4">
        {mode === 'ai' ? (
          <AIMode />
        ) : (
          <Outlet
            context={{
              userSettings: mergedUserSettings,
              setUserSettings,
              setUserSetting,
              manualTemp,
              handleTempChange,
              manualHumidity,
              handleHumidityChange,
              heatLossFactor,
              setHeatLossFactor,
            }}
          />
        )}
      </main>

      {/* Floating Action Button for Ask Joule */}
      <JouleFab onClick={() => setIsJouleModalOpen(true)} />

      {/* Ask Joule Modal */}
      {isJouleModalOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center"
          onClick={() => setIsJouleModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4"
            onClick={e => e.stopPropagation()}
          >
            <AskJoule
              userSettings={mergedUserSettings}
              isModal={true}
              onClose={() => setIsJouleModalOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Bottom Navigation for Mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex justify-around">
        {navLinks.slice(0, 4).map(route => (
          <NavLink
            key={route.path}
            to={route.path}
            onClick={() => {
              // Switch to traditional mode when navigating from AI mode
              if (mode === 'ai') {
                setMode('traditional');
              }
            }}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center text-center p-2 ${
                isActive
                  ? 'text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 dark:text-gray-400'
              }`
            }
          >
            {route.icon ? React.createElement(route.icon, { className: 'h-5 w-5', 'aria-hidden': true }) : null}
            <span className="text-xs mt-1">{route.name}</span>
          </NavLink>
        ))}
        <button
          onClick={() => setShowMoreMenu(!showMoreMenu)}
          className="flex flex-col items-center justify-center text-center p-2 text-gray-600 dark:text-gray-400"
        >
          {showMoreMenu ? <ChevronDown /> : <ChevronUp />}
          <span className="text-xs mt-1">More</span>
        </button>
      </nav>

      {/* More Menu Modal */}
      {showMoreMenu && (
        <div className="md:hidden fixed bottom-16 left-0 right-0 bg-white dark:bg-gray-800 p-4 z-20 shadow-lg rounded-t-lg">
          <div className="grid grid-cols-4 gap-4">
            {moreLinks.map(route => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => {
                  setShowMoreMenu(false);
                  // Switch to traditional mode when navigating from AI mode
                  if (mode === 'ai') {
                    setMode('traditional');
                  }
                }}
                className="flex flex-col items-center text-gray-700 dark:text-gray-300"
              >
                {route.icon ? React.createElement(route.icon, { className: 'h-5 w-5 mb-1', 'aria-hidden': true }) : null}
                <span className="text-xs mt-1 text-center">{route.name}</span>
              </NavLink>
            ))}
          </div>
        </div>
      )}

      {/* Animated Splash Screen */}
      {showSplash && (
        <AnimatedSplash onComplete={() => setShowSplash(false)} />
      )}

      {/* Floating Ask Joule Launcher - only in Traditional Mode */}
      {shouldShowGlobalAskJoule && mode === 'traditional' && (
        <>
          <button
            data-testid="ask-joule-fab"
            aria-label="Open Ask Joule"
            title="Ask Joule"
            className="fixed bottom-6 right-6 z-50 inline-flex items-center justify-center w-12 h-12 rounded-full shadow-lg bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            onClick={() => setShowAskModal(true)}
          >
            {/* Icon - use lightning or chat */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" fill="currentColor" />
            </svg>
          </button>
          {showAskModal && (
            <div aria-modal="true" role="dialog" className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50" onClick={() => setShowAskModal(false)} />
              <div className="relative z-10 w-full max-w-2xl bg-white dark:bg-gray-900 rounded-xl shadow-xl p-4 sm:p-6">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ask Joule</h2>
                  <button aria-label="Close" className="text-gray-600 dark:text-gray-300 hover:text-gray-900" onClick={() => setShowAskModal(false)}>✕</button>
                </div>
                <AskJoule
                  hasLocation={!!userLocation}
                  userLocation={userLocation}
                  userSettings={mergedUserSettings}
                  onNavigate={(path) => navigate(path)}
                  onSettingChange={(key, value, meta) => setUserSetting(key, value, meta)}
                  auditLog={auditLog}
                  onUndo={(id) => undoChange(id)}
                />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Wrap AppInner with providers
const App = () => (
  <ConversationProvider>
    <ModeProvider>
      <AppInner />
    </ModeProvider>
  </ConversationProvider>
);

export default App;