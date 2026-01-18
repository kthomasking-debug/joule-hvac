#!/usr/bin/env python3
import json
import os
import time

try:
    from evdev import InputDevice, categorize, ecodes
except Exception as e:
    print('[ERROR] evdev not available:', e)
    print('Install with: pip3 install evdev')
    raise SystemExit(1)

CFG_PATH = os.environ.get('HMI_TOUCH_CFG', os.path.join(os.path.dirname(__file__), 'touch_config.json'))

# Find a likely touch device

def find_touch():
    import glob
    for path in glob.glob('/dev/input/event*'):
        try:
            dev = InputDevice(path)
            name = dev.name.lower()
            if any(k in name for k in ['goodix', 'ft', 'touch', 'capacitive']):
                print(f'[INFO] Using touch device: {path} ({dev.name})')
                return dev
        except Exception:
            pass
    print('[WARN] No known touch device found, defaulting to first event device')
    for path in glob.glob('/dev/input/event*'):
        try:
            dev = InputDevice(path)
            print(f'[INFO] Using device: {path} ({dev.name})')
            return dev
        except Exception:
            pass
    return None


def calibrate(dev):
    print('\nTouch Calibration Helper')
    print('Instructions: Tap the screen corners when prompted.\n')
    # Collect samples for four corners
    samples = {
        'top_left': [],
        'top_right': [],
        'bottom_right': [],
        'bottom_left': [],
    }

    def collect(label):
        print(f'>> Tap {label.replace("_", " ").title()} (tap and release)')
        x = y = None
        # Wait for a single tap release
        for event in dev.read_loop():
            if event.type == ecodes.EV_ABS:
                if event.code in (getattr(ecodes, 'ABS_X', 0), getattr(ecodes, 'ABS_MT_POSITION_X', -1)):
                    x = event.value
                elif event.code in (getattr(ecodes, 'ABS_Y', 0), getattr(ecodes, 'ABS_MT_POSITION_Y', -1)):
                    y = event.value
            elif event.type == ecodes.EV_KEY and event.code == ecodes.BTN_TOUCH and event.value == 0:
                if x is not None and y is not None:
                    samples[label].append((x, y))
                    print(f'  captured: x={x} y={y}')
                    return

    for lbl in ('top_left', 'top_right', 'bottom_right', 'bottom_left'):
        collect(lbl)
        time.sleep(0.2)

    # Derive min/max from samples
    xs = [p[0] for pts in samples.values() for p in pts]
    ys = [p[1] for pts in samples.values() for p in pts]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)

    # Guess axis orientation and inversion by comparing corners
    tl = samples['top_left'][0]
    br = samples['bottom_right'][0]
    # If top-left has larger x than bottom-right, x is inverted
    invert_x = tl[0] > br[0]
    invert_y = tl[1] > br[1]
    swap_xy = False  # set manually after test if needed

    cfg = {
        'min_x': int(min_x), 'max_x': int(max_x),
        'min_y': int(min_y), 'max_y': int(max_y),
        'swap_xy': bool(swap_xy),
        'invert_x': bool(invert_x),
        'invert_y': bool(invert_y),
    }

    os.makedirs(os.path.dirname(CFG_PATH), exist_ok=True)
    with open(CFG_PATH, 'w') as f:
        json.dump(cfg, f, indent=2)
    print('\n[OK] Saved calibration to:', CFG_PATH)
    print(json.dumps(cfg, indent=2))

    print('\nTip: If axes look swapped, set swap_xy=true in the config file.')


if __name__ == '__main__':
    dev = find_touch()
    if not dev:
        print('[ERROR] No input device found.')
        raise SystemExit(1)
    calibrate(dev)
