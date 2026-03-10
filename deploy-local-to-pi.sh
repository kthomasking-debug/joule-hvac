#!/bin/bash
# Deploy the current local project to a Pi (no git required on the Pi)
# Usage: bash deploy-local-to-pi.sh <pi_ip> [<pi_project_dir>]

set -e

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 <pi_ip> [<pi_project_dir>]"
  exit 1
fi

PI_IP="$1"
PI_PROJECT_DIR="${2:-/home/pi/git/joule-hvac}"

# Build the app locally (customize as needed)
echo "Building app locally..."
npm run build


# Ensure target directory exists on Pi BEFORE rsync
echo "Ensuring target directory exists on pi@$PI_IP:$PI_PROJECT_DIR ..."
ssh pi@"$PI_IP" "mkdir -p ${PI_PROJECT_DIR}"

# Rsync the entire project to the Pi (excluding node_modules, .git, dist if not needed, etc.)
echo "Copying project to pi@$PI_IP:$PI_PROJECT_DIR ..."
rsync -avz --delete --exclude node_modules --exclude .git --exclude .venv --exclude dist --exclude '*.pyc' ./ pi@"$PI_IP":"$PI_PROJECT_DIR"/

# Copy the built dist folder separately (if needed by the Pi)
rsync -avz ./dist/ pi@"$PI_IP":"$PI_PROJECT_DIR"/dist/

# SSH into the Pi and run the setup script
ssh pi@"$PI_IP" bash -s <<ENDSSH
set -e
cd "$PI_PROJECT_DIR"
if [ -f ./setup-pi-zero.sh ]; then
  chmod +x ./setup-pi-zero.sh
  ./setup-pi-zero.sh
elif [ -f ./deploy-to-pi.sh ]; then
  chmod +x ./deploy-to-pi.sh
  ./deploy-to-pi.sh
else
  echo "No setup script found. Please run setup manually."
fi
ENDSSH

echo "Local deploy to Pi complete."
