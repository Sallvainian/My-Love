# My-Love Project Standards

> Quick reference for coding standards. See extended docs for detailed patterns.

@docs/03-Development/typescript-patterns.md
@docs/03-Development/react-19-guide.md
@docs/04-Testing-QA/testing-guide.md
@docs/03-Development/troubleshooting.md

---

## TypeScript - Strict Mode Required

```json
{ "strict": true, "noUncheckedIndexedAccess": true }
```

**Rules:**
- Use `unknown` over `any`
- Prefer type guards over type assertions
- Always handle null/undefined explicitly

📚 *Extended: [typescript-patterns.md](docs/03-Development/typescript-patterns.md)*

---

## React - Server-First

- **Default:** Server Components (async, no hooks)
- **Explicit:** `'use client'` for interactivity
- **Patterns:** `useTransition`, `Suspense`, Server Actions

📚 *Extended: [react-19-guide.md](docs/03-Development/react-19-guide.md)*

---

## Testing - Dual Strategy

**Unit (Vitest):**
- Colocated: `file.ts` + `file.test.ts`
- Mock server-only: `vi.mock("server-only", () => ({}))`

**E2E (Playwright):**
- Accessibility selectors: `getByRole`, `getByLabel`
- Avoid CSS selectors: `.class`, `#id`

📚 *Extended: [testing-guide.md](docs/04-Testing-QA/testing-guide.md)*

---

## Styling - Tailwind Mobile-First

```html
<div class="w-full md:w-1/2 lg:w-1/3">
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2">
```

---

## Decision Matrix

| Question | Use CLAUDE.md | Use Extended Docs |
|----------|---------------|-------------------|
| TypeScript config? | ✅ | |
| React 19 hook patterns? | | ✅ |
| Why is test flaky? | | ✅ (troubleshooting) |
| Server vs Client Component? | ✅ | |

📚 *Troubleshooting: [troubleshooting.md](docs/03-Development/troubleshooting.md)*

---

## Core Principles

1. **TypeScript strict mode is non-negotiable**
2. **Server Components by default, Client Components when needed**
3. **Test behavior, not implementation**
4. **Accessibility selectors over CSS selectors**
5. **Mobile-first responsive design**
