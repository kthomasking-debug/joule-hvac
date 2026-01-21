#!/bin/bash
# Oracle command to validate test fixes
# Returns 0 if all critical fixes are validated, 1 otherwise

set -e

echo "Validating test fixes..."

# Check 1: VoiceListenDurationInput is exported
echo -n "Checking VoiceListenDurationInput export... "
if grep -q "^export const VoiceListenDurationInput" src/pages/Settings.jsx; then
    echo "✓"
else
    echo "✗"
    exit 1
fi

# Check 2: cachedStorage returns default on JSON parse error
echo -n "Checking cachedStorage JSON error handling... "
if grep -A 10 "catch (parseError)" src/utils/cachedStorage.js | grep -q "return defaultValue"; then
    echo "✓"
else
    echo "✗"
    exit 1
fi

# Check 3: Parser uses setMode (not switchMode) with value field
echo -n "Checking parser setMode consistency... "
if grep -q 'action: "setMode", value:' src/utils/askJouleParser.js && ! grep -q 'action: "switchMode"' src/utils/askJouleParser.js; then
    echo "✓"
else
    echo "✗"
    exit 1
fi

# Check 4: Preset modes are handled
echo -n "Checking preset modes... "
if grep -q 'action: "presetSleep"' src/utils/askJouleParser.js && \
   grep -q 'action: "presetAway"' src/utils/askJouleParser.js && \
   grep -q 'action: "presetHome"' src/utils/askJouleParser.js; then
    echo "✓"
else
    echo "✗"
    exit 1
fi

# Check 5: Verify test file exists and imports correctly
echo -n "Checking test file can import component... "
if grep -q "import.*VoiceListenDurationInput.*from.*Settings" src/pages/__tests__/VoiceListenDurationInput.test.jsx 2>/dev/null; then
    echo "✓"
else
    echo "⚠ (test file may use different import)"
fi

echo ""
echo "✓ All test fixes validated successfully"
exit 0

