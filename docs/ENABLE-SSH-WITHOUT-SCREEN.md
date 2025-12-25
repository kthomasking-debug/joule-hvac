# Enable SSH Without Screen/Keyboard

You don't need a screen and keyboard if your mini computer is a Raspberry Pi!

## Option 1: Enable SSH via SD Card (Raspberry Pi Only)

If your mini computer is a Raspberry Pi:

1. **Remove SD card** from Raspberry Pi
2. **Insert SD card** into your computer
3. **Navigate to boot partition** (the one you can see in Windows/Mac)
4. **Create empty file** named `ssh` (no extension, no content)
5. **Eject SD card** safely
6. **Insert back into Raspberry Pi**
7. **Power on** - SSH will be enabled automatically!

**That's it!** No screen/keyboard needed.

## Option 2: Pre-Configure SSH (If Setting Up Fresh)

If you're setting up a new Raspberry Pi:

1. **Use Raspberry Pi Imager** on your computer
2. **Before writing**, click the gear icon (⚙️)
3. **Enable SSH** in the settings
4. **Set username/password**
5. **Write image** to SD card
6. **Boot Raspberry Pi** - SSH already enabled!

## Option 3: If It's NOT a Raspberry Pi

If your mini computer is a different type (Intel NUC, mini PC, etc.):

**You have a few options:**

### A. Temporary Screen/Keyboard
- Borrow a monitor and keyboard temporarily
- Just to enable SSH (takes 2 minutes)
- Then remove them

### B. Network Share
- If mini computer can access network shares
- Copy files via network share
- But still need to enable SSH somehow

### C. Check if SSH is on Different Port
```bash
nmap -p 22,2222,22022 192.168.0.106
```

### D. Use Remote Desktop (If Available)
- Some mini PCs have RDP or VNC enabled
- Check if port 3389 (RDP) or 5900 (VNC) is open
```bash
nmap -p 3389,5900 192.168.0.106
```

## Option 4: Use USB Drive Method (If Files Accessible)

If your mini computer can access USB files without screen:

1. **Insert USB drive** into mini computer
2. **Files should be accessible** at `/media/USERNAME/writable/prostat-bridge/`
3. **But you still need a way to run commands...**

This still requires some way to access the command line.

## Recommendation

**If Raspberry Pi:**
- ✅ Use Option 1 (create `ssh` file on SD card)
- ✅ No screen/keyboard needed
- ✅ Takes 2 minutes

**If NOT Raspberry Pi:**
- ⚠️ You'll need temporary screen/keyboard to enable SSH
- ⚠️ Or check if remote desktop is available
- ⚠️ Or use network share if supported

## Quick Check: Is It a Raspberry Pi?

**Raspberry Pi indicators:**
- Uses microSD card (not internal storage)
- Raspberry Pi logo/branding
- Model name like "Raspberry Pi Zero 2 W", "Pi 4", etc.

**If it's a Raspberry Pi**, you can enable SSH without screen/keyboard using the SD card method!

