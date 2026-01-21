#!/usr/bin/env python3
"""
Joule HVAC E-Ink Display HMI
For Waveshare 2.13" e-paper HAT on Raspberry Pi Zero 2W
Display: 250x122 pixels, 1-bit color
"""

import os
import sys
import time
import requests
import subprocess
from datetime import datetime
from PIL import Image, ImageDraw, ImageFont

# Waveshare e-paper library (install via: git clone https://github.com/waveshare/e-Paper)
# Add to path: sys.path.append('/home/pi/e-Paper/RaspberryPi_JetsonNano/python/lib')
try:
    from waveshare_epd import epd2in13_V4
    from waveshare_epd import gt1151
except ImportError:
    print("Warning: Waveshare library not found. Running in simulation mode.")
    epd2in13_V4 = None
    gt1151 = None

# Configuration
BRIDGE_URL = os.getenv('BRIDGE_URL', 'http://localhost:3002')
REFRESH_INTERVAL = 900  # 15 minutes in seconds
FULL_REFRESH_EVERY = 10  # Full refresh every N partial refreshes
DISPLAY_WIDTH = 250
DISPLAY_HEIGHT = 122

# Layout coordinates (from deployment guide)
HEADER_RECT = (0, 0, 250, 18)
FOOTER_RECT = (0, 95, 250, 110)
NAV_RECT = (0, 106, 250, 122)
CONTENT_RECT = (0, 18, 250, 95)

# Colors for 1-bit display
BLACK = 0
WHITE = 255

# Font paths (try IBM Plex Mono first, fallback to DejaVu Sans Mono)
FONT_PATHS = [
    '/home/pi/joule-hvac/fonts/IBMPlexMono-Regular.ttf',
    '/usr/share/fonts/truetype/ibm-plex-mono/IBMPlexMono-Regular.ttf',
    '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf',
    '/usr/share/fonts/truetype/liberation/LiberationMono-Regular.ttf'
]

class JouleHMI:
    def __init__(self):
        self.epd = None
        self.current_page = 0  # 0=Status, 1=Actions, 2=Guide
        self.page_names = ['Status', 'Actions', 'Guide']
        self.refresh_counter = 0
        self.partial_flash = True
        
        # Data state
        self.bridge_data = {
            'mode': '—',
            'temperature': '—',
            'humidity': '—',
            'target': '—',
            'connected': False
        }
        self.wifi_signal = 0  # 0-3 bars
        self.weekly_cost = None
        self.monthly_cost = None
        self.outdoor_temp = None
        self.outdoor_humidity = None
        
        # Load fonts
        self.fonts = self._load_fonts()
        
        # Initialize display
        if epd2in13_V4:
            self.epd = epd2in13_V4.EPD()
            self.epd.init()
            self.epd.Clear(0xFF)
        
        # Initialize touch controller (gt1151)
        if gt1151:
            try:
                self.touch = gt1151.GT1151()
                self.touch.init()
            except Exception as e:
                print(f"Touch init error: {e}")
                self.touch = None
        else:
            self.touch = None
    
    def _load_fonts(self):
        """Load fonts with fallback"""
        base_font = None
        for path in FONT_PATHS:
            if os.path.exists(path):
                base_font = path
                break
        
        if not base_font:
            print("Warning: No suitable monospace font found, using default")
            return {
                'header': ImageFont.load_default(),
                'large': ImageFont.load_default(),
                'medium': ImageFont.load_default(),
                'small': ImageFont.load_default()
            }
        
        return {
            'header': ImageFont.truetype(base_font, 10),
            'large': ImageFont.truetype(base_font, 14),
            'medium': ImageFont.truetype(base_font, 10),
            'small': ImageFont.truetype(base_font, 8)
        }
    
    def fetch_bridge_data(self):
        """Fetch current HVAC state from bridge"""
        try:
            response = requests.get(f'{BRIDGE_URL}/api/status', timeout=5)
            if response.status_code == 200:
                data = response.json()
                self.bridge_data = {
                    'mode': data.get('hvacMode', '—').upper(),
                    'temperature': f"{data.get('temperature', '—')}°" if data.get('temperature') else '—',
                    'humidity': f"{data.get('humidity', '—')}%" if data.get('humidity') else '—',
                    'target': f"{data.get('targetTemp', '—')}°" if data.get('targetTemp') else '—',
                    'connected': True
                }
                return True
        except Exception as e:
            print(f"Bridge fetch error: {e}")
            self.bridge_data['connected'] = False
        return False
    
    def fetch_wifi_signal(self):
        """Fetch WiFi signal strength (0-3 bars)"""
        try:
            # Try bridge endpoint first
            response = requests.get(f'{BRIDGE_URL}/api/wifi/signal', timeout=3)
            if response.status_code == 200:
                data = response.json()
                self.wifi_signal = data.get('bars', 0)
                return
        except:
            pass
        
        # Fallback: parse iwconfig directly
        try:
            output = subprocess.check_output(['iwconfig', 'wlan0'], 
                                           stderr=subprocess.DEVNULL, 
                                           text=True)
            for line in output.split('\n'):
                if 'Signal level' in line:
                    # Extract dBm value
                    dbm_str = line.split('Signal level=')[1].split(' ')[0]
                    dbm = int(dbm_str)
                    
                    # Convert to bars (0-3)
                    if dbm >= -50:
                        self.wifi_signal = 3
                    elif dbm >= -60:
                        self.wifi_signal = 2
                    elif dbm >= -70:
                        self.wifi_signal = 1
                    else:
                        self.wifi_signal = 0
                    return
        except Exception as e:
            print(f"WiFi signal fetch error: {e}")
            self.wifi_signal = 0
    
    def fetch_weekly_cost(self):
        """Fetch weekly HVAC cost estimate"""
        # First try to read from Forecaster's localStorage data (via bridge)
        try:
            response = requests.get(f'{BRIDGE_URL}/api/settings', timeout=5)
            if response.status_code == 200:
                settings = response.json()
                # Try to get forecast summary from localStorage
                if 'last_forecast_summary' in settings:
                    forecast_data = settings['last_forecast_summary']
                    # Use with-aux cost if available (matches Quick Answer display logic)
                    # Fall back to base HP cost if with-aux not available
                    cost = (forecast_data.get('totalHPCostWithAux') or 
                           forecast_data.get('totalHPCost') or 
                           forecast_data.get('totalWeeklyCost') or 
                           forecast_data.get('weekly_cost') or 
                           forecast_data.get('weeklyCost'))
                    
                    if cost and isinstance(cost, (int, float)):
                        self.weekly_cost = f"${cost:.2f}/wk"
                        self.monthly_cost = f"${cost * 4.33:.2f}/mo"
                        return
        except Exception as e:
            print(f"localStorage forecast fetch error: {e}")
        
        # Try new bridge cost-estimate API endpoint
        try:
            target_str = self.bridge_data['target'].replace('°', '').strip()
            outdoor_str = (self.outdoor_temp or '—').replace('°', '').strip()
            
            if target_str != '—' and outdoor_str != '—':
                response = requests.post(
                    f'{BRIDGE_URL}/api/cost-estimate',
                    json={
                        'outdoor_temp': float(outdoor_str),
                        'target_temp': float(target_str),
                        'duration_hours': 168  # 1 week
                    },
                    timeout=5
                )
                if response.status_code == 200:
                    data = response.json()
                    if data.get('success'):
                        self.weekly_cost = f"${data['weeklyCost']:.2f}/wk"
                        self.monthly_cost = f"${data['monthlyCost']:.2f}/mo"
                        return
        except Exception as e:
            print(f"Cost estimate API error: {e}")
        
        # Fallback: Use outdoor temp to estimate heating/cooling load
        try:
            # Get target and outdoor temps
            target_str = self.bridge_data['target'].replace('°', '').strip()
            outdoor_str = (self.outdoor_temp or '—').replace('°', '').strip()
            
            if target_str != '—' and outdoor_str != '—':
                target_temp = float(target_str)
                outdoor_temp = float(outdoor_str)
                
                # Calculate degree-days for a typical week (7 days)
                # Assume outdoor temp is relatively stable over the week
                temp_diff = abs(target_temp - outdoor_temp)
                
                # Determine if heating or cooling
                if outdoor_temp < target_temp - 2:  # Heating
                    # Heating degree-days per week
                    weekly_dd = temp_diff * 7
                    # Rough estimate: $0.50 per degree-day for typical 1500 sqft home
                    estimate = weekly_dd * 0.50
                elif outdoor_temp > target_temp + 2:  # Cooling
                    # Cooling degree-days per week (less efficient than heating)
                    weekly_dd = temp_diff * 7
                    # Cooling costs more per degree-day
                    estimate = weekly_dd * 0.60
                else:
                    # Mild weather, minimal HVAC usage
                    estimate = 2.00
                
                self.weekly_cost = f"${estimate:.2f}/wk"
                self.monthly_cost = f"${estimate * 4.33:.2f}/mo"
            else:
                # No outdoor temp available, use minimal estimate
                self.weekly_cost = "$5.00/wk"
                self.monthly_cost = "$21.65/mo"
        except Exception as e:
            print(f"Cost calculation error: {e}")
            self.weekly_cost = "$5.00/wk"
            self.monthly_cost = "$21.65/mo"
    
    def fetch_outdoor_weather(self):
        """Fetch outdoor temperature and humidity from NWS or OpenMeteo"""
        # First try to get location from bridge settings
        location = self._get_location()
        if not location:
            return
        
        lat, lon = location
        
        # Try OpenMeteo (more reliable than NWS)
        try:
            url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m&temperature_unit=fahrenheit"
            response = requests.get(url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                current = data.get('current', {})
                self.outdoor_temp = f"{current.get('temperature_2m', '—'):.0f}°"
                self.outdoor_humidity = f"{current.get('relative_humidity_2m', '—')}%"
                return
        except Exception as e:
            print(f"OpenMeteo fetch error: {e}")
        
        # Fallback to NWS
        try:
            # Get grid point
            point_url = f"https://api.weather.gov/points/{lat},{lon}"
            response = requests.get(point_url, timeout=5)
            if response.status_code == 200:
                point_data = response.json()
                forecast_url = point_data['properties']['forecastHourly']
                
                # Get hourly forecast
                forecast_response = requests.get(forecast_url, timeout=5)
                if forecast_response.status_code == 200:
                    forecast_data = forecast_response.json()
                    current_forecast = forecast_data['properties']['periods'][0]
                    
                    self.outdoor_temp = f"{current_forecast['temperature']}°"
                    self.outdoor_humidity = f"{current_forecast.get('relativeHumidity', {}).get('value', '—')}%"
        except Exception as e:
            print(f"NWS fetch error: {e}")
    
    def _get_location(self):
        """Get location from bridge settings or localStorage equivalent"""
        # First try to fetch from bridge API (shares React app's settings)
        try:
            response = requests.get(f'{BRIDGE_URL}/api/settings', timeout=3)
            if response.status_code == 200:
                settings = response.json()
                lat = settings.get('location', {}).get('latitude')
                lon = settings.get('location', {}).get('longitude')
                if lat and lon:
                    return (lat, lon)
        except Exception as e:
            print(f"Bridge settings fetch error: {e}")
        
        # Fallback: Try to read from a config file
        config_path = os.path.expanduser('~/.joule-hmi-config.txt')
        if os.path.exists(config_path):
            try:
                with open(config_path, 'r') as f:
                    lines = f.readlines()
                    for line in lines:
                        if line.startswith('LAT='):
                            lat = float(line.split('=')[1].strip())
                        if line.startswith('LON='):
                            lon = float(line.split('=')[1].strip())
                    return (lat, lon)
            except:
                pass
        
        # Default to a location (user should configure)
        return None
    
    def fetch_all_data(self):
        """Fetch all data from various sources"""
        print(f"Fetching data... [{datetime.now().strftime('%H:%M:%S')}]")
        self.fetch_bridge_data()
        self.fetch_wifi_signal()
        self.fetch_outdoor_weather()  # Fetch outdoor weather BEFORE cost calc
        self.fetch_weekly_cost()  # Cost calc needs outdoor temp for fallback
    
    def draw_header(self, draw):
        """Draw header with mode, temp, humidity, WiFi signal, status"""
        x1, y1, x2, y2 = HEADER_RECT
        
        # Background
        draw.rectangle([(x1, y1), (x2, y2)], fill=WHITE)
        
        # Left side: Mode + Temp + Humidity
        mode = self.bridge_data['mode'][:4]  # Truncate to 4 chars
        temp = self.bridge_data['temperature']
        humidity = self.bridge_data['humidity']
        
        # Only show humidity if connected
        if self.bridge_data['connected']:
            left_text = f"{mode} {temp} {humidity}"
        else:
            left_text = f"{mode} {temp}"
        
        draw.text((2, y1 + 3), left_text, font=self.fonts['header'], fill=BLACK)
        
        # Right side: WiFi signal + Status
        status = 'OK' if self.bridge_data['connected'] else 'ERR'
        
        # WiFi bars (simplified representation)
        bars_x = x2 - 30
        for i in range(4):
            bar_height = 2 + (i * 2)
            if i < self.wifi_signal:
                draw.rectangle([(bars_x + i * 3, y2 - 6 - bar_height), 
                              (bars_x + i * 3 + 2, y2 - 6)], fill=BLACK)
            else:
                draw.rectangle([(bars_x + i * 3, y2 - 6 - bar_height), 
                              (bars_x + i * 3 + 2, y2 - 6)], outline=BLACK)
        
        # Status text
        status_bbox = draw.textbbox((0, 0), status, font=self.fonts['small'])
        status_width = status_bbox[2] - status_bbox[0]
        draw.text((x2 - status_width - 2, y1 + 3), status, 
                 font=self.fonts['small'], fill=BLACK)
    
    def draw_footer(self, draw):
        """Draw footer with outdoor temp/humidity and weekly cost"""
        if self.current_page == 1:  # Hide on Actions page
            return
        
        x1, y1, x2, y2 = FOOTER_RECT
        
        # Background
        draw.rectangle([(x1, y1), (x2, y2)], fill=WHITE)
        
        # Left side: Outdoor temp + humidity
        outdoor_temp = self.outdoor_temp or '—'
        outdoor_hum = self.outdoor_humidity or '—'
        left_text = f"Out: {outdoor_temp} {outdoor_hum}"
        draw.text((2, y1 + 2), left_text, font=self.fonts['small'], fill=BLACK)
        
        # Right side: Weekly cost
        if self.weekly_cost:
            cost_bbox = draw.textbbox((0, 0), self.weekly_cost, font=self.fonts['small'])
            cost_width = cost_bbox[2] - cost_bbox[0]
            draw.text((x2 - cost_width - 2, y1 + 2), 
                     self.weekly_cost, font=self.fonts['small'], fill=BLACK)
    
    def draw_nav_bar(self, draw):
        """Draw navigation bar with page indicators"""
        x1, y1, x2, y2 = NAV_RECT
        
        # Background
        draw.rectangle([(x1, y1), (x2, y2)], fill=WHITE)
        
        # Draw three page buttons
        button_width = (x2 - x1) // 3
        for i, name in enumerate(self.page_names):
            button_x = x1 + (i * button_width)
            button_x_end = button_x + button_width
            
            # Highlight current page
            if i == self.current_page:
                draw.rectangle([(button_x, y1), (button_x_end, y2)], 
                             fill=BLACK)
                text_color = WHITE
            else:
                draw.rectangle([(button_x, y1), (button_x_end, y2)], 
                             outline=BLACK)
                text_color = BLACK
            
            # Center text in button
            text_bbox = draw.textbbox((0, 0), name, font=self.fonts['small'])
            text_width = text_bbox[2] - text_bbox[0]
            text_height = text_bbox[3] - text_bbox[1]
            text_x = button_x + (button_width - text_width) // 2
            text_y = y1 + (y2 - y1 - text_height) // 2
            
            draw.text((text_x, text_y), name, font=text_color, fill=text_color)
    
    def draw_status_page(self, draw):
        """Draw Status page content - compact layout"""
        x1, y1, x2, y2 = CONTENT_RECT
        
        # Clear content area
        draw.rectangle([(x1, y1), (x2, y2)], fill=WHITE)
        
        # Compact single-column layout with all key info
        mode = self.bridge_data['mode']
        temp = self.bridge_data['temperature']
        target = self.bridge_data['target']
        weekly_cost = self.weekly_cost or '—'
        monthly_cost = self.monthly_cost or '—'
        
        line_y = y1 + 4
        
        # Mode
        draw.text((x1 + 4, line_y), f"Mode: {mode}", font=self.fonts['small'], fill=BLACK)
        line_y += 11
        
        # Temperature line: Show both if connected, otherwise just target
        has_temp = self.bridge_data['connected'] and temp != '—'
        
        if has_temp:
            # Current temp and target temp on same line
            draw.text((x1 + 4, line_y), f"Temp: {temp}", font=self.fonts['small'], fill=BLACK)
            
            # Right-align target temp
            target_text = f"Tgt: {target}"
            target_bbox = draw.textbbox((0, 0), target_text, font=self.fonts['small'])
            target_width = target_bbox[2] - target_bbox[0]
            draw.text((x2 - target_width - 4, line_y), target_text, font=self.fonts['small'], fill=BLACK)
        else:
            # Only show target when not connected
            draw.text((x1 + 4, line_y), f"Tgt: {target}", font=self.fonts['small'], fill=BLACK)
        
        line_y += 11
        
        # Weekly and Monthly costs on same line
        draw.text((x1 + 4, line_y), f"Wk: {weekly_cost}", font=self.fonts['small'], fill=BLACK)
        
        # Right-align monthly cost
        mo_bbox = draw.textbbox((0, 0), f"Mo: {monthly_cost}", font=self.fonts['small'])
        mo_width = mo_bbox[2] - mo_bbox[0]
        draw.text((x2 - mo_width - 4, line_y), f"Mo: {monthly_cost}", font=self.fonts['small'], fill=BLACK)
    
    def draw_actions_page(self, draw):
        """Draw Actions page content"""
        x1, y1, x2, y2 = CONTENT_RECT
        
        # Clear content area
        draw.rectangle([(x1, y1), (x2, y2)], fill=WHITE)
        
        # Title with weekly cost on right
        title = "Actions"
        cost = self.weekly_cost or '—'
        
        draw.text((x1 + 2, y1 + 2), title, font=self.fonts['medium'], fill=BLACK)
        
        cost_bbox = draw.textbbox((0, 0), cost, font=self.fonts['small'])
        cost_width = cost_bbox[2] - cost_bbox[0]
        draw.text((x2 - cost_width - 2, y1 + 2), cost, 
                 font=self.fonts['small'], fill=BLACK)
        
        # Temp controls
        temp_y = y1 + 18
        draw.text((x1 + 4, temp_y), "Temp:", font=self.fonts['small'], fill=BLACK)
        
        # +1 button
        draw.rectangle([(x1 + 40, temp_y - 2), (x1 + 65, temp_y + 10)], outline=BLACK)
        draw.text((x1 + 48, temp_y), "+1", font=self.fonts['small'], fill=BLACK)
        
        # -1 button
        draw.rectangle([(x1 + 70, temp_y - 2), (x1 + 95, temp_y + 10)], outline=BLACK)
        draw.text((x1 + 78, temp_y), "-1", font=self.fonts['small'], fill=BLACK)
        
        # Mode cycle
        mode_y = temp_y + 16
        draw.text((x1 + 4, mode_y), "Mode:", font=self.fonts['small'], fill=BLACK)
        
        # Cycle button
        draw.rectangle([(x1 + 40, mode_y - 2), (x1 + 90, mode_y + 10)], outline=BLACK)
        draw.text((x1 + 48, mode_y), "Cycle", font=self.fonts['small'], fill=BLACK)
        
        # Offline message if disconnected
        if not self.bridge_data['connected']:
            msg_y = mode_y + 18
            draw.text((x1 + 4, msg_y), "Bridge offline", 
                     font=self.fonts['small'], fill=BLACK)
    
    def draw_guide_page(self, draw):
        """Draw Guide page content"""
        x1, y1, x2, y2 = CONTENT_RECT
        
        # Clear content area
        draw.rectangle([(x1, y1), (x2, y2)], fill=WHITE)
        
        # Guide tips
        tips = [
            "Status: Current state",
            "Actions: Temp/mode",
            "Bridge: Local server",
            "15min auto-refresh"
        ]
        
        line_y = y1 + 4
        for tip in tips:
            draw.text((x1 + 4, line_y), tip, font=self.fonts['small'], fill=BLACK)
            line_y += 12
    
    def render_frame(self):
        """Render complete frame to display"""
        # Create image
        image = Image.new('1', (DISPLAY_WIDTH, DISPLAY_HEIGHT), WHITE)
        draw = ImageDraw.Draw(image)
        
        # Draw all components
        self.draw_header(draw)
        
        if self.current_page == 0:
            self.draw_status_page(draw)
        elif self.current_page == 1:
            self.draw_actions_page(draw)
        elif self.current_page == 2:
            self.draw_guide_page(draw)
        
        self.draw_footer(draw)
        self.draw_nav_bar(draw)
        
        return image
    
    def update_display(self, force_full=False):
        """Update e-paper display"""
        image = self.render_frame()
        
        if not self.epd:
            # Simulation mode: save to file
            image.save('/tmp/joule_hmi_preview.png')
            print("Display updated (simulation mode)")
            return
        
        # Determine refresh type
        use_full = force_full or (self.refresh_counter >= FULL_REFRESH_EVERY)
        
        if use_full:
            print("Full refresh")
            self.epd.init()  # Full init
            self.epd.display(self.epd.getbuffer(image))
            self.refresh_counter = 0
        else:
            print("Partial refresh")
            self.epd.init_part()  # Partial init for V4
            self.epd.display_Partial(self.epd.getbuffer(image))
            self.refresh_counter += 1
        
        self.epd.sleep()  # Always sleep after update to protect the ink
    
    def process_touch(self, x, y):
        """Process touch coordinates and determine action"""
        # Nav bar is at bottom (y: 106-122)
        if y >= 106:
            # Determine which button (0-83: Status, 84-166: Actions, 167-250: Guide)
            button_width = DISPLAY_WIDTH // 3
            button = x // button_width
            if 0 <= button < len(self.page_names):
                print(f"Touch: Page {self.page_names[button]}")
                self.current_page = button
                self.update_display()
        
        # Actions page buttons (if on Actions page)
        elif self.current_page == 1 and 18 <= y <= 95:
            # Check for +1 button (x: 40-65, y: ~16-28)
            if 40 <= x <= 65 and 34 <= y <= 46:
                print("Touch: +1°F")
                self.adjust_setpoint(+1)
            # Check for -1 button (x: 70-95, y: ~16-28)
            elif 70 <= x <= 95 and 34 <= y <= 46:
                print("Touch: -1°F")
                self.adjust_setpoint(-1)
            # Check for Mode Cycle button (x: 40-90, y: ~32-44)
            elif 40 <= x <= 90 and 50 <= y <= 62:
                print("Touch: Cycle mode")
                self.cycle_mode()
    
    def adjust_setpoint(self, delta):
        """Adjust temperature setpoint by delta"""
        try:
            response = requests.post(f'{BRIDGE_URL}/api/setpoint',
                                   json={'delta': delta},
                                   timeout=3)
            if response.status_code == 200:
                # Refresh display
                self.fetch_bridge_data()
                self.update_display()
        except Exception as e:
            print(f"Setpoint adjust error: {e}")
    
    def cycle_mode(self):
        """Cycle through HVAC modes"""
        modes = ['OFF', 'HEAT', 'COOL', 'AUTO']
        current = self.bridge_data['mode'].upper()
        try:
            current_idx = modes.index(current)
            next_mode = modes[(current_idx + 1) % len(modes)]
        except ValueError:
            next_mode = 'OFF'
        
        try:
            response = requests.post(f'{BRIDGE_URL}/api/mode',
                                   json={'mode': next_mode.lower()},
                                   timeout=3)
            if response.status_code == 200:
                # Refresh display
                self.fetch_bridge_data()
                self.update_display()
        except Exception as e:
            print(f"Mode cycle error: {e}")
    
    def handle_touch(self, button):
        """Handle touch button press (0=Status, 1=Actions, 2=Guide) - Legacy method"""
        if 0 <= button < len(self.page_names):
            self.current_page = button
            self.update_display()
    
    def run(self):
        """Main loop"""
        print("Joule HMI starting...")
        
        # Initial data fetch
        self.fetch_all_data()
        self.update_display(force_full=True)
        
        last_refresh = time.time()
        
        try:
            while True:
                # 1. Handle Touch (if hardware exists)
                if self.touch:
                    try:
                        # Check for touch interrupt
                        touch_data = self.touch.get_touch()
                        if touch_data:
                            # Process first touch point
                            self.process_touch(touch_data[0].x, touch_data[0].y)
                    except Exception as e:
                        print(f"Touch read error: {e}")
                
                # 2. Check for 15-minute Auto-Refresh
                if time.time() - last_refresh >= REFRESH_INTERVAL:
                    self.fetch_all_data()
                    self.update_display()
                    last_refresh = time.time()
                
                # Small sleep to keep CPU usage low but touch responsive
                time.sleep(0.1)
                
        except KeyboardInterrupt:
            print("\nShutting down...")
            if self.epd:
                self.epd.sleep()
            sys.exit(0)

def main():
    hmi = JouleHMI()
    hmi.run()

if __name__ == '__main__':
    main()
