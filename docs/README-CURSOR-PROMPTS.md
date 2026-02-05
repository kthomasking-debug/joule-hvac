# Cursor Prompt Templates - Quick Guide

## TL;DR - Just Copy & Paste This

When you need a fix verified by the bridge health check, use:

```
REQUIREMENTS:
- Make the smallest change that could work
- Don't claim success until you run: ./scripts/validate-bridge-health.sh and it prints JOULE_BRIDGE_OK=1
- If command output is unknown, ask for it—don't guess
- Keep changes in <file-list> only
- Summarize: root cause, fix, and why the oracle proves it

ORACLE: ./scripts/validate-bridge-health.sh | grep "JOULE_BRIDGE_OK=1"
FILES: <comma-separated-file-list>
SCOPE: <brief-description>

<your-actual-request>
```

---

## When Do I Need This?

**Use this template when:**
- ✅ You need a minimal, focused fix
- ✅ You want verification via a test/script
- ✅ You need clear documentation of changes
- ✅ The fix must be verified before claiming success

**Skip this template when:**
- ❌ Just asking questions or exploring code
- ❌ Making large refactors (use simpler prompts)
- ❌ Quick syntax fixes that don't need verification

---

## How to Use

1. **Copy the template** from `.cursor-prompt-bridge.txt` (or the short version above)
2. **Fill in the placeholders:**
   - `<file-list>`: Comma-separated list like `src/lib/jouleBridgeApi.js, src/components/JouleBridgeSettings.jsx`
   - `<brief-description>`: One sentence like "Increase timeout from 5s to 30s"
   - `<your-actual-request>`: Your actual problem/request
3. **Paste it in Cursor** before your actual request
4. **The AI will:**
   - Make minimal changes
   - Run the oracle command
   - Only claim success if oracle passes
   - Summarize root cause, fix, and proof

---

## Example: Real Usage

**Before (without template):**
```
The bridge health check is timing out. Fix it.
```
*Problem: AI might make big changes, won't verify, unclear scope*

**After (with template):**
```
REQUIREMENTS:
- Make the smallest change that could work
- Don't claim success until you run: ./scripts/validate-bridge-health.sh and it prints JOULE_BRIDGE_OK=1
- If command output is unknown, ask for it—don't guess
- Keep changes in src/lib/jouleBridgeApi.js only
- Summarize: root cause, fix, and why the oracle proves it

ORACLE: ./scripts/validate-bridge-health.sh | grep "JOULE_BRIDGE_OK=1"
FILES: src/lib/jouleBridgeApi.js
SCOPE: Increase checkBridgeHealth timeout from 5s to 30s

The bridge health check is timing out after 5 seconds. Increase it to 30 seconds.
```
*Result: AI makes minimal change, verifies with oracle, documents everything*

---

## Available Templates

1. **`.cursor-prompt-bridge.txt`** - For bridge-related fixes (uses validate-bridge-health.sh)
2. **`.cursor-prompt-short.txt`** - Generic template (fill in your own oracle)
3. **`.cursor-prompt-template.md`** - Full documentation with examples

---

## Common Oracles for This Project

| Use Case | Oracle Command |
|----------|---------------|
| Bridge health | `./scripts/validate-bridge-health.sh \| grep "JOULE_BRIDGE_OK=1"` |
| Build success | `npm run build 2>&1 \| grep -q "built in"` |
| Dev server running | `curl -s http://localhost:5173 > /dev/null && echo "OK"` |
| Bridge server running | `curl -s http://localhost:8080/health > /dev/null && echo "OK"` |
| No lint errors | `npm run lint 2>&1 \| grep -q "No lint errors"` |

---

## Pro Tips

1. **Be specific about files**: Only list files that MUST change
2. **Use the right oracle**: Match the oracle to what you're actually fixing
3. **Ask if unsure**: If you don't know what the oracle should output, say "If command output is unknown, ask for it"
4. **One fix at a time**: Don't combine multiple unrelated fixes in one prompt

---

## Why This Works

- **Smallest change**: Forces focused, minimal fixes
- **Oracle verification**: Proves the fix actually works
- **File scope**: Prevents accidental changes elsewhere
- **Documentation**: Clear summary helps future debugging

