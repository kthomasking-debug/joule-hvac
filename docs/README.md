# Documentation Structure

This folder contains all documentation for the Joule HVAC project.

## Manuals

- **`USER_MANUAL.md`** - Complete guide for end users (setup, pairing, troubleshooting, voice commands)
- **`ADMIN_MANUAL.md`** - Guide for support staff and administrators (remote support, troubleshooting, Tailscale)

## Why Two Docs Folders?

- **`docs/`** (this folder) - Main documentation repository
  - Source of truth for all documentation
  - Used by developers and support staff
  - Includes both user and support documentation

- **`public/docs/`** - Public-facing documentation
  - Served on the website (if applicable)
  - May be a subset of main docs
  - User-facing guides only

## Quick Reference

| Document | Audience | Purpose |
|----------|----------|---------|
| `USER_MANUAL.md` | End Users | Complete setup and usage guide |
| `ADMIN_MANUAL.md` | Support Staff | Remote support and troubleshooting |
| `BRIDGE-INSTALLATION-GUIDE.md` | Developers | Technical installation details |
| `ECOBEE-PAIRING-GUIDE.md` | End Users | Step-by-step pairing instructions |
| `QUICK_START_GUIDE.md` | End Users | Quick start for voice commands |

## Contributing

When updating documentation:
1. Update files in `docs/` (main repository)
2. If needed, sync relevant files to `public/docs/` for web serving
3. Keep ASCII diagrams for visual clarity
4. Test all links and instructions

