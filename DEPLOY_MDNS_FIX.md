# Deploy mDNS Registration Fix

## Quick Deploy

Run the deployment script to deploy the mDNS registration fix to the minipc:

```bash
./scripts/deploy-bridge-code.sh
```

## What the Script Does

1. **Creates Backup** - Backs up existing `server.py` on the minipc
2. **Deploys Fix** - Copies the fixed `server.py` with improved mDNS registration
3. **Restarts Service** - Restarts the `prostat-bridge` service
4. **Checks mDNS** - Verifies mDNS registration in logs
5. **Tests Connection** - Verifies bridge is accessible
6. **Reports Status** - Shows summary and next steps

## What Was Fixed

The mDNS registration was failing with `NonUniqueNameException` because the service name was already registered. The fix:

- ✅ Uses `allow_name_change=True` to handle name conflicts gracefully
- ✅ Falls back to hostname-based naming if preferred name is taken
- ✅ Improved error logging to show actual exception details
- ✅ Better user messaging about accessible URLs

## After Deployment

1. **Update Bridge URL in UI:**
   - Go to Settings → Joule Bridge Settings
   - Enter: `http://192.168.0.106:8080` (or `http://joule-bridge.local:8080` if mDNS works)
   - Click "Save"

2. **Verify mDNS (optional):**
   ```bash
   # From another device on the network
   ping joule-bridge.local
   
   # Or check services
   avahi-browse -a | grep joule-bridge
   ```

3. **Check Logs:**
   ```bash
   ssh tom-pc@192.168.0.106 'sudo journalctl -u prostat-bridge -n 50 | grep -i mDNS'
   ```

## Troubleshooting

- **If mDNS doesn't work:** Use IP address `http://192.168.0.106:8080` (bridge works fine via IP)
- **If service doesn't start:** Check logs with `ssh tom-pc@192.168.0.106 'sudo journalctl -u prostat-bridge -n 50'`
- **If connection fails:** Verify service is running: `ssh tom-pc@192.168.0.106 'sudo systemctl status prostat-bridge'`

## Manual Deployment (if script fails)

```bash
# 1. Copy file
scp prostat-bridge/server.py tom-pc@192.168.0.106:~/prostat-bridge/server.py

# 2. Restart service (will prompt for password)
ssh tom-pc@192.168.0.106 "sudo systemctl restart prostat-bridge"

# 3. Check status
ssh tom-pc@192.168.0.106 "sudo systemctl status prostat-bridge"
```





