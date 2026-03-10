# 2.13-inch Touch E-Paper HAT (Pi Zero) Setup & Troubleshooting

## Hardware Installation

- **Mount the HAT:** Place the 2.13-inch E-Paper HAT directly onto the 40-pin GPIO header of your Raspberry Pi Zero.
- **Secure the Case:** Assemble the provided ABS case around the Pi Zero and HAT, ensuring the connectors are aligned and the screen sits securely in the front bezel.
- **Ensure Proper Orientation:** The display should be oriented with the ribbon cable at the top or side, depending on the specific model's design, with the GPIO pins matching correctly.

## Software Setup & Configuration

1. **Enable SPI Interface:**
    - Boot your Raspberry Pi and open a terminal.
    - Run:
       sudo raspi-config
    - Go to Interface Options → SPI and enable it. Reboot if prompted.

2. **Install Python Dependencies:**
    - Update your system and install required libraries:
       sudo apt-get update
       sudo apt-get install python3-pip python3-pil python3-numpy
       sudo pip3 install spidev RPi.GPIO

3. **Download Waveshare Examples:**
    - Clone the Waveshare e-Paper repository:
       git clone https://github.com/waveshare/e-Paper.git

4. **Run Sample Code:**
    - Navigate to the Python examples folder for your version:
       cd e-Paper/RaspberryPi_JetsonNano/python/examples
    - Run the touch test demo:
       python3 epd_2in13_touch_test.py

## Touch Features

- **Driver:** The display supports 5-point touch and gestures, which can be configured using specialized scripts.
- **Touch Testing:** The epd_2in13_touch_test.py script will test the touch functionality, showing coordinates when the screen is touched.

## Troubleshooting

- **Display Upside Down:** If the image is inverted, adjust the orientation in your script or add lcd_rotate=2 to /boot/config.txt.
- **No Display:** Ensure all GPIO pins are properly seated and that SPI is enabled in raspi-config.
- **Touch Not Working:**
   - Confirm the device appears in /dev/input/ and is listed in /proc/bus/input/devices.
   - Double-check physical connections and repeat the software setup steps.
   - Review dmesg for hardware detection messages: dmesg | grep -i touch

# Useful Commands

Quick reference for common Joule project commands.

## Development

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server (localhost:5173). Use for day-to-day development. |
| `npm run dev:clean:linux` | Kill any existing dev server, then start fresh. |
| `npm run build` | Build production app to `dist/`. |
| `npm run preview` | Preview production build locally. |

## Deployment
### Fresh Pi Zero Setup (after SD wipe)

If you have wiped your Pi Zero SD card and need to reinstall everything:

1. Flash Raspberry Pi OS to the SD card and boot the Pi.
2. Set up Wi-Fi and enable SSH (add an empty file named `ssh` to the boot partition if needed).
3. If your Pi Zero does not have git (or you prefer to deploy from your local machine), use the local deploy script:

   ```bash
./deploy-local-to-pi.sh 192.168.0.103

   ```
   Replace `<pi_ip>` with your Pi's IP address (e.g., 192.168.0.103).

This script will:
 - Build your app locally
 - Copy your entire project (excluding node_modules, .git, etc.) to the Pi
 - Copy the built dist folder
 - SSH into the Pi and run the setup script (`setup-pi-zero.sh` or `deploy-to-pi.sh`)

No git required on the Pi. See `deploy-local-to-pi.sh` in the repo for details.

If you do want to use git on the Pi, you can still use:

   ```bash
   bash setup-fresh-pi.sh <pi_ip> <your-repo-url>
   ```
   Replace `<pi_ip>` with your Pi's IP address and `<your-repo-url>` with your Git repo URL.

This script will:
 - SSH into the Pi
 - Install system dependencies (git, python, node, etc.)
 - Clone your Joule project repo (or pull latest)
 - Run the setup script (`setup-pi-zero.sh` or `deploy-to-pi.sh`)
 - Prompt for any additional configuration if needed

See `setup-fresh-pi.sh` in the repo for details.

### Local Deploy to Pi (no git required on Pi)

If you want to deploy your current local project directly to the Pi (without using git on the Pi):

1. Make sure your Pi is running, on the network, and SSH is enabled.
2. From your project root, run:

   ```bash
   bash deploy-local-to-pi.sh <pi_ip>
   bash deploy-local-to-pi.sh 192.168.0.103
   ```
   Replace `<pi_ip>` with your Pi's IP address (e.g., 192.168.0.103).

This script will:
 - Build your app locally
 - Copy your entire project (excluding node_modules, .git, etc.) to the Pi
 - Copy the built dist folder
 - SSH into the Pi and run the setup script (`setup-pi-zero.sh` or `deploy-to-pi.sh`)

No git required on the Pi. See `deploy-local-to-pi.sh` in the repo for details.

Run all deploy commands from the **project root** (the folder that contains `package.json`).
On Linux, `cd` there first, e.g. `cd /home/thomas/git/joule-hvac` (or your actual path).

| Command | Description |
|---------|-------------|
| `./deploy-to-pi.sh` | **(Linux/Mac only)** Build app, copy to Pi, restart bridge + Pi HMI. Uses Bash + sshpass. |
| `.\deploy-to-pi.ps1` | **(Windows)** Same as above: build, copy dist + pi-hmi/app.py, restart bridge + pi-hmi. Requires OpenSSH (scp/ssh); run from project root. |
| `npm run deploy:pi` | Deploy via Node script (works on Windows). Default host: joule.local. |
| `npm run deploy:pi:build` | Deploy with explicit build step. |
| **Windows deploy to Pi (npm)** | From project root: `npm run deploy:pi:build -- --host=192.168.0.103 --user=pi --path=/home/pi/git/joule-hvac/dist` (alternative to script). |
| `npm run build:netlify` | Build for Netlify deployment. |
| `npm run deploy` | Deploy to GitHub Pages (gh-pages branch). |

## Testing

| Command | Description |
|---------|-------------|
| `npm run test` | Run all Vitest tests. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:parser` | Run Ask Joule parser tests. |
| `npm run test:ci` | CI-friendly test run (single worker, jsdom). |
| `npm run test:visual` | Run Playwright E2E tests. |
| `npm run test:smoke` | Run smoke test only. |

## Linting

| Command | Description |
|---------|-------------|
| `npm run lint` | Run ESLint on the codebase. |

## Git

| Command | Description |
|---------|-------------|
| `git pull` | Pull latest changes (e.g. after working on another machine). |
| `git add -A && git commit -m "message" && git push` | Stage, commit, and push. |

## Pi / Bridge

| Command | Description |
|---------|-------------|
| `ssh pi@192.168.0.103` | SSH into the Pi bridge. |
| `ssh pi@192.168.0.103 "sudo systemctl restart prostat-bridge"` | Restart the bridge service. |
| `ssh pi@192.168.0.103 "sudo systemctl restart pi-hmi.service"` | Restart the Pi HMI (e-ink display). |
| `ssh pi@192.168.0.103 "sudo journalctl -u prostat-bridge -n 50"` | View bridge logs. |
| ssh pi@192.168.0.103 sudo journalctl -u cloudflared \| grep 'Route' \| tail -1 | Get Pi Cloudflare tunnel URL from logs (requires sudo). |

## Debugging Ask Joule on Windows

If **Ask Joule** fails on Windows but works on Linux (and the "Got Your Bill? Let's Compare" AI works on both):

1. **Retry behavior** – The app now retries once without RAG if the first attempt fails. If the second attempt succeeds, the issue was likely in the RAG or large-context path.
2. **Check the browser console** – Press **F12** → **Console**. When you submit an Ask Joule question, look for:
   - `[AskJoule] First attempt failed, retrying without RAG:` – retry ran; if you then get a response, RAG or message size was the cause.
   - `[groqAgent] Streaming error:` or `[aiProvider] Streaming read error:` – streaming or network failed; note the message.
3. **Check AI config** – In Console run: `({ provider: localStorage.getItem('aiProvider'), hasGroq: !!localStorage.getItem('groqApiKey'), localUrl: localStorage.getItem('localAIBaseUrl') })`. Ensure you have either a Groq key or local URL set the same way as on Linux.
4. **Network** – If using local Ollama, ensure the URL (e.g. `http://other-pc:11434`) is reachable from Windows (firewall, same network). The bill feature uses the same AI backend; if bill analysis works, the backend is reachable and the difference is in the Ask Joule path (RAG/streaming/context).

## Access URLs

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Dev server (Vite). |
| http://192.168.0.103:8080 | Pi bridge (production app). |
| http://joule-bridge.local:8080 | Pi bridge via mDNS hostname. |
