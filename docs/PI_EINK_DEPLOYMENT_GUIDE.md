# Pi Zero 2W E-Ink Deployment Guide
## Friday Hardware Setup - Critical Implementation Notes

### 1. Display Specifications (Waveshare 2.13" V4)
- **Resolution**: 250×122 pixels (confirmed from React prototype)
- **Color Mode**: 1-bit (BLACK=0, WHITE=255)
- **Interface**: SPI via GPIO

---

## Critical UI Coordinates (PIL ImageDraw)

```python
# Layout constants (matching React prototype exactly)
SCREEN_W = 250
SCREEN_H = 122
HEADER_H = 18  # Increased from 16 to match visual weight
FOOTER_H = 12
NAV_H = 16     # Bottom nav bar

# Coordinate map from React → Python PIL
HEADER_RECT = (0, 0, 250, 18)
FOOTER_START_Y = 95  # SCREEN_H - NAV_H - FOOTER_H - 15
NAV_RECT = (0, 106, 250, 122)

# Content area boundaries
CONTENT_TOP = 18
CONTENT_BOTTOM_STATUS = 106  # Full height on Status page
CONTENT_BOTTOM_ACTIONS = 95   # Shorter on Actions (no footer)
CONTENT_LEFT = 8
CONTENT_RIGHT = 242
```

---

## 2. Ghosting Management Strategy

### Refresh Counter Pattern
```python
class JouleHMI:
    def __init__(self):
        self.partial_refresh_count = 0
        self.MAX_PARTIAL_REFRESHES = 10
    
    def draw_ui(self, force_full=False):
        image = self.render_screen()
        
        # Trigger full refresh every 10 partials OR on page change
        needs_full = (
            force_full or 
            self.partial_refresh_count >= self.MAX_PARTIAL_REFRESHES
        )
        
        if needs_full:
            self.epd.init()  # Reinitialize (clears ghosting)
            self.epd.display(self.epd.getbuffer(image))
            self.partial_refresh_count = 0
            print("✓ Full refresh (ghosting cleared)")
        else:
            self.epd.displayPartial(self.epd.getbuffer(image))
            self.partial_refresh_count += 1
            print(f"→ Partial refresh ({self.partial_refresh_count}/10)")
    
    def change_page(self, new_page):
        self.page = new_page
        self.draw_ui(force_full=True)  # Always full refresh on nav
```

---

## 3. Touch Target Expansion

```python
# Visual nav button widths: ~83px each
# Expanded hit zones for fat fingers:
def get_nav_target(x, y):
    """
    Expand touch zones by 10px on each side
    Visual: [0-83] [83-166] [166-250]
    Touch:  [0-93] [73-176] [156-250]  (overlapping is fine!)
    """
    if y < 100:  # Not in nav bar
        return None
    
    if x < 93:
        return "status"
    elif x < 176:
        return "actions"
    else:
        return "guide"
```

---

## 4. Font Setup (IBM Plex Mono)

### Download and Install
```bash
# On your Pi Zero 2W
cd ~
mkdir -p joule-hmi/fonts
cd joule-hmi/fonts

# Download IBM Plex Mono from Google Fonts
wget https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Regular.ttf
wget https://github.com/google/fonts/raw/main/ofl/ibmplexmono/IBMPlexMono-Bold.ttf

# Verify
ls -lh
# Should see:
# IBMPlexMono-Regular.ttf (~100KB)
# IBMPlexMono-Bold.ttf (~100KB)
```

### Font Loading with Fallback
```python
from PIL import ImageFont

def load_font(path, size, fallback_size=None):
    """Load font with graceful degradation"""
    try:
        return ImageFont.truetype(path, size)
    except OSError:
        print(f"⚠ Font not found: {path}, using default")
        if fallback_size:
            return ImageFont.load_default()
        return ImageFont.load_default()

# Font sizes optimized for 2.13" display
font_xs = load_font("fonts/IBMPlexMono-Regular.ttf", 8)   # Footer stats
font_sm = load_font("fonts/IBMPlexMono-Regular.ttf", 10)  # Header, nav, body
font_md = load_font("fonts/IBMPlexMono-Bold.ttf", 11)     # Page titles (Actions/Status)
font_lg = load_font("fonts/IBMPlexMono-Bold.ttf", 14)     # Unused (too large)
```

---

## 5. High-Contrast Rendering (Combat E-Ink Grey)

```python
# E-ink displays are NOT pure white - they're light grey
# Use ABSOLUTE BLACK (0) for all text/borders to maximize contrast

BLACK = 0    # Use this for ALL text, borders, filled areas
WHITE = 255  # Only for background and inverted text

# Header example (black background, white text)
draw.rectangle(HEADER_RECT, fill=BLACK)
draw.text((4, 3), header_text, font=font_sm, fill=WHITE)

# Body text (black on white)
draw.text((8, 28), "Status", font=font_md, fill=BLACK)

# Never use grays (128, 192, etc.) - they look muddy on e-ink
```

---

## 6. Footer Data Positioning (matching screenshot)

```python
def draw_footer(self, draw):
    """
    Footer layout (only shown on Status/Guide pages):
    [Out 29°]                    [$6.50/wk]
     ^left-aligned                ^right-aligned
    """
    outdoor_text = f"Out {self.data['outdoor']}°"
    cost_text = f"${self.data['weekly_cost']:.2f}/wk"
    
    # Left: Outdoor temp
    draw.text((6, 95), outdoor_text, font=font_xs, fill=BLACK)
    
    # Right: Weekly cost (measure width for right-align)
    bbox = draw.textbbox((0, 0), cost_text, font=font_xs)
    text_width = bbox[2] - bbox[0]
    right_x = SCREEN_W - text_width - 6
    draw.text((right_x, 95), cost_text, font=font_xs, fill=BLACK)
```

---

## 7. Nav Bar (Black background, centered labels)

```python
def draw_nav(self, draw):
    """Bottom navigation with vertical dividers"""
    draw.rectangle(NAV_RECT, fill=BLACK)
    
    # Vertical dividers (white lines at 1/3 and 2/3 points)
    div1_x = 83
    div2_x = 166
    draw.line((div1_x, 106, div1_x, 122), fill=WHITE, width=1)
    draw.line((div2_x, 106, div2_x, 122), fill=WHITE, width=1)
    
    # Button labels (centered in each zone)
    labels = [
        ("Status", 41 - 18),    # Center of [0-83]
        ("Actions", 124 - 21),  # Center of [83-166]
        ("Guide", 208 - 15)     # Center of [166-250]
    ]
    
    for label, x in labels:
        draw.text((x, 108), label, font=font_sm, fill=WHITE)
```

---

## 8. Actions Page Layout (Compact, no footer)

```python
def draw_actions(self, draw):
    """
    Buttons arranged in tight grid to fit within 70px content area
    (+1°) (-1°)
    (Mode: heat   )
    (tap to cycle )
    """
    y_start = 24
    
    # Title
    draw.text((8, y_start), "Actions", font=font_md, fill=BLACK)
    
    # Temperature adjustment buttons (side by side)
    btn_y = y_start + 14
    btn_w = 54
    btn_h = 22
    btn_gap = 8
    
    # +1° button
    draw.rectangle((8, btn_y, 8 + btn_w, btn_y + btn_h), outline=BLACK, width=1)
    draw.text((24, btn_y + 6), "+1°", font=font_sm, fill=BLACK)
    
    # -1° button
    draw.rectangle((8 + btn_w + btn_gap, btn_y, 8 + btn_w*2 + btn_gap, btn_y + btn_h), 
                   outline=BLACK, width=1)
    draw.text((8 + btn_w + btn_gap + 16, btn_y + 6), "-1°", font=font_sm, fill=BLACK)
    
    # Mode cycle button (wider, below temp buttons)
    mode_btn_y = btn_y + btn_h + 6
    mode_btn_w = 115
    mode_btn_h = 26
    draw.rectangle((8, mode_btn_y, 8 + mode_btn_w, mode_btn_y + mode_btn_h), 
                   outline=BLACK, width=1)
    draw.text((12, mode_btn_y + 4), f"Mode: {self.data['mode']}", font=font_sm, fill=BLACK)
    draw.text((12, mode_btn_y + 15), "tap to cycle", font=font_xs, fill=BLACK)
```

---

## 9. Pre-Flight Checklist (Friday AM)

- [ ] `sudo raspi-config` → Interface → SPI → Enable
- [ ] Install deps: `pip3 install RPi.GPIO spidev Pillow requests`
- [ ] Clone Waveshare lib: `git clone https://github.com/waveshare/e-Paper.git`
- [ ] Download IBM Plex Mono fonts to `~/joule-hmi/fonts/`
- [ ] Test screen init: `python3 -c "from waveshare_epd import epd2in13_V4; e=epd2in13_V4.EPD(); e.init(); print('OK')"`
- [ ] Verify Bridge is running: `curl http://localhost:3002/api/status`
- [ ] Verify WiFi endpoint: `curl http://localhost:3002/api/wifi/signal`
- [ ] Test outdoor temp: `curl http://localhost:3002/api/weather/current`

---

## 10. Marketing Copy (Etsy Description)

**"Always-On Energy Cost Display for Heat Pumps"**

> Most thermostats hide your energy costs in buried menus. This Pi-powered e-paper display shows your **Weekly Spend** and **Outdoor Temp** 24/7 on a crisp, paper-like screen. No backlight. No glare. Just clean data.

Features:
- 2.13" E-Ink display (updates every 15 min, no flicker)
- Real-time outdoor weather from NWS/OpenMeteo
- WiFi signal strength indicator
- Touchscreen navigation (Status/Actions/Guide)
- Industrial-minimalist design (engineered, not "smart home cute")

Perfect for:
- Heat pump owners obsessed with COP
- Homeowners tracking HVAC costs
- Anyone who wants "financial HVAC data" at a glance

---

**You're 100% right about the "hook":** That footer showing `Out 29° | $6.50/wk` is what makes people stop scrolling. It's the difference between "another IoT gadget" and "a tool that saves me money."
