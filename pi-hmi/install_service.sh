#!/usr/bin/env bash
set -euo pipefail

# Systemd installer for the Pi HMI service
# Creates/updates a unit file and enables/starts the service.
# Usage:
#   sudo bash install_service.sh [options]
# Options:
#   -u USER           User to run service as (default: current user or $SUDO_USER)
#   -n NAME           Service name (default: pi-hmi.service)
#   -p PYTHON         Python executable (default: python3)
#   -b API_BASE       Bridge API base URL (default: http://127.0.0.1:8080)
#   -i POLL_SECS      Polling interval seconds (default: 15)
#   --partial 0|1     Enable partial refresh (default: 1)
#   --touch-cfg PATH  Path to touch_config.json (default: pi-hmi/touch_config.json)
#   --dry-run         Print unit and exit without installing
#
# Examples:
#   sudo bash install_service.sh -b http://bridge.local:8080 -u pi
#   sudo bash install_service.sh -n my-hmi.service --partial 0

# Resolve paths
SCRIPT_DIR=$(dirname "$(readlink -f "$0")")
WORKDIR="$SCRIPT_DIR"
APP_PATH="$WORKDIR/app.py"

# Defaults
SERVICE_NAME="pi-hmi.service"
RUN_USER="${SUDO_USER:-$USER}"
PYTHON_BIN="python3"
API_BASE_DEFAULT="http://127.0.0.1:8080"
POLL_SECS_DEFAULT="15"
PARTIAL_DEFAULT="1"
TOUCH_CFG_DEFAULT="$WORKDIR/touch_config.json"
DRY_RUN=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -u)
      RUN_USER="$2"; shift 2;;
    -n)
      SERVICE_NAME="$2"; shift 2;;
    -p)
      PYTHON_BIN="$2"; shift 2;;
    -b)
      API_BASE_DEFAULT="$2"; shift 2;;
    -i)
      POLL_SECS_DEFAULT="$2"; shift 2;;
    --partial)
      PARTIAL_DEFAULT="$2"; shift 2;;
    --touch-cfg)
      TOUCH_CFG_DEFAULT="$2"; shift 2;;
    --dry-run)
      DRY_RUN=1; shift;;
    *)
      echo "Unknown option: $1"; exit 1;;
  esac
done

# Root check
if [[ $EUID -ne 0 ]]; then
  echo "This script must be run with sudo or as root." >&2
  exit 1
fi

# Validate
if [[ ! -f "$APP_PATH" ]]; then
  echo "Cannot find app.py at $APP_PATH" >&2
  exit 1
fi
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "Python executable not found: $PYTHON_BIN" >&2
  exit 1
fi

UNIT_PATH="/etc/systemd/system/$SERVICE_NAME"

read -r -d '' UNIT_CONTENT <<UNIT
[Unit]
Description=Pi E-Ink HMI
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$WORKDIR
Environment=HMI_API_BASE=$API_BASE_DEFAULT
Environment=HMI_POLL_SECS=$POLL_SECS_DEFAULT
Environment=HMI_PARTIAL=$PARTIAL_DEFAULT
Environment=HMI_TOUCH_CFG=$TOUCH_CFG_DEFAULT
ExecStart=$(command -v "$PYTHON_BIN") $APP_PATH
Restart=on-failure
User=$RUN_USER

[Install]
WantedBy=multi-user.target
UNIT

if [[ $DRY_RUN -eq 1 ]]; then
  echo "--- $UNIT_PATH (dry run) ---"
  echo "$UNIT_CONTENT"
  exit 0
fi

# Write unit
echo "Installing systemd unit: $UNIT_PATH"
echo "$UNIT_CONTENT" > "$UNIT_PATH"
chmod 644 "$UNIT_PATH"

# Reload and enable
systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
# Prefer restart if already running
if systemctl is-active --quiet "$SERVICE_NAME"; then
  systemctl restart "$SERVICE_NAME"
else
  systemctl start "$SERVICE_NAME"
fi

# Show status summary
systemctl --no-pager --full status "$SERVICE_NAME" || true

echo "\nDone. Manage the service with:"
echo "  sudo systemctl restart $SERVICE_NAME"
echo "  sudo systemctl status $SERVICE_NAME"
echo "\nTo update settings, re-run this script with new options or edit $UNIT_PATH and run:"
echo "  sudo systemctl daemon-reload && sudo systemctl restart $SERVICE_NAME"
