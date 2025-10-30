# Deployment Guide for My-Love PWA

This guide covers the complete deployment process for the My-Love Progressive Web App to GitHub Pages.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Environment Configuration](#environment-configuration)
4. [Build Process](#build-process)
5. [Deployment](#deployment)
6. [Verification](#verification)
7. [Troubleshooting](#troubleshooting)
8. [Rollback Procedure](#rollback-procedure)
9. [Security Considerations](#security-considerations)

---

## Prerequisites

### Required Software

- **Node.js**: v18.x or later (v20.x recommended)
  - Check version: `node --version`
  - Download: https://nodejs.org/

- **npm**: v8.x or later (included with Node.js)
  - Check version: `npm --version`

- **Git**: v2.x or later
  - Check version: `git --version`

### GitHub Pages Setup

1. **Enable GitHub Pages** in your repository settings:
   - Navigate to: `Settings → Pages`
   - Source: `Deploy from a branch`
   - Branch: `gh-pages` (will be created automatically on first deployment)
   - Folder: `/ (root)`

2. **Verify base path** in `vite.config.ts`:
   ```typescript
   base: '/My-Love/',  // Must match your repository name
   ```

3. **HTTPS is automatically enforced** by GitHub Pages (required for PWA features).

---

## Quick Start

For experienced developers who want to deploy immediately:

```bash
# 1. Edit src/config/constants.ts with your relationship data
nano src/config/constants.ts

# 2. Install dependencies (if not already done)
npm install

# 3. Deploy (builds, tests, and deploys in one command)
npm run deploy
```

That's it! Your site will be live at `https://yourusername.github.io/My-Love/`

---

## Configuration

### Edit the App Constants

The app uses pre-configured constants for relationship data. Edit `src/config/constants.ts`:

```typescript
// src/config/constants.ts
export const APP_CONFIG = {
  defaultPartnerName: 'YourPartnerName',     // Partner's name (displayed throughout the app)
  defaultStartDate: '2024-01-15',             // Relationship start date (YYYY-MM-DD format)
  isPreConfigured: true,
} as const;
```

**Format Requirements:**
- `defaultPartnerName`: Any string (first name or nickname recommended)
- `defaultStartDate`: ISO 8601 date (YYYY-MM-DD), must be a valid past date

**Examples:**
```typescript
// Option 1
defaultPartnerName: 'Sarah',
defaultStartDate: '2024-01-15',

// Option 2
defaultPartnerName: 'My Love',
defaultStartDate: '2025-10-18',
```

**That's it!** When you build and deploy, these values will be hardcoded into the app.

---

## Build Process

### Manual Build

To build without deploying:

```bash
npm run build
```

**What happens:**
1. **TypeScript compilation** (`tsc -b`): Type-checks all source code
2. **Vite bundling**: Bundles React app with optimizations
3. **Environment variable injection**: Replaces `import.meta.env.VITE_*` with literal values
4. **Asset optimization**: Minifies JavaScript, optimizes CSS with Tailwind purge
5. **PWA generation**: Creates service worker (`sw.js`) and manifest
6. **Output**: Compiled app in `dist/` directory

**Build output structure:**
```
dist/
├── index.html              # Entry point
├── manifest.webmanifest    # PWA manifest
├── sw.js                   # Service worker (auto-generated)
├── registerSW.js           # Service worker registration helper
├── workbox-*.js            # Workbox runtime
├── icons/                  # PWA icons
│   ├── icon-192.png
│   └── icon-512.png
└── assets/                 # Bundled assets (hashed filenames)
    ├── index-[hash].js     # JavaScript bundle (~110KB gzipped)
    └── index-[hash].css    # CSS bundle (~3KB gzipped)
```

**Expected build output:**
```
✓ 2080 modules transformed.
dist/index.html                   0.62 kB │ gzip:   0.35 kB
dist/assets/index-*.css          16.64 kB │ gzip:   3.55 kB
dist/assets/index-*.js          354.14 kB │ gzip: 112.68 kB
✓ built in ~2s

PWA v1.1.0
precache  11 entries (365.66 KiB)
files generated
  dist/sw.js
  dist/workbox-*.js
```

**Build must succeed with:**
- ✅ Zero TypeScript errors
- ✅ Total bundle size <200KB gzipped (target: NFR001)
- ✅ Service worker generated successfully
- ✅ PWA manifest generated

### Preview Build Locally

Test the production build before deploying:

```bash
npm run preview
```

Open: http://localhost:4173/My-Love/

**Verify:**
- Partner name displays correctly
- Relationship duration calculates from start date
- No onboarding flow shown
- All themes work
- No console errors

---

## Deployment

### Automated Deployment (Recommended)

Deploy with automated smoke tests:

```bash
npm run deploy
```

**What happens:**
1. **Predeploy hook** runs automatically:
   - `npm run build` → Builds production bundle
   - `npm run test:smoke` → Runs smoke tests
2. **Smoke tests** validate build output (15 automated checks)
3. **gh-pages deployment** → Pushes `dist/` to `gh-pages` branch
4. **GitHub Actions** → Deploys to GitHub Pages
5. **Postdeploy message** → Suggests running post-deploy validation

**Expected output:**
```
> npm run deploy

> predeploy
> npm run build && npm run test:smoke

...build output...

> test:smoke
╔═══════════════════════════════════════════════════════╗
║        Pre-Deploy Smoke Tests for My-Love PWA       ║
╚═══════════════════════════════════════════════════════╝

✅ All smoke tests passed (15/15)
✨ Build is ready for deployment!

> deploy
> gh-pages -d dist

Published
```

**Deployment timing:**
- Build: ~2 seconds
- Smoke tests: ~1 second
- gh-pages push: ~5-10 seconds
- GitHub Pages propagation: 1-2 minutes

**Live URL:** `https://yourusername.github.io/My-Love/`

### Manual Deployment Steps

If you need to deploy without automation:

```bash
# 1. Build
npm run build

# 2. Run smoke tests (optional but recommended)
npm run test:smoke

# 3. Deploy
npm run deploy
```

---

## Verification

### Automated Pre-Deploy Validation (Smoke Tests)

Smoke tests run automatically during `npm run deploy`. They validate:

1. **✅ File Existence**: `index.html`, `manifest.webmanifest`, `sw.js`
2. **✅ HTML Structure**: Viewport meta tag, manifest link
3. **✅ PWA Manifest**: Valid JSON, required fields (name, icons, theme_color)
4. **✅ Service Worker**: Contains caching logic and precache manifest
5. **✅ Environment Variables**: APP_CONFIG constants injected into bundle
6. **✅ Bundle Size**: Total <200KB gzipped (NFR001 compliance)
7. **✅ Critical Assets**: Icons, JavaScript bundles, CSS bundles

**Smoke tests are fail-fast**: Deployment is blocked if any test fails.

To run smoke tests independently:
```bash
npm run test:smoke
```

### Post-Deploy Validation (Optional)

After deployment, verify the live site:

```bash
node scripts/post-deploy-check.cjs https://yourusername.github.io/My-Love/
```

**Automated checks:**
- HTTP 200 response from live URL
- Manifest link present in HTML
- Manifest is accessible and valid JSON

**Manual verification steps:**

#### 1. Open Live Site
Navigate to: `https://yourusername.github.io/My-Love/`

**Verify:**
- ✅ Site loads without errors
- ✅ Partner name displays correctly
- ✅ Relationship duration calculates from start date
- ✅ No onboarding wizard shown
- ✅ Today's message displays
- ✅ All 4 themes work (click theme switcher)

#### 2. Test Service Worker Registration

Open DevTools (F12) → **Application** tab → **Service Workers**

**Verify:**
- ✅ Status: "activated and is running" (green indicator)
- ✅ No errors in registration

**Check Cache Storage:**
- Application tab → **Cache Storage**
- Expand `workbox-precache-v2-https://...`
- Verify all app shell files are pre-cached (JS, CSS, HTML, icons)

#### 3. Test Offline Functionality

**Steps:**
1. DevTools → **Network** tab
2. Check "Offline" checkbox
3. Refresh page (Cmd+R or Ctrl+R)

**Verify:**
- ✅ App loads from service worker cache
- ✅ All features work offline
- ✅ No network errors
- ✅ Status in Network tab shows "(ServiceWorker)"

#### 4. Run Lighthouse Audit

DevTools → **Lighthouse** tab → **Generate report**

**Target scores:**
- 🎯 **Performance**: >90
- 🎯 **Accessibility**: >90
- 🎯 **Best Practices**: >90
- 🎯 **SEO**: >80
- 🎯 **PWA**: 100 (critical requirement)

#### 5. Test Core Features

Manual regression testing:

- ✅ **Favorite button**: Toggle favorite → Refresh → State persists
- ✅ **Share button**: Click share → Web Share API or clipboard copy works
- ✅ **Theme switcher**: All 4 themes apply correctly
- ✅ **Animations**: Smooth 60fps, no jank
- ✅ **Relationship counter**: Duration calculates correctly from env date

---

## Troubleshooting

### Build Failures

#### TypeScript Errors

**Symptom:** `npm run build` fails with TypeScript errors

**Solution:**
```bash
# Run type check to see detailed errors
npx tsc -b

# Fix errors in source code
# Then rebuild
npm run build
```

**Common causes:**
- Type mismatches in React components
- Missing type definitions
- Strict mode violations

#### Vite Build Errors

**Symptom:** Vite bundling fails after TypeScript succeeds

**Solution:**
- Check for import errors or missing files
- Verify all dependencies are installed: `npm install`
- Clear Vite cache: `rm -rf node_modules/.vite`

### Smoke Test Failures

#### Test 1: File Existence

**Error:** `❌ Required file not found: [filename]`

**Solution:**
- Verify build completed successfully
- Check `dist/` directory exists
- Rebuild: `npm run build`

#### Test 5: Configuration Constants

**Warning:** `⚠️ Warning: APP_CONFIG constants not found in bundle`

**Cause:** `src/config/constants.ts` values were not properly set during build

**Solution:**
```bash
# 1. Edit src/config/constants.ts
nano src/config/constants.ts

# 2. Verify defaultPartnerName and defaultStartDate are set with non-empty values
# Example:
#   defaultPartnerName: 'Gracie',
#   defaultStartDate: '2025-10-18',

# 3. Save the file and rebuild
npm run build
```

**Impact:** App will function but without pre-configured data (falls back to empty settings)

#### Test 6: Bundle Size

**Error:** `❌ Bundle size exceeds 200KB limit`

**Solution:**
1. Analyze bundle composition:
   ```bash
   npm run build -- --sourcemap
   # Inspect generated source maps in dist/assets/
   ```

2. Common optimizations:
   - Remove unused dependencies from `package.json`
   - Ensure Tailwind CSS purge is working (verify in `tailwind.config.js`)
   - Check for accidentally imported large libraries
   - Verify tree-shaking is working (check bundle for dead code)

3. Use bundle analyzer:
   ```bash
   npm install --save-dev rollup-plugin-visualizer
   # Add to vite.config.ts plugins array
   ```

### Deployment Failures

#### gh-pages Push Fails

**Error:** `fatal: could not read Username`

**Solution:**
```bash
# Configure Git credentials
git config user.name "Your Name"
git config user.email "your.email@example.com"

# Retry deployment
npm run deploy
```

#### GitHub Pages Not Updating

**Symptom:** Deployment succeeds but site shows old version

**Solution:**
1. **Wait 1-2 minutes** for GitHub Pages to propagate changes
2. **Hard refresh** browser: Cmd+Shift+R (Mac) or Ctrl+Shift+F5 (Windows)
3. **Clear browser cache** or test in incognito mode
4. **Check gh-pages branch**:
   ```bash
   git fetch
   git log origin/gh-pages
   # Verify latest commit timestamp
   ```

### Runtime Issues

#### Partner Name Not Showing

**Symptom:** App loads but partner name is empty or "Unknown"

**Checklist:**
1. ✅ `src/config/constants.ts` exists in project root
2. ✅ `defaultPartnerName` is set to a non-empty string
3. ✅ Rebuilt after editing `constants.ts`: `npm run build`
4. ✅ Check browser console for APP_CONFIG warnings

**Debug steps:**
```bash
# Verify constants were set correctly
cat src/config/constants.ts | grep defaultPartnerName

# Should show: defaultPartnerName: 'YourName',
# If not set, edit the file and rebuild with: npm run build
```

#### Relationship Duration Shows "NaN"

**Symptom:** Duration counter displays "NaN days" or incorrect value

**Causes:**
- Invalid date format (must be YYYY-MM-DD)
- Invalid date (e.g., 2024-02-30)
- Future date (causes negative duration)

**Solution:**
```bash
# Verify date format in src/config/constants.ts
cat src/config/constants.ts | grep defaultStartDate

# Correct format example:
defaultStartDate: '2024-01-15',

# Rebuild after fixing
npm run build && npm run deploy
```

#### Service Worker Not Registering

**Symptom:** DevTools shows service worker status "Redundant" or no service worker

**Checklist:**
1. ✅ HTTPS is enabled (GitHub Pages enforces this automatically)
2. ✅ `sw.js` exists in deployed site root
3. ✅ No console errors in browser DevTools
4. ✅ Hard refresh page to update service worker

**Debug steps:**
```javascript
// In browser console, check registration manually
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Registered service workers:', regs);
});
```

**Force service worker update:**
1. DevTools → Application → Service Workers
2. Check "Update on reload"
3. Hard refresh page (Cmd+Shift+R)

#### Offline Mode Not Working

**Symptom:** App doesn't load when offline

**Solution:**
1. **First load must be online** (service worker needs to cache assets)
2. **Verify service worker is activated** (see Service Worker troubleshooting)
3. **Check cache storage**:
   - DevTools → Application → Cache Storage
   - Verify assets are cached
4. **Test again**:
   - Refresh page while online (to cache everything)
   - Go offline
   - Refresh again

---

## Rollback Procedure

If a deployment introduces issues, you can rollback to a previous version.

### Quick Rollback (Revert Last Deployment)

```bash
# 1. Checkout gh-pages branch
git fetch
git checkout gh-pages

# 2. Revert the last commit
git revert HEAD

# 3. Push the revert
git push origin gh-pages

# 4. Return to main branch
git checkout main
```

**Result:** Site will rollback to the previous deployment within 1-2 minutes.

### Rollback to Specific Version

```bash
# 1. Checkout gh-pages branch
git fetch
git checkout gh-pages

# 2. View deployment history
git log --oneline -10

# 3. Find the commit hash of the version you want (e.g., abc1234)

# 4. Reset to that commit
git reset --hard abc1234

# 5. Force push (overwrites history)
git push --force origin gh-pages

# 6. Return to main branch
git checkout main
```

**Warning:** `--force` push overwrites history. Use with caution.

### Alternative: Deploy Previous Build

```bash
# 1. Checkout the working commit on main branch
git log --oneline -10
git checkout abc1234

# 2. Rebuild and deploy
npm run build
npm run deploy

# 3. Return to latest main
git checkout main
```

---

## Security Considerations

### What Gets Committed

**✅ Safe to commit:**
- `src/config/constants.ts` (your relationship data)
- `vite.config.ts` (build configuration)
- All source code

**❌ Never commit:**
- `dist/` directory (build output, regenerated on each build)
- `node_modules/` (dependencies, installed via npm)

### Relationship Data Storage

**Your relationship data is stored in source code:**
- `defaultPartnerName` and `defaultStartDate` values are in `src/config/constants.ts`
- This file IS committed to version control (it's part of your app)
- Anyone with repository access can see these values
- The app is designed for single-user deployment by you for your partner

**Privacy considerations:**
- Relationship data (partner name, start date) is personal but not sensitive
- Single-user PWA deployment assumes you control access to the URL
- The data is publicly visible in the deployed app (browser DevTools)
- If you need true privacy:
  - Deploy to a private server with authentication
  - Use a deployment platform with environment variables (e.g., Vercel, Netlify)
  - Implement authentication and server-side rendering

### How Configuration Works

The constants are directly embedded in your source code:

1. **You edit**: `src/config/constants.ts` with your values
2. **Build time**: Vite bundles the constants as hardcoded values
3. **Runtime**: App reads the hardcoded values from `APP_CONFIG` object
4. **Deployment**: Bundle is deployed with values permanently embedded

**How it works:**
```typescript
// Your source: src/config/constants.ts
export const APP_CONFIG = {
  defaultPartnerName: 'Gracie',
  defaultStartDate: '2025-10-18',
} as const;

// After build: Embedded directly in the app
// At runtime: APP_CONFIG.defaultPartnerName === 'Gracie'
```

---

## Deployment Checklist

Use this checklist before each deployment:

### Pre-Deployment

- [ ] `src/config/constants.ts` edited with partner name and relationship start date
- [ ] Date format is YYYY-MM-DD
- [ ] Partner name is not an empty string
- [ ] Code committed to main branch
- [ ] TypeScript compiles with zero errors: `npx tsc -b`
- [ ] ESLint passes with zero warnings: `npm run lint`

### Deployment

- [ ] Run: `npm run deploy`
- [ ] All smoke tests pass (15/15)
- [ ] gh-pages push succeeds
- [ ] Wait 1-2 minutes for GitHub Pages propagation

### Post-Deployment

- [ ] Open live site: `https://yourusername.github.io/My-Love/`
- [ ] Partner name displays correctly
- [ ] Relationship duration calculates correctly
- [ ] No onboarding wizard shown
- [ ] Service worker registered (DevTools → Application → Service Workers)
- [ ] Offline mode works (DevTools → Network → Offline)
- [ ] All themes work
- [ ] Lighthouse PWA score: 100
- [ ] No console errors

---

## Support and Resources

### Documentation

- **Vite Documentation**: https://vite.dev/
- **vite-plugin-pwa**: https://vite-pwa-org.netlify.app/
- **GitHub Pages**: https://docs.github.com/en/pages
- **gh-pages package**: https://www.npmjs.com/package/gh-pages

### Project Structure

```
.
├── .env.production          # Your relationship data (gitignored)
├── .env.production.example  # Template with instructions
├── vite.config.ts           # Build configuration
├── package.json             # Scripts and dependencies
├── scripts/
│   ├── smoke-tests.cjs      # Pre-deploy validation
│   └── post-deploy-check.cjs # Post-deploy validation
├── src/
│   ├── config/
│   │   └── constants.ts     # APP_CONFIG (env var exposure)
│   └── ...                  # App source code
└── dist/                    # Build output (generated, not committed)
```

### Commands Reference

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173/My-Love/)

# Building
npm run build            # Build production bundle
npm run preview          # Preview production build locally

# Testing
npm run lint             # Run ESLint
npm run test:smoke       # Run smoke tests on dist/

# Deployment
npm run deploy           # Build, test, and deploy to GitHub Pages

# Validation
node scripts/post-deploy-check.cjs [URL]  # Validate live deployment
```

---

## Version History

- **v1.0.0** (2025-10-30): Initial deployment guide
  - Story 1.6: Build & Deployment Configuration Hardening
  - Automated smoke tests
  - Pre-configured relationship data via environment variables
  - Bundle size optimization (<200KB gzipped)
  - Service worker and PWA manifest generation
  - GitHub Pages deployment with gh-pages package

---

**Questions or Issues?** Check the [Troubleshooting](#troubleshooting) section or review the smoke test output for specific error messages.
