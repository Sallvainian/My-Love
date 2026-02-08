# Code Style

## TypeScript

- **Strict mode** enabled with `noUnusedLocals`, `noUnusedParameters`, and `noFallthroughCasesInSwitch`.
- **No `any` types** -- `@typescript-eslint/no-explicit-any` is set to `error`. Use `unknown` or specific types instead.
- **Target**: ES2022.

## ESLint

ESLint 9 flat config with:
- `eslint-plugin-react-hooks` for hook rule enforcement
- `eslint-plugin-react-refresh` for HMR compatibility
- `typescript-eslint` recommended rules
- Unused variables allowed if prefixed with `_`

## Prettier

Prettier 3.8 with the `prettier-plugin-tailwindcss` plugin for automatic Tailwind class sorting.

## Conventions

- **Self-documenting code** -- Use descriptive names; minimize comments.
- **Import order** -- Node built-ins, external packages, internal modules, relative imports.
- **State management** -- Zustand with one slice per domain area (10 slices total).
- **Validation** -- Zod schemas for all runtime data validation.

---
