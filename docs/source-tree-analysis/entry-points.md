# Entry Points

## Primary Entry Points

| File           | Purpose                                                                         | Import Chain     |
| -------------- | ------------------------------------------------------------------------------- | ---------------- |
| `src/main.tsx` | **Application bootstrap** - React 19 root render, StrictMode, global CSS import | Entry → App.tsx  |
| `src/App.tsx`  | **Root component** - Route orchestration, auth state management, lazy loading   | App → Components |
| `index.html`   | **HTML shell** - PWA manifest link, viewport config, root div                   | HTML → main.tsx  |

## Secondary Entry Points

| File                   | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `vite.config.ts`       | Build configuration, PWA plugin setup, optimization settings |
| `tailwind.config.js`   | Theme system, custom colors, animations                      |
| `playwright.config.ts` | E2E test configuration                                       |
| `vitest.config.ts`     | Unit test configuration                                      |
