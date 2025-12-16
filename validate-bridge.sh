#!/bin/bash
# Validate that the Joule Bridge is running and responding correctly

set -e

BRIDGE_URL="${BRIDGE_URL:-http://localhost:8080}"
HEALTH_ENDPOINT="${BRIDGE_URL}/health"

echo "Validating Joule Bridge at ${BRIDGE_URL}..."

# Check if bridge is responding
if curl -s -f --max-time 5 "${HEALTH_ENDPOINT}" > /dev/null 2>&1; then
    echo "✓ Bridge health check passed"
    echo "JOULE_BRIDGE_OK=1"
    exit 0
else
    echo "✗ Bridge health check failed"
    echo "JOULE_BRIDGE_OK=0"
    exit 1
fi




