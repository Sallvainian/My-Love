# Technology Stack

> **Last Updated:** 2025-12-08 | **Scan Type:** Exhaustive

## Core Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 19.2.1 | Component-based UI framework |
| **TypeScript** | 5.9.3 | Type-safe development |
| **Vite** | 7.2.6 | Build tool and dev server |
| **Zustand** | 5.0.9 | State management with persistence |

## Backend & Data

| Technology | Version | Purpose |
|------------|---------|---------|
| **Supabase** | 2.86.2 | Backend-as-a-Service (Auth, Database, Realtime, Storage) |
| **IndexedDB** (via idb) | 8.0.3 | Client-side mood/message storage |
| **LocalStorage** | Native | Settings and small data persistence |
| **Zod** | 4.1.13 | Runtime type validation and schemas (v4 API) |

## Styling & UI

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | 4.1.17 | Utility-first styling (CSS-first config) |
| **Framer Motion** | 12.23.25 | Animations and gestures |
| **Lucide React** | 0.513.0 | Icon library |

## Testing & Quality

| Technology | Version | Purpose |
|------------|---------|---------|
| **Vitest** | 4.0.9 | Unit testing framework |
| **Playwright** | 1.57.0 | End-to-end testing |
| **ESLint** | 9.23.0 | Code quality and linting |

## PWA Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| **vite-plugin-pwa** | 1.2.0 | Service worker generation (injectManifest) |
| **Workbox** | (via plugin) | Intelligent caching strategies |

## Version-Specific Notes

### React 19.2.1
- Use `useTransition` for non-blocking updates
- `useDeferredValue` for expensive renders
- Concurrent rendering features enabled

### TypeScript 5.9.3
- `verbatimModuleSyntax: true` - Use `import type { X }` for type-only imports
- `noUncheckedIndexedAccess: true` - Array access returns `T | undefined`
- Target: ES2022, Module: ESNext

### Tailwind CSS 4.1.17
- **NO `tailwind.config.js`** - CSS-first configuration
- Use `@theme` in CSS for customization
- Mobile-first responsive design

### Zod 4.1.13
- Use `.safeParse()` for user input validation
- Avoid `.parse()` which throws on invalid data
- Updated v4 API syntax

### Zustand 5.0.9
- **Maps don't serialize** - Use arrays instead
- Always use selectors: `useAppStore(s => s.field)`
- Persist middleware with partialize

### vite-plugin-pwa 1.2.0
- `injectManifest` strategy - all caching in `src/sw.ts`
- Workbox options in vite.config.ts are IGNORED
- Background Sync for offline mood sync

## Dependency Categories

### Production Dependencies

```json
{
  "react": "^19.2.1",
  "react-dom": "^19.2.1",
  "@supabase/supabase-js": "^2.86.2",
  "zustand": "^5.0.9",
  "zod": "^4.1.13",
  "framer-motion": "^12.23.25",
  "lucide-react": "^0.513.0",
  "idb": "^8.0.3"
}
```

### Development Dependencies

```json
{
  "typescript": "^5.9.3",
  "vite": "^7.2.6",
  "tailwindcss": "^4.1.17",
  "vitest": "^4.0.9",
  "playwright": "^1.57.0",
  "eslint": "^9.23.0",
  "vite-plugin-pwa": "^1.2.0",
  "@vitejs/plugin-react": "^4.5.1"
}
```

## Build Configuration

### Vite Config Highlights

```typescript
// vite.config.ts
export default defineConfig({
  base: '/My-Love/', // GitHub Pages base path
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'supabase': ['@supabase/supabase-js'],
          'framer': ['framer-motion'],
          'zustand': ['zustand'],
        },
      },
    },
  },
});
```

### TypeScript Config Highlights

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```
