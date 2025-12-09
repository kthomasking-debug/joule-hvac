# Raspberry Pi Zero 2 W Setup for Joule Groq-Powered RAG

**The "Apple Way"**: Lightweight local orchestration + Groq's cloud inference = Best of both worlds.

## Why This Approach?

- **$52 total** vs $187 for Pi 5
- **1-2W power** vs 6-8W for Pi 5
- **500+ tokens/sec** via Groq (vs 13-16 local)
- **Sub-200ms latency** end-to-end
- **Wallet-sized** portable RAG agent

## Hardware Shopping List

| Item | Price | Notes |
|------|-------|-------|
| Raspberry Pi Zero 2 W | $26.99 | Quad-core @1GHz, WiFi/BT built-in |
| Flirc Raspberry Pi Zero Case | $14.95 | Passive cooling, no fan noise |
| 2-Pack 16GB microSD | $9.99 | Boot drive + backup |
| **Total** | **$51.93** | Under a nice dinner! |

## Quick Setup (15 minutes)

### 1. Flash & Boot

```bash
# Flash Raspberry Pi OS Lite (64-bit) to microSD
# Add ssh file and wpa_supplicant.conf to boot partition
# Insert microSD, power up with 5V/1A USB
```

### 2. SSH In

```bash
ssh pi@raspberrypi.local
# Default password: raspberry
```

### 3. Run Setup Script

```bash
cd pi-zero-setup
chmod +x install.sh
./install.sh
```

### 4. Configure Groq API Key

```bash
# Get free key from https://console.groq.com/
export GROQ_API_KEY=your_key_here
echo 'export GROQ_API_KEY=your_key_here' >> ~/.bashrc

# Update systemd service
sudo nano /etc/systemd/system/joule-bridge.service
# Add: Environment="GROQ_API_KEY=your_key_here"
```

### 5. Copy Bridge Files

```bash
cp -r ../pi-zero-bridge ~/joule-bridge
cd ~/joule-bridge
npm install
```

### 6. Add Documents

```bash
# Place your PDFs/text files in docs/
cp ~/your-docs/*.txt ~/joule-bridge/docs/

# Ingest into vector database
source ~/joule-rag-env/bin/activate
python rag_groq.py ingest
```

### 7. Start Service

```bash
sudo systemctl start joule-bridge
sudo systemctl status joule-bridge
```

## Performance

- **Embedding**: 10-20 docs/sec (local, lightweight)
- **Query latency**: 100-300ms end-to-end (WiFi + Groq)
- **Inference speed**: 500+ tokens/sec (Groq LPU)
- **Power**: 1-2W (perfect for always-on)

## Groq API Limits

- **Free tier**: 14,000 tokens/minute
- **Dev tier**: $0.27/M input tokens (unlimited)
- **Perfect for**: Hobby RAG, personal use

## Architecture

```
User Query
    ↓
Pi Zero 2 W (Lightweight)
    ├─ Embed query (local, ~50MB RAM)
    ├─ Retrieve top-3 chunks (local, ChromaDB)
    └─ Send to Groq API (cloud, 500+ t/s)
    ↓
Response (<200ms)
```

## Troubleshooting

**Out of memory:**
- Reduce chunk size in `rag_groq.py` (CHUNK_SIZE = 300)
- Batch ingest smaller document sets

**Groq API errors:**
- Check API key: `echo $GROQ_API_KEY`
- Check rate limits: https://console.groq.com/
- Fall back to smaller model: `llama-3.2-1b-versatile`

**Connection issues:**
- Test Groq: `curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer $GROQ_API_KEY"`
- Check bridge: `curl http://localhost:3002/health`

## Comparison: Pi Zero vs Pi 5

| Feature | Pi Zero 2 W + Groq | Pi 5 + Local |
|---------|-------------------|--------------|
| Cost | $52 | $187 |
| Power | 1-2W | 6-8W |
| Speed | 500+ t/s | 13-16 t/s |
| Latency | 100-300ms | 900-1800ms |
| Privacy | Query only | Complete |
| Internet | Required | Optional |

**Verdict**: Pi Zero + Groq for speed/cost, Pi 5 for complete privacy.

## Next Steps

1. Add HVAC documentation to `docs/`
2. Monitor Groq usage: https://console.groq.com/
3. Fine-tune chunk size for your documents
4. Set up automatic document sync if needed

## Enable in Joule App

1. Settings → Advanced → Use Local LLM
2. Set URL: `http://raspberrypi.local:3002`
3. Test connection
4. Start querying!





