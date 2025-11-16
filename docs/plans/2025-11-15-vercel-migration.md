# GitHub Pages to Vercel Migration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate My-Love PWA from GitHub Pages hosting to Vercel for improved deployment flexibility, custom domain support, and removal of base path configuration complexity.

**Architecture:** Remove GitHub Pages-specific base path handling from Vite config, create Vercel configuration for static SPA deployment, update CI/CD pipeline to deploy to Vercel via GitHub integration, and configure environment variables in Vercel dashboard.

**Tech Stack:** Vite + React + TypeScript, Vercel hosting, GitHub integration, Supabase backend

---

## Required Secrets and Environment Variables

### Vercel Dashboard Configuration

Configure these in **Vercel Project Settings > Environment Variables**:

| Variable Name            | Value Source                                  | Environment                      |
| ------------------------ | --------------------------------------------- | -------------------------------- |
| `VITE_SUPABASE_URL`      | `https://vdltoyxpujbsaidctzjb.supabase.co`    | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | Get from GitHub Secrets or Supabase Dashboard | Production, Preview, Development |

### GitHub Secrets (Keep Existing)

These remain in **GitHub Repository > Settings > Secrets**:

| Secret Name              | Purpose                    | Still Needed?                              |
| ------------------------ | -------------------------- | ------------------------------------------ |
| `SUPABASE_ACCESS_TOKEN`  | TypeScript type generation | YES - for local dev and CI type generation |
| `VITE_SUPABASE_URL`      | Build-time env var         | NO - Vercel handles this                   |
| `VITE_SUPABASE_ANON_KEY` | Build-time env var         | NO - Vercel handles this                   |

---

## Task 1: Remove GitHub Pages Base Path Configuration

**Files:**

- Modify: `vite.config.ts:7-9`

**Step 1: Update Vite config to use root path always**

Open `vite.config.ts` and change:

```typescript
// BEFORE (line 9)
base: mode === 'production' ? '/My-Love/' : '/',

// AFTER (line 9)
base: '/',
```

**Step 2: Verify change is correct**

Run: `grep -n "base:" vite.config.ts`
Expected: Shows `base: '/',` with no conditional logic

**Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: remove GitHub Pages base path configuration

Vercel deploys to root domain, no subpath needed."
```

---

## Task 2: Create Vercel Configuration File

**Files:**

- Create: `vercel.json`

**Step 1: Create vercel.json with SPA routing**

Create `vercel.json` in project root:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm ci",
  "rewrites": [
    {
      "source": "/((?!assets/).*)",
      "destination": "/index.html"
    }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        }
      ]
    }
  ]
}
```

**Step 2: Validate JSON syntax**

Run: `node -e "require('./vercel.json'); console.log('Valid JSON')"`
Expected: `Valid JSON`

**Step 3: Commit**

```bash
git add vercel.json
git commit -m "feat: add Vercel configuration for SPA deployment

- Configure Vite framework detection
- Add SPA rewrites for client-side routing
- Set cache headers for static assets
- Add security headers"
```

---

## Task 3: Update Package.json Scripts

**Files:**

- Modify: `package.json:21-23`

**Step 1: Replace gh-pages deploy scripts**

Open `package.json` and update the deploy scripts:

```json
// BEFORE (lines 21-23)
"predeploy": "npm run build && npm run test:smoke",
"deploy": "gh-pages -d dist",
"postdeploy": "echo 'Deployment complete! Run: node scripts/post-deploy-check.cjs [YOUR_URL]'",

// AFTER (lines 21-23)
"predeploy": "npm run build && npm run test:smoke",
"deploy": "echo 'Deployment handled by Vercel GitHub integration. Push to main to deploy.'",
"postdeploy": "echo 'Check deployment status at: https://vercel.com/dashboard'",
```

**Step 2: Verify changes**

Run: `grep -A 2 '"predeploy"' package.json`
Expected: Shows the new echo commands, not gh-pages

**Step 3: Commit**

```bash
git add package.json
git commit -m "chore: update deploy scripts for Vercel

Replace gh-pages deployment with Vercel integration notice."
```

---

## Task 4: Disable GitHub Pages Workflow

**Files:**

- Modify: `.github/workflows/deploy.yml:1-7`

**Step 1: Rename workflow to indicate deprecation**

Open `.github/workflows/deploy.yml` and add deprecation notice:

```yaml
# BEFORE (line 1)
name: Deploy to GitHub Pages

# AFTER (line 1)
name: "[DEPRECATED] Deploy to GitHub Pages"
```

**Step 2: Disable automatic triggers**

Comment out the triggers (lines 3-6):

```yaml
# BEFORE
on:
  push:
    branches: [main]
  workflow_dispatch:

# AFTER
on:
  workflow_dispatch:  # Manual only - Vercel handles automatic deployment
  # push:
  #   branches: [main]  # DISABLED - Using Vercel for production deployments
```

**Step 3: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "chore: disable automatic GitHub Pages deployment

Vercel now handles production deployments via GitHub integration.
Workflow retained for reference/fallback, manual trigger only."
```

---

## Task 5: Create Vercel Ignore File

**Files:**

- Create: `.vercelignore`

**Step 1: Create .vercelignore**

Create `.vercelignore` in project root:

```
# Development artifacts
.git
.gitignore
node_modules

# Testing
tests/
coverage/
playwright-report/
test-results/

# Development configs
.env
.env.test
.vscode/
.claude/
.cursor/
.gemini/
.opencode/
.bmad/
.serena/

# Documentation (not needed in deployment)
docs/
claudedocs/
*.md

# Build artifacts (Vercel builds fresh)
dist/
dev-dist/

# Logs
*.log
npm-debug.log*
```

**Step 2: Verify file created**

Run: `ls -la .vercelignore`
Expected: File exists

**Step 3: Commit**

```bash
git add .vercelignore
git commit -m "feat: add Vercel ignore file

Exclude development artifacts, tests, and docs from deployment."
```

---

## Task 6: Update PWA Manifest Start URL

**Files:**

- Modify: `vite.config.ts:44`

**Step 1: Update start_url for root deployment**

Open `vite.config.ts` and verify the PWA manifest settings (already correct):

```typescript
// Line 44 - Should be relative
start_url: './',
scope: './',
```

These are already correct for Vercel. No change needed.

**Step 2: Verify PWA config is correct**

Run: `grep -A 2 "start_url:" vite.config.ts`
Expected: `start_url: './'`

**Step 3: Commit (only if changes made)**

If no changes needed, skip commit for this task.

---

## Task 7: Update OAuth Redirect Configuration

**Files:**

- Modify: `src/api/authService.ts` (search for redirect URLs)

**Step 1: Search for hardcoded GitHub Pages URLs**

Run: `grep -r "github.io\|My-Love" src/ --include="*.ts" --include="*.tsx"`

Check for any hardcoded redirect URLs that need updating.

**Step 2: Update any found URLs (if applicable)**

If found, replace with environment variable or dynamic detection:

```typescript
// BEFORE (example)
const redirectUrl = 'https://username.github.io/My-Love/';

// AFTER
const redirectUrl = window.location.origin + '/';
```

**Step 3: Update Supabase Auth Settings**

In Supabase Dashboard > Authentication > URL Configuration:

- Add your Vercel deployment URL to "Site URL"
- Add to "Redirect URLs": `https://your-vercel-domain.vercel.app/**`

**Step 4: Commit (if code changes)**

```bash
git add src/
git commit -m "fix: update OAuth redirects for Vercel deployment

Use dynamic origin detection instead of hardcoded GitHub Pages URL."
```

---

## Task 8: Set Up Vercel Project

**Manual Steps (Not Automated):**

**Step 1: Install Vercel CLI (optional, for local testing)**

```bash
npm install -g vercel
```

**Step 2: Link to Vercel via GitHub**

1. Go to https://vercel.com/new
2. Import Git Repository: `My-Love`
3. Select Framework Preset: `Vite`
4. Configure Build Settings:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm ci`

**Step 3: Configure Environment Variables**

In Vercel Project Settings > Environment Variables, add:

```
VITE_SUPABASE_URL = https://vdltoyxpujbsaidctzjb.supabase.co
VITE_SUPABASE_ANON_KEY = [Get from GitHub Secrets or Supabase Dashboard]
```

Set for environments: Production, Preview, Development

**Step 4: Deploy**

Push any commit to `main` branch, or click "Deploy" in Vercel dashboard.

**Step 5: Verify deployment**

Run: Visit the Vercel deployment URL
Expected: App loads without 404 errors, PWA installs correctly

---

## Task 9: Remove gh-pages Dependency

**Files:**

- Modify: `package.json:56`

**Step 1: Remove gh-pages from devDependencies**

```bash
npm uninstall gh-pages
```

**Step 2: Verify removal**

Run: `grep "gh-pages" package.json`
Expected: No output (dependency removed)

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: remove gh-pages dependency

No longer needed with Vercel deployment."
```

---

## Task 10: Update Documentation

**Files:**

- Modify: `README.md`
- Modify: `DEPLOYMENT.md`

**Step 1: Update README deployment section**

Add/update deployment information:

```markdown
## Deployment

This app is deployed to [Vercel](https://vercel.com):

- Production: Automatically deploys on push to `main`
- Preview: Automatically deploys on pull requests

### Environment Variables (Vercel Dashboard)

Configure in Vercel Project Settings > Environment Variables:

- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
```

**Step 2: Update DEPLOYMENT.md**

Document the Vercel setup process and environment variable configuration.

**Step 3: Commit**

```bash
git add README.md DEPLOYMENT.md
git commit -m "docs: update deployment documentation for Vercel

- Document Vercel deployment process
- List required environment variables
- Update deployment URLs"
```

---

## Task 11: Final Verification

**Step 1: Build locally to ensure no errors**

```bash
npm run build
```

Expected: Build completes successfully

**Step 2: Run smoke tests**

```bash
npm run test:smoke
```

Expected: All smoke tests pass

**Step 3: Preview locally**

```bash
npm run preview
```

Expected: App runs on localhost without base path issues

**Step 4: Push to main and verify Vercel deployment**

```bash
git push origin main
```

Expected: Vercel automatically builds and deploys

**Step 5: Verify production**

- Visit Vercel deployment URL
- Check PWA installation works
- Verify OAuth login flow works
- Test all core features

---

## Secrets Summary

### Required in Vercel Dashboard:

| Secret                   | Where to Get It                     | Priority |
| ------------------------ | ----------------------------------- | -------- |
| `VITE_SUPABASE_URL`      | Supabase Dashboard > Settings > API | REQUIRED |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard > Settings > API | REQUIRED |

### Required in Supabase Dashboard:

| Setting       | Location                 | Value                               |
| ------------- | ------------------------ | ----------------------------------- |
| Site URL      | Auth > URL Configuration | Your Vercel deployment URL          |
| Redirect URLs | Auth > URL Configuration | `https://your-domain.vercel.app/**` |

### GitHub Secrets (Can Remove After Migration):

| Secret                   | Keep or Remove?                             |
| ------------------------ | ------------------------------------------- |
| `VITE_SUPABASE_URL`      | REMOVE - Vercel manages this                |
| `VITE_SUPABASE_ANON_KEY` | REMOVE - Vercel manages this                |
| `SUPABASE_ACCESS_TOKEN`  | KEEP - For local TypeScript type generation |

---

## Rollback Plan

If migration fails:

1. Re-enable GitHub Pages workflow triggers
2. Revert base path change in `vite.config.ts`
3. Push to main to trigger GitHub Pages deployment
4. Disconnect Vercel GitHub integration (if needed)

---

## Post-Migration Cleanup

After successful Vercel deployment:

1. Delete GitHub Pages environment (Repository Settings > Environments)
2. Remove GitHub Secrets that are now in Vercel
3. Update any external references to the old GitHub Pages URL
4. Consider setting up custom domain in Vercel
