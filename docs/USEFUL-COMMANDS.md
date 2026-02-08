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

Run all deploy commands from the **project root** (the folder that contains `package.json`). On Windows, `cd` there first, e.g. `cd C:\Users\YourName\Documents\git\joule-hvac`.

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
