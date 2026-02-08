# Deploy to Raspberry Pi

## Quick Deploy Workflow

### 1. Build on Dev Machine
```bash
cd /home/thomas/git/joule-hvac
npm run build
```

### 2. Copy to Pi
```bash
scp -r dist pi@192.168.0.103:/home/pi/git/joule-hvac/
```
Password: `1`

### 3. Refresh Browser
Navigate to http://192.168.0.103:8080/home and hard refresh (Ctrl+F5)

---

## Alternative: One-Command Deploy
```bash
cd /home/thomas/git/joule-hvac && npm run build && scp -r dist pi@192.168.0.103:/home/pi/git/joule-hvac/
```

---

## Troubleshooting

### Browser shows old version
- Hard refresh: Ctrl+F5 (or Cmd+Shift+R on Mac)
- Clear browser cache
- Try incognito/private window

### Changes still not showing
- Check that build completed successfully (look for `✓ built in` message)
- Verify scp copied files (should see file list scrolling)
- Check Pi web server is running and serving from correct directory

---

## Notes
- Pi doesn't have npm/node installed, so we build on dev machine and copy dist
- **The Pi web server ONLY looks in `/home/pi/git/joule-hvac/dist`** - don't deploy anywhere else!
- Only the `dist` folder needs to be synced - source files stay on dev machine
- If changes don't appear, check server logs: `ssh pi@192.168.0.103 "sudo journalctl -u prostat-bridge -n 20"`

## What We Fixed
Previously, the server checked multiple paths which caused confusion:
- ❌ `/home/pi/git/joule-hvac/dist` (production)
- ❌ `/home/pi/dist` (fallback)
- ❌ `parent/dist` (dev mode)

Now it's simple:
- ✅ **ONE path only**: `/home/pi/git/joule-hvac/dist`
- Server logs clear error if dist folder is missing
- Error message shows exact deploy command
