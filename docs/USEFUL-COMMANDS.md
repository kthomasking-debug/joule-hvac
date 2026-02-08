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

| Command | Description |
|---------|-------------|
| `./deploy-to-pi.sh` | Build app, copy to Pi, restart bridge + Pi HMI. One-command deploy. |
| `npm run deploy:pi` | Alternative deploy via Node script. |
| `npm run deploy:pi:build` | Deploy with explicit build step. |
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

## Access URLs

| URL | Description |
|-----|-------------|
| http://localhost:5173 | Dev server (Vite). |
| http://192.168.0.103:8080 | Pi bridge (production app). |
| http://joule-bridge.local:8080 | Pi bridge via mDNS hostname. |
