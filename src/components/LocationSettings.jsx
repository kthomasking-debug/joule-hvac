import React, { useState } from 'react';

export default function LocationSettings() {
  const [lat, setLat] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('userLat') || '';
  });
  const [lon, setLon] = useState(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('userLon') || '';
  });
  const [status, setStatus] = useState('');

  function save() {
    try {
      if (lat) localStorage.setItem('userLat', lat);
      if (lon) localStorage.setItem('userLon', lon);
      setStatus('Location saved');
    } catch {
      setStatus('Save failed');
    }
  }

  function detect() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setStatus('Geolocation unavailable');
      return;
    }
    setStatus('Detecting…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLat(String(latitude));
        setLon(String(longitude));
        try {
          localStorage.setItem('userLat', String(latitude));
          localStorage.setItem('userLon', String(longitude));
        } catch { /* ignore */ }
        setStatus('Detected');
      },
      () => {
        setStatus('Detection failed');
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900 space-y-3" data-testid="location-settings">
      <h3 className="text-sm font-semibold">Location</h3>
      <div className="flex flex-col gap-2 text-xs">
        <label className="flex flex-col">
          <span className="mb-1">Latitude</span>
          <input value={lat} onChange={e => setLat(e.target.value)} className="border rounded px-2 py-1 bg-gray-50 dark:bg-gray-800" placeholder="e.g. 39.7392" />
        </label>
        <label className="flex flex-col">
          <span className="mb-1">Longitude</span>
          <input value={lon} onChange={e => setLon(e.target.value)} className="border rounded px-2 py-1 bg-gray-50 dark:bg-gray-800" placeholder="e.g. -104.9903" />
        </label>
      </div>
      <div className="flex gap-2 flex-wrap">
        <button onClick={save} className="btn btn-outline text-xs px-2 py-1">Save</button>
        <button onClick={detect} className="btn btn-outline text-xs px-2 py-1">Detect</button>
      </div>
      {status && <div className="text-[11px] text-gray-600 dark:text-gray-300" data-testid="location-status">{status}</div>}
    </div>
  );
}
