# Running LLM Locally on Raspberry Pi (Instead of Groq API)

## Why Run LLM on Raspberry Pi?

### The Problem with Cloud APIs (Groq, OpenAI, etc.)

1. **Vendor Lock-In**
   - Dependence on external services
   - API keys can be revoked or rate-limited
   - Costs can increase unexpectedly
   - Privacy concerns (queries sent to third parties)

2. **The "Sovereign" Principle**
   - Your thermostat should work even if the internet is down
   - No external dependencies for core functionality
   - Complete control over your data and queries

3. **Cost at Scale**
   - Free tiers are limited (Groq: 30 requests/minute)
   - If you sell 100 thermostats, you need 100 API keys or pay enterprise fees
   - Local LLM: One-time setup, unlimited queries

## Architecture Overview

```
┌─────────────────┐
│  React Frontend │
│  (Tablet)       │
│                 │
│  Ask Joule      │
└────────┬────────┘
         │
         │ HTTP POST /api/llm/query
         │
         ▼
┌─────────────────┐
│  Raspberry Pi   │
│  (Python)       │
│                 │
│  Ollama /       │ ◄── Free, open-source LLM
│  llama.cpp      │     Runs entirely locally
│  Service        │
└─────────────────┘
```

## Recommended Solutions

### Option 1: Ollama (Recommended)

**Why Ollama?**
- Easy installation: `curl -fsSL https://ollama.ai/install.sh | sh`
- Pre-built models optimized for ARM (Raspberry Pi)
- Simple REST API compatible with existing code
- Active community and regular updates

**Supported Models for Pi 4/5:**
- `llama3.2:1b` - Fastest, good for simple queries (1GB RAM)
- `llama3.2:3b` - Better quality, still fast (3GB RAM)
- `phi3:mini` - Microsoft's efficient model (2GB RAM)
- `tinyllama` - Ultra-lightweight (500MB RAM)

**Installation:**
```bash
# On Raspberry Pi
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.2:1b

# Test it
ollama run llama3.2:1b "What is a heat pump?"
```

**API Integration:**
```python
# prostat-bridge/llm_service.py
import requests
import json

def query_ollama(prompt, model="llama3.2:1b"):
    response = requests.post(
        "http://localhost:11434/api/generate",
        json={
            "model": model,
            "prompt": prompt,
            "stream": False
        }
    )
    return response.json()["response"]
```

### Option 2: llama.cpp (Advanced)

**Why llama.cpp?**
- Most efficient C++ implementation
- Best performance on limited hardware
- Can run models that don't fit in RAM (via memory mapping)
- More control over inference parameters

**Installation:**
```bash
# Build from source (takes ~30 minutes on Pi 4)
git clone https://github.com/ggerganov/llama.cpp
cd llama.cpp
make -j4

# Download a quantized model
# Use GGUF format models (smaller, faster)
```

**API Integration:**
- Use `llama.cpp`'s server mode or wrap it in Python
- More complex setup but maximum efficiency

## Implementation Plan

### Step 1: Install Ollama on Raspberry Pi

```bash
# SSH into your Pi
ssh pi@raspberrypi.local

# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Verify installation
ollama --version

# Pull a lightweight model
ollama pull llama3.2:1b
```

### Step 2: Add LLM Endpoint to ProStat Bridge

```python
# prostat-bridge/app.py (add to existing Flask app)

import requests
from flask import request, jsonify

@app.route('/api/llm/query', methods=['POST'])
def llm_query():
    """Query local LLM via Ollama"""
    data = request.json
    prompt = data.get('prompt', '')
    model = data.get('model', 'llama3.2:1b')
    
    try:
        response = requests.post(
            'http://localhost:11434/api/generate',
            json={
                'model': model,
                'prompt': prompt,
                'stream': False,
                'options': {
                    'temperature': 0.7,
                    'top_p': 0.9,
                }
            },
            timeout=30
        )
        response.raise_for_status()
        result = response.json()
        return jsonify({
            'success': True,
            'message': result.get('response', ''),
            'model': model
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
```

### Step 3: Update React Frontend

```javascript
// src/lib/groqAgent.js (add fallback to local LLM)

async function queryLocalLLM(prompt, userSettings, userLocation) {
  const bridgeUrl = getBridgeUrl(); // From prostatBridgeApi.js
  
  try {
    const response = await fetch(`${bridgeUrl}/api/llm/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: buildPrompt(prompt, userSettings, userLocation),
        model: localStorage.getItem('localLLMModel') || 'llama3.2:1b'
      })
    });
    
    const data = await response.json();
    if (data.success) {
      return {
        success: true,
        message: data.message,
        source: 'local-llm'
      };
    }
    throw new Error(data.error || 'Local LLM request failed');
  } catch (error) {
    console.error('[Local LLM] Error:', error);
    throw error;
  }
}

// Update answerWithAgent to try local LLM first, fallback to Groq
export async function answerWithAgent(input, groqApiKey, ...) {
  // Check if local LLM is enabled
  const useLocalLLM = localStorage.getItem('useLocalLLM') === 'true';
  
  if (useLocalLLM) {
    try {
      return await queryLocalLLM(input, userSettings, userLocation);
    } catch (error) {
      console.warn('[Local LLM] Failed, falling back to Groq:', error);
      // Fall through to Groq
    }
  }
  
  // Existing Groq code...
}
```

### Step 4: Add Settings UI

Add toggle in Settings page to:
- Enable/disable local LLM
- Select model (llama3.2:1b, llama3.2:3b, etc.)
- Test connection to Pi
- Fallback to Groq if local LLM unavailable

## Performance Considerations

### Model Selection Guide

| Model | RAM Required | Speed | Quality | Best For |
|-------|--------------|-------|---------|----------|
| `tinyllama` | 500MB | Very Fast | Basic | Simple commands only |
| `llama3.2:1b` | 1GB | Fast | Good | Most use cases |
| `llama3.2:3b` | 3GB | Medium | Better | Complex queries |
| `phi3:mini` | 2GB | Fast | Good | Balanced choice |

### Raspberry Pi Requirements

- **Pi 4 (4GB)**: Can run `llama3.2:1b` comfortably
- **Pi 4 (8GB)**: Can run `llama3.2:3b` or `phi3:mini`
- **Pi 5 (8GB)**: Can run larger models, faster inference

### Optimization Tips

1. **Use Quantized Models**: GGUF format reduces model size by 50-75%
2. **Limit Context**: Keep conversation history short (last 3-5 exchanges)
3. **Cache Responses**: Cache common queries locally
4. **Stream Responses**: Show partial results as they generate

## Migration Checklist

- [ ] Install Ollama on Raspberry Pi
- [ ] Test model inference speed and quality
- [ ] Add `/api/llm/query` endpoint to ProStat Bridge
- [ ] Update `groqAgent.js` to support local LLM fallback
- [ ] Add settings toggle in React frontend
- [ ] Test end-to-end: Ask Joule → Pi → Ollama → Response
- [ ] Add connection status indicator
- [ ] Document model selection for users
- [ ] Update error handling for offline scenarios

## Fallback Strategy

**Priority Order:**
1. **Local LLM (Ollama)** - If enabled and Pi is reachable
2. **Groq API** - If local LLM fails or is disabled
3. **Built-in Parser** - If both fail (limited functionality)

This ensures the system always works, even if:
- Internet is down (local LLM works)
- Pi is offline (Groq works)
- Both are unavailable (basic parsing works)

## Key Principle

> **Your thermostat should work in a bunker with no internet.**

Running the LLM locally on the Pi ensures:
- ✅ No external dependencies
- ✅ No API key management
- ✅ No rate limits
- ✅ Complete privacy
- ✅ Works offline
- ✅ Unlimited queries

---

*This document explains how to replace cloud-based LLM APIs (Groq) with a local LLM running on your Raspberry Pi for complete sovereignty and offline operation.*

