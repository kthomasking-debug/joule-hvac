# Joule Deployment Strategy

## Dual Deployment Approach

Joule uses a **dual deployment strategy** to maximize both marketing reach and user sovereignty:

### 1. Netlify: Public Marketing Site (`joule.app`)

**Purpose:** Marketing, sales, public documentation

**What goes here:**
- Landing page
- Product information
- Documentation (public guides)
- Free tier (CSV analyzer)

**Why Netlify:**
- Public internet access
- Fast CDN globally
- Free SSL/HTTPS
- Easy deployment
- SEO-friendly

**Deployment:**
```bash
npm run build:netlify
# Then deploy to Netlify (via Netlify CLI or Git integration)
```

### 2. Raspberry Pi: Self-Hosted Dashboard (`joule.local`)

**Purpose:** Actual control dashboard, private operation

**What goes here:**
- Full dashboard application
- Thermostat control interface
- Real-time monitoring
- All Bridge features

**Why Self-Host:**
- ⚡ **Instant Speed**: Local LAN, no CDN round-trips
- 🔒 **Complete Privacy**: No cloud logs, no tracking
- 🛡️ **Offline Operation**: Works even if internet is down
- 🎯 **Clean Architecture**: Frontend and backend on same network (no mixed content)
- 💪 **Sovereign**: Aligns with "No Cloud" brand

**Deployment:**
```bash
npm run deploy:pi
# Or manually: npm run build:pi && scp -r dist/* pi@joule.local:/var/www/joule/
```

## Architecture Comparison

### Cloud-Hosted (Netlify) + Bridge API
```
Browser → Netlify (HTTPS) → Bridge API (HTTP) ❌ Mixed Content Issues
```

### Self-Hosted (Pi) + Bridge API
```
Browser → Nginx (HTTP) → Bridge API (HTTP) ✅ Same Network, No Issues
```

## When to Use Each

### Use Netlify When:
- Building marketing presence
- Need public internet access
- Want SEO for landing page
- Free tier users (CSV analyzer)

### Use Pi When:
- Bridge tier customers
- Want complete privacy
- Need offline operation
- Want fastest possible performance

## Setup Instructions

### Netlify Setup
See: `DEPLOY_NETLIFY.md`

### Pi Self-Hosting Setup
See: `docs/SELF-HOSTING-NGINX.md`

## Quick Deploy Commands

```bash
# Deploy to Netlify (marketing site)
npm run build:netlify
# Then push to Netlify via CLI or Git

# Deploy to Pi (dashboard)
npm run deploy:pi

# Deploy to both
npm run build:netlify && npm run deploy:pi
```

## Remote Access

### For Netlify Site
- Already public: `https://joule.app`
- No setup needed

### For Pi Dashboard
- **Local only by default**: `http://joule.local` (same network)
- **Remote access options**:
  - Tailscale VPN (recommended)
  - Cloudflare Tunnel
  - Port forwarding (not recommended)

See `docs/SELF-HOSTING-NGINX.md` for remote access setup.

## Best Practice

**Recommended Workflow:**

1. **Development**: Build and test locally
2. **Marketing Updates**: Deploy to Netlify
3. **Dashboard Updates**: Deploy to Pi
4. **Both**: Deploy to both when making major changes

This gives you:
- Public marketing presence (Netlify)
- Private, sovereign control (Pi)
- No mixed content issues
- Best of both worlds









