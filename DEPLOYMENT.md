# Deployment Guide for My-Love PWA

This guide covers the complete deployment process for the My-Love Progressive Web App to Vercel.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Vercel Setup](#vercel-setup)
4. [Environment Configuration](#environment-configuration)
5. [Build Process](#build-process)
6. [Automatic Deployments](#automatic-deployments)
7. [Verification](#verification)
8. [Troubleshooting](#troubleshooting)
9. [Rollback Procedure](#rollback-procedure)
10. [Security Considerations](#security-considerations)

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

### Vercel Account Setup

1. **Create Vercel account** at https://vercel.com/signup
   - Recommended: Sign up with GitHub for seamless integration

2. **Install Vercel CLI** (optional, for local testing):

   ```bash
   npm install -g vercel
   ```

3. **Connect GitHub repository**:
   - Vercel automatically detects Vite projects
   - Zero configuration needed for React + Vite

---

## Quick Start

For experienced developers who want to deploy immediately:

```bash
# 1. Edit src/config/constants.ts with your relationship data
nano src/config/constants.ts

# 2. Push to GitHub
git add . && git commit -m "Configure app" && git push

# 3. Import project to Vercel (one-time setup)
# Go to: https://vercel.com/new
# Select your GitHub repository
# Add environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY)
# Click "Deploy"
```

That's it! Vercel automatically deploys on every push to main.

**Live URL**: `https://your-project.vercel.app/`

---

## Vercel Setup

### Initial Project Import

1. **Go to Vercel Dashboard**: https://vercel.com/dashboard

2. **Import Git Repository**:
   - Click "Add New" → "Project"
   - Select "Import Git Repository"
   - Choose your My-Love repository
   - Vercel auto-detects Vite configuration

3. **Configure Build Settings** (auto-detected):

   ```
   Framework Preset: Vite
   Build Command: npm run build
   Output Directory: dist
   Install Command: npm install
   ```

4. **Add Environment Variables**:
   - `VITE_SUPABASE_URL` → Your Supabase project URL
   - `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` → Your Supabase anonymous key

5. **Deploy**: Click "Deploy" button

### Project Settings

After initial deployment, configure additional settings:

**General**:

- Project Name: `my-love` (or custom name)
- Root Directory: `.` (project root)

**Domains**:

- Default: `your-project.vercel.app`
- Custom domain: Add your own domain (optional)

**Environment Variables**:

- Production, Preview, Development environments supported
- Add variables for each environment as needed

---

## Environment Configuration

### Local Development (dotenvx)

This project uses [dotenvx](https://dotenvx.com) for encrypted environment variables. The `.env` file is encrypted and committed to the repository.

**Setup:**

1. Get the `DOTENV_KEY` from a team member or your password manager
2. Create `.env.keys` file:

```bash
echo "DOTENV_KEY='your-decryption-key-here'" > .env.keys
```

3. Run with dotenvx (auto-decrypts at runtime):

```bash
dotenvx run -- npm run dev
```

**Note**: The `.env.keys` file is gitignored. Never commit or share it.

### Vercel Dashboard Configuration

1. **Navigate to Project Settings** → **Environment Variables**

2. **Add Required Variables**:

   | Variable                 | Value                              | Environments                     |
   | ------------------------ | ---------------------------------- | -------------------------------- |
   | `VITE_SUPABASE_URL`      | `https://your-project.supabase.co` | Production, Preview, Development |
   | `VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | `your-anon-key`                    | Production, Preview, Development |

3. **Redeploy** to apply new variables (or wait for next push)

### App Configuration

Edit `src/config/constants.ts` with your relationship data:

```typescript
// src/config/constants.ts
export const APP_CONFIG = {
  defaultPartnerName: 'YourPartnerName',
  defaultStartDate: '2024-01-15', // YYYY-MM-DD format
  isPreConfigured: true,
} as const;
```

---

## Build Process

### Local Build (Testing)

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

### Preview Build Locally

```bash
npm run preview
```

Open: http://localhost:4173/

**Verify:**

- Partner name displays correctly
- Relationship duration calculates from start date
- No onboarding flow shown
- All themes work
- No console errors

---

## Automatic Deployments

### Production Deployments

**Trigger**: Push to `main` branch

**Process**:

1. Vercel detects push via GitHub webhook
2. Starts new deployment automatically
3. Runs `npm install` and `npm run build`
4. Deploys to production URL
5. Sends notification (email/Slack if configured)

**Timeline**: ~1-2 minutes from push to live

### Preview Deployments

**Trigger**: Create or update Pull Request

**Process**:

1. Vercel creates unique preview URL
2. Builds with PR changes
3. Comments preview URL on PR
4. Updates preview on each new commit

**URL Pattern**: `https://my-love-<branch>-<user>.vercel.app`

### Manual Deployment (CLI)

```bash
# Deploy current directory to Vercel
vercel

# Deploy to production (from main branch)
vercel --prod

# Deploy specific commit
git checkout <commit-hash>
vercel --prod
```

---

## Verification

### Post-Deploy Validation

#### 1. Open Live Site

Navigate to: `https://your-project.vercel.app/`

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
- ✅ **Relationship counter**: Duration calculates correctly

---

## Troubleshooting

### Build Failures

#### TypeScript Errors

**Symptom:** Build fails in Vercel logs with TypeScript errors

**Solution:**

```bash
# Test locally first
npx tsc -b

# Fix errors, then push
git add . && git commit -m "Fix type errors" && git push
```

#### Missing Environment Variables

**Symptom:** `undefined` values or API connection failures

**Solution:**

1. Check Vercel Dashboard → Project Settings → Environment Variables
2. Ensure variables are added for correct environment (Production/Preview)
3. Redeploy after adding variables

#### Build Command Fails

**Symptom:** `npm run build` fails in Vercel

**Solution:**

1. Check Vercel build logs for specific error
2. Ensure `package.json` scripts are correct
3. Verify all dependencies are in `dependencies` (not just `devDependencies`)

### Runtime Issues

#### Partner Name Not Showing

**Checklist:**

1. ✅ `src/config/constants.ts` has `defaultPartnerName` set
2. ✅ Rebuilt and deployed after editing
3. ✅ Check browser console for APP_CONFIG warnings

#### Service Worker Not Registering

**Checklist:**

1. ✅ HTTPS is enabled (Vercel enforces automatically)
2. ✅ `sw.js` exists in deployed site root
3. ✅ No console errors in browser DevTools

**Force service worker update:**

1. DevTools → Application → Service Workers
2. Check "Update on reload"
3. Hard refresh page (Cmd+Shift+R)

#### Environment Variables Not Working

**Common causes:**

- Variables not prefixed with `VITE_` (Vite requirement)
- Variables added after deployment (need redeploy)
- Wrong environment selected (Production vs Preview)

**Debug:**

```javascript
// In browser console
console.log(import.meta.env);
```

### Deployment Issues

#### Deployment Stuck

**Solution:**

1. Check Vercel Dashboard for deployment status
2. Cancel stuck deployment
3. Re-trigger by pushing empty commit:
   ```bash
   git commit --allow-empty -m "Trigger redeploy"
   git push
   ```

#### Custom Domain Not Working

**Checklist:**

1. ✅ DNS records configured correctly (CNAME or A record)
2. ✅ Domain verified in Vercel
3. ✅ SSL certificate provisioned (automatic, may take time)

---

## Rollback Procedure

### Instant Rollback via Vercel Dashboard

1. **Go to Vercel Dashboard** → Your Project → **Deployments**

2. **Find Previous Working Deployment**:
   - List shows all deployments with timestamps
   - Click on deployment to preview

3. **Promote to Production**:
   - Click "..." menu on deployment
   - Select "Promote to Production"
   - Instant rollback (no rebuild needed)

### Rollback via Git

```bash
# Revert last commit
git revert HEAD
git push

# Vercel auto-deploys the revert
```

### Rollback to Specific Version

```bash
# Find working commit
git log --oneline -10

# Revert to that commit
git revert HEAD~<number>
# or
git checkout <commit-hash>
git push
```

---

## Security Considerations

### What Gets Committed

**✅ Safe to commit:**

- `.env` (encrypted with dotenvx - secrets are encrypted)
- `src/config/constants.ts` (your relationship data)
- `vite.config.ts` (build configuration)
- All source code

**❌ Never commit:**

- `.env.keys` (decryption key - keep this secret!)
- `.env.local` (local overrides)
- `dist/` directory (build output)
- `node_modules/` (dependencies)

### Relationship Data Storage

- `defaultPartnerName` and `defaultStartDate` are in source code
- Values are public in the deployed app (DevTools accessible)
- Designed for personal/couple use, not public multi-user deployment

### Environment Variable Security

- **Vercel Dashboard**: Variables encrypted at rest
- **Build Time**: Variables injected during build process
- **Runtime**: Values embedded in bundle (no server-side secrets)
- **Never expose**: Service role keys or admin tokens

### HTTPS & Security

- Vercel enforces HTTPS automatically
- Let's Encrypt certificates (free, auto-renewed)
- Required for PWA features (service worker, Web Share API)

---

## Deployment Checklist

### Pre-Deployment

- [ ] `src/config/constants.ts` edited with partner name and relationship start date
- [ ] Date format is YYYY-MM-DD
- [ ] Partner name is not empty
- [ ] TypeScript compiles: `npx tsc -b`
- [ ] Lint passes: `npm run lint`
- [ ] Local build works: `npm run build`
- [ ] Environment variables configured in Vercel Dashboard

### Deployment

- [ ] Code pushed to `main` branch
- [ ] Vercel deployment triggered
- [ ] Build succeeds in Vercel logs
- [ ] Deployment completes (~1-2 minutes)

### Post-Deployment

- [ ] Open live site
- [ ] Partner name displays correctly
- [ ] Relationship duration calculates correctly
- [ ] Service worker registered
- [ ] Offline mode works
- [ ] All themes work
- [ ] Lighthouse PWA score: 100
- [ ] No console errors

---

## Advanced Configuration

### Custom Domain Setup

1. **Add domain in Vercel**:
   - Project Settings → Domains → Add
   - Enter your domain name

2. **Configure DNS**:
   - CNAME record pointing to `cname.vercel-dns.com`
   - Or A record to Vercel IP addresses

3. **SSL Certificate**:
   - Automatically provisioned
   - Takes ~10-15 minutes

### Preview Deployment Protection

Protect preview deployments with password:

1. Project Settings → Deployment Protection
2. Enable "Vercel Authentication" or "Password Protection"
3. Set password for preview URLs

### Build Caching

Vercel caches `node_modules/` and build cache automatically:

- First deployment: ~2 minutes
- Subsequent deployments: ~30-60 seconds

---

## Support and Resources

### Documentation

- **Vercel Documentation**: https://vercel.com/docs
- **Vite + Vercel**: https://vitejs.dev/guide/static-deploy.html#vercel
- **Supabase Documentation**: https://supabase.com/docs

### Commands Reference

```bash
# Development
npm run dev              # Start dev server (http://localhost:5173/)

# Building
npm run build            # Build production bundle
npm run preview          # Preview production build locally

# Testing
npm run lint             # Run ESLint
npm run test:smoke       # Run smoke tests on dist/

# Vercel CLI (optional)
vercel                   # Deploy preview
vercel --prod            # Deploy to production
vercel env pull          # Pull environment variables
```

---

## Version History

- **v2.0.0** (2025-11-16): Migrated to Vercel deployment
  - Removed GitHub Pages configuration
  - Added Vercel automatic deployment setup
  - Updated environment variable management
  - Simplified deployment process (zero-config)
  - Added instant rollback via Vercel Dashboard

- **v1.0.0** (2025-10-30): Initial deployment guide (GitHub Pages)

---

**Questions or Issues?** Check the [Troubleshooting](#troubleshooting) section or review Vercel deployment logs in the dashboard.
