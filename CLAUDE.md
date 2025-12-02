# Testing Guidelines

## Testing Framework
- `vitest` is used for testing
- Tests are colocated next to the tested file
  - Example: `dir/format.ts` and `dir/format.test.ts`

## Common Mocks

### Server-Only Mock
```ts
vi.mock("server-only", () => ({}));
```

### Prisma Mock
```ts
import { beforeEach } from "vitest";
import prisma from "@/utils/__mocks__/prisma";

vi.mock("@/utils/prisma");

describe("example", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("test", async () => {
    prisma.group.findMany.mockResolvedValue([]);
  });
});
```

## Best Practices
- Each test should be independent
- Use descriptive test names
- Mock external dependencies
- Clean up mocks between tests
- Avoid testing implementation details

# React rules

- Use functional components with hooks instead of class components
- Use custom hooks for reusable logic
- Use the Context API for state management when needed
- Use proper prop validation with PropTypes
- Use React.memo for performance optimization when necessary
- Use fragments to avoid unnecessary DOM elements
- Use proper list rendering with keys
- Prefer composition over inheritance

# Tailwind CSS rules

- Use responsive prefixes for mobile-first design:

```html
<div class="w-full md:w-1/2 lg:w-1/3">
  <!-- Full width on mobile, half on medium, one-third on large screens -->
</div>
```

- Use state variants for interactive elements:

```html
<button class="bg-blue-500 hover:bg-blue-600 focus:ring-2">
  Click me
</button>
```

- Use @apply for repeated patterns when necessary:

```css
@layer components {
  .btn-primary {
    @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600;
  }
}
```

- Use arbitrary values for specific requirements:

```html
<div class="top-[117px] grid-cols-[1fr_2fr]">
  <!-- Custom positioning and grid layout -->
</div>
```

- Use spacing utilities for consistent layout:

```html
<div class="space-y-4">
  <div>Item 1</div>
  <div>Item 2</div>
</div>
```
