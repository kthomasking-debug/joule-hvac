# Self-Hosting Joule Dashboard on Raspberry Pi

## Overview

Instead of hosting the Joule dashboard on Netlify (cloud), you can self-host it directly on your Joule Bridge (Raspberry Pi). This provides:

- **⚡ Instant Speed**: Local LAN speed, no CDN round-trips
- **🔒 Complete Privacy**: No cloud logs, no tracking
- **🛡️ Offline Operation**: Works even if internet is down
- **🎯 Clean Architecture**: Frontend and backend on same local network (no mixed content issues)

## Architecture

```
┌─────────────────┐
│  Your Browser   │
│  (Laptop/Phone) │
└────────┬────────┘
         │ HTTP (Local Network)
         │
┌────────▼────────┐         ┌──────────────┐         ┌──────────┐
│  Nginx          │────────▶│ Joule Bridge │────────▶│  Ecobee  │
│  (Web Server)   │  HTTP   │  (Python)    │   HAP   │          │
│  Port 80        │         │  Port 8080   │         │          │
└─────────────────┘         └──────────────┘         └──────────┘
         │
         │ Serves React App
         │ (index.html + assets)
         │
┌────────▼────────┐
│  /var/www/joule │
│  (Static Files) │
└─────────────────┘
```

## Prerequisites

- Joule Bridge (Raspberry Pi) already set up and running
- SSH access to your Bridge
- Development machine with Node.js installed
- Network access to your Bridge (same WiFi/LAN)

## Step 1: Install Nginx on the Bridge

SSH into your Bridge:

```bash
ssh pi@joule.local
# Or use IP: ssh pi@192.168.1.100
```

Install Nginx:

```bash
sudo apt update
sudo apt install -y nginx
```

Verify Nginx is running:

```bash
sudo systemctl status nginx
```

You should see "active (running)" in green.

Test in browser: Visit `http://joule.local` (or your Bridge's IP). You should see the default Nginx welcome page.

## Step 2: Configure Nginx for Joule Dashboard

Create the web directory:

```bash
sudo mkdir -p /var/www/joule
sudo chown pi:pi /var/www/joule
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/joule
```

Paste this configuration:

```nginx
server {
    listen 80;
    server_name joule.local localhost;
    
    root /var/www/joule;
    index index.html;
    
    # Serve static files
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Cache static assets (JS, CSS, images)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Proxy API requests to Joule Bridge backend
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Health check endpoint
    location /health {
        proxy_pass http://localhost:8080/health;
        access_log off;
    }
}
```

Enable the site:

```bash
# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Enable Joule site
sudo ln -s /etc/nginx/sites-available/joule /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

## Step 3: Build the Dashboard on Your Development Machine

On your development machine (not the Pi), build the React app:

```bash
# In your project directory
npm run build
```

This creates a `dist/` folder with all the static files.

## Step 4: Deploy to the Bridge

### Option A: Using SCP (Manual)

Copy the built files to the Bridge:

```bash
# From your development machine
scp -r dist/* pi@joule.local:/var/www/joule/
```

Or use the IP address:

```bash
scp -r dist/* pi@192.168.1.100:/var/www/joule/
```

### Option B: Using Deployment Script (Automated)

We'll create a deployment script (see next section).

## Step 5: Set Permissions

SSH back into the Bridge and set correct permissions:

```bash
ssh pi@joule.local
sudo chown -R www-data:www-data /var/www/joule
sudo chmod -R 755 /var/www/joule
```

## Step 6: Test the Dashboard

Open your browser and visit:

- `http://joule.local` (if mDNS works)
- `http://192.168.1.100` (use your Bridge's IP)

You should see the Joule dashboard!

## Step 7: Set Up Auto-Deployment (Optional)

Create a deployment script on your development machine to automate the process.

## Troubleshooting

### Dashboard shows "404 Not Found"

- Check that files are in `/var/www/joule/`
- Verify Nginx config: `sudo nginx -t`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

### Dashboard loads but API calls fail

- Check that Joule Bridge service is running: `sudo systemctl status joule-bridge`
- Verify proxy configuration in Nginx config
- Test backend directly: `curl http://localhost:8080/health`

### Can't access from other devices on network

- Check firewall: `sudo ufw status`
- Allow HTTP: `sudo ufw allow 80`
- Verify Bridge IP is correct

### mDNS not working (joule.local doesn't resolve)

- Install avahi-daemon: `sudo apt install avahi-daemon`
- Or just use the IP address: `http://192.168.1.100`

## Updating the Dashboard

When you make changes to the code:

1. Build on development machine: `npm run build`
2. Deploy to Bridge: `scp -r dist/* pi@joule.local:/var/www/joule/`
3. Clear browser cache (or hard refresh: Ctrl+Shift+R)

## Remote Access (Optional)

If you want to access your dashboard from outside your home network:

### Option 1: Tailscale VPN (Recommended)

1. Install Tailscale on Bridge: `curl -fsSL https://tailscale.com/install.sh | sh`
2. Install Tailscale on your phone/laptop
3. Access via: `http://joule.tailscale-ip`

### Option 2: Cloudflare Tunnel

1. Install cloudflared on Bridge
2. Create tunnel: `cloudflared tunnel create joule`
3. Configure and run tunnel

### Option 3: Port Forwarding (Not Recommended)

- Forward port 80 from router to Bridge
- Access via your public IP (security risk - use HTTPS!)

## Dual Deployment Strategy

**Use Both Netlify and Pi:**

- **Netlify** (`joule.app`): Marketing site, landing page, public documentation
- **Pi** (`joule.local`): Actual dashboard, controller, local network only

This gives you:
- Public marketing presence (Netlify)
- Private, sovereign control (Pi)
- No mixed content issues (everything local)

## Next Steps

- Set up automatic deployment script
- Configure HTTPS with Let's Encrypt (optional)
- Set up remote access via Tailscale
- Configure automatic updates






