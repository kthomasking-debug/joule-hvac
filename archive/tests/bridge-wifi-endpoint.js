// Add this route to your existing Node.js Joule Bridge server
// File: routes/wifi.js or add to your main server file

const { exec } = require('child_process');

/**
 * Get WiFi signal strength from the Pi's wlan0 interface
 * Returns signal bars (0-3) for display on E-ink screen
 */
function getWifiSignal(callback) {
  exec('iwconfig wlan0 2>/dev/null', (error, stdout, stderr) => {
    if (error) {
      return callback({ bars: 0, error: 'iwconfig failed' });
    }

    // Parse signal level in dBm
    const dbmMatch = stdout.match(/Signal level=(-?\d+) dBm/);
    if (dbmMatch) {
      const dbm = parseInt(dbmMatch[1]);
      
      // Convert dBm to bars (0-3)
      let bars;
      if (dbm >= -50) bars = 3;      // Excellent
      else if (dbm >= -60) bars = 2; // Good
      else if (dbm >= -70) bars = 1; // Fair
      else bars = 0;                  // Poor
      
      // Calculate quality percentage
      const quality = Math.max(0, Math.min(100, 2 * (dbm + 100)));
      
      return callback({
        bars,
        dbm,
        quality,
        interface: 'wlan0'
      });
    }
    
    // Fallback: try Link Quality
    const qualityMatch = stdout.match(/Link Quality=(\d+)\/(\d+)/);
    if (qualityMatch) {
      const current = parseInt(qualityMatch[1]);
      const maximum = parseInt(qualityMatch[2]);
      const qualityPct = Math.round((current / maximum) * 100);
      
      let bars;
      if (qualityPct >= 75) bars = 3;
      else if (qualityPct >= 50) bars = 2;
      else if (qualityPct >= 25) bars = 1;
      else bars = 0;
      
      return callback({
        bars,
        quality: qualityPct,
        interface: 'wlan0'
      });
    }
    
    callback({ bars: 0, error: 'Could not parse signal' });
  });
}

// Express route
app.get('/api/wifi/signal', (req, res) => {
  getWifiSignal((result) => {
    res.json(result);
  });
});

module.exports = { getWifiSignal };
