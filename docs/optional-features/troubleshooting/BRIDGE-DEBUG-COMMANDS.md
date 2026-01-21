# Bridge Debug Commands

Run these on the mini PC (tom-pc-P150HMx) via SSH.

**SSH Access:**
```bash
ssh tom-pc@192.168.0.106
# Or via Tailscale:
ssh tom-pc@100.102.98.23
```

## 1. Check What's Running

```bash
# See all bridge-related processes
ps aux | grep -E 'server.py|prostat' | grep -v grep

# More detailed - shows parent process
pstree -p | grep server

# Check systemd service status
systemctl status prostat-bridge

# Check if running via systemd or manually
systemctl is-active prostat-bridge
```

## 2. Kill Duplicate Processes

```bash
# Kill ALL bridge processes
pkill -f 'python3.*server.py'

# Wait 2 seconds
sleep 2

# Restart the service properly
sudo systemctl restart prostat-bridge

# Verify only one process
ps aux | grep server.py | grep -v grep
```

## 3. Check Blueair Connection

```bash
# Test Blueair credentials directly
curl -s http://localhost:8080/api/blueair/status | jq

# Check if credentials are configured
curl -s http://localhost:8080/api/blueair/credentials/status | jq

# View bridge logs for Blueair errors
sudo journalctl -u prostat-bridge -f --no-pager | grep -i blueair
```

## 4. Set Blueair Credentials via API

```bash
# Set credentials
curl -X POST http://localhost:8080/api/blueair/credentials \
  -H "Content-Type: application/json" \
  -d '{"username": "bunnyrita@gmail.com", "password": "$Usfs30512"}'

# Verify connection
curl -s http://localhost:8080/api/blueair/status | jq
```

## 5. Check Ecobee HomeKit Pairing

```bash
# Check pairing status
curl -s http://localhost:8080/api/paired-devices | jq

# Check if Ecobee is reachable
curl -s http://localhost:8080/api/ecobee/status | jq

# View pairing diagnostics
curl -s http://localhost:8080/api/pairing/diagnostics | jq
```

## 6. View Logs in Real-Time

```bash
# All bridge logs
sudo journalctl -u prostat-bridge -f

# Just errors
sudo journalctl -u prostat-bridge -p err -f

# Last 100 lines
sudo journalctl -u prostat-bridge -n 100 --no-pager
```

## 7. Complete Reset (Nuclear Option)

```bash
# Stop everything
sudo systemctl stop prostat-bridge
pkill -9 -f 'python3.*server.py'

# Clear any stale state
rm -f ~/prostat-bridge/data/*.lock 2>/dev/null

# Start fresh
sudo systemctl start prostat-bridge

# Check status
systemctl status prostat-bridge
ps aux | grep server.py | grep -v grep
```

## Expected Output

**Good state (1 process):**
```
tom       12345  0.5  1.2 123456 12345 ?  S  10:00  0:01 python3 server.py
```

**Bad state (multiple processes):**
```
tom       12345  0.5  1.2 123456 12345 ?  S  10:00  0:01 python3 server.py
tom       45951  0.5  1.2 123456 12345 ?  S  09:55  0:02 python3 server.py  ← ZOMBIE
```

## Port Conflict Check

```bash
# Check what's using port 8080
sudo lsof -i :8080

# If multiple processes, this shows who's winning
sudo netstat -tlnp | grep 8080
```

