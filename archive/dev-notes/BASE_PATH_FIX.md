# 🔧 Base Path Configuration Fix

## Problem Identified

The `vite.config.js` was hardcoded to `base: "/"`, which:

- ✅ Works for Netlify (domain root)
- ❌ **Breaks GitHub Pages** (subdirectory deployment like `/engineering-tools/`)

This would cause routing failures and 404 errors when deploying to GitHub Pages because all assets and routes would look for files at `/` instead of `/engineering-tools/`.

## Solution Implemented

### ✨ Environment-Dependent Base Path

The configuration now uses an environment variable that can be set differently for each deployment platform:

```javascript
// vite.config.js
export default defineConfig({
  // Environment-dependent base path
  base: process.env.VITE_BASE_PATH || "/",
  // ...
});
```

### 📦 Platform-Specific Build Scripts

Added dedicated build scripts in `package.json`:

```json
{
  "scripts": {
    "build": "vite build", // Default: base=/
    "build:gh-pages": "cross-env VITE_BASE_PATH=/engineering-tools/ vite build", // GitHub Pages
    "build:netlify": "cross-env VITE_BASE_PATH=/ vite build", // Netlify
    "predeploy": "npm run build:gh-pages", // Auto-runs before deploy
    "deploy": "gh-pages -d dist" // GitHub Pages deploy
  }
}
```

### 🔄 Automatic Deployment Configuration

**Netlify (`netlify.toml`):**

```toml
[build]
  command = "npm run build:netlify"  # Uses VITE_BASE_PATH=/
  publish = "dist"
```

**GitHub Pages:**

```bash
npm run deploy  # Automatically runs build:gh-pages first
```

## ✅ Verification

### GitHub Pages Build

```bash
npm run build:gh-pages
```

**Result:** Assets use `/engineering-tools/` prefix

- `/engineering-tools/assets/index-*.js`
- `/engineering-tools/vite.svg`

### Netlify Build

```bash
npm run build:netlify
```

**Result:** Assets use `/` prefix (root)

- `/assets/index-*.js`
- `/vite.svg`

## 🚀 How to Use

### For GitHub Pages Deployment:

```bash
npm run deploy
```

- Automatically uses `build:gh-pages`
- Sets `VITE_BASE_PATH=/engineering-tools/`
- Deploys to `https://username.github.io/engineering-tools/`

### For Netlify Deployment:

```bash
npm run build:netlify
# Then drag dist/ to https://app.netlify.com/drop
```

- Sets `VITE_BASE_PATH=/`
- Deploys to `https://your-site.netlify.app/`

### For Local Development:

```bash
npm run dev
```

- Uses default `base: "/"`
- Works at `http://localhost:5173/`

## 📝 Customization

### Different Repository Name?

If your GitHub repo is **NOT** named `engineering-tools`, update the build script:

```json
"build:gh-pages": "cross-env VITE_BASE_PATH=/your-repo-name/ vite build"
```

### Custom Domain?

For custom domains or `username.github.io` sites:

```json
"build:gh-pages": "cross-env VITE_BASE_PATH=/ vite build"
```

## 🔍 Technical Details

### Package Added

- **`cross-env`**: Cross-platform environment variable support (Windows, Mac, Linux)

### Files Modified

1. ✅ `vite.config.js` - Environment variable support
2. ✅ `package.json` - Platform-specific build scripts
3. ✅ `netlify.toml` - Uses `build:netlify` script
4. ✅ `DEPLOYMENT.md` - Updated documentation
5. ✅ `DEPLOY_NETLIFY.md` - Updated documentation

### How It Works

1. **Vite reads** `process.env.VITE_BASE_PATH` during build
2. **cross-env sets** the environment variable before running Vite
3. **React Router** automatically uses `import.meta.env.BASE_URL` for routing
4. **All assets** get the correct path prefix

## 🎯 Result

✅ **GitHub Pages** - Works with `/engineering-tools/` subdirectory  
✅ **Netlify** - Works at domain root `/`  
✅ **Development** - Works at `localhost:5173/`  
✅ **No manual config changes** needed between deployments

The app now correctly handles both deployment scenarios without manual configuration changes!
