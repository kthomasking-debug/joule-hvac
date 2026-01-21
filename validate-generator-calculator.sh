#!/usr/bin/env bash
set -euo pipefail

# Build the app to validate Generator Calculator page bundles correctly
npm run build > /dev/null 2>&1

# Success indicator (separate from validate-bridge.sh oracle)
echo "GENERATOR_CALCULATOR_VALIDATION_OK=1"
