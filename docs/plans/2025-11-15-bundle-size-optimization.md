# Bundle Size Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reduce production bundle size from 225KB to under 200KB (gzipped) by implementing code splitting, lazy loading, and dependency optimization.

**Architecture:** Split the monolithic bundle into smaller chunks using dynamic imports for route-based and component-based code splitting. Optimize heavy dependencies (framer-motion, @supabase/supabase-js, lucide-react) through selective imports and lazy loading.

**Tech Stack:** Vite (build tool), React lazy/Suspense, rollup manual chunks

---

## Current State Analysis

**Bundle breakdown (gzipped):**

- `index-DSscoiHy.js`: 214.30KB (main bundle - target for splitting)
- `index-DUXVYzF-.css`: 8.15KB (acceptable)
- `workbox-window.prod.es5-CwtvwXb3.js`: 2.31KB (acceptable)
- `virtual_pwa-register-BrxPdkhn.js`: 0.45KB (acceptable)

**Total:** 225.22KB → **Target:** <200KB

**Heavy dependencies to optimize:**

- `framer-motion` (~50KB gzipped) - animation library
- `@supabase/supabase-js` (~40KB gzipped) - backend client
- `lucide-react` (~30KB+ gzipped) - icon library
- `zustand` + `idb` + `zod` (~20KB combined)

---

## Task 1: Install Bundle Analyzer

**Files:**

- Modify: `package.json`
- Create: None

**Step 1: Install rollup-plugin-visualizer**

```bash
npm install -D rollup-plugin-visualizer
```

Expected: Package added to devDependencies

**Step 2: Verify installation**

```bash
npm list rollup-plugin-visualizer
```

Expected: Shows installed version

**Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add bundle analyzer for optimization"
```

---

## Task 2: Configure Bundle Analyzer

**Files:**

- Modify: `vite.config.ts`

**Step 1: Add visualizer plugin to vite.config.ts**

In `vite.config.ts`, add at top:

```typescript
import { visualizer } from 'rollup-plugin-visualizer';
```

Then in plugins array, add:

```typescript
plugins: [
  react(),
  VitePWA({
    // ... existing config
  }),
  visualizer({
    filename: 'dist/stats.html',
    gzipSize: true,
    brotliSize: true,
  }),
],
```

**Step 2: Build and generate stats**

```bash
npm run build
```

Expected: Creates `dist/stats.html` with bundle visualization

**Step 3: Open stats and analyze**

```bash
open dist/stats.html  # or xdg-open on Linux
```

Expected: Interactive treemap showing package sizes

**Step 4: Commit**

```bash
git add vite.config.ts
git commit -m "chore: configure bundle visualizer"
```

---

## Task 3: Implement Route-Based Code Splitting

**Files:**

- Modify: `src/App.tsx`
- Create: None

**Step 1: Convert static imports to lazy imports**

In `src/App.tsx`, replace static imports with:

```typescript
import { lazy, Suspense } from 'react';

// Lazy load route components
const MoodTracker = lazy(() => import('./components/MoodTracker/MoodTracker'));
const MoodHistory = lazy(() => import('./components/MoodHistory/MoodHistory'));
const PhotoGallery = lazy(() => import('./components/PhotoGallery/PhotoGallery'));
const Settings = lazy(() => import('./components/Settings/Settings'));
const AdminPanel = lazy(() => import('./components/AdminPanel/AdminPanel'));
```

**Step 2: Wrap routes in Suspense**

```typescript
// In your route rendering logic
<Suspense fallback={<LoadingSpinner />}>
  {currentView === 'mood-tracker' && <MoodTracker />}
  {currentView === 'mood-history' && <MoodHistory />}
  {/* ... other routes */}
</Suspense>
```

**Step 3: Create simple loading spinner component**

If `LoadingSpinner` doesn't exist, create inline:

```typescript
const LoadingSpinner = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
  </div>
);
```

**Step 4: Test route navigation**

```bash
npm run dev
```

Navigate between routes and verify:

- Routes load correctly
- Loading spinner shows briefly
- No console errors

**Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: implement route-based code splitting with lazy loading"
```

---

## Task 4: Optimize Framer Motion Imports

**Files:**

- Find all files importing from 'framer-motion'
- Modify each to use selective imports

**Step 1: Find all framer-motion imports**

```bash
grep -r "from 'framer-motion'" src/ --include="*.tsx" --include="*.ts"
```

Expected: List of files using framer-motion

**Step 2: Convert to selective imports**

For each file, change from:

```typescript
import { motion } from 'framer-motion';
```

To:

```typescript
import { m as motion } from 'framer-motion';
```

This uses the lighter `m` export that tree-shakes better.

**Step 3: Test animations**

```bash
npm run dev
```

Navigate to pages with animations and verify they still work.

**Step 4: Build and check size reduction**

```bash
npm run build
```

Expected: Bundle size should decrease by ~5-10KB

**Step 5: Commit**

```bash
git add src/
git commit -m "perf: optimize framer-motion imports for better tree-shaking"
```

---

## Task 5: Lazy Load Lucide Icons

**Files:**

- Modify: All files importing lucide-react icons
- Consider: Creating an icon registry/wrapper

**Step 1: Create icon wrapper component**

Create `src/components/Icon/Icon.tsx`:

```typescript
import { lazy, Suspense, ComponentType } from 'react';
import { LucideProps } from 'lucide-react';

const iconCache = new Map<string, ComponentType<LucideProps>>();

export const Icon = ({ name, ...props }: { name: string } & LucideProps) => {
  if (!iconCache.has(name)) {
    const IconComponent = lazy(() =>
      import('lucide-react').then((mod) => ({ default: mod[name] }))
    );
    iconCache.set(name, IconComponent);
  }

  const IconComponent = iconCache.get(name)!;

  return (
    <Suspense fallback={<div style={{ width: props.size || 24, height: props.size || 24 }} />}>
      <IconComponent {...props} />
    </Suspense>
  );
};
```

**Step 2: Replace direct icon imports**

Find files with:

```bash
grep -r "from 'lucide-react'" src/ --include="*.tsx"
```

Replace patterns like:

```typescript
import { Heart, Camera, Calendar } from 'lucide-react';

// Usage
<Heart size={24} />
```

With:

```typescript
import { Icon } from './components/Icon/Icon';

// Usage
<Icon name="Heart" size={24} />
```

**Step 3: Test icon rendering**

```bash
npm run dev
```

Verify all icons render correctly across the app.

**Step 4: Build and check size**

```bash
npm run build
```

Expected: Significant reduction (10-20KB) as icons are now code-split

**Step 5: Commit**

```bash
git add src/
git commit -m "perf: implement lazy loading for lucide-react icons"
```

---

## Task 6: Configure Manual Chunks for Vendor Libraries

**Files:**

- Modify: `vite.config.ts`

**Step 1: Add manualChunks configuration**

In `vite.config.ts`, add to the config:

```typescript
export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? '/My-Love/' : '/',
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core
          'vendor-react': ['react', 'react-dom'],
          // Supabase (heavy, used mostly in settings/admin)
          'vendor-supabase': ['@supabase/supabase-js'],
          // State management + storage
          'vendor-state': ['zustand', 'idb', 'zod'],
          // Animations (optional, can be lazy loaded)
          'vendor-animation': ['framer-motion'],
        },
      },
    },
  },
  plugins: [
    // ... existing plugins
  ],
}));
```

**Step 2: Build and verify chunk splitting**

```bash
npm run build
```

Expected output:

```
dist/assets/vendor-react-[hash].js
dist/assets/vendor-supabase-[hash].js
dist/assets/vendor-state-[hash].js
dist/assets/vendor-animation-[hash].js
dist/assets/index-[hash].js (much smaller now)
```

**Step 3: Check individual chunk sizes**

```bash
ls -lh dist/assets/*.js
```

Expected: No single chunk over 150KB gzipped

**Step 4: Test app loading**

```bash
npm run preview
```

Open browser and verify:

- App loads correctly
- Network tab shows multiple chunk downloads
- App functions normally

**Step 5: Commit**

```bash
git add vite.config.ts
git commit -m "perf: configure manual chunks for vendor libraries"
```

---

## Task 7: Lazy Load Admin Panel (Heavy Component)

**Files:**

- Modify: `src/App.tsx` or wherever AdminPanel is imported

**Step 1: Make AdminPanel lazy-loaded**

Already done in Task 3, but verify it's properly split:

```typescript
const AdminPanel = lazy(() => import('./components/AdminPanel/AdminPanel'));
```

**Step 2: Verify Supabase is only loaded when Admin panel loads**

Check that AdminPanel is the only place importing supabase:

```bash
grep -r "@supabase/supabase-js" src/ --include="*.tsx" --include="*.ts"
```

If other components import it, consider:

- Moving supabase logic to a service file
- Lazy loading those components too

**Step 3: Test admin panel access**

```bash
npm run dev
```

Navigate to admin panel and verify:

- Loads correctly after brief delay
- Supabase functionality works
- No errors in console

**Step 4: Build and verify supabase chunk is separate**

```bash
npm run build && ls -lh dist/assets/*supabase*.js
```

Expected: vendor-supabase chunk exists and is ~30-40KB

**Step 5: Commit (if changes made)**

```bash
git add src/
git commit -m "perf: ensure admin panel and supabase are lazy-loaded"
```

---

## Task 8: Update Smoke Test Bundle Size Limit

**Files:**

- Modify: `scripts/smoke-tests.cjs`

**Step 1: Calculate new total bundle size**

```bash
npm run build
ls -lh dist/assets/*.js | awk '{sum += $5} END {print sum/1024 " KB"}'
```

Note the total gzipped size.

**Step 2: Update bundle size limit in smoke tests**

In `scripts/smoke-tests.cjs`, find the bundle size check (NFR001) and update:

```javascript
const MAX_BUNDLE_SIZE_KB = 200; // or slightly higher if needed
```

Adjust based on actual size achieved (should be under 200KB now).

**Step 3: Run smoke tests**

```bash
npm run test:smoke
```

Expected: All tests pass including bundle size validation

**Step 4: Commit**

```bash
git add scripts/smoke-tests.cjs
git commit -m "chore: update bundle size limit after optimization"
```

---

## Task 9: Deploy ServiceWorker Fix + Optimizations

**Files:**

- None (deployment task)

**Step 1: Run full build with tests**

```bash
npm run predeploy
```

Expected: Build succeeds, smoke tests pass

**Step 2: Deploy to GitHub Pages**

```bash
npm run deploy
```

Expected: Deployment succeeds

**Step 3: Verify deployed app**

Open: https://sallvainian.github.io/My-Love/

Verify:

- App loads without ServiceWorker errors
- All routes work
- Bundle chunks load correctly
- No console errors

**Step 4: Check deployed bundle sizes**

Open browser DevTools Network tab:

- Verify multiple chunk downloads
- Check individual chunk sizes
- Confirm total is under 200KB gzipped

**Step 5: Create deployment summary**

Document the optimization results:

```markdown
## Bundle Optimization Results

**Before:**

- Single bundle: 214.30KB gzipped
- Total: 225.22KB

**After:**

- vendor-react: ~XX KB
- vendor-supabase: ~XX KB
- vendor-state: ~XX KB
- vendor-animation: ~XX KB
- index: ~XX KB
- route chunks: ~XX KB each
- **Total: ~XX KB** (XX% reduction)

**Techniques Applied:**

1. Route-based code splitting
2. Vendor library chunking
3. Lazy loading heavy components
4. Optimized framer-motion imports
5. Lazy loaded lucide-react icons
6. ServiceWorker JS/CSS caching removed
```

---

## Verification Steps

After completing all tasks:

**1. Build size check:**

```bash
npm run build
du -sh dist/assets/*.js | sort -rh
```

Expected: No single file over 100KB, total under 200KB gzipped

**2. Smoke tests:**

```bash
npm run test:smoke
```

Expected: All tests pass

**3. E2E tests:**

```bash
npm run test:e2e
```

Expected: All tests pass (routes still load correctly)

**4. Production deployment test:**

- Deploy to GitHub Pages
- Test all major user flows
- Verify no console errors
- Check Network tab for efficient chunk loading

**5. Performance metrics:**

- Run Lighthouse audit
- Verify improved Performance score
- Check bundle size in DevTools

---

## Rollback Plan

If bundle optimization causes issues:

**1. Revert to previous commit:**

```bash
git log --oneline  # find commit before optimization
git revert <commit-hash>
```

**2. Quick deploy:**

```bash
npm run build && npm run deploy
```

**3. Investigate specific issue:**

- Check console errors
- Review Network tab for failed chunks
- Test specific routes that fail

---

## Success Criteria

- ✅ Total bundle size < 200KB gzipped
- ✅ All smoke tests pass
- ✅ All E2E tests pass
- ✅ No console errors in production
- ✅ ServiceWorker error resolved
- ✅ App loads and functions correctly
- ✅ Lighthouse Performance score improved

---

## Notes for Implementation

- **Test frequently:** After each task, run `npm run dev` and test the app
- **Incremental commits:** Commit after each task completion
- **Monitor bundle size:** After tasks 3-7, run `npm run build` to see progress
- **Keep stats.html:** Review bundle analyzer after each optimization
- **Document learnings:** Note which optimizations had biggest impact
