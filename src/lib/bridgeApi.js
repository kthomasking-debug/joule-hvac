// Bridge API helper: configure base URL and send/retrieve home profile and weekly cost

export function getBridgeBase() {
  // First, try environment
  const fromEnv = import.meta?.env?.VITE_BRIDGE_BASE;
  if (fromEnv) return fromEnv;
  // Next, localStorage override
  try {
    const stored = localStorage.getItem('bridgeBase');
    if (stored) return stored;
  } catch {}
  // Fallback to same-origin or localhost mock
  return window.location.origin.includes('localhost')
    ? 'http://127.0.0.1:8090'
    : `${window.location.origin}`;
}

export async function saveHomeProfile(profile) {
  const base = getBridgeBase();
  const res = await fetch(`${base}/profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });
  if (!res.ok) throw new Error('Failed to save home profile');
  return res.json();
}

export async function getHomeProfile() {
  const base = getBridgeBase();
  const res = await fetch(`${base}/profile`);
  if (!res.ok) throw new Error('Failed to fetch home profile');
  return res.json();
}

export async function getWeeklyCost(inputs) {
  const base = getBridgeBase();
  const res = await fetch(`${base}/cost-weekly`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inputs || {}),
  });
  if (!res.ok) throw new Error('Failed to compute weekly cost');
  return res.json();
}

// Send forecast summary to Pi bridge for E-ink display
export async function shareSettingsWithPi(piUrl) {
  try {
    const forecastData = localStorage.getItem('last_forecast_summary');
    const userSettings = localStorage.getItem('userSettings');
    
    const payload = {
      last_forecast_summary: forecastData ? JSON.parse(forecastData) : null,
      userSettings: userSettings ? JSON.parse(userSettings) : null,
      timestamp: new Date().toISOString(),
    };
    
    const res = await fetch(`${piUrl}/api/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!res.ok) throw new Error('Failed to share settings with Pi');
    return res.json();
  } catch (error) {
    throw new Error(`Failed to share with Pi: ${error.message}`);
  }
}

// Convenience: set bridge base URL persistently
export function setBridgeBase(url) {
  try {
    localStorage.setItem('bridgeBase', url);
  } catch {}
}
