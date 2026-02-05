#!/usr/bin/env python3
import os
import time
import threading
from dataclasses import dataclass
from datetime import datetime
from typing import Optional, Tuple
import json

import requests
from PIL import Image, ImageDraw, ImageFont

# Try to import Waveshare Touch e-Paper HAT library
# Expecting you cloned https://github.com/waveshare/Touch_e-Paper_HAT
try:
    import sys
    for _path in (
        '/home/pi/Touch_e-Paper_HAT/python/lib',
        os.path.expanduser('~/Touch_e-Paper_HAT/python/lib'),
        os.path.expanduser('~/git/Touch_e-Paper_HAT/python/lib'),
    ):
        if _path and os.path.isdir(_path):
            sys.path.insert(0, _path)
            break
    from TP_lib import epd2in13_V4 as epdmod
    from TP_lib import gt1151
    print("[INFO] Waveshare Touch e-Paper HAT library loaded")
except Exception as e:
    epdmod = None
    gt1151 = None
    print("[WARN] Waveshare Touch e-Paper HAT library not available:", e)

# Fallback to standard e-Paper library if Touch library not available
if epdmod is None:
    try:
        for _path in (
            os.path.expanduser('~/e-Paper/RaspberryPi_JetsonNano/python/lib'),
            '/home/pi/e-Paper/RaspberryPi_JetsonNano/python/lib',
        ):
            if _path and os.path.isdir(_path):
                import sys
                sys.path.insert(0, _path)
                break
        from waveshare_epd import epd2in13_V4 as epdmod
        print("[INFO] Fallback to standard e-Paper library")
    except Exception as e:
        epdmod = None
        print("[WARN] No EPD driver available:", e)

# --- Config ---
API_BASE = os.environ.get('HMI_API_BASE', 'http://127.0.0.1:8080')
POLL_SECS = int(os.environ.get('HMI_POLL_SECS', '15'))
# E-paper refresh: only update display at this interval (seconds) to avoid blinking
DISPLAY_REFRESH_SECS = int(os.environ.get('HMI_DISPLAY_REFRESH_SECS', '900'))  # 15 min default
USE_PARTIAL = os.environ.get('HMI_PARTIAL', '1') == '1'
TOUCH_CFG_PATH = os.environ.get('HMI_TOUCH_CFG', os.path.join(os.path.dirname(__file__), 'touch_config.json'))

# E-Ink resolution (2.13" typical variants)
SCREEN_W, SCREEN_H = 250, 122  # adjust to your panel (e.g., 212x104 or 250x122)

# Fonts - try to load TrueType fonts for better appearance
def _load_font(size, bold=False):
    """Load a TrueType font, falling back to default if not found"""
    font_paths = [
        # DejaVu fonts (common on Raspberry Pi)
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        # Liberation fonts (alternative)
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        # FreeFonts
        '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf' if bold else '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    ]
    for path in font_paths:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    # Fallback to default
    return ImageFont.load_default()

# Font sizes optimized for 250x122 e-ink display
FONT_SMALL = _load_font(10)        # For labels and small text
FONT_MED = _load_font(14, bold=True)  # For section headers
FONT_BIG = _load_font(32, bold=True)  # For the big dollar amount
FONT_HEADER = _load_font(9)        # For the top status bar

@dataclass
class Status:
    mode: str = 'off'      # 'heat'|'cool'|'off'
    temp: float = 0.0      # current temp °F
    target_temp: float = 0.0  # daytime target °F
    night_temp: float = 0.0   # nighttime target °F
    humidity: int = 0
    last_ok: bool = False
    # Bridge/Ecobee connection status: 'connected', 'no_ecobee', 'offline', 'error'
    bridge_status: str = 'offline'
    bridge_ip: str = ''  # Bridge's LAN IP (e.g., 192.168.0.103)
    device_id: str = ''  # Paired Ecobee device ID (e.g., a7:9f:60:3c:8a:b9)
    # Pairing status from wizard: 'idle', 'wizard_started', 'discovered', 'pairing', 'success', 'error', 'healthy', 'unhealthy'
    pairing_mode: str = 'idle'
    pairing_code: str = ''  # Partial code for display (e.g., "123-XX-XXX")
    pairing_error: str = ''
    # Outdoor weather (fetched from OpenMeteo)
    outdoor_temp: float = 0.0
    outdoor_humidity: int = 0
    weather_ok: bool = False
    # Cost estimate - prefer monthly_cost if available, otherwise weekly_cost * 4.33
    weekly_cost: float = 0.0
    monthly_cost: float = 0.0  # Direct monthly cost from Monthly Forecast
    # Cost breakdown
    variable_cost: float = 0.0
    fixed_cost: float = 0.0
    # Energy breakdown (kWh)
    total_energy_kwh: float = 0.0
    hp_energy_kwh: float = 0.0
    aux_energy_kwh: float = 0.0
    electricity_rate: float = 0.10
    # Daily forecast data (list of dicts with 'dayLabel', 'cost', 'costWithAux', 'lowTemp', 'highTemp')
    daily_forecast: list = None
    # Timestamp when forecast was last updated (milliseconds)
    forecast_timestamp: int = 0
    
    def __post_init__(self):
        if self.daily_forecast is None:
            self.daily_forecast = []
    
    def get_forecast_age_str(self) -> str:
        """Return human-readable age of forecast data (e.g., '2h ago', '1d ago')"""
        if not self.forecast_timestamp:
            return ""
        age_ms = int(time.time() * 1000) - self.forecast_timestamp
        age_mins = age_ms // 60000
        if age_mins < 1:
            return "now"
        elif age_mins < 60:
            return f"{age_mins}m ago"
        elif age_mins < 1440:  # 24 hours
            return f"{age_mins // 60}h ago"
        else:
            return f"{age_mins // 1440}d ago"
    
    def has_aux_heat_expected(self) -> bool:
        """Check if any day in forecast expects auxiliary heat"""
        if not self.daily_forecast:
            return False
        return any(float(d.get('auxEnergy', 0) or 0) > 0 for d in self.daily_forecast)

# Default location (Blairsville, GA) - can be overridden via HMI_LAT/HMI_LON env vars
DEFAULT_LAT = float(os.environ.get('HMI_LAT', '34.876'))
DEFAULT_LON = float(os.environ.get('HMI_LON', '-83.958'))

class EInkHMI:
    def __init__(self):
        self.status = Status()
        self.current_page = 'status'  # 'status'|'actions'|'guide'
        self.touch_x = None
        self.touch_y = None
        self._device_id = None  # primary thermostat device_id for set-mode/setpoint
        self.stop = False
        self.partial_available = False
        self.partial_enabled = False
        self._partial_base_set = False  # Track if displayPartBaseImage has been called
        self.epd = self._init_epd()
        self.gt = self._init_touch()
        self.gt_dev = None
        self.gt_old = None
        if self.gt and gt1151:
            self.gt_dev = gt1151.GT_Development()
            self.gt_old = gt1151.GT_Development()
        self.canvas = Image.new('1', (SCREEN_W, SCREEN_H), 255)
        self.draw = ImageDraw.Draw(self.canvas)
        self._last_display_time = 0.0
        self._touch_pending_display = False

    def _init_epd(self):
        if epdmod is None:
            print('[ERROR] No EPD driver, drawing to memory only.')
            return None
        epd = epdmod.EPD()
        # Initial full update - V4 needs FULL_UPDATE mode constant
        try:
            if hasattr(epd, 'FULL_UPDATE'):
                epd.init(epd.FULL_UPDATE)
            else:
                epd.init()
        except Exception as e:
            print(f'[WARN] EPD init: {e}')
        epd.Clear(0xFF)  # 0xFF = white
        # Detect partial update capability
        try:
            self.partial_available = any(hasattr(epd, name) for name in (
                'displayPartial', 'DisplayPartial', 'partial_update', 'display_part'))
        except Exception:
            self.partial_available = False
        # Attempt to enable partial mode if requested
        if USE_PARTIAL and self.partial_available:
            self._enable_partial_mode(epd)
        return epd

    def _enable_partial_mode(self, epd):
        try:
            # Some drivers require a re-init for partial; feature-detect common patterns
            if hasattr(epd, 'init'):  # may accept a mode constant
                # Try known constants on module if present
                mode = None
                for name in ('PARTIAL_UPDATE', 'EPD_PARTIAL_UPDATE', 'EPD_2IN13_V3_PARTIAL'):  # best-effort
                    mode = getattr(epdmod, name, None)
                    if mode is not None:
                        break
                if mode is not None:
                    try:
                        epd.init(mode)
                        self.partial_enabled = True
                        print('[INFO] Partial update mode enabled via constant')
                        return
                    except Exception:
                        pass
            # Fallback: consider partial enabled if method exists
            self.partial_enabled = True
            print('[INFO] Partial update methods detected; will use partial display calls')
        except Exception as e:
            print('[WARN] Failed to enable partial mode:', e)
            self.partial_enabled = False

    def _init_touch(self):
        """Initialize GT1151 touch controller"""
        if gt1151 is None:
            print('[WARN] GT1151 touch library not available')
            return None
        try:
            gt = gt1151.GT1151()
            gt.GT_Init()
            print('[INFO] GT1151 touch controller initialized')
            return gt
        except Exception as e:
            print(f'[WARN] Touch init failed: {e}')
            return None

    def run(self):
        # Fetch weather immediately at startup
        self._fetch_outdoor_weather()
        threading.Thread(target=self._poll_status_loop, daemon=True).start()
        # Start touch polling thread if GT1151 is available
        if self.gt:
            threading.Thread(target=self._touch_loop, daemon=True).start()
        # Initial display
        self.render()
        self._display()
        self._last_display_time = time.time()
        try:
            while not self.stop:
                now = time.time()
                # Update display only: after touch, or every DISPLAY_REFRESH_SECS
                if self._touch_pending_display or (now - self._last_display_time >= DISPLAY_REFRESH_SECS):
                    self.render()
                    self._display()
                    self._last_display_time = now
                    self._touch_pending_display = False
                time.sleep(1.0)  # Check once per second
        except KeyboardInterrupt:
            self.shutdown()

    def shutdown(self):
        self.stop = True
        try:
            if self.epd:
                self.epd.Sleep()
        except Exception:
            pass

    # --- Network ---
    def _poll_status_loop(self):
        weather_counter = 0
        settings_counter = 0
        last_monthly_cost = 0.0
        last_target_temp = 0.0
        last_night_temp = 0.0
        while not self.stop:
            # Fetch thermostat status from bridge
            try:
                r = requests.get(f'{API_BASE.rstrip("/")}/api/status', timeout=5)
                if r.ok:
                    data = r.json()
                    devices = data.get('devices', [])
                    if devices:
                        d = devices[0]
                        self._device_id = d.get('device_id')
                        self.status.device_id = d.get('device_id', '')
                        self.status.mode = d.get('mode', 'off')
                        temp_c = d.get('temperature')
                        if temp_c is not None:
                            self.status.temp = (float(temp_c) * 9 / 5) + 32
                        else:
                            self.status.temp = 0.0
                        tgt_c = d.get('target_temperature')
                        if tgt_c is not None:
                            self.status.target_temp = (float(tgt_c) * 9 / 5) + 32
                        else:
                            self.status.target_temp = 0.0
                        self.status.humidity = int(d.get('humidity', 0))
                        self.status.last_ok = True
                        self.status.bridge_status = 'connected'
                    else:
                        self.status.last_ok = False
                        self.status.bridge_status = 'no_ecobee'
                else:
                    self.status.last_ok = False
                    self.status.bridge_status = 'error'
            except requests.exceptions.ConnectionError:
                self.status.last_ok = False
                self.status.bridge_status = 'offline'
            except Exception:
                self.status.last_ok = False
                self.status.bridge_status = 'error'
            
            # Fetch pairing status (for wizard display)
            try:
                pr = requests.get(f'{API_BASE.rstrip("/")}/api/pairing/status', timeout=3)
                if pr.ok:
                    ps = pr.json()
                    new_mode = ps.get('mode', 'idle')
                    new_code = ps.get('code', '')
                    new_error = ps.get('error', '')
                    # Trigger display update if pairing status changed
                    if (new_mode != self.status.pairing_mode or 
                        new_code != self.status.pairing_code):
                        self.status.pairing_mode = new_mode
                        self.status.pairing_code = new_code or ''
                        self.status.pairing_error = new_error or ''
                        if new_mode not in ('idle', 'healthy'):
                            self._touch_pending_display = True  # Show pairing status
            except Exception:
                pass  # Pairing status is optional
            
            # Fetch settings/cost from bridge every ~60 seconds (4 polls at 15s each)
            settings_counter += 1
            if settings_counter >= 4:
                settings_counter = 0
                self._fetch_bridge_settings()
                
                # Check if data changed - trigger display update if so
                if (self.status.monthly_cost != last_monthly_cost or 
                    self.status.target_temp != last_target_temp or
                    self.status.night_temp != last_night_temp):
                    print(f'[INFO] Data changed: ${self.status.monthly_cost:.2f}/mo Day {self.status.target_temp:.0f}°F Night {self.status.night_temp:.0f}°F')
                    last_monthly_cost = self.status.monthly_cost
                    last_target_temp = self.status.target_temp
                    last_night_temp = self.status.night_temp
                    self._touch_pending_display = True  # Trigger display refresh
            
            # Fetch outdoor weather every 5 minutes (20 polls at 15s each)
            weather_counter += 1
            if weather_counter >= 20 or not self.status.weather_ok:
                weather_counter = 0
                self._fetch_outdoor_weather()
            
            time.sleep(POLL_SECS)
    
    def _fetch_bridge_settings(self):
        """Fetch cost and settings from bridge (called every 60 seconds)"""
        try:
            r = requests.get(f'{API_BASE.rstrip("/")}/api/settings', timeout=3)
            if r.ok:
                settings = r.json()
                
                # Get forecast/cost data if available
                forecast = settings.get('last_forecast_summary')
                if forecast and isinstance(forecast, dict):
                    # Check for direct monthly cost first (from Monthly Forecast)
                    monthly = forecast.get('totalMonthlyCost')
                    if monthly and isinstance(monthly, (int, float)):
                        self.status.monthly_cost = float(monthly)
                    
                    # Cost breakdown
                    variable = forecast.get('variableCost')
                    if variable and isinstance(variable, (int, float)):
                        self.status.variable_cost = float(variable)
                    fixed = forecast.get('fixedCost')
                    if fixed and isinstance(fixed, (int, float)):
                        self.status.fixed_cost = float(fixed)
                    
                    # Energy breakdown (kWh)
                    total_kwh = forecast.get('totalEnergyKwh')
                    if total_kwh and isinstance(total_kwh, (int, float)):
                        self.status.total_energy_kwh = float(total_kwh)
                    hp_kwh = forecast.get('hpEnergyKwh')
                    if hp_kwh and isinstance(hp_kwh, (int, float)):
                        self.status.hp_energy_kwh = float(hp_kwh)
                    aux_kwh = forecast.get('auxEnergyKwh')
                    if aux_kwh and isinstance(aux_kwh, (int, float)):
                        self.status.aux_energy_kwh = float(aux_kwh)
                    rate = forecast.get('electricityRate')
                    if rate and isinstance(rate, (int, float)):
                        self.status.electricity_rate = float(rate)
                    
                    # Also get weekly cost (from Weekly Forecast or derived)
                    cost = (forecast.get('totalHPCostWithAux') or 
                           forecast.get('totalHPCost') or 
                           forecast.get('totalWeeklyCost') or 
                           forecast.get('weekly_cost') or 
                           forecast.get('weeklyCost'))
                    if cost and isinstance(cost, (int, float)):
                        self.status.weekly_cost = float(cost)
                    
                    # Get target temperature (daytime) from forecast
                    target = forecast.get('targetTemp')
                    if target and isinstance(target, (int, float)):
                        self.status.target_temp = float(target)
                    
                    # Get nighttime temperature from forecast
                    night = forecast.get('nightTemp')
                    if night and isinstance(night, (int, float)):
                        self.status.night_temp = float(night)
                    
                    # Get mode from forecast
                    mode = forecast.get('mode')
                    if mode and isinstance(mode, str):
                        self.status.mode = mode
                    
                    # Get daily forecast summary for 3-day view
                    daily = forecast.get('dailySummary')
                    if daily and isinstance(daily, list):
                        self.status.daily_forecast = daily[:3]  # Keep only first 3 days
                        # Get timestamp for "last updated" display
                        ts = forecast.get('timestamp')
                        if ts and isinstance(ts, (int, float)):
                            self.status.forecast_timestamp = int(ts)
                        print(f'[INFO] Got {len(self.status.daily_forecast)} day(s) of forecast data')
                
                # Fetch bridge IP from /api/bridge/info
                try:
                    br = requests.get(f'{API_BASE.rstrip("/")}/api/bridge/info', timeout=2)
                    if br.ok:
                        info = br.json()
                        ip = info.get('local_ip')
                        if ip and isinstance(ip, str):
                            self.status.bridge_ip = ip
                except Exception:
                    pass
        except Exception as e:
            print(f'[WARN] Bridge settings fetch: {e}')

    def _fetch_3day_weather_forecast(self, lat, lon):
        """Fetch 3-day weather forecast from OpenMeteo"""
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_min,temperature_2m_max&temperature_unit=fahrenheit&timezone=auto&forecast_days=3"
            r = requests.get(url, timeout=5)
            if r.ok:
                data = r.json()
                daily = data.get('daily', {})
                times = daily.get('time', [])
                mins = daily.get('temperature_2m_min', [])
                maxs = daily.get('temperature_2m_max', [])
                
                forecast = []
                for i in range(min(3, len(times))):
                    # Parse date to get day name
                    dt = datetime.strptime(times[i], '%Y-%m-%d')
                    day_name = dt.strftime('%a')
                    
                    forecast.append({
                        'day': day_name,  # Match field name from SevenDayCostForecaster
                        'lowTemp': mins[i] if i < len(mins) else 0,
                        'highTemp': maxs[i] if i < len(maxs) else 0,
                    })
                
                return forecast
        except Exception as e:
            print(f'[WARN] 3-day forecast fetch failed: {e}')
        return []

    def _fetch_outdoor_weather(self):
        """Fetch outdoor weather from OpenMeteo and initial settings from bridge"""
        lat, lon = DEFAULT_LAT, DEFAULT_LON
        
        # Try to get location from bridge settings
        try:
            r = requests.get(f'{API_BASE.rstrip("/")}/api/settings', timeout=3)
            if r.ok:
                settings = r.json()
                # Get location
                loc = settings.get('location') or settings.get('userSettings', {}).get('location')
                if loc and isinstance(loc, dict):
                    lat = loc.get('lat', loc.get('latitude', lat))
                    lon = loc.get('lon', loc.get('longitude', lon))
                
                # Also fetch settings while we're here
                forecast = settings.get('last_forecast_summary')
                if forecast and isinstance(forecast, dict):
                    monthly = forecast.get('totalMonthlyCost')
                    if monthly and isinstance(monthly, (int, float)):
                        self.status.monthly_cost = float(monthly)
                        print(f'[INFO] Monthly cost from bridge: ${self.status.monthly_cost:.2f}')
                    
                    cost = (forecast.get('totalHPCostWithAux') or 
                           forecast.get('totalHPCost') or 
                           forecast.get('totalWeeklyCost') or 
                           forecast.get('weekly_cost') or 
                           forecast.get('weeklyCost'))
                    if cost and isinstance(cost, (int, float)):
                        self.status.weekly_cost = float(cost)
                        print(f'[INFO] Weekly cost from bridge: ${self.status.weekly_cost:.2f}')
                    
                    target = forecast.get('targetTemp')
                    if target and isinstance(target, (int, float)):
                        self.status.target_temp = float(target)
                        print(f'[INFO] Day temp from bridge: {self.status.target_temp:.0f}°F')
                    
                    night = forecast.get('nightTemp')
                    if night and isinstance(night, (int, float)):
                        self.status.night_temp = float(night)
                        print(f'[INFO] Night temp from bridge: {self.status.night_temp:.0f}°F')
                    
                    mode = forecast.get('mode')
                    if mode and isinstance(mode, str):
                        self.status.mode = mode
                        print(f'[INFO] Mode from bridge: {self.status.mode}')
                    
                    # Get daily forecast for 3-day view
                    daily = forecast.get('dailySummary')
                    if daily and isinstance(daily, list):
                        self.status.daily_forecast = daily[:3]
                        ts = forecast.get('timestamp')
                        if ts and isinstance(ts, (int, float)):
                            self.status.forecast_timestamp = int(ts)
                        print(f'[INFO] Got {len(self.status.daily_forecast)} day(s) of forecast')
                
                # Fetch bridge IP
                try:
                    br = requests.get(f'{API_BASE.rstrip("/")}/api/bridge/info', timeout=2)
                    if br.ok:
                        info = br.json()
                        ip = info.get('local_ip')
                        if ip and isinstance(ip, str):
                            self.status.bridge_ip = ip
                except Exception:
                    pass
        except Exception as e:
            print(f'[WARN] Bridge settings fetch: {e}')
        
        # Fetch weather from OpenMeteo
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit"
            r = requests.get(url, timeout=5)
            if r.ok:
                data = r.json()
                current = data.get('current', {})
                self.status.outdoor_temp = float(current.get('temperature_2m', 0))
                self.status.outdoor_humidity = int(current.get('relative_humidity_2m', 0))
                self.status.weather_ok = True
                print(f'[INFO] Weather: {self.status.outdoor_temp:.0f}°F, {self.status.outdoor_humidity}%')
                
                # Calculate fallback cost if not from bridge
                if not self.status.weekly_cost and self.status.target_temp > 0:
                    self._calculate_fallback_cost()
        except Exception as e:
            print(f'[WARN] Weather fetch failed: {e}')
        
        # Fetch 3-day weather forecast if we don't have daily forecast data
        if not self.status.daily_forecast or len(self.status.daily_forecast) == 0:
            weather_forecast = self._fetch_3day_weather_forecast(lat, lon)
            if weather_forecast:
                # If we have weekly cost, estimate daily costs from weather
                if self.status.weekly_cost > 0:
                    daily_avg = self.status.weekly_cost / 7.0
                    target = self.status.target_temp or 70
                    rate = self.status.electricity_rate or 0.10
                    
                    for day in weather_forecast:
                        avg_temp = (day['lowTemp'] + day['highTemp']) / 2
                        temp_diff = abs(target - avg_temp)
                        # Simple cost scaling based on temperature difference
                        if avg_temp < target:  # Heating
                            cost_factor = max(0.5, min(2.0, temp_diff / 15))
                        else:  # Cooling or mild
                            cost_factor = max(0.3, min(1.5, temp_diff / 20))
                        day['cost'] = daily_avg * cost_factor
                        day['costWithAux'] = day['cost']
                    
                    self.status.daily_forecast = weather_forecast
                    print(f'[INFO] Built 3-day forecast from weather data')
    
    def _calculate_fallback_cost(self):
        """Calculate cost estimate based on weather and target temp"""
        target = self.status.target_temp or 70
        outdoor = self.status.outdoor_temp
        if not outdoor:
            return
        
        temp_diff = abs(target - outdoor)
        if outdoor < target - 2:  # Heating
            weekly_dd = temp_diff * 7
            self.status.weekly_cost = weekly_dd * 0.50
        elif outdoor > target + 2:  # Cooling
            weekly_dd = temp_diff * 7
            self.status.weekly_cost = weekly_dd * 0.60
        else:
            self.status.weekly_cost = 2.0
        print(f'[INFO] Fallback cost: ${self.status.weekly_cost:.2f}/wk')

    # --- Touch ---
    def _touch_loop(self):
        """Poll GT1151 touch controller using Waveshare library"""
        if not self.gt or not self.gt_dev:
            print('[WARN] Touch controller not available')
            return
        print('[INFO] Touch polling started')
        last_x = last_y = -1
        while not self.stop:
            try:
                # Monitor INT pin - when it goes low, a touch event is ready
                if self.gt.digital_read(self.gt.INT) == 0:
                    self.gt_dev.Touch = 1
                else:
                    self.gt_dev.Touch = 0
                
                # Poll the touch controller (only reads when Touch == 1)
                self.gt.GT_Scan(self.gt_dev, self.gt_old)
                
                # Check if we got a valid touch
                if self.gt_dev.TouchpointFlag:
                    self.gt_dev.TouchpointFlag = 0
                    x, y = self.gt_dev.X[0], self.gt_dev.Y[0]
                    # Avoid repeat touches at same location
                    if x != last_x or y != last_y:
                        last_x, last_y = x, y
                        # Coordinates need to be mapped to screen (122x250 -> 250x122 with rotation)
                        # The GT1151 reports in display native orientation, we rotated 180°
                        # X mapping: raw Y -> screen X (horizontal position - left/right)
                        screen_x = y * SCREEN_W // 250
                        # Y mapping: raw X -> screen Y, INVERTED for 180° rotation
                        # Physical bottom (small raw x) -> high screen_y (nav buttons area)
                        screen_y = SCREEN_H - 1 - (x * SCREEN_H // 122)
                        print(f'[TOUCH] raw=({x},{y}) screen=({screen_x},{screen_y})')
                        self._handle_touch(screen_x, screen_y)
                time.sleep(0.02)  # Poll at 50Hz for responsive touch
            except Exception as e:
                print(f'[WARN] Touch poll error: {e}')
                time.sleep(1)

    def _handle_touch(self, x, y):
        self._touch_pending_display = True
        # Bottom nav buttons (nav bar is 20px tall)
        if y > SCREEN_H - 20:  # y > 102
            if x < SCREEN_W // 3:
                self.current_page = 'status'
                print(f'[NAV] -> Status')
            elif x < 2 * SCREEN_W // 3:
                self.current_page = 'actions'  # Energy page
                print(f'[NAV] -> Energy')
            else:
                self.current_page = 'guide'
                print(f'[NAV] -> 3-Day Forecast')

    def _send_mode(self, mode: str):
        if not self._device_id:
            return
        try:
            requests.post(
                f'{API_BASE.rstrip("/")}/api/set-mode',
                json={'device_id': self._device_id, 'mode': mode},
                timeout=5,
            )
        except Exception:
            pass

    def _send_setpoint(self, delta: int):
        """Adjust target temp by delta and sync to bridge settings"""
        # Calculate new target temp
        current = self.status.target_temp if self.status.target_temp else 70
        new_temp = max(60, min(80, current + delta))  # Clamp to 60-80°F range
        
        print(f'[ACTION] Adjusting temp: {current:.0f}°F -> {new_temp:.0f}°F')
        
        # Update local status immediately for responsive UI
        self.status.target_temp = new_temp
        
        # Save to bridge settings so web app can pick it up
        try:
            # Update the last_forecast_summary with new target temp
            # First get current forecast data
            r = requests.get(f'{API_BASE.rstrip("/")}/api/settings', timeout=3)
            if r.ok:
                settings = r.json()
                forecast = settings.get('last_forecast_summary', {})
                if forecast:
                    forecast['targetTemp'] = new_temp
                    forecast['timestamp'] = int(time.time() * 1000)
                    forecast['updatedFromHMI'] = True
                    
                    # Save back to bridge
                    requests.post(
                        f'{API_BASE.rstrip("/")}/api/settings/last_forecast_summary',
                        json={'value': forecast},
                        timeout=5,
                    )
                    print(f'[INFO] Synced target temp to bridge: {new_temp:.0f}°F')
            
            # Also save directly as a user setting for the web app to read
            requests.post(
                f'{API_BASE.rstrip("/")}/api/settings/hmiTargetTemp',
                json={'value': new_temp},
                timeout=5,
            )
        except Exception as e:
            print(f'[WARN] Failed to sync target temp: {e}')
        
        # Trigger display update
        self._touch_pending_display = True

    # --- Render ---
    def render(self):
        self.draw.rectangle((0,0,SCREEN_W,SCREEN_H), fill=255)
        
        # Check for active pairing mode - show special pairing screen
        if self.status.pairing_mode not in ('idle', 'healthy', 'unhealthy', ''):
            self._render_pairing_status()
            return
        
        # Header bar (14px tall) - show mode/temp info
        header_h = 14
        self.draw.rectangle((0, 0, SCREEN_W, header_h), fill=0)
        
        # Build header with day/night temps
        mode_str = self.status.mode.upper() if self.status.mode else "OFF"
        day_temp = self.status.target_temp if self.status.target_temp else 70
        night_temp = self.status.night_temp if self.status.night_temp else day_temp
        
        if self.status.last_ok and self.status.temp > 0:
            # With thermostat: MODE TEMP° | Day XX° Night XX°
            hdr = f"{mode_str} {self.status.temp:.0f}° | Day {day_temp:.0f}° Night {night_temp:.0f}°"
        else:
            # No thermostat: MODE | Day XX° Night XX°
            hdr = f"{mode_str} | Day {day_temp:.0f}° Night {night_temp:.0f}°"
        
        # Bridge/Ecobee connection status indicator
        status_map = {
            'connected': 'OK',
            'no_ecobee': 'NO ECO',
            'offline': 'BRIDGE?',
            'error': 'ERR'
        }
        conn = status_map.get(self.status.bridge_status, '...')
        conn_width = len(conn) * 6  # Approximate width for small font
        
        self.draw.text((3, 2), hdr, font=FONT_HEADER, fill=255)
        self.draw.text((SCREEN_W - conn_width - 3, 2), conn, font=FONT_HEADER, fill=255)
        
        # Page content (between header and nav)
        if self.current_page == 'status':
            self._render_status()
        elif self.current_page == 'actions':
            self._render_actions()
        else:
            self._render_guide()
        # Bottom nav
        self._render_nav()
    
    def _render_pairing_status(self):
        """Render special pairing mode screen"""
        # Full-screen pairing display
        header_h = 14
        self.draw.rectangle((0, 0, SCREEN_W, header_h), fill=0)
        self.draw.text((3, 2), "PAIRING MODE", font=FONT_HEADER, fill=255)
        
        content_y = 20
        mode = self.status.pairing_mode
        
        if mode == 'wizard_started':
            self.draw.text((10, content_y), "Pairing wizard", font=FONT_MED, fill=0)
            self.draw.text((10, content_y + 20), "started...", font=FONT_MED, fill=0)
            self.draw.text((10, content_y + 50), "Follow steps on app", font=FONT_SMALL, fill=0)
        elif mode == 'discovered':
            self.draw.text((10, content_y), "Devices found!", font=FONT_MED, fill=0)
            self.draw.text((10, content_y + 20), "Select device in app", font=FONT_SMALL, fill=0)
        elif mode == 'pairing':
            self.draw.text((10, content_y), "Pairing...", font=FONT_MED, fill=0)
            if self.status.pairing_code:
                self.draw.text((10, content_y + 25), f"Code: {self.status.pairing_code}", font=FONT_MED, fill=0)
            self.draw.text((10, content_y + 55), "Please wait", font=FONT_SMALL, fill=0)
        elif mode == 'success':
            self.draw.text((10, content_y), "SUCCESS!", font=FONT_BIG, fill=0)
            self.draw.text((10, content_y + 45), "Ecobee connected", font=FONT_MED, fill=0)
        elif mode == 'error':
            self.draw.text((10, content_y), "PAIRING FAILED", font=FONT_MED, fill=0)
            if self.status.pairing_error:
                # Truncate error for display
                err = self.status.pairing_error[:30]
                self.draw.text((10, content_y + 25), err, font=FONT_SMALL, fill=0)
            self.draw.text((10, content_y + 55), "Check app for details", font=FONT_SMALL, fill=0)
        else:
            self.draw.text((10, content_y), f"Mode: {mode}", font=FONT_SMALL, fill=0)

    def _render_status(self):
        # Main content area: y=14 to y=98 (84px height)
        content_y = 16
        
        # Use monthly_cost directly if available, otherwise calculate from weekly
        monthly = self.status.monthly_cost if self.status.monthly_cost else (self.status.weekly_cost * 4.33 if self.status.weekly_cost else 0)
        
        if monthly > 0:
            # Large dollar amount - centered
            cost_str = f"${monthly:.0f}"
            # Get text width for centering (approximate)
            cost_width = len(cost_str) * 18  # ~18px per char for big font
            cost_x = (SCREEN_W - cost_width) // 2
            self.draw.text((cost_x, content_y + 5), cost_str, font=FONT_BIG, fill=0)
            
            # "per month" label - centered below
            self.draw.text((SCREEN_W // 2 - 28, content_y + 38), "per month", font=FONT_MED, fill=0)
            
            # Weekly cost on left, below "per month"
            weekly = self.status.weekly_cost if self.status.weekly_cost else (monthly / 4.33)
            self.draw.text((4, content_y + 54), f"${weekly:.2f}/wk", font=FONT_SMALL, fill=0)
            
            # Temps on right side: "In: 67° → 70°  Out: 33°"
            temp_str = ""
            if self.status.last_ok and self.status.temp > 0:
                temp_str = f"In:{self.status.temp:.0f}°"
                if self.status.target_temp > 0:
                    temp_str += f"→{self.status.target_temp:.0f}°"
            if self.status.weather_ok:
                if temp_str:
                    temp_str += "  "
                temp_str += f"Out:{self.status.outdoor_temp:.0f}°"
            if temp_str:
                # Right-align temperature info
                self.draw.text((130, content_y + 54), temp_str, font=FONT_SMALL, fill=0)
            
            # Bridge IP and device ID at very bottom
            if self.status.bridge_ip:
                ip_str = f"IP: {self.status.bridge_ip}"
                self.draw.text((4, content_y + 68), ip_str, font=FONT_SMALL, fill=0)
                # Show device ID (last 8 chars) on right, or humidity if no device
                if self.status.device_id:
                    # Show short device ID (last 8 chars: e.g., "3c:8a:b9")
                    short_id = self.status.device_id[-8:] if len(self.status.device_id) > 8 else self.status.device_id
                    self.draw.text((155, content_y + 68), f"ID:{short_id}", font=FONT_SMALL, fill=0)
                elif self.status.weather_ok and self.status.outdoor_humidity:
                    self.draw.text((200, content_y + 68), f"{self.status.outdoor_humidity}%", font=FONT_SMALL, fill=0)
        else:
            # No cost data - show status info
            self.draw.text((10, content_y + 10), 'Joule Status', font=FONT_MED, fill=0)
            self.draw.text((10, content_y + 30), 'Waiting for forecast data...', font=FONT_SMALL, fill=0)
            self.draw.text((10, content_y + 44), 'Run Weekly Forecaster in app', font=FONT_SMALL, fill=0)
            
            if self.status.weather_ok:
                self.draw.text((10, content_y + 60), f"Outside: {self.status.outdoor_temp:.0f}°F {self.status.outdoor_humidity}%", font=FONT_SMALL, fill=0)
            if self.status.bridge_ip:
                self.draw.text((10, content_y + 74), f"Bridge IP: {self.status.bridge_ip}", font=FONT_SMALL, fill=0)

    def _render_actions(self):
        """Render Energy Breakdown page"""
        content_y = 18
        self.draw.text((10, content_y), 'Energy Breakdown', font=FONT_MED, fill=0)
        
        row_y = content_y + 20
        row_h = 14
        
        # Energy usage (kWh) - calculate from cost if not directly available
        total_kwh = self.status.total_energy_kwh
        hp_kwh = self.status.hp_energy_kwh
        aux_kwh = self.status.aux_energy_kwh
        
        # If no detailed kWh data, estimate from variable cost
        if total_kwh == 0 and self.status.variable_cost > 0:
            rate = self.status.electricity_rate or 0.10
            total_kwh = self.status.variable_cost / rate
            hp_kwh = total_kwh  # Assume all HP if no breakdown
            aux_kwh = 0
        
        # Fallback: use hp_kwh = total if not separately tracked
        if hp_kwh == 0 and total_kwh > 0:
            hp_kwh = total_kwh
        
        # Show data if we have cost OR energy
        if total_kwh > 0 or self.status.monthly_cost > 0:
            # Heat Pump energy
            self.draw.text((10, row_y), f"Heat Pump:", font=FONT_SMALL, fill=0)
            self.draw.text((140, row_y), f"{hp_kwh:.0f} kWh", font=FONT_SMALL, fill=0)
            row_y += row_h
            
            # Aux Heat energy (show even if 0)
            self.draw.text((10, row_y), f"Aux Heat:", font=FONT_SMALL, fill=0)
            self.draw.text((140, row_y), f"{aux_kwh:.0f} kWh", font=FONT_SMALL, fill=0)
            row_y += row_h + 4
            
            # Divider line
            self.draw.line([(10, row_y), (240, row_y)], fill=0, width=1)
            row_y += 6
            
            # Cost breakdown
            variable = self.status.variable_cost or (total_kwh * self.status.electricity_rate)
            fixed = self.status.fixed_cost
            total = self.status.monthly_cost or (variable + fixed)
            
            self.draw.text((10, row_y), f"Energy Cost:", font=FONT_SMALL, fill=0)
            self.draw.text((140, row_y), f"${variable:.2f}", font=FONT_SMALL, fill=0)
            row_y += row_h
            
            self.draw.text((10, row_y), f"Fixed Fee:", font=FONT_SMALL, fill=0)
            self.draw.text((140, row_y), f"${fixed:.2f}", font=FONT_SMALL, fill=0)
            row_y += row_h + 2
            
            # Total (bold)
            self.draw.text((10, row_y), f"Total:", font=FONT_MED, fill=0)
            self.draw.text((140, row_y), f"${total:.2f}/mo", font=FONT_MED, fill=0)
        else:
            # No energy data yet
            self.draw.text((10, row_y), 'Waiting for data...', font=FONT_SMALL, fill=0)
            self.draw.text((10, row_y + 16), 'Run Monthly Forecaster', font=FONT_SMALL, fill=0)
            self.draw.text((10, row_y + 30), 'in the Joule web app', font=FONT_SMALL, fill=0)

    def _render_guide(self):
        """Render 3-Day Cost Forecast page"""
        content_y = 18
        
        # Header with title and last updated time
        self.draw.text((10, content_y), '3-Day Forecast', font=FONT_MED, fill=0)
        age_str = self.status.get_forecast_age_str()
        if age_str:
            self.draw.text((160, content_y + 2), age_str, font=FONT_SMALL, fill=0)
        
        row_y = content_y + 18
        row_h = 20  # Height for each day row (slightly reduced)
        
        if self.status.daily_forecast and len(self.status.daily_forecast) > 0:
            # Check if any day has aux heat
            has_aux = self.status.has_aux_heat_expected()
            
            # Calculate total 3-day cost
            total_cost = sum(
                float(d.get('costWithAux', d.get('cost', 0)) or 0) 
                for d in self.status.daily_forecast[:3]
            )
            
            for i, day in enumerate(self.status.daily_forecast[:3]):
                if i >= 3:
                    break
                    
                # Get day label (e.g., "Wed, 2/4") - shorten to just day name
                day_label = day.get('day', day.get('dayLabel', f'Day {i+1}'))
                if ',' in day_label:
                    day_name = day_label.split(',')[0][:3]  # "Wed", "Thu", etc.
                elif ' ' in day_label:
                    day_name = day_label.split()[0][:3]
                else:
                    day_name = day_label[:3]
                
                # Get cost (prefer costWithAux for accuracy)
                cost = day.get('costWithAux', day.get('cost', 0))
                if cost is None:
                    cost = 0
                cost = float(cost)
                
                # Get temperature range
                low_temp = day.get('lowTemp', 0)
                high_temp = day.get('highTemp', 0)
                
                # Check if this day has aux heat
                aux_energy = float(day.get('auxEnergy', 0) or 0)
                day_has_aux = aux_energy > 0
                
                # Draw day row
                y = row_y + (i * row_h)
                
                # Day name (left) - add "*" marker if aux heat expected
                day_display = f"{day_name}*" if day_has_aux else day_name
                self.draw.text((10, y), day_display, font=FONT_MED, fill=0)
                
                # Temperature range (center)
                if low_temp and high_temp:
                    temp_str = f"{low_temp:.0f}-{high_temp:.0f}°"
                    self.draw.text((55, y + 2), temp_str, font=FONT_SMALL, fill=0)
                
                # Cost (right-aligned)
                cost_str = f"${cost:.2f}"
                self.draw.text((180, y), cost_str, font=FONT_MED, fill=0)
            
            # Draw divider line
            divider_y = row_y + (3 * row_h) - 2
            self.draw.line([(10, divider_y), (240, divider_y)], fill=0, width=1)
            
            # Total 3-day cost
            total_y = divider_y + 4
            self.draw.text((10, total_y), '3-Day Total:', font=FONT_SMALL, fill=0)
            self.draw.text((180, total_y), f"${total_cost:.2f}", font=FONT_MED, fill=0)
            
            # Aux heat warning legend if any day has aux
            if has_aux:
                self.draw.text((10, total_y + 14), '* = Aux heat expected', font=FONT_SMALL, fill=0)
        else:
            # No daily forecast data - show fallback with calculated estimate
            self.draw.text((10, row_y), 'Waiting for forecast...', font=FONT_SMALL, fill=0)
            
            # If we have weekly cost, estimate daily
            if self.status.weekly_cost > 0:
                daily_est = self.status.weekly_cost / 7.0
                self.draw.text((10, row_y + 16), f'Est: ${daily_est:.2f}/day', font=FONT_SMALL, fill=0)
                self.draw.text((10, row_y + 32), f'(Based on ${self.status.weekly_cost:.2f}/wk)', font=FONT_SMALL, fill=0)
            else:
                self.draw.text((10, row_y + 16), 'Run 7-Day Forecaster', font=FONT_SMALL, fill=0)
                self.draw.text((10, row_y + 32), 'in the Joule app', font=FONT_SMALL, fill=0)

    def _render_nav(self):
        nav_h = 20
        y = SCREEN_H - nav_h
        self.draw.rectangle((0, y, SCREEN_W, SCREEN_H), fill=0)
        
        labels = ['Status', 'Energy', '3-Day']
        btn_w = SCREEN_W // 3
        
        for i, lab in enumerate(labels):
            x0 = i * btn_w
            # Draw separator lines between buttons
            if i > 0:
                self.draw.line([(x0, y + 2), (x0, SCREEN_H - 2)], fill=255, width=1)
            # Center text in button
            text_x = x0 + (btn_w - len(lab) * 6) // 2
            self.draw.text((text_x, y + 4), lab, font=FONT_SMALL, fill=255)

    def _display(self):
        if not self.epd:
            return
        try:
            # Rotate 180 degrees for correct orientation
            bw = self.canvas.convert('1').rotate(180)
            buf = self.epd.getbuffer(bw)
            # Use partial update if enabled and available
            if self.partial_enabled and self.partial_available:
                # Waveshare V3 requires displayPartBaseImage() first, then displayPartial()
                if not self._partial_base_set and hasattr(self.epd, 'displayPartBaseImage'):
                    self.epd.displayPartBaseImage(buf)
                    self._partial_base_set = True
                    print('[INFO] Set partial base image')
                    return
                # Now use partial update
                for name in ('displayPartial', 'DisplayPartial', 'partial_update', 'display_part'):
                    fn = getattr(self.epd, name, None)
                    if callable(fn):
                        fn(buf)
                        return
            # Fallback to full update
            self.epd.display(buf)
        except Exception as e:
            print('[WARN] display failed:', e)

if __name__ == '__main__':
    EInkHMI().run()
