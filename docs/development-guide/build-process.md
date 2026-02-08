# Build Process

Running `npm run build` executes three stages:

1. **dotenvx decryption** -- Decrypts `.env` variables so Vite can inline them at build time.
2. **TypeScript compilation** -- `tsc -b` type-checks and compiles the project.
3. **Vite build** -- Produces the production bundle with:
   - Manual chunk splitting (react, supabase, zustand/idb/zod, framer-motion, lucide-react)
   - PWA manifest generation
   - Service worker compilation via `injectManifest` strategy
   - Bundle size analysis output at `dist/stats.html`

The production output is written to `dist/`.

---
