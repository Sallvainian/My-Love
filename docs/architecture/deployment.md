# Deployment

| Aspect | Technology | Details |
|---|---|---|
| **Hosting** | GitHub Pages | Static file serving from `dist/` directory |
| **CI/CD** | GitHub Actions | Automated build, test, deploy pipeline |
| **Build** | Vite + tsc | `dotenvx run -- bash -c 'tsc -b && vite build'` |
| **Base Path** | `/My-Love/` | Production builds use repository name as subpath |
| **Backend** | Supabase (hosted) | Managed PostgreSQL, Auth, Realtime, Storage |
| **Pre-deploy** | Smoke tests | `node scripts/smoke-tests.cjs` validates build output |
| **Post-deploy** | Health check | `node scripts/post-deploy-check.cjs [URL]` |
| **Deploy command** | gh-pages | `gh-pages -d dist` publishes to `gh-pages` branch |

---
