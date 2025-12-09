# Raspberry Pi 5 Setup for Joule Local RAG

Complete setup guide for running Joule's Ask Joule feature locally on Raspberry Pi 5 with Ollama + Llama 3.2 3B.

## Quick Start

1. **Flash Raspberry Pi OS** (64-bit) to your Pi 5 16GB
2. **Run the setup script:**
   ```bash
   chmod +x install.sh
   ./install.sh
   ```
3. **Copy the bridge server:**
   ```bash
   cp -r ../pi-bridge ~/joule-bridge
   cd ~/joule-bridge
   npm install
   ```
4. **Start the service:**
   ```bash
   sudo systemctl start joule-bridge
   ```
5. **Enable in Joule app:** Settings → Advanced → Use Local LLM

## Optional: Performance Optimization

For better performance (17-21 tokens/second instead of 13-16):

```bash
chmod +x optimize-pi.sh
./optimize-pi.sh
sudo reboot
```

**⚠️ Requires adequate cooling (heatsink + fan)**

## Hardware Requirements

- Raspberry Pi 5 16GB RAM ($132)
- Heatsink + fan case ($25-35)
- 128-256GB NVMe SSD (optional, $20-30)
- 27W USB-C PD power supply ($10)

**Total: ~$187-197**

## Performance

| Configuration | Tokens/sec | First Token | 100 Token Response |
|--------------|------------|-------------|-------------------|
| Stock 2.4 GHz | 13-16 | 180-250ms | 1.3-1.8s |
| OC 2.8 GHz | 17-21 | 140-180ms | 0.9-1.3s |

## Troubleshooting

**Ollama not working:**
```bash
ollama serve  # Start manually
ollama run llama3.2:3b "test"
```

**Bridge service not starting:**
```bash
sudo journalctl -u joule-bridge -f
```

**Check temperature:**
```bash
vcgencmd measure_temp
```

**Test connection from web app:**
```bash
curl http://raspberrypi.local:3002/health
```

## Next Steps

1. Add HVAC documentation to `~/joule-bridge/docs/` for better RAG
2. Configure your Pi's hostname if needed
3. Set up static IP if using IP instead of hostname





