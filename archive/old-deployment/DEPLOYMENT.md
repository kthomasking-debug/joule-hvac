# 🚀 Deploying Joule HVAC to GitHub Pages

This guide will help you deploy the Joule HVAC application to GitHub Pages.

## 📋 Prerequisites

- A GitHub account
- Git installed locally
- Node.js and npm installed
- This project cloned/forked to your GitHub account

## ⚙️ Configuration

The project is **already configured** for GitHub Pages deployment with:

✅ **Basename routing** - Routes work correctly with repository paths  
✅ **404 redirect** - Direct navigation and page refreshes work  
✅ **Build optimization** - Automatic 404.html generation  
✅ **Deploy scripts** - One-command deployment

## 🔧 Setup Steps

### 1. Update the Repository Name

If your repository name is **NOT** `engineering-tools`, update the build script in **package.json:**

```json
"build:gh-pages": "cross-env VITE_BASE_PATH=/your-repo-name/ vite build",
```

The project now uses environment variables for flexible deployment:

- **GitHub Pages:** Uses `VITE_BASE_PATH=/engineering-tools/` (set in `build:gh-pages` script)
- **Netlify/Vercel:** Uses `VITE_BASE_PATH=/` (set in `build:netlify` script)
- **Development:** Uses `base: "/"` (default)

**For custom domains or username.github.io sites:**

Update the `build:gh-pages` script to use `/`:

```json
"build:gh-pages": "cross-env VITE_BASE_PATH=/ vite build",
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Test the Build Locally

```bash
npm run build
npm run preview
```

Visit `http://localhost:4173/engineering-tools/` (or your repo path) to verify.

## 🚀 Deploy to GitHub Pages

### Option 1: Automated Deploy (Recommended)

Run the deploy command:

```bash
npm run deploy
```

This will:

1. Build the production bundle (`npm run build`)
2. Copy `index.html` to `404.html` for routing
3. Deploy the `dist` folder to the `gh-pages` branch
4. Push to GitHub

### Option 2: Manual Deploy

```bash
# Build
npm run build

# Deploy using gh-pages
npx gh-pages -d dist
```

## 🌐 Enable GitHub Pages

After deploying:

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under "Source", select:
   - Branch: `gh-pages`
   - Folder: `/ (root)`
4. Click **Save**

GitHub will provide your live URL:

```
https://yourusername.github.io/engineering-tools/
```

## ✅ Verify Deployment

1. Visit your GitHub Pages URL
2. Test navigation between pages
3. **Test direct navigation**: Visit `https://yourusername.github.io/engineering-tools/forecast` directly
4. **Test page refresh**: Refresh on any page (should not show 404)

## 🔄 Updating Your Site

Whenever you make changes:

```bash
git add .
git commit -m "Update application"
git push origin main
npm run deploy
```

The `deploy` script automatically rebuilds and deploys.

## 🐛 Troubleshooting

### Issue: Pages show 404 on refresh

**Solution:** The 404.html redirect should handle this. Verify:

- `public/404.html` exists
- `index.html` has the redirect handler script
- `base` path in `vite.config.js` matches your repo name

### Issue: Assets not loading (blank page)

**Solution:** Check the base path:

```javascript
// vite.config.js
base: '/your-actual-repo-name/',  // Must match GitHub repo name
```

### Issue: Routes don't work

**Solution:** Ensure `basename` is set correctly in `src/main.jsx`:

```javascript
const basename = import.meta.env.BASE_URL || '/';
const router = createBrowserRouter([...], { basename });
```

### Issue: CSS/JS not loading

**Solution:**

1. Clear browser cache
2. Check browser console for 404 errors
3. Verify `base` path in `vite.config.js`

## 📁 Project Structure for Deployment

```
engineering-tools/
├── dist/               # Built files (auto-generated, deployed to gh-pages)
│   ├── index.html     # Main entry point
│   ├── 404.html       # Auto-copied from index.html
│   └── assets/        # Bundled JS/CSS
├── public/
│   └── 404.html       # GitHub Pages 404 redirect template
├── src/
│   └── main.jsx       # Router with basename configuration
├── vite.config.js     # Base path configuration
└── package.json       # Homepage and deploy scripts
```

## 🔒 Environment Variables

For production deployment with API keys:

1. **Never commit API keys to GitHub**
2. Use GitHub Secrets for sensitive data
3. Configure environment variables in GitHub Actions (if using CI/CD)

Current setup stores API keys in:

- Local Storage (browser-side)
- User configures via Settings page

## 🎯 Custom Domain Setup

To use a custom domain like `joule-hvac.com`:

1. **Update configuration:**

```javascript
// vite.config.js
base: '/',  // Root path for custom domain

// package.json
"homepage": "https://joule-hvac.com",
```

2. **Add CNAME file to public folder:**

```bash
echo "joule-hvac.com" > public/CNAME
```

3. **Configure DNS:**

- Add a CNAME record pointing to `yourusername.github.io`
- Or add A records for GitHub Pages IPs

4. **Enable in GitHub Settings:**

- Go to Settings → Pages
- Enter your custom domain
- Enable "Enforce HTTPS"

## 📚 Additional Resources

- [GitHub Pages Documentation](https://docs.github.com/en/pages)
- [Vite Deployment Guide](https://vitejs.dev/guide/static-deploy.html)
- [React Router Documentation](https://reactrouter.com/)

## 🎉 Success!

Your Joule HVAC application is now live on GitHub Pages! 🚀

Visit your site and test all features, including:

- ✅ Home page loads
- ✅ Navigation works
- ✅ Direct URL access works
- ✅ Page refresh works
- ✅ Voice assistant functions
- ✅ Settings persist

---

**Questions or issues?** Open an issue on the GitHub repository.
