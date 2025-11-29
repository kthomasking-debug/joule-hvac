# Shopping List Verification

## ✅ What You Have (Good!)

### 1. **8CH USB Serial Port Relay Module CH340** - ✅ Perfect!

- **Price:** $16.41
- **Status:** ✅ Correct choice
- **Notes:** This is the relay module we discussed. Make sure it comes with the USB-B cable, or you'll need one separately.

### 2. **USB-C to USB-A OTG Adapter** - ✅ Good!

- **Price:** $5.49
- **Status:** ✅ Needed for connecting relay to tablet
- **Notes:** This connects the relay module (USB-B) to tablet (USB-C). You'll need a USB-B to USB-A cable/adapter too.

## ⚠️ Items That Need Attention

### 3. **12V/24V to 5V USB C Adapter** - ⚠️ **PROBLEM!**

**Issue:** This adapter is likely for **DC input** (12VDC/24VDC), but your furnace transformer outputs **24VAC** (alternating current).

**What you need instead:**

- Search for: **"24VAC to 5V USB adapter"** or **"thermostat USB power adapter"**
- Must specifically say **"24VAC"** (not just "24V")
- Should output 5V DC via USB-C
- Price: ~$15-25

**Why this matters:**

- AC (alternating current) and DC (direct current) are different
- A DC adapter won't work with AC input
- Could damage the adapter or not work at all

**Recommended search terms:**

- "24VAC to USB adapter"
- "thermostat USB power supply"
- "24VAC to 5V USB converter"

### 4. **USB-C Y-Cable Splitter** - ⚠️ **Might Not Need**

**Status:** Only needed if you're NOT using furnace power

**If using furnace transformer (recommended):**

- ❌ Don't need this - tablet gets power from furnace transformer
- USB OTG adapter alone is enough

**If NOT using furnace power:**

- ✅ Need this - allows charging + USB OTG simultaneously

**Recommendation:** Skip this if you're using furnace power (which you should!)

### 5. **ONN Surf Tablet** - ⚠️ **Check Specs!**

**What you have:** ONN Surf 7" with 16GB storage, 1GB RAM, Android 9.0

**What we discussed:** ONN Surf 7" (2024) with 32GB storage, 3GB RAM, Android 11-13

**Potential issues:**

- **1GB RAM** - Very low! Your React app might be slow or struggle
- **Android 9.0** - Older version, but should still support Web Serial API (needs Android 7.0+)
- **16GB storage** - Less space, but probably fine for just the browser app

**Will it work?**

- ✅ Probably, but might be slow
- ⚠️ 1GB RAM is really minimal for modern web apps
- ⚠️ Consider looking for a model with at least 2GB RAM

**Recommendation:**

- If you can find the 2024 model with 3GB RAM for a bit more, it's worth it
- If this is all you can get, it should work but may be sluggish

## ❌ Missing Items

### 6. **USB-B to USB-A Cable** - ❌ **MISSING!**

**Why you need it:**

- Relay module has **USB-B** connector
- Your OTG adapter is **USB-C to USB-A**
- You need: **USB-B to USB-A cable** to connect them

**What to get:**

- Standard USB-A to USB-B cable (like printer cable)
- Price: ~$5-10
- Or get a USB-B to USB-C adapter directly (~$5)

**Alternative:** Get a **USB-B to USB-C adapter** instead of USB-B to USB-A + USB-C to USB-A

### 7. **24VAC to 12VDC Converter (for relay module)** - ❌ **MISSING!**

**Why you need it:**

- Relay module needs DC power (5V, 12V, or 24V depending on jumper)
- Furnace transformer outputs 24VAC
- Need to convert 24VAC → 12VDC (or 5VDC if module uses 5V)

**What to get:**

- **24VAC to 12VDC converter** (~$10-15)
- Or **24VAC to 5VDC converter** if relay module uses 5V
- Check relay module specs for voltage requirement

**Alternative:** If relay module can use 24V, you could get a **24VAC to 24VDC converter** (less common)

### 8. **Wall Mount for Tablet** - ❌ **MISSING!**

**What you need:**

- Tablet wall mount bracket
- Price: ~$10-30
- Or 3D print a custom one

## 📋 Complete Shopping List

### Essential Items:

1. ✅ **8CH USB Relay Module (CH340)** - $16.41 - You have this
2. ❌ **24VAC to 5V USB-C Adapter** - ~$15-25 - **WRONG ONE IN CART!**
3. ❌ **24VAC to 12VDC Converter** - ~$10-15 - **MISSING!**
4. ✅ **USB-C to USB-A OTG Adapter** - $5.49 - You have this
5. ❌ **USB-B to USB-A Cable** - ~$5-10 - **MISSING!** (or USB-B to USB-C adapter)
6. ⚠️ **ONN Surf Tablet** - $33 - You have this, but check RAM (1GB is low)
7. ❌ **Tablet Wall Mount** - ~$10-30 - **MISSING!**

### Optional Items:

8. ❌ **USB-C Y-Cable** - $19.99 - **Skip if using furnace power**
9. ❌ **Wire nuts/terminal blocks** - ~$5 - For wiring connections
10. ❌ **Junction box** - ~$5-10 - To mount power adapters behind tablet

## 🔧 Quick Fixes

### Fix #1: Replace the Power Adapter

**Remove from cart:** "12V/24V to 5V USB C Adapter" (DC version)
**Add to cart:** Search for "24VAC to 5V USB adapter" or "24VAC to USB-C adapter"

### Fix #2: Add Missing Cables

**Add:** USB-B to USB-A cable (or USB-B to USB-C adapter)

- This connects relay module to OTG adapter

### Fix #3: Add Power Converter for Relay

**Add:** 24VAC to 12VDC converter

- Powers the relay module from furnace transformer

### Fix #4: Consider Better Tablet

**Current:** 1GB RAM, Android 9.0
**Better:** Look for 2GB+ RAM, Android 10+ if possible

- But if budget is tight, 1GB should work (just slower)

## 💰 Estimated Total Cost

**With fixes:**

- Tablet: $33 (current) or ~$50 (better model)
- Relay module: $16.41 ✅
- 24VAC to USB adapter: ~$20 (correct one)
- 24VAC to 12VDC converter: ~$12
- USB OTG adapter: $5.49 ✅
- USB-B to USB-A cable: ~$7
- Wall mount: ~$15
- **Total: ~$109-125**

**Current cart total (with issues):** ~$91
**Fixed cart total:** ~$109-125

## ✅ Final Checklist - UPDATED

Before checkout, make sure you have:

- [x] **USB A to B Cable** ✅ ($3.69 - You have this!)
- [x] **USB-C to USB-A OTG Adapter** ✅ ($5.49 - You have this!)
- [x] **8CH USB Relay Module (CH340)** ✅ ($16.41 - You have this!)
- [x] **ONN Surf Tablet (32GB, 3GB RAM)** ✅ ($45.00 - Perfect choice!)
- [ ] **24VAC to 5V USB-C adapter** ❌ (Remove the DC version, get AC version ~$20)
- [ ] **24VAC to 12VDC converter** ❌ (For relay module power ~$12)
- [ ] **Tablet wall mount** ❌ (~$15)
- [ ] **Wire nuts/terminal blocks** ❌ (~$5)
- [ ] **Junction box** (optional, ~$5-10)

## 🚨 Critical Issues to Fix

1. **❌ Remove wrong power adapter** - The "12V/24V to 5V" is for DC, you need 24VAC
2. **❌ Remove extra tablet** - You have TWO tablets in cart! Remove the 1GB RAM one ($33)
3. **❌ Missing relay power converter** - Need 24VAC to 12VDC converter (~$12)
4. **❌ Missing wall mount** - Need to mount tablet on wall (~$15)

## 🎯 Action Items

**Remove from cart:**

- ❌ "12V/24V to 5V USB C Adapter" ($15.80) - Wrong type (DC instead of AC)
- ❌ "ONN Surf 7' Tablet 16GB 1GB RAM" ($33.00) - You have the better one!

**Add to cart:**

- ✅ "24VAC to 5V USB-C adapter" (~$20) - Search specifically for "24VAC"
- ✅ "24VAC to 12VDC converter" (~$12) - For relay module power
- ✅ Tablet wall mount (~$15)
- ✅ Wire nuts/terminal blocks (~$5)

**Keep in cart:**

- ✅ USB A to B Cable ($3.69)
- ✅ USB-C to USB-A OTG Adapter ($5.49)
- ✅ 8CH USB Relay Module ($16.41)
- ✅ ONN Surf Tablet 32GB/3GB RAM ($45.00)

Fix these before ordering!
