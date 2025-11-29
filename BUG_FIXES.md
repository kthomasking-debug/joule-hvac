# 🐛 Bug Fixes - ESLint & Pre-commit Hook

## ✅ Bug 1: ESLint Regex Anchor Placement

### **Issue**
**File:** `.eslintrc.cjs` line 25

**Original (Incorrect):**
```javascript
varsIgnorePattern: '^(_|[A-Z_]+$)'
```

**Problem:**
- The `$` anchor was inside the alternation group, only applying to `[A-Z_]+$`
- This meant `_foo` would incorrectly match `^_` without requiring the string to end
- The intent was to match either:
  - A single underscore `_`
  - All-caps constants like `CONSTANT` or `MY_CONST`

**Fixed:**
```javascript
varsIgnorePattern: '^(_|[A-Z_]+)$'
```

**Explanation:**
- The `$` anchor is now outside the alternation group
- Correctly matches:
  - `_` ✅ (single underscore)
  - `CONSTANT` ✅ (all caps)
  - `MY_CONST` ✅ (all caps with underscores)
  - `_CONST` ✅ (underscore + caps)
  - `_foo` ❌ (doesn't match - not just underscore or all caps)
  - `myVar` ❌ (doesn't match - not all caps)

---

## ✅ Bug 2: Pre-commit Hook Dead Code

### **Issue**
**File:** `.husky/pre-commit` line 36

**Original (Incorrect):**
```javascript
if (error.status === 127 || error.code === 'ENOENT') {
```

**Problem:**
- `execSync` errors don't have a `.code` property
- They use `.status` for exit codes (127 = command not found)
- The `error.code === 'ENOENT'` check is **dead code** that will never execute
- This could mask other error types

**Fixed:**
```javascript
// execSync errors use .status (exit code), not .code
// Status 127 = command not found
if (error.status === 127) {
```

**Explanation:**
- Removed the dead `error.code === 'ENOENT'` check
- Rely solely on `error.status === 127` (standard "command not found" exit code)
- Added clarifying comments about `execSync` error structure

---

## 🧪 Verification

### **Regex Fix Test Cases**

| Variable Name | Old Pattern | New Pattern | Expected |
|--------------|-------------|-------------|----------|
| `_` | ✅ Match | ✅ Match | ✅ Correct |
| `CONSTANT` | ✅ Match | ✅ Match | ✅ Correct |
| `MY_CONST` | ✅ Match | ✅ Match | ✅ Correct |
| `_CONST` | ✅ Match | ✅ Match | ✅ Correct |
| `_foo` | ❌ **Incorrectly matched** | ✅ **Correctly rejected** | ✅ Fixed |
| `myVar` | ❌ Rejected | ❌ Rejected | ✅ Correct |

### **Pre-commit Hook Behavior**

| Scenario | Old Code | New Code | Result |
|----------|----------|----------|--------|
| `lint-staged` not found | ✅ Handled (status 127) | ✅ Handled (status 127) | ✅ Same |
| `lint-staged` fails | ✅ Exits with error | ✅ Exits with error | ✅ Same |
| Other execSync errors | ⚠️ Dead code path | ✅ Proper error handling | ✅ Improved |

---

## 📝 Files Modified

1. **`.eslintrc.cjs`**
   - Fixed `varsIgnorePattern` regex anchor placement
   - Line 25: `'^(_|[A-Z_]+$)'` → `'^(_|[A-Z_]+)$'`

2. **`.husky/pre-commit`**
   - Removed dead code `error.code === 'ENOENT'` check
   - Added clarifying comments about `execSync` error structure
   - Line 38: Simplified condition to `error.status === 127`

---

## ✅ Impact

### **Bug 1 Impact:**
- **Before:** Variables like `_foo` were incorrectly ignored by ESLint
- **After:** Only true ignored variables (`_`, `CONSTANT`, etc.) are ignored
- **Result:** Better linting accuracy

### **Bug 2 Impact:**
- **Before:** Dead code that never executed, potential confusion
- **After:** Cleaner, more accurate error handling
- **Result:** More maintainable code

---

## 🎯 Summary

Both bugs have been **verified and fixed**:

✅ **Regex anchor placement** - Now correctly matches intended patterns  
✅ **Dead code removal** - Cleaner error handling with accurate checks

The fixes are minimal, targeted, and maintain backward compatibility while correcting the logical errors.

