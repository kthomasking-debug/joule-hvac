# OTA (Over-The-Air) Updates for Joule Bridge

This document explains how to perform remote updates to customer Joule Bridge devices without SSH access.

## Overview

The OTA update system allows you to:
- Check for available updates remotely
- Update bridge firmware over HTTPS
- Automatically create backups before updates
- Rollback on failure
- No SSH access required

## API Endpoints

### 1. Check Current Version
```bash
GET http://bridge-ip:8080/api/ota/version
```

**Response:**
```json
{
  "version": "9679e92",
  "service_path": "/home/tom-pc/prostat-bridge"
}
```

### 2. Check for Updates
```bash
GET http://bridge-ip:8080/api/ota/check
```

**Response:**
```json
{
  "current_version": "9679e92",
  "latest_version": "d53a46a",
  "update_available": true
}
```

### 3. Perform Update
```bash
POST http://bridge-ip:8080/api/ota/update
```

### 4. Restart Bridge Service
```bash
POST http://bridge-ip:8080/api/bridge/restart
```

**Response:**
```json
{
  "success": true,
  "message": "Bridge service restarted successfully"
}
```

**Use Case:** If a customer reports the bridge stopped working, you can remotely restart it without SSH access.

**Note:** The restart endpoint requires passwordless sudo to be configured. If you get an empty reply, set up passwordless sudo:

```bash
ssh tom-pc@bridge-ip
echo 'tom-pc ALL=(ALL) NOPASSWD: /bin/systemctl restart prostat-bridge' | sudo tee /etc/sudoers.d/prostat-bridge
sudo chmod 0440 /etc/sudoers.d/prostat-bridge
```

**Response (Success):**
```json
{
  "success": true,
  "version": "d53a46a",
  "backup": "/home/tom-pc/.joule-bridge-backups/server.py.20251228_130000",
  "message": "Update completed successfully"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": "Service restart failed, rolled back to previous version",
  "backup": "/home/tom-pc/.joule-bridge-backups/server.py.20251228_130000"
}
```

## Usage Examples

### From Command Line

**Check for updates:**
```bash
curl http://192.168.0.106:8080/api/ota/check
```

**Perform update:**
```bash
curl -X POST http://192.168.0.106:8080/api/ota/update
```

### From Web Application

You can integrate OTA updates into your management dashboard:

```javascript
// Check for updates
async function checkForUpdates(bridgeUrl) {
  const response = await fetch(`${bridgeUrl}/api/ota/check`);
  const data = await response.json();
  return data;
}

// Perform update
async function performUpdate(bridgeUrl) {
  const response = await fetch(`${bridgeUrl}/api/ota/update`, {
    method: 'POST'
  });
  const data = await response.json();
  return data;
}
```

### Using the OTA Update Script

The bridge includes a standalone script for updates:

```bash
# Check for updates
python3 ~/prostat-bridge/ota-update.py --check

# Perform update
python3 ~/prostat-bridge/ota-update.py --update
```

## How It Works

1. **Version Check**: Compares local git commit hash with GitHub
2. **Backup**: Creates timestamped backup of `server.py` before update
3. **Update**: Pulls latest code from GitHub and copies to service location
4. **Restart**: Restarts the systemd service
5. **Rollback**: If restart fails, automatically restores from backup

## Security Considerations

### For Production Deployments

**Option 1: Add Authentication (Recommended)**

Add API key authentication to OTA endpoints:

```python
OTA_API_KEY = os.getenv('OTA_API_KEY', '')

async def handle_ota_update(request):
    api_key = request.headers.get('X-API-Key', '')
    if api_key != OTA_API_KEY:
        return web.json_response({'error': 'Unauthorized'}, status=401)
    # ... rest of update logic
```

Then use:
```bash
curl -X POST http://bridge-ip:8080/api/ota/update \
  -H "X-API-Key: your-secret-key"
```

**Option 2: Network Restrictions**

- Only allow OTA updates from specific IPs
- Use firewall rules to restrict access
- Use VPN for customer bridges

**Option 3: Customer-Initiated Updates**

- Provide a web UI on the bridge for customers to trigger updates
- Add confirmation dialogs
- Show update progress

## Deployment Checklist

For customer devices:

1. ✅ Ensure git is installed: `sudo apt install git`
2. ✅ Ensure bridge has internet access
3. ✅ Set up automatic backups directory
4. ✅ Configure passwordless sudo for service restart (optional)
5. ✅ Test OTA update on staging device first
6. ✅ Document customer-facing update process

## Troubleshooting

### Update Fails with "Service restart failed"

- Check if passwordless sudo is configured
- Verify systemd service is running
- Check logs: `sudo journalctl -u prostat-bridge -n 50`

### "Update timed out"

- Check network connectivity
- Verify GitHub is accessible
- Increase timeout in code if needed

### Version Shows "unknown"

- Git repository may not be initialized
- Run: `cd ~/git/joule-hvac && git pull origin main`

## Future Enhancements

- [ ] Scheduled automatic update checks
- [ ] Update notifications
- [ ] Changelog display
- [ ] Update progress tracking
- [ ] Multi-version rollback
- [ ] Update via webhook (push updates)
- [ ] Encrypted update packages

