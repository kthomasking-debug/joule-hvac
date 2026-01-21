#!/usr/bin/env python3
import os
import time
import threading
from dataclasses import dataclass
from typing import Optional, Tuple
import json

import requests
from PIL import Image, ImageDraw, ImageFont

# Try to import Waveshare EPD driver (adjust this to your module/version)
# Expecting you cloned https://github.com/waveshare/e-Paper
# and the Python lib is on PYTHONPATH (or add dynamically below).
try:
    import sys
    sys.path.append(os.path.expanduser('~/git/e-Paper/RaspberryPi_JetsonNano/python/lib'))
    from waveshare_epd import epd2in13_V3 as epdmod
except Exception as e:
    epdmod = None
    print("[WARN] Waveshare EPD driver not available:", e)

# Touch support via evdev (capacitive controllers typically appear as input devices)
try:
    from evdev import InputDevice, categorize, ecodes
except Exception as e:
    InputDevice = None
    print("[WARN] evdev not available:", e)

# --- Config ---
API_BASE = os.environ.get('HMI_API_BASE', 'http://127.0.0.1:8080')
POLL_SECS = int(os.environ.get('HMI_POLL_SECS', '15'))
USE_PARTIAL = os.environ.get('HMI_PARTIAL', '1') == '1'
TOUCH_CFG_PATH = os.environ.get('HMI_TOUCH_CFG', os.path.join(os.path.dirname(__file__), 'touch_config.json'))

# E-Ink resolution (2.13" typical variants)
SCREEN_W, SCREEN_H = 250, 122  # adjust to your panel (e.g., 212x104 or 250x122)

# Fonts
FONT_SMALL = ImageFont.load_default()
FONT_MED = ImageFont.load_default()
FONT_BIG = ImageFont.load_default()

@dataclass
class Status:
    mode: str = 'off'      # 'heat'|'cool'|'off'
    temp: float = 0.0
    humidity: int = 0
    last_ok: bool = False

class EInkHMI:
    def __init__(self):
        self.status = Status()
        self.current_page = 'status'  # 'status'|'actions'|'guide'
        self.touch_x = None
        self.touch_y = None
        self.touch_device = self._find_touch_device()
        self.stop = False
        self.epd = self._init_epd()
        self.partial_available = False
        self.partial_enabled = False
        self.touch_cfg = self._load_touch_cfg()
        self.canvas = Image.new('1', (SCREEN_W, SCREEN_H), 255)
        self.draw = ImageDraw.Draw(self.canvas)

    def _init_epd(self):
        if epdmod is None:
            print('[ERROR] No EPD driver, drawing to memory only.')
            return None
        epd = epdmod.EPD()
        # Initial full update
        try:
            epd.init()
        except Exception:
            pass
        epd.Clear()
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

    def _load_touch_cfg(self):
        try:
            if os.path.exists(TOUCH_CFG_PATH):
                with open(TOUCH_CFG_PATH, 'r') as f:
                    cfg = json.load(f)
                    # Expected keys: min_x, max_x, min_y, max_y, swap_xy, invert_x, invert_y
                    return cfg
        except Exception as e:
            print('[WARN] Failed to load touch config:', e)
        return {
            'min_x': 0, 'max_x': 4095,
            'min_y': 0, 'max_y': 4095,
            'swap_xy': False,
            'invert_x': False,
            'invert_y': False,
        }

    def _find_touch_device(self) -> Optional[InputDevice]:
        if InputDevice is None:
            return None
        try:
            import glob
            for path in glob.glob('/dev/input/event*'):
                dev = InputDevice(path)
                name = dev.name.lower()
                if any(k in name for k in ['goodix', 'ft6236', 'touch', 'capacitive']):
                    print(f'[INFO] Using touch device: {path} ({dev.name})')
                    return dev
            print('[WARN] No known touch device found; UI will be button-only.')
        except Exception as e:
            print('[WARN] Touch init failed:', e)
        return None

    def run(self):
        threading.Thread(target=self._poll_status_loop, daemon=True).start()
        if self.touch_device:
            threading.Thread(target=self._touch_loop, daemon=True).start()
        try:
            while not self.stop:
                self.render()
                self._display()
                time.sleep(0.2)
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
        while not self.stop:
            try:
                r = requests.get(f'{API_BASE}/status', timeout=5)
                if r.ok:
                    data = r.json()
                    self.status.mode = data.get('mode', 'off')
                    self.status.temp = float(data.get('temp', 0))
                    self.status.humidity = int(data.get('humidity', 0))
                    self.status.last_ok = True
                else:
                    self.status.last_ok = False
            except Exception:
                self.status.last_ok = False
            time.sleep(POLL_SECS)

    # --- Touch ---
    def _touch_loop(self):
        dev = self.touch_device
        if not dev:
            return
        x = y = None
        for event in dev.read_loop():
            if event.type == ecodes.EV_ABS:
                # Handle both single-touch and multi-touch controllers
                if event.code in (getattr(ecodes, 'ABS_X', 0), getattr(ecodes, 'ABS_MT_POSITION_X', -1)):
                    x = event.value
                elif event.code in (getattr(ecodes, 'ABS_Y', 0), getattr(ecodes, 'ABS_MT_POSITION_Y', -1)):
                    y = event.value
            elif event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 0:
                if x is not None and y is not None:
                    # Map raw touch to screen coords; you may need to calibrate
                    sx, sy = self._map_touch(x, y)
                    self.touch_x, self.touch_y = sx, sy
                    self._handle_touch(sx, sy)
                    x = y = None

    def _map_touch(self, raw_x, raw_y) -> Tuple[int, int]:
        cfg = self.touch_cfg
        rx, ry = raw_x, raw_y
        # Optional axis swap
        if cfg.get('swap_xy'):
            rx, ry = ry, rx
        # Normalize to 0..1 with calibration min/max
        min_x, max_x = cfg.get('min_x', 0), cfg.get('max_x', 4095)
        min_y, max_y = cfg.get('min_y', 0), cfg.get('max_y', 4095)
        nx = (rx - min_x) / max(1, (max_x - min_x))
        ny = (ry - min_y) / max(1, (max_y - min_y))
        # Optional inversion
        if cfg.get('invert_x'):
            nx = 1.0 - nx
        if cfg.get('invert_y'):
            ny = 1.0 - ny
        sx = int(nx * SCREEN_W)
        sy = int(ny * SCREEN_H)
        return max(0, min(SCREEN_W - 1, sx)), max(0, min(SCREEN_H - 1, sy))

    def _handle_touch(self, x, y):
        # Bottom nav buttons
        if y > SCREEN_H - 24:
            if x < SCREEN_W // 3:
                self.current_page = 'status'
            elif x < 2 * SCREEN_W // 3:
                self.current_page = 'actions'
            else:
                self.current_page = 'guide'
            return
        # Page-specific hit tests
        if self.current_page == 'actions':
            # Up/Down areas
            if 10 <= x <= 60 and 30 <= y <= 60:
                self._send_setpoint(+1)
            elif 70 <= x <= 120 and 30 <= y <= 60:
                self._send_setpoint(-1)
            # Mode toggle
            elif 140 <= x <= 230 and 30 <= y <= 60:
                next_mode = {'off':'heat','heat':'cool','cool':'off'}.get(self.status.mode, 'off')
                self._send_mode(next_mode)

    def _send_mode(self, mode:str):
        try:
            requests.post(f'{API_BASE}/mode', json={'mode':mode}, timeout=5)
        except Exception:
            pass

    def _send_setpoint(self, delta:int):
        try:
            requests.post(f'{API_BASE}/setpoint', json={'delta':delta}, timeout=5)
        except Exception:
            pass

    # --- Render ---
    def render(self):
        self.draw.rectangle((0,0,SCREEN_W,SCREEN_H), fill=255)
        # Header
        hdr = f"{self.status.mode.upper()}  {self.status.temp:.0f}°  {self.status.humidity}%"
        conn = "OK" if self.status.last_ok else "ERR"
        self.draw.rectangle((0,0,SCREEN_W,16), fill=0)
        self.draw.text((4,2), hdr, font=FONT_SMALL, fill=255)
        self.draw.text((SCREEN_W-26,2), conn, font=FONT_SMALL, fill=255)
        # Page content
        if self.current_page == 'status':
            self._render_status()
        elif self.current_page == 'actions':
            self._render_actions()
        else:
            self._render_guide()
        # Bottom nav
        self._render_nav()

    def _render_status(self):
        self.draw.text((10,30), 'Status', font=FONT_MED, fill=0)
        self.draw.text((10,50), f"Mode: {self.status.mode}", font=FONT_SMALL, fill=0)
        self.draw.text((10,64), f"Temp: {self.status.temp:.1f}°", font=FONT_SMALL, fill=0)
        self.draw.text((10,78), f"Hum: {self.status.humidity}%", font=FONT_SMALL, fill=0)

    def _render_actions(self):
        self.draw.text((10,22), 'Actions', font=FONT_MED, fill=0)
        # Setpoint buttons
        self.draw.rectangle((10,30,60,60), outline=0)
        self.draw.text((20,40), '+1°', font=FONT_SMALL, fill=0)
        self.draw.rectangle((70,30,120,60), outline=0)
        self.draw.text((80,40), '-1°', font=FONT_SMALL, fill=0)
        # Mode cycle button
        self.draw.rectangle((140,30,230,60), outline=0)
        self.draw.text((150,40), f"Mode: {self.status.mode}", font=FONT_SMALL, fill=0)
        self.draw.text((150,54), 'tap to cycle', font=FONT_SMALL, fill=0)

    def _render_guide(self):
        self.draw.text((10,22), 'Guide', font=FONT_MED, fill=0)
        self.draw.text((10,40), 'Small-screen tips:', font=FONT_SMALL, fill=0)
        self.draw.text((10,54), '- Use app for visuals', font=FONT_SMALL, fill=0)
        self.draw.text((10,66), '- Press Actions below', font=FONT_SMALL, fill=0)

    def _render_nav(self):
        y = SCREEN_H - 24
        self.draw.rectangle((0,y,SCREEN_W,SCREEN_H), fill=0)
        labels = ['Status','Actions','Guide']
        for i, lab in enumerate(labels):
            x0 = i * SCREEN_W // 3
            self.draw.text((x0+6, y+4), lab, font=FONT_SMALL, fill=255)

    def _display(self):
        if not self.epd:
            return
        try:
            bw = self.canvas.convert('1')
            buf = self.epd.getbuffer(bw)
            # Use partial update if enabled and available
            if self.partial_enabled and self.partial_available:
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
