#!/usr/bin/env python3
from flask import Flask, request, jsonify
from datetime import datetime

app = Flask(__name__)

state = {
    'mode': 'off',
    'temp': 72.0,
    'humidity': 45,
    'setpoint': 72.0,
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
