# 🚀 Quick Deploy Reference - Joule HVAC

## ⚡ One-Line Deploy

```bash
npm run deploy
```

That's it! This command:
1. ✅ Builds the production app
2. ✅ Creates 404.html for routing
3. ✅ Deploys to GitHub Pages
4. ✅ Pushes to `gh-pages` branch

## 🔧 Before First Deploy

### Step 1: Update Configuration (IMPORTANT!)

**If your repo is NOT named `engineering-tools`, update these:**

**`package.json`** - Line 6:
```json
"homepage": "https://YOUR-USERNAME.github.io/YOUR-REPO-NAME",
```

**`vite.config.js`** - Line 9:
```javascript
base: '/YOUR-REPO-NAME/',
```

### Step 2: Enable GitHub Pages

1. Push your code to GitHub
2. Run `npm run deploy`
3. Go to repo **Settings** → **Pages**
4. Set Source to: **Branch: `gh-pages`**, **Folder: `/ (root)`**
5. Save and wait ~2 minutes

Your site will be live at:
```
https://YOUR-USERNAME.github.io/YOUR-REPO-NAME/
```

## 📝 Common Workflows

### Deploy Changes
```bash
git add .
git commit -m "Your update message"
git push
npm run deploy
```

### Test Before Deploy
```bash
npm run build
npm run preview
# Visit http://localhost:4173/engineering-tools/
```

### Check Build Size
```bash
npm run build
# Look for chunk size warnings
```

## 🐛 Troubleshooting

### Blank page or 404 errors?
**Check base path matches repo name:**
```javascript
// vite.config.js
base: '/YOUR-ACTUAL-REPO-NAME/',  // Must match!
```

### Routes not working?
**Verify 404.html exists:**
```bash
dir dist\404.html  # Windows
ls dist/404.html   # Mac/Linux
```

### Assets not loading?
1. Clear browser cache (Ctrl+Shift+R / Cmd+Shift+R)
2. Check browser console for 404s
3. Verify `base` path in vite.config.js

### Still having issues?
Read the full guide: [DEPLOYMENT.md](./DEPLOYMENT.md)

## 📦 Files Changed for GitHub Pages

| File | Purpose |
|------|---------|
| `vite.config.js` | Base path for assets |
| `src/main.jsx` | Router basename config |
| `package.json` | Homepage URL & deploy scripts |
| `index.html` | Redirect handler script |
| `public/404.html` | Fallback for direct navigation |

## 🎯 Custom Domain Setup

Using `yourdomain.com` instead of GitHub Pages URL?

1. **Update config:**
```javascript
// vite.config.js
base: '/',

// package.json
"homepage": "https://yourdomain.com",
```

2. **Add CNAME:**
```bash
echo "yourdomain.com" > public/CNAME
```

3. **Configure DNS** (at your domain registrar):
```
Type: CNAME
Name: www (or @)
Value: YOUR-USERNAME.github.io
```

4. **Enable in GitHub:** Settings → Pages → Custom domain

## ✅ Quick Checklist

- [ ] Updated `homepage` in package.json
- [ ] Updated `base` in vite.config.js
- [ ] Ran `npm install` (installed gh-pages)
- [ ] Tested with `npm run build && npm run preview`
- [ ] Pushed code to GitHub
- [ ] Ran `npm run deploy`
- [ ] Enabled Pages in GitHub Settings
- [ ] Tested live URL
- [ ] Tested direct navigation to routes
- [ ] Tested page refresh

## 🎉 Success Indicators

✅ Deploy command completes without errors  
✅ `gh-pages` branch appears in GitHub  
✅ GitHub Pages shows "Your site is published"  
✅ Can navigate between pages  
✅ Can refresh pages without 404  
✅ Can access routes directly (e.g., `/forecast`)  

---

**Need more help?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for the complete guide.

