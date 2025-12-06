# Option B: Minimal Pragmatic Ruleset

> Focused essentials only - principles over exhaustive examples

---

## TypeScript

Enable strict mode. No exceptions.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

**Rules:**
- Use `unknown` over `any`
- Prefer type guards over type assertions
- Always handle null/undefined explicitly

---

## React

**Server Components are default.** Mark client components with `'use client'`.

**Core patterns:**
- `useTransition` for non-blocking updates
- `Suspense` for loading states
- Server Actions for mutations

```typescript
// Server Component (default)
async function Page() {
  const data = await fetchData();
  return <Display data={data} />;
}

// Client Component (explicit)
'use client';
function InteractiveWidget() {
  const [state, setState] = useState();
  return <button onClick={() => setState(...)}>Click</button>;
}
```

---

## Testing

**Unit tests:** Vitest, colocated (`file.ts` + `file.test.ts`)

**E2E tests:** Playwright with accessibility selectors

```typescript
// Prefer
await page.getByRole('button', { name: 'Submit' }).click();

// Avoid
await page.locator('.submit-btn').click();
```

---

## Styling

Tailwind CSS. Mobile-first. Use variants.

```html
<div class="w-full md:w-1/2 hover:bg-gray-100 focus:ring-2">
```

---

## Decision Principles

1. **TypeScript strict mode is non-negotiable**
2. **Server Components by default, Client Components when needed**
3. **Test behavior, not implementation**
4. **Accessibility selectors over CSS selectors**
5. **Mobile-first responsive design**

---

*This ruleset fits in ~100 lines. Add examples as needed.*
