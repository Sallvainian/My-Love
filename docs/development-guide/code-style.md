# Code Style

## TypeScript

### Compiler Settings

| Setting | Value | Purpose |
|---|---|---|
| `target` | ES2022 | Modern JavaScript output |
| `module` | ESNext | ES module syntax |
| `moduleResolution` | bundler | Vite/Rollup compatible resolution |
| `jsx` | react-jsx | React 19 automatic JSX transform |
| `strict` | true | All strict type-checking options enabled |
| `noUnusedLocals` | true | Error on unused local variables |
| `noUnusedParameters` | true | Error on unused function parameters |
| `noFallthroughCasesInSwitch` | true | Error on switch case fallthrough |
| `verbatimModuleSyntax` | true | Enforce explicit `type` imports |
| `noEmit` | true | Vite handles bundling; TypeScript only type-checks |

### Type Safety Rules

- **No `any` types** -- `@typescript-eslint/no-explicit-any` is set to `error`. Use `unknown` or specific types instead.
- **Unused variables** prefixed with `_` are allowed (e.g., `_event`, `_unused`).
- **Generated types** -- `src/types/database.types.ts` is auto-generated from the Supabase schema. Do not edit manually. Regenerate with:
  ```bash
  supabase gen types typescript --local > src/types/database.types.ts
  ```

## ESLint

ESLint 9 with flat config (`eslint.config.js`). No `.eslintrc` file.

### Base Configurations

- `@eslint/js` recommended rules
- `typescript-eslint` recommended rules

### Plugin Rules

| Plugin | Key Rules |
|---|---|
| `eslint-plugin-react-hooks` | All recommended rules enabled. `set-state-in-effect` and `purity` downgraded to `warn` for legitimate patterns (blob URL lifecycle, timer setup, animation randomization). |
| `eslint-plugin-react-refresh` | `only-export-components` as warning, with `allowConstantExport: true` |
| `typescript-eslint` | `no-explicit-any`: error. `no-unused-vars`: error with `_` prefix ignore pattern for args, vars, and caught errors. |

### Special Configurations

**CommonJS files (`*.cjs`)**:
- Node.js globals enabled
- `sourceType: 'commonjs'`
- `no-require-imports` disabled

**Test files (`tests/**`, `*.test.*`, `*.spec.*`)**:
- Both browser and Node globals enabled
- `rules-of-hooks` disabled (test fixtures may use hooks unconventionally)
- `no-empty-pattern` disabled (Playwright fixtures use empty destructuring)
- `ban-ts-comment` disabled (tests may need `@ts-ignore` for mocking)
- `no-unused-vars` disabled (tests often have unused imports/mocks)
- `no-global-assign` disabled (tests may mock global objects like `Date`)

**Scripture Reading feature** (`src/services/scriptureReadingService.ts`, `src/stores/slices/scriptureReadingSlice.ts`, `src/hooks/useScriptureBroadcast.ts`, `src/components/scripture-reading/**`):
- Strict `no-explicit-any` enforcement as error (reinforced for this feature domain)

### Global Ignores

```javascript
ignores: [
  'dist/**', 'dev-dist/**', 'build/**', 'coverage/**', 'node_modules/**',
  '.bmad/**', 'scripts/**', '**/*.config.js', '**/*.config.ts',
  'vite.config.*', 'playwright.config.*', 'src/types/database.types.ts',
]
```

### Running

```bash
npm run lint         # Check for errors
npm run lint:fix     # Auto-fix + Prettier format
```

The lint command targets `src`, `tests`, and `scripts` directories with explicit ignore patterns for test report directories, BMAD artifacts, and Codex artifacts.

## Prettier

Prettier 3.8 with `prettier-plugin-tailwindcss` for automatic Tailwind CSS class sorting.

### Configuration (`.prettierrc`)

```json
{
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "quoteProps": "as-needed",
  "jsxSingleQuote": false,
  "trailingComma": "es5",
  "bracketSpacing": true,
  "bracketSameLine": false,
  "arrowParens": "always",
  "endOfLine": "lf",
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

Key settings:

- **100-character line width** (wider than 80-char default)
- **Single quotes** in JavaScript/TypeScript, double quotes in JSX
- **ES5 trailing commas** (objects, arrays, function parameters)
- **LF line endings** (Unix-style)
- **Tailwind class sorting** via `prettier-plugin-tailwindcss`

### Running

```bash
npm run format         # Format all files (writes changes)
npm run format:check   # Check formatting (no writes, non-zero exit on violations)
```

### Ignored Files (`.prettierignore`)

```
node_modules/
dist/
dev-dist/
coverage/
.vscode/
package-lock.json
playwright-report/
test-results/
```

## Naming and Import Conventions

### Self-Documenting Code

Use descriptive names that reveal intent. Minimize comments.

```typescript
// Good: descriptive names
function calculateDaysSinceStart(startDate: string): number { ... }
const isPartnerLinked = partner?.id !== undefined;

// Bad: generic names requiring comments
function calc(d: string): number { ... }
const flag = p?.id !== undefined;
```

### Import Order

1. Node built-ins (if any)
2. External packages (`react`, `zustand`, `@supabase/supabase-js`)
3. Internal modules (`@/services/...`, `@/stores/...`)
4. Relative imports (`./components/...`, `../utils/...`)

### State Management

Zustand with one slice per domain area (10 slices). The main store is composed in `src/stores/useAppStore.ts`.

### Validation

Zod 4.3.6 schemas for all runtime data validation. Schemas are defined in `src/validation/schemas.ts` with user-facing error messages in `src/validation/errorMessages.ts`.

### Component Organization

Components are organized by feature domain under `src/components/`:

```
components/
  DailyMessage/        # Feature: daily love messages
  love-notes/          # Feature: real-time chat
  MoodTracker/         # Feature: mood logging
  PartnerMoodView/     # Feature: partner mood display
  PokeKissInterface/   # Feature: partner interactions
  PhotoGallery/        # Feature: photo gallery
  scripture-reading/   # Feature: scripture reading flow
```

Each feature directory contains its components, styles, and feature-specific hooks.
