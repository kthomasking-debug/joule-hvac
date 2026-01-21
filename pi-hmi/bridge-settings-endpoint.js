// Add this endpoint to your Node.js bridge server (port 3002)
// This allows the e-ink display to fetch the same settings as the React app

const fs = require('fs');
const path = require('path');

// Path to store settings (shared between React app and e-ink)
const SETTINGS_FILE = path.join(__dirname, 'joule-settings.json');

/**
 * GET /api/settings
 * Returns user's onboarding settings from localStorage equivalent
 */
app.get('/api/settings', (req, res) => {
  try {
    // Try to read existing settings file
    if (fs.existsSync(SETTINGS_FILE)) {
      const settings = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      res.json(settings);
    } else {
      // Return defaults if no settings file exists
      res.json({
        location: null,
        homeSettings: null,
        systemSettings: null,
        rateSettings: null
      });
    }
  } catch (error) {
    console.error('Error reading settings:', error);
    res.status(500).json({ error: 'Failed to read settings' });
  }
});

/**
 * POST /api/settings
 * Saves user's onboarding settings (called by React app)
 */
app.post('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    
    // Validate required fields
    if (!settings.location || !settings.location.latitude || !settings.location.longitude) {
      return res.status(400).json({ error: 'Location is required' });
    }
    
    // Save settings to file
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    
    res.json({ success: true, message: 'Settings saved' });
  } catch (error) {
    console.error('Error saving settings:', error);
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// Expected settings format:
/*
{
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "city": "New York",
    "state": "NY",
    "zipcode": "10001"
  },
  "homeSettings": {
    "squareFeet": 1500,
    "insulationLevel": 1.0,
    "ceilingHeight": 8,
    "homeShape": 1.0
  },
  "systemSettings": {
    "primarySystem": "heatPump",
    "capacity": 36,
    "seer2": 16.0,
    "hspf": 10.0
  },
  "rateSettings": {
    "electricityRate": 0.15,
    "gasRate": 1.20
  }
}
*/
