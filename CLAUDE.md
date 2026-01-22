# My-Love Project Standards

> Quick reference for coding standards. See magic docs for architecture details.

@docs/03-Development/typescript-patterns.md
@docs/magic/component-architecture.md
@docs/magic/state-management.md
@docs/magic/api-services.md

---

## TypeScript - Strict Mode Required

```json
{ "strict": true, "noUncheckedIndexedAccess": true }
```

**Rules:**
- Use `unknown` over `any`
- Prefer type guards over type assertions
- Always handle null/undefined explicitly

---

## React - Client-Side SPA (Vite)

- **Architecture:** Pure client-side SPA - no Server Components
- **State:** Zustand with slice composition pattern
- **Routing:** Manual URL-based (no React Router library)
- **Lazy loading:** Route-level code splitting with `React.lazy()`

**Patterns:**
- `useTransition` for non-urgent updates
- Selector pattern: `useAppStore(state => state.value)`
- Custom hooks in `src/hooks/` for reusable logic

---

## Testing - Dual Strategy

**Unit (Vitest):**
- Colocated: `src/**/__tests__/` or `tests/unit/`
- Environment: `happy-dom` with `fake-indexeddb/auto`
- Mock Supabase client module, not individual functions

**E2E (Playwright):**
- Accessibility selectors: `getByRole`, `getByLabel`
- Avoid CSS selectors: `.class`, `#id`
- Global auth setup with `storageState.json`

---

## Styling - Tailwind Mobile-First

```html
<div class="w-full md:w-1/2 lg:w-1/3">
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2">
```

---

## Decision Matrix

| Question | Use CLAUDE.md | Use Magic Docs |
|----------|---------------|----------------|
| TypeScript config? | Yes | |
| Component patterns? | | `component-architecture.md` |
| Zustand slice pattern? | | `state-management.md` |
| API/service layer? | | `api-services.md` |
| Testing setup? | Yes | |

---

## Core Principles

1. **TypeScript strict mode is non-negotiable**
2. **Zustand selectors to prevent unnecessary re-renders**
3. **Test behavior, not implementation**
4. **Accessibility selectors over CSS selectors**
5. **Mobile-first responsive design**
6. **Offline-first with IndexedDB + Supabase sync**
