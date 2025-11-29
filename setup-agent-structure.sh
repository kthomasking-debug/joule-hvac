#!/bin/bash
# Setup script to create agent directory structure

echo "Creating agent directory structure..."

# Create directories
mkdir -p agent
mkdir -p state
mkdir -p config
mkdir -p logs
mkdir -p knowledge
mkdir -p docs/wiring_diagrams
mkdir -p docs/manufacturer_specs

echo "✅ Directories created"

# Create empty files with .gitkeep
touch agent/.gitkeep
touch state/.gitkeep
touch config/.gitkeep
touch logs/.gitkeep
touch knowledge/.gitkeep
touch docs/.gitkeep

echo "✅ Structure ready"

# Copy sample files (if they exist)
if [ -f "state/current_status.json.example" ]; then
  cp state/current_status.json.example state/current_status.json
  echo "✅ Copied state/current_status.json"
fi

if [ -f "config/settings.json.example" ]; then
  cp config/settings.json.example config/settings.json
  echo "✅ Copied config/settings.json"
fi

if [ -f "config/policy.json.example" ]; then
  cp config/policy.json.example config/policy.json
  echo "✅ Copied config/policy.json"
fi

echo ""
echo "📁 Directory structure:"
tree -L 2 -a agent state config logs knowledge docs 2>/dev/null || find agent state config logs knowledge docs -type d | head -20

echo ""
echo "✅ Setup complete!"

