# USB Flash Drive Files for Bridge Transfer

This guide lists exactly what files you need to copy to a USB flash drive to transfer the bridge software to your mini computer.

## Required Files (Minimum)

These are the **essential files** needed for the bridge to run:

```
prostat-bridge/
├── server.py              # Main bridge server (REQUIRED)
├── requirements.txt       # Python dependencies list (REQUIRED)
└── data/                  # Data directory (create empty)
    └── (empty - will be created automatically)
```

## Recommended Files (Helpful)

These files make installation and setup easier:

```
prostat-bridge/
├── server.py              # Main bridge server
├── requirements.txt       # Python dependencies
├── README.md              # Documentation
├── install-service.sh     # Auto-installation script
├── joule-bridge.service   # Systemd service file template
├── prepare-usb.sh         # Script to prepare USB (optional)
└── data/                  # Data directory
    └── (empty)
```

## Complete File List

All files in `prostat-bridge/` that you might want to copy:

- ✅ `server.py` - **REQUIRED** - Main bridge server
- ✅ `requirements.txt` - **REQUIRED** - Python dependencies
- ✅ `README.md` - Documentation
- ✅ `install-service.sh` - Installation script
- ✅ `joule-bridge.service` - Systemd service template
- ✅ `prostat-bridge.service` - Alternative service file
- ✅ `asthma_shield.py` - Optional feature (if you use it)
- ✅ `asthma-shield.service` - Optional service file
- ✅ `prepare-usb.sh` - USB preparation script
- ✅ `data/` - Empty directory (pairings.json created automatically)

## Files to EXCLUDE (Don't Copy)

**Do NOT copy these** - they're too large, platform-specific, or will be recreated:

- ❌ `venv/` - Virtual environment (too large, platform-specific)
- ❌ `__pycache__/` - Python cache files
- ❌ `data/pairings.json` - Will be created fresh on new system
- ❌ `*.pyc` - Compiled Python files
- ❌ `.git/` - Git repository (if present)

## Step-by-Step: Preparing USB Drive

### Option 1: Automated Script (Easiest)

Use the included script to automatically prepare files:

```bash
cd prostat-bridge
./prepare-usb.sh /path/to/usb
```

Replace `/path/to/usb` with your USB mount point (e.g., `/mnt/usb`, `/media/user/USBDRIVE`).

The script will:
- Create the directory structure
- Copy all essential files
- Exclude venv, cache, and data files
- Make scripts executable
- Show a summary

### Option 2: Manual Copy

1. **Create the directory structure on USB drive:**
   ```bash
   # On your current computer
   mkdir -p /path/to/usb/prostat-bridge/data
   ```

2. **Copy essential files:**
   ```bash
   cd /path/to/your/joule-hvac/prostat-bridge
   
   # Copy main files
   cp server.py /path/to/usb/prostat-bridge/
   cp requirements.txt /path/to/usb/prostat-bridge/
   
   # Copy helpful files (optional but recommended)
   cp README.md /path/to/usb/prostat-bridge/
   cp install-service.sh /path/to/usb/prostat-bridge/
   cp joule-bridge.service /path/to/usb/prostat-bridge/
   
   # Create empty data directory
   mkdir -p /path/to/usb/prostat-bridge/data
   # (leave it empty - pairings.json will be created automatically)
   ```

3. **Verify files:**
   ```bash
   ls -la /path/to/usb/prostat-bridge/
   # Should show:
   # server.py
   # requirements.txt
   # README.md (if copied)
   # install-service.sh (if copied)
   # joule-bridge.service (if copied)
   # data/ (empty directory)
   ```

### Option 2: Using tar (Archive Method)

1. **Create a tar archive (excludes venv and cache):**
   ```bash
   cd /path/to/your/joule-hvac
   tar --exclude='venv' \
       --exclude='__pycache__' \
       --exclude='*.pyc' \
       --exclude='data/pairings.json' \
       -czf prostat-bridge.tar.gz prostat-bridge/
   ```

2. **Copy to USB drive:**
   ```bash
   cp prostat-bridge.tar.gz /path/to/usb/
   ```

3. **On mini computer, extract:**
   ```bash
   cd ~
   tar -xzf /path/to/usb/prostat-bridge.tar.gz
   ```

## File Sizes (Approximate)

- `server.py`: ~50-100 KB
- `requirements.txt`: <1 KB
- `README.md`: ~20-30 KB
- `install-service.sh`: <5 KB
- `joule-bridge.service`: <1 KB
- **Total: <200 KB** (very small!)

## On Mini Computer: Installation Steps

After transferring files to mini computer:

1. **Mount USB drive** (if not auto-mounted):
   ```bash
   # Find USB drive
   lsblk
   
   # Mount (replace /dev/sdb1 with your USB device)
   sudo mkdir -p /mnt/usb
   sudo mount /dev/sdb1 /mnt/usb
   ```

2. **Copy files to final location:**
   ```bash
   # Create destination
   mkdir -p ~/prostat-bridge
   
   # Copy files
   cp -r /mnt/usb/prostat-bridge/* ~/prostat-bridge/
   
   # Or if using tar:
   cd ~
   tar -xzf /mnt/usb/prostat-bridge.tar.gz
   ```

3. **Set up Python environment:**
   ```bash
   cd ~/prostat-bridge
   python3 -m venv venv
   source venv/bin/activate
   pip install --upgrade pip
   pip install -r requirements.txt
   ```

4. **Make server.py executable:**
   ```bash
   chmod +x server.py
   ```

5. **Test the bridge:**
   ```bash
   source venv/bin/activate
   python3 server.py
   ```

6. **Set up as service (optional):**
   ```bash
   # If you copied install-service.sh
   chmod +x install-service.sh
   ./install-service.sh
   ```

## Quick Checklist

Before transferring, verify you have:

- [ ] `server.py` - Main bridge server
- [ ] `requirements.txt` - Python dependencies
- [ ] `data/` directory (empty)
- [ ] (Optional) `README.md` - Documentation
- [ ] (Optional) `install-service.sh` - Installation script
- [ ] (Optional) `joule-bridge.service` - Service template

## Troubleshooting

### "No module named 'aiohomekit'"
- You need to install dependencies: `pip install -r requirements.txt`

### "Permission denied" when running server.py
- Make it executable: `chmod +x server.py`
- Or run with: `python3 server.py`

### "data/pairings.json not found"
- This is normal! The file will be created automatically when you pair a device
- Just make sure the `data/` directory exists

## Alternative: Git Clone (If Mini Computer Has Internet)

If your mini computer has internet access, you can skip the USB drive and clone directly:

```bash
cd ~
git clone <your-repo-url> joule-hvac
cd joule-hvac/prostat-bridge
```

This is easier but requires internet on the mini computer.

