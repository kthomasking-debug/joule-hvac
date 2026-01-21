#!/usr/bin/env python3
from flask import Flask, request, jsonify
from datetime import datetime
import os

app = Flask(__name__)

state = {
    'mode': 'off',
    'temp': 72.0,
    'humidity': 45,
    'setpoint': 72.0,
    'profile': {
        # Example defaults; will be overwritten by POST /profile
        'electric_rate_cents_kwh': 15.0,
        'gas_rate_per_therm': 1.50,
        'weekly_kwh': 0.0,
        'weekly_therms': 0.0,
        'notes': 'User-supplied profile',
    }
}

@app.get('/status')
def status():
    return jsonify({
        'mode': state['mode'],
        'temp': state['temp'],
        'humidity': state['humidity'],
        'setpoint': state['setpoint'],
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    })

@app.post('/mode')
def set_mode():
    data = request.get_json(silent=True) or {}
    mode = data.get('mode')
    if mode not in ('heat','cool','off'):
        return jsonify({'ok': False, 'error': 'invalid mode'}), 400
    state['mode'] = mode
    return jsonify({'ok': True, 'mode': state['mode']})

@app.post('/setpoint')
def setpoint():
    data = request.get_json(silent=True) or {}
    try:
        delta = float(data.get('delta', 0))
    except Exception:
        return jsonify({'ok': False, 'error': 'invalid delta'}), 400
    state['setpoint'] = round(state['setpoint'] + delta, 1)
    # Simulate temperature drifting toward setpoint
    drift = (state['setpoint'] - state['temp']) * 0.1
    state['temp'] = round(state['temp'] + drift, 1)
    return jsonify({'ok': True, 'setpoint': state['setpoint'], 'temp': state['temp']})

# --- Home profile endpoints ---
@app.get('/profile')
def get_profile():
    return jsonify({'ok': True, 'profile': state.get('profile', {})})

@app.post('/profile')
def set_profile():
    data = request.get_json(silent=True) or {}
    # Basic validation and normalization
    prof = state.get('profile', {})
    for key in (
        'electric_rate_cents_kwh', 'gas_rate_per_therm', 'weekly_kwh', 'weekly_therms', 'notes'
    ):
        if key in data:
            prof[key] = data[key]
    state['profile'] = prof
    return jsonify({'ok': True, 'profile': prof})

@app.post('/cost-weekly')
def cost_weekly():
    """
    Compute weekly cost using either provided usage or stored profile.
    Request body can override fields: { weekly_kwh, weekly_therms, electric_rate_cents_kwh, gas_rate_per_therm }
    Returns: { ok, electric_cost_usd, gas_cost_usd, total_usd }
    """
    data = request.get_json(silent=True) or {}
    prof = state.get('profile', {})
    wkwh = float(data.get('weekly_kwh', prof.get('weekly_kwh', 0.0) or 0.0))
    wtherms = float(data.get('weekly_therms', prof.get('weekly_therms', 0.0) or 0.0))
    cents = float(data.get('electric_rate_cents_kwh', prof.get('electric_rate_cents_kwh', 0.0) or 0.0))
    grate = float(data.get('gas_rate_per_therm', prof.get('gas_rate_per_therm', 0.0) or 0.0))
    # Compute
    electric_cost_usd = round((wkwh * cents) / 100.0, 2)
    gas_cost_usd = round(wtherms * grate, 2)
    total_usd = round(electric_cost_usd + gas_cost_usd, 2)
    return jsonify({
        'ok': True,
        'electric_cost_usd': electric_cost_usd,
        'gas_cost_usd': gas_cost_usd,
        'total_usd': total_usd,
        'inputs': {
            'weekly_kwh': wkwh,
            'weekly_therms': wtherms,
            'electric_rate_cents_kwh': cents,
            'gas_rate_per_therm': grate,
        }
    })

if __name__ == '__main__':
    port = int(os.environ.get('MOCK_PORT', '8080'))
    app.run(host='0.0.0.0', port=port)
