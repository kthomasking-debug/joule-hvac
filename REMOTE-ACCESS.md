# Remote Access to Joule Bridge

## SSH Access

To access the remote bridge (mini PC) from your laptop:

```bash
ssh tom-pc@192.168.0.106
```

**If prompted for password:** Enter the password for the `tom-pc` user on the remote bridge.

**Once connected, you can:**
- Check service status: `sudo systemctl status prostat-bridge`
- Restart service: `sudo systemctl restart prostat-bridge`
- View logs: `sudo journalctl -u prostat-bridge -f`
- Check code version: `cd ~/git/joule-hvac && git log --oneline -1`

## Passwordless SSH Setup (One-Time)

To avoid entering password every time:

**On your laptop:**
```bash
ssh-copy-id tom-pc@192.168.0.106
```

This copies your SSH key to the remote bridge. After this, you won't need to enter the password.

## Remote Commands (Without Interactive SSH)

You can run commands remotely without opening an interactive session:

```bash
# Restart service
ssh tom-pc@192.168.0.106 "sudo systemctl restart prostat-bridge"

# Check status
ssh tom-pc@192.168.0.106 "sudo systemctl status prostat-bridge --no-pager | head -20"

# View recent logs
ssh tom-pc@192.168.0.106 "journalctl -u prostat-bridge --no-pager -n 30"

# Update code
ssh tom-pc@192.168.0.106 "cd ~/git/joule-hvac && git pull origin main && cp prostat-bridge/server.py ~/prostat-bridge/server.py"
```

## Passwordless Sudo for Service Restart

To allow remote restarts without password prompts:

**SSH into the bridge and run:**
```bash
echo 'tom-pc ALL=(ALL) NOPASSWD: /bin/systemctl restart prostat-bridge, /bin/systemctl start prostat-bridge, /bin/systemctl stop prostat-bridge, /bin/systemctl status prostat-bridge' | sudo tee /etc/sudoers.d/prostat-bridge
sudo chmod 0440 /etc/sudoers.d/prostat-bridge
```

After this, you can restart the service remotely without entering a password:
```bash
ssh tom-pc@192.168.0.106 "sudo systemctl restart prostat-bridge"
```

## API-Based Remote Control (No SSH Needed)

Once the service is running with the latest code, you can control it via API:

```bash
# Restart service
curl -X POST http://192.168.0.106:8080/api/bridge/restart

# Check health
curl http://192.168.0.106:8080/health

# Check version
curl http://192.168.0.106:8080/api/ota/version

# Perform update
curl -X POST http://192.168.0.106:8080/api/ota/update
```

## Troubleshooting

**"Permission denied (publickey,password)"**
- SSH keys not set up. Run: `ssh-copy-id tom-pc@192.168.0.106`

**"Connection refused"**
- Bridge might be off or network issue
- Check: `ping 192.168.0.106`

**"sudo: a password is required"**
- Set up passwordless sudo (see above)
- Or use API endpoints instead of SSH

**Service not responding to API calls**
- Service might need restart: `ssh tom-pc@192.168.0.106 "sudo systemctl restart prostat-bridge"`
- Check if service is running: `ssh tom-pc@192.168.0.106 "sudo systemctl is-active prostat-bridge"`

