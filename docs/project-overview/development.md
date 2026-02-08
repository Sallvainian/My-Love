# Development

**Package Manager**: npm (package-lock.json)
**Node Version**: 18+ (.nvmrc)

## Commands

| Task | Command |
|---|---|
| Dev Server | `npm run dev` |
| Build | `npm run build` |
| Unit Tests | `npm run test:unit` |
| E2E Tests | `npm run test:e2e` |
| Lint | `npm run lint` |
| Format | `npm run format` |
| Type Check | `npm run typecheck` |

## Notes

- The dev server runs Vite with a cleanup script.
- The build uses dotenvx for encrypted environment variables.
- Unit tests use Vitest with happy-dom.
- E2E tests use Playwright.

---
