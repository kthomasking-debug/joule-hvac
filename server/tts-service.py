#!/usr/bin/env python3
"""
Open-Source TTS Service for Ask Joule
Uses Coqui TTS for high-quality, natural-sounding speech synthesis
"""

import os
import sys
import json
import logging
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import base64

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Global TTS model cache
tts_model = None
tts_processor = None

def load_tts_model():
    """Load Coqui TTS model (lazy loading)"""
    global tts_model, tts_processor
    
    if tts_model is not None:
        return tts_model, tts_processor
    
    try:
        from TTS.api import TTS
        
        logger.info("Loading Coqui TTS model...")
        # Use a fast, high-quality model
        # "tts_models/en/ljspeech/tacotron2-DDC" - Fast, good quality
        # "tts_models/en/vctk/vits" - Very natural, multiple voices
        # "tts_models/en/ljspeech/neural_hmm" - Fastest, decent quality
        model_name = os.getenv("TTS_MODEL", "tts_models/en/ljspeech/tacotron2-DDC")
        
        tts = TTS(model_name=model_name, progress_bar=False)
        tts_model = tts
        tts_processor = None  # Coqui TTS handles processing internally
        
        logger.info(f"TTS model loaded: {model_name}")
        return tts_model, tts_processor
        
    except ImportError:
        logger.error("Coqui TTS not installed. Install with: pip install TTS")
        return None, None
    except Exception as e:
        logger.error(f"Failed to load TTS model: {e}")
        return None, None

@app.route("/api/tts/health", methods=["GET"])
def health():
    """Health check endpoint"""
    model, _ = load_tts_model()
    return jsonify({
        "status": "ok" if model is not None else "error",
        "model_loaded": model is not None,
        "service": "coqui-tts"
    })

@app.route("/api/tts/synthesize", methods=["POST"])
def synthesize():
    """Synthesize speech from text"""
    try:
        data = request.get_json()
        text = data.get("text", "")
        speaker_id = data.get("speaker_id", None)  # For multi-speaker models
        language = data.get("language", "en")
        
        if not text:
            return jsonify({"error": "Text is required"}), 400
        
        # Load model if not already loaded
        model, _ = load_tts_model()
        if model is None:
            return jsonify({
                "error": "TTS model not available. Install Coqui TTS: pip install TTS"
            }), 503
        
        logger.info(f"Synthesizing speech for text: {text[:50]}...")
        
        # Generate audio
        # Coqui TTS returns audio as numpy array
        wav = model.tts(text=text, speaker=speaker_id, language=language)
        
        # Convert to WAV bytes
        import numpy as np
        import soundfile as sf
        
        # Ensure audio is in correct format (float32, -1 to 1 range)
        if isinstance(wav, np.ndarray):
            # Normalize if needed
            if wav.dtype != np.float32:
                wav = wav.astype(np.float32)
            if wav.max() > 1.0 or wav.min() < -1.0:
                wav = wav / np.max(np.abs(wav))
        
        # Write to bytes buffer
        buffer = io.BytesIO()
        sf.write(buffer, wav, 22050, format='WAV')  # 22050 Hz sample rate
        buffer.seek(0)
        
        # Convert to base64 for JSON response
        audio_base64 = base64.b64encode(buffer.read()).decode('utf-8')
        
        return jsonify({
            "audio": audio_base64,
            "format": "wav",
            "sample_rate": 22050,
            "text": text
        })
        
    except Exception as e:
        logger.error(f"TTS synthesis error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route("/api/tts/voices", methods=["GET"])
def get_voices():
    """Get available voices/speakers"""
    try:
        model, _ = load_tts_model()
        if model is None:
            return jsonify({"voices": []}), 200
        
        # Try to get speaker IDs if model supports it
        voices = []
        try:
            # Some models have speaker_manager with speaker IDs
            if hasattr(model, 'speaker_manager') and model.speaker_manager:
                speaker_ids = model.speaker_manager.speaker_ids
                voices = [{"id": sid, "name": f"Speaker {sid}"} for sid in speaker_ids]
        except:
            pass
        
        # If no speakers, return default
        if not voices:
            voices = [{"id": None, "name": "Default"}]
        
        return jsonify({"voices": voices})
        
    except Exception as e:
        logger.error(f"Error getting voices: {e}")
        return jsonify({"voices": []}), 200

if __name__ == "__main__":
    port = int(os.getenv("TTS_SERVICE_PORT", "3003"))
    host = os.getenv("TTS_SERVICE_HOST", "0.0.0.0")
    
    logger.info(f"Starting TTS service on {host}:{port}")
    logger.info("Install Coqui TTS with: pip install TTS")
    logger.info(f"Service will be accessible at: http://{host}:{port}/api/tts")
    logger.info("Make sure temperature-server.js is configured to proxy to this service")
    
    app.run(host=host, port=port, debug=False)

