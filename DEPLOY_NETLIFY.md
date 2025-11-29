# 🚀 Deploy Joule HVAC to Netlify

Netlify is **easier** than GitHub Pages! You can drag-and-drop your `dist` folder directly.

## ⚡ Quick Deploy (Recommended)

### Method 1: Drag & Drop (Fastest - 2 minutes!)

1. **Build your app for Netlify:**

   ```bash
   npm run build:netlify
   ```

   Or use the generic build (defaults to `/` base path):
   
   ```bash
   npm run build
   ```

2. **Go to [Netlify Drop](https://app.netlify.com/drop)**

   - No account needed for the first deployment!
   - You'll get a random URL like `random-name-12345.netlify.app`

3. **Drag the entire `dist` folder** onto the page
   - Wait ~30 seconds for upload
   - **Done!** Your site is live!

### Method 2: Netlify Dashboard (With Account)

1. **Create free account** at [netlify.com](https://netlify.com)

2. **Build your app:**

   ```bash
   npm run build
   ```

3. **In Netlify Dashboard:**

   - Click "Add new site" → "Deploy manually"
   - Drag the `dist` folder
   - Click "Deploy site"

4. **Customize your URL** (optional):
   - Go to Site settings → Change site name
   - `your-cool-name.netlify.app`

---

## 🔧 Configuration for Netlify

The project is **already configured** for Netlify! The configuration uses environment variables for flexible deployment:

### Environment-Based Base Path

**vite.config.js** now uses:

```javascript
// Automatically uses VITE_BASE_PATH environment variable
base: process.env.VITE_BASE_PATH || "/",
```

The build scripts handle this:

- `npm run build:netlify` → Sets `VITE_BASE_PATH=/`
- `npm run build:gh-pages` → Sets `VITE_BASE_PATH=/engineering-tools/`
- `npm run build` → Defaults to `/`

### netlify.toml (Already Configured)

The project includes this configuration:

```toml
# netlify.toml
[build]
  command = "npm run build:netlify"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  NODE_VERSION = "18"
```

This ensures:

- ✅ Netlify knows where your built files are
- ✅ React Router works on all routes
- ✅ Page refreshes work correctly

---

## 📦 Method 3: Netlify CLI (For Updates)

Install once:

```bash
npm install -g netlify-cli
```

### First Deploy:

```bash
npm run build
netlify deploy --prod --dir=dist
```

### Update Your Site:

```bash
npm run build
netlify deploy --prod --dir=dist
```

You'll be prompted to:

1. Authorize Netlify
2. Create a new site or link to existing one
3. Deploy!

---

## 🔄 Method 4: Continuous Deployment from GitHub (Advanced)

### Setup:

1. **Push your code to GitHub** (if not already)

2. **In Netlify Dashboard:**

   - New site → Import from Git
   - Connect GitHub
   - Select your repository

3. **Build settings:**

   ```
   Build command: npm run build
   Publish directory: dist
   ```

4. **Save & Deploy**

Now every `git push` automatically deploys! 🎉

---

## 🎯 Why Netlify is Easier than GitHub Pages

| Feature                  | Netlify                | GitHub Pages          |
| ------------------------ | ---------------------- | --------------------- |
| **Deploy method**        | Drag & drop            | Git push + scripts    |
| **SPA routing**          | Automatic              | Manual 404.html setup |
| **Custom domain**        | Free SSL, easy setup   | Requires DNS config   |
| **Build on push**        | Built-in CI/CD         | Requires Actions      |
| **Instant rollback**     | One-click              | Manual git revert     |
| **Forms**                | Built-in form handling | Not supported         |
| **Serverless functions** | Supported              | Not supported         |
| **Deploy previews**      | Automatic for PRs      | Manual setup          |

---

## ⚙️ Environment Variables (for API Keys)

If you need to set API keys:

### In Netlify Dashboard:

1. Site settings → Environment variables
2. Add variable:
   ```
   VITE_GROQ_API_KEY = your-key-here
   ```

### Access in code:

```javascript
const apiKey = import.meta.env.VITE_GROQ_API_KEY;
```

**Note:** For Joule HVAC, API keys are stored in browser localStorage (user-configurable via Settings page), so this isn't required.

---

## 🐛 Troubleshooting

### Issue: Blank page after deploy

**Solution:** Check `base` in vite.config.js:

```javascript
base: '/',  // Should be '/' for Netlify, not '/repo-name/'
```

### Issue: 404 on page refresh

**Solution:** Create `netlify.toml` with the redirect rule (see above).

Or add `public/_redirects` file:

```
/*    /index.html   200
```

### Issue: Assets not loading

1. Check browser console for errors
2. Verify `dist` folder was built correctly:
   ```bash
   npm run build
   dir dist  # Windows
   ls dist   # Mac/Linux
   ```

---

## 📊 Quick Comparison

### Netlify (Recommended for you):

✅ **5 minutes** setup  
✅ Drag & drop  
✅ Free SSL  
✅ Automatic SPA routing  
✅ Custom domain easy  
✅ Rollback with one click  
✅ 100GB bandwidth/month free

### GitHub Pages (Alternative):

✅ Free hosting  
✅ Good for open source  
⚠️ Requires Git knowledge  
⚠️ Manual SPA routing setup  
⚠️ Build process more complex

---

## 🎉 Complete Workflow

### Initial Deploy:

```bash
# 1. Configure for Netlify
# Update base: '/' in vite.config.js

# 2. Build
npm run build

# 3. Deploy
# Go to https://app.netlify.com/drop
# Drag the dist folder
```

### Update Your Site:

```bash
# 1. Make changes to your code

# 2. Rebuild
npm run build

# 3. Redeploy
# Go to your site in Netlify dashboard
# Click "Deploys" → "Deploy site" → Drag dist folder
```

---

## 🌐 Custom Domain Setup

### Your domain at Netlify:

1. **In Netlify Dashboard:**

   - Domain settings → Add custom domain
   - Enter: `joule-hvac.com`

2. **At your domain registrar:**

   - Add DNS records Netlify provides
   - Usually: CNAME to `your-site.netlify.app`

3. **Enable HTTPS:**
   - Netlify does this automatically (free Let's Encrypt SSL)

---

## 📋 Checklist

- [ ] Updated `base: '/'` in vite.config.js
- [ ] Created `netlify.toml` (optional but recommended)
- [ ] Ran `npm run build`
- [ ] Verified `dist` folder exists and has files
- [ ] Deployed to Netlify (drag & drop or CLI)
- [ ] Tested live URL
- [ ] Tested navigation between pages
- [ ] Tested page refresh on different routes
- [ ] Tested on mobile

---

## 🆚 GitHub Pages vs Netlify - Choose Your Path

**Use Netlify if:**

- ✅ You want the easiest deployment
- ✅ You want drag-and-drop
- ✅ You need serverless functions later
- ✅ You want instant rollbacks
- ✅ You want deploy previews

**Use GitHub Pages if:**

- ✅ You're already comfortable with Git
- ✅ Your project is open source
- ✅ You want everything in one place (code + hosting)

---

**Recommended:** Start with Netlify drag-and-drop. It takes 2 minutes and you can always switch later!

## 🎯 Next Steps

1. Update `vite.config.js` (change `base` to `/`)
2. Run `npm run build`
3. Go to [https://app.netlify.com/drop](https://app.netlify.com/drop)
4. Drag `dist` folder
5. **Done!** 🎉

Your app will be live in ~30 seconds.
