# Joule Local RAG Bridge

Local API bridge for Joule HVAC assistant running on Raspberry Pi 5 with Ollama + Llama 3.2 3B.

## Features

- 🚀 **Fast**: 13-21 tokens/second on Pi 5
- 🔒 **Private**: All data stays local, no cloud API calls
- 📚 **RAG**: Simple document search for context
- 🔌 **Compatible**: Drop-in replacement for Groq API

## Setup

1. Run the Pi setup script:
   ```bash
   chmod +x ../pi-setup/install.sh
   ../pi-setup/install.sh
   ```

2. Copy this directory to your Pi:
   ```bash
   scp -r pi-bridge pi@raspberrypi.local:~/joule-bridge
   ```

3. Install dependencies:
   ```bash
   cd ~/joule-bridge
   npm install
   ```

4. Start the service:
   ```bash
   sudo systemctl start joule-bridge
   ```

## Configuration

Set environment variables in `/etc/systemd/system/joule-bridge.service`:

- `PORT`: Server port (default: 3002)
- `OLLAMA_HOST`: Ollama API URL (default: http://localhost:11434)
- `MODEL`: Ollama model to use (default: llama3.2:3b)

## API Endpoints

### Health Check
```
GET /health
```

### Ask Joule
```
POST /api/ask-joule
Content-Type: application/json

{
  "query": "What's my balance point?",
  "context": {
    "userSettings": { ... },
    "userLocation": { ... }
  }
}
```

### Ingest Documents
```
POST /api/ingest
Content-Type: application/json

{
  "filename": "ashrae-standards.txt",
  "content": "..."
}
```

## Adding Documents

Place `.txt` or `.md` files in the `docs/` directory, or use the `/api/ingest` endpoint.

## Performance

On Raspberry Pi 5 16GB:
- Q4_K_M quantization: 13-16 tokens/second
- With overclock (2.8 GHz): 17-21 tokens/second
- First token latency: 140-250ms
- Full response (100 tokens): 0.9-1.8 seconds

## Troubleshooting

Check logs:
```bash
sudo journalctl -u joule-bridge -f
```

Test Ollama:
```bash
ollama run llama3.2:3b "Hello"
```

Check temperature:
```bash
check-pi-temp
```





