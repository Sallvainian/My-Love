# Technology Stack

> Complete technology inventory for My-Love project.

## Core Technologies

### Language & Runtime

| Technology | Version | Purpose |
|------------|---------|---------|
| TypeScript | 5.9.3 | Static typing with strict mode |
| Node.js | 18+ | Development runtime |
| ES2022 | Target | JavaScript target |

### Frontend Framework

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2.3 | UI framework (latest React 19) |
| React DOM | 19.2.3 | DOM rendering |
| Vite | 7.3.1 | Build tool & dev server |

### State Management

| Technology | Version | Purpose |
|------------|---------|---------|
| Zustand | 5.0.10 | Global state management |
| idb | 8.0.3 | IndexedDB wrapper |
| Zod | 4.3.5 | Runtime schema validation |

### Backend (BaaS)

| Technology | Version | Purpose |
|------------|---------|---------|
| Supabase JS | 2.90.1 | Client SDK |
| Supabase Auth | - | Email/password + OAuth |
| Supabase Database | PostgreSQL | Primary data store |
| Supabase Storage | - | Photo storage |
| Supabase Realtime | - | Live subscriptions |

### Styling

| Technology | Version | Purpose |
|------------|---------|---------|
| Tailwind CSS | 4.1.17 | Utility-first CSS |
| PostCSS | 8.5.6 | CSS processing |
| Autoprefixer | 10.4.23 | Browser prefixes |

### Animation

| Technology | Version | Purpose |
|------------|---------|---------|
| Framer Motion | 12.27.1 | React animations |

### Icons

| Technology | Version | Purpose |
|------------|---------|---------|
| Lucide React | 0.562.0 | Icon library |

### PWA

| Technology | Version | Purpose |
|------------|---------|---------|
| vite-plugin-pwa | 1.2.0 | PWA support |
| Workbox | 7.4.0 | Service worker utilities |

## Development Tools

### Testing

| Technology | Version | Purpose |
|------------|---------|---------|
| Vitest | 4.0.17 | Unit test runner |
| Playwright | 1.57.0 | E2E testing |
| Testing Library | 16.3.2 | React testing |
| happy-dom | 20.3.4 | DOM environment |
| fake-indexeddb | 6.2.5 | IndexedDB mock |

### Code Quality

| Technology | Version | Purpose |
|------------|---------|---------|
| ESLint | 9.39.2 | Code linting |
| Prettier | 3.8.0 | Code formatting |
| TypeScript ESLint | 8.53.1 | TS-specific linting |

### Build & Bundle

| Technology | Version | Purpose |
|------------|---------|---------|
| Vite | 7.3.1 | Bundler |
| @vitejs/plugin-react | 5.1.2 | React plugin |
| vite-plugin-checker | 0.12.0 | Type checking |
| rollup-plugin-visualizer | 6.0.5 | Bundle analysis |

### Deployment

| Technology | Version | Purpose |
|------------|---------|---------|
| gh-pages | 6.3.0 | GitHub Pages deploy |
| dotenvx | 1.51.4 | Encrypted env vars |

## Configuration Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript config (project references) |
| `tsconfig.app.json` | App TypeScript config |
| `vite.config.ts` | Vite build config |
| `tailwind.config.js` | Tailwind customization |
| `postcss.config.js` | PostCSS plugins |
| `eslint.config.js` | ESLint rules |
| `playwright.config.ts` | E2E test config |
| `vitest.config.ts` | Unit test config |

## TypeScript Configuration

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "react-jsx"
  }
}
```

## Build Optimization

### Manual Chunk Splitting

```typescript
manualChunks: {
  'vendor-react': ['react', 'react-dom'],
  'vendor-supabase': ['@supabase/supabase-js'],
  'vendor-state': ['zustand', 'idb', 'zod'],
  'vendor-animation': ['framer-motion'],
  'vendor-icons': ['lucide-react'],
}
```

## Browser Support

```json
{
  "browserslist": [
    "defaults and supports es6-module",
    "maintained node versions"
  ]
}
```
