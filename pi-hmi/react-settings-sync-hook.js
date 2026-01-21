// React: Hook into onboarding completion to sync settings to bridge
// Add this to your onboarding flow or settings page

import { useEffect } from 'react';

export function useSyncSettingsToBridge() {
  useEffect(() => {
    const syncSettings = async () => {
      try {
        // Get all settings from localStorage
        const userLocation = localStorage.getItem('userLocation');
        const homeSettings = localStorage.getItem('homeSettings');
        const systemSettings = localStorage.getItem('systemSettings');
        const rateSettings = localStorage.getItem('rateSettings');
        
        if (!userLocation) {
          console.log('No location set, skipping bridge sync');
          return;
        }
        
        const settings = {
          location: JSON.parse(userLocation),
          homeSettings: homeSettings ? JSON.parse(homeSettings) : null,
          systemSettings: systemSettings ? JSON.parse(systemSettings) : null,
          rateSettings: rateSettings ? JSON.parse(rateSettings) : null,
        };
        
        // Get bridge URL from context or localStorage
        const bridgeUrl = localStorage.getItem('bridgeUrl') || 'http://localhost:3002';
        
        // Send to bridge
        const response = await fetch(`${bridgeUrl}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        });
        
        if (response.ok) {
          console.log('Settings synced to bridge successfully');
        } else {
          console.error('Failed to sync settings to bridge:', await response.text());
        }
      } catch (error) {
        console.error('Error syncing settings to bridge:', error);
      }
    };
    
    // Sync on mount and when settings change
    syncSettings();
    
    // Also sync when localStorage changes
    window.addEventListener('storage', syncSettings);
    return () => window.removeEventListener('storage', syncSettings);
  }, []);
}

// Usage in your App.jsx or onboarding completion:
// import { useSyncSettingsToBridge } from './hooks/useSyncSettingsToBridge';
// 
// function App() {
//   useSyncSettingsToBridge();
//   // ... rest of app
// }
