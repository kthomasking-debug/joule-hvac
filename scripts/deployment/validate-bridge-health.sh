#!/bin/bash
# Validation script for Joule Bridge health
# This checks the actual user-visible state, not just server liveness
#
# Exit codes (semantically meaningful for automation):
#   0 = healthy and connected
#   1 = server unhealthy
#   2 = unpaired (no devices or wrong device_id)
#   3 = paired but unreachable (device offline)
#   4 = status invalid (bad JSON or unexpected response)
#
# Environment variables:
#   JOULE_BRIDGE_URL - Bridge URL (default: http://localhost:8080)
#   REQUIRE_PAIRED - Require paired device for success (default: 1)
#                     0 = server health only, 1 = require paired device

set -euo pipefail

BRIDGE_URL="${JOULE_BRIDGE_URL:-http://localhost:8080}"
REQUIRE_PAIRED="${REQUIRE_PAIRED:-1}"

# Curl with timeouts to prevent hanging
CURL="curl -fsS --max-time 3 --connect-timeout 2"
CURL_OPTS="--max-time 3 --connect-timeout 2"

# Temp file cleanup on exit
TMPFILES=()
cleanup() {
    for f in "${TMPFILES[@]}"; do
        rm -f "$f" 2>/dev/null || true
    done
}
trap cleanup EXIT

# Helper function to get HTTP response body and status code
# Uses a sentinel line to safely separate body from code (handles multi-line JSON)
curl_with_code() {
    local url="$1"
    local tmp
    tmp="$(mktemp)"
    TMPFILES+=("$tmp")
    local code
    code="$(curl -sS -o "$tmp" -w "%{http_code}" $CURL_OPTS "$url" 2>/dev/null || echo "000")"
    cat "$tmp" 2>/dev/null || echo "{}"
    echo
    echo "__HTTP_CODE__=$code"
}

# Parse response from curl_with_code (handles multi-line bodies safely)
parse_http_code() {
    echo "$1" | sed -n 's/^__HTTP_CODE__=//p' | tail -n 1
}

parse_http_body() {
    echo "$1" | sed '/^__HTTP_CODE__=/,$d'
}

echo "Validating Joule Bridge health..."
echo "Bridge URL: $BRIDGE_URL"
echo ""

# 1. Check server is responding
echo "1. Checking server health..."
if ! $CURL "${BRIDGE_URL}/health" >/dev/null 2>/dev/null; then
    echo "❌ FAIL: Server health check failed"
    exit 1  # Exit code 1 = server unhealthy
fi
echo "✅ Server is responding"

# 2. Check if any devices are paired
echo ""
echo "2. Checking for paired devices..."
PAIRED_RESPONSE="$($CURL "${BRIDGE_URL}/api/paired" 2>/dev/null || echo '{"devices":[]}')"

# Validate JSON
if ! echo "$PAIRED_RESPONSE" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    echo "❌ FAIL: Paired endpoint returned invalid JSON"
    echo "   Response: $PAIRED_RESPONSE"
    exit 4  # Exit code 4 = status invalid
fi

DEVICE_COUNT=$(echo "$PAIRED_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(len(data.get('devices', [])))" 2>/dev/null || echo "0")

if [ "$DEVICE_COUNT" -eq "0" ]; then
    if [ "$REQUIRE_PAIRED" -eq "1" ]; then
        echo "❌ FAIL: No devices paired (REQUIRE_PAIRED=1)"
        echo "   Response: $PAIRED_RESPONSE"
        exit 2  # Exit code 2 = unpaired
    else
        echo "⚠️  WARNING: No devices paired (this is OK if you haven't paired yet)"
        echo "   Bridge is healthy but not connected to a thermostat"
        exit 0  # Not a failure, just not connected
    fi
fi
echo "✅ Found $DEVICE_COUNT paired device(s)"

# 3. Get primary device ID (validated)
echo ""
echo "3. Getting primary device ID..."
# Single HTTP call to get both body and status code (prevents race conditions)
PRIMARY_RESULT=$(curl_with_code "${BRIDGE_URL}/api/primary")
PRIMARY_HTTP_CODE=$(parse_http_code "$PRIMARY_RESULT")
PRIMARY_RESPONSE=$(parse_http_body "$PRIMARY_RESULT")

# Treat connection failure (000) as server unhealthy
if [ "$PRIMARY_HTTP_CODE" = "000" ]; then
    echo "❌ FAIL: Could not connect to /api/primary"
    exit 1  # Exit code 1 = server unhealthy
fi

# Validate JSON if we got a response
if [ -n "$PRIMARY_RESPONSE" ] && [ "$PRIMARY_HTTP_CODE" != "404" ]; then
    if ! echo "$PRIMARY_RESPONSE" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
        echo "❌ FAIL: Primary endpoint returned invalid JSON"
        echo "   HTTP code: $PRIMARY_HTTP_CODE"
        echo "   Response: $PRIMARY_RESPONSE"
        exit 4  # Exit code 4 = status invalid
    fi
fi

# Fallback to /api/paired if /api/primary doesn't exist (404) or fails
if [ "$PRIMARY_HTTP_CODE" = "404" ] || [ -z "$PRIMARY_RESPONSE" ]; then
    echo "   /api/primary not available, falling back to /api/paired"
    if [ "$DEVICE_COUNT" -gt "0" ]; then
        PRIMARY_ID=$(echo "$PAIRED_RESPONSE" | python3 -c '
import sys,json
d=json.load(sys.stdin)
devs=d.get("devices",[])
if not devs: print(""); raise SystemExit
x=devs[0]
print(x.get("device_id","") if isinstance(x,dict) else str(x))
' 2>/dev/null || echo "")
        VALIDATED="Unknown"  # Will validate via status response
    else
        PRIMARY_ID=""
        VALIDATED="False"
    fi
else
    PRIMARY_ID=$(echo "$PRIMARY_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); v=data.get('device_id', None); print('' if v is None else v)" 2>/dev/null || echo "")
    VALIDATED=$(echo "$PRIMARY_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); v=data.get('validated'); print('True' if v is True or v == 'True' else 'False')" 2>/dev/null || echo "False")
fi

if [ -z "$PRIMARY_ID" ] || [ "$PRIMARY_ID" = "null" ]; then
    echo "❌ FAIL: No primary device ID returned"
    echo "   Primary response: $PRIMARY_RESPONSE"
    exit 2  # Exit code 2 = unpaired
fi
echo "✅ Primary device ID: $PRIMARY_ID"
echo "   validated: $VALIDATED"

# If validated is Unknown (fallback mode), we'll validate via status response
# If validated is False, device is explicitly not reachable
if [ "$VALIDATED" = "False" ]; then
    echo "❌ FAIL: Device is paired but not reachable (may be offline)"
    ERROR_MSG=$(echo "$PRIMARY_RESPONSE" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data.get('error', ''))" 2>/dev/null || echo "")
    if [ -n "$ERROR_MSG" ]; then
        echo "   Error: $ERROR_MSG"
    fi
    echo "   Full primary response: $PRIMARY_RESPONSE"
    exit 3  # Exit code 3 = paired but unreachable
fi

# 4. Check status endpoint returns valid data
echo ""
echo "4. Checking device status..."
# Single HTTP call to get both body and status code (for better debugging)
STATUS_RESULT=$(curl_with_code "${BRIDGE_URL}/api/status?device_id=${PRIMARY_ID}")
STATUS_HTTP_CODE=$(parse_http_code "$STATUS_RESULT")
STATUS_RESPONSE=$(parse_http_body "$STATUS_RESULT")

# Treat connection failure (000) as server unhealthy
if [ "$STATUS_HTTP_CODE" = "000" ]; then
    echo "❌ FAIL: Could not connect to /api/status"
    exit 1  # Exit code 1 = server unhealthy
fi

# Validate JSON
if ! echo "$STATUS_RESPONSE" | python3 -c "import sys,json; json.load(sys.stdin)" >/dev/null 2>&1; then
    echo "❌ FAIL: Status endpoint returned invalid JSON"
    echo "   HTTP code: $STATUS_HTTP_CODE"
    echo "   Response: $STATUS_RESPONSE"
    exit 4  # Exit code 4 = status invalid
fi

TEMP=$(echo "$STATUS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('temperature', None); print('null' if v is None else v)" 2>/dev/null || echo "null")
TARGET_TEMP=$(echo "$STATUS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('target_temperature', None); print('null' if v is None else v)" 2>/dev/null || echo "null")
MODE=$(echo "$STATUS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); v=d.get('mode', None); print('null' if v is None else v)" 2>/dev/null || echo "null")

# If validated was Unknown, infer validation from status response
if [ "$VALIDATED" = "Unknown" ]; then
    if [ "$TEMP" != "null" ] || [ "$TARGET_TEMP" != "null" ] || [ "$MODE" != "null" ]; then
        VALIDATED="True"
        echo "✅ Device validated via status response"
    else
        VALIDATED="False"
        echo "❌ FAIL: Device is paired but not reachable (status returned no data)"
        echo "   HTTP code: $STATUS_HTTP_CODE"
        echo "   Response: $STATUS_RESPONSE"
        exit 3  # Exit code 3 = paired but unreachable
    fi
fi

if [ "$TEMP" = "null" ] && [ "$TARGET_TEMP" = "null" ] && [ "$MODE" = "null" ]; then
    echo "❌ FAIL: Status endpoint returned no data"
    echo "   HTTP code: $STATUS_HTTP_CODE"
    if [ "$STATUS_HTTP_CODE" = "404" ]; then
        echo "   Device not paired or wrong device_id"
        exit 2  # Exit code 2 = unpaired
    elif [ "$STATUS_HTTP_CODE" = "401" ] || [ "$STATUS_HTTP_CODE" = "403" ]; then
        echo "   Authentication/authorization error (server misconfigured)"
        exit 1  # Exit code 1 = server unhealthy
    elif [ "$STATUS_HTTP_CODE" = "503" ] || [ "$STATUS_HTTP_CODE" = "504" ]; then
        echo "   Device unreachable (timeout)"
        exit 3  # Exit code 3 = paired but unreachable
    else
        echo "   Response: $STATUS_RESPONSE"
        exit 4  # Exit code 4 = status invalid
    fi
fi

echo "✅ Status data retrieved:"
echo "   Temperature: ${TEMP}"
echo "   Target: ${TARGET_TEMP}"
echo "   Mode: ${MODE}"

# 5. Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ALL CHECKS PASSED"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Bridge is healthy and connected:"
echo "  • Server: ✅ Running"
echo "  • Device: ✅ Paired ($PRIMARY_ID)"
echo "  • Connection: ✅ Validated"
echo "  • Data: ✅ Available (temp: ${TEMP}, target: ${TARGET_TEMP}, mode: ${MODE})"
echo ""

# Machine-readable JSON output for CI/automation (printed last for easy scraping)
python3 <<EOF
import json

def to_num(x):
    x = x.strip()
    if x in ("", "null", "None"):
        return None
    try:
        return float(x)
    except Exception:
        return x  # preserve raw if non-numeric

result = {
    "ok": True,
    "device_id": "$PRIMARY_ID",
    "temperature": to_num("$TEMP"),
    "target": to_num("$TARGET_TEMP"),
    "mode": "$MODE",
}
print(json.dumps(result))
EOF

# Agent control: unambiguous success marker (printed last)
echo "JOULE_BRIDGE_OK=1"

exit 0
