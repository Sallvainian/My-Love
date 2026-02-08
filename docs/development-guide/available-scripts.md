# Available Scripts

## Development

| Script | Description |
|---|---|
| `npm run dev` | Start dev server with cleanup script |
| `npm run dev:raw` | Start Vite dev server directly (no cleanup) |
| `npm run preview` | Preview the production build locally |

## Build

| Script | Description |
|---|---|
| `npm run build` | Full production build (dotenvx decrypt + tsc + vite build) |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |

## Code Quality

| Script | Description |
|---|---|
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint issues and run Prettier |
| `npm run format` | Run Prettier formatting |
| `npm run format:check` | Check formatting without making changes |

## Testing

| Script | Description |
|---|---|
| `npm run test:unit` | Run Vitest unit tests |
| `npm run test:unit:watch` | Run Vitest in watch mode |
| `npm run test:unit:ui` | Run Vitest with browser UI |
| `npm run test:unit:coverage` | Run unit tests with V8 coverage report |
| `npm run test:smoke` | Run smoke tests against built output |
| `npm run test:e2e` | Run Playwright E2E tests (with cleanup) |
| `npm run test:e2e:raw` | Run Playwright directly |
| `npm run test:e2e:ui` | Run Playwright with interactive UI |
| `npm run test:e2e:debug` | Debug Playwright tests step-by-step |
| `npm run test:burn-in` | Extended test automation (repeated runs) |
| `npm run test:ci-local` | Simulate the CI pipeline locally |

## Deployment

| Script | Description |
|---|---|
| `npm run deploy` | Manual deploy to GitHub Pages (builds + smoke tests first) |

---
