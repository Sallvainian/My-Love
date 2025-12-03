# My-Love Development Practices

Development workflows, testing strategies, and best practices.

---

## Development Environment

### Prerequisites
- Node.js 20+ (LTS recommended)
- pnpm (preferred) or npm
- Git

### Initial Setup
```bash
# Clone repository
git clone <repo-url>
cd My-Love

# Install dependencies
pnpm install

# Copy environment template
cp .env.example .env.local

# Start development server
pnpm dev
```

### Environment Variables
```bash
# .env.local
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx
```

---

## Development Commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server (http://localhost:5173) |
| `pnpm build` | Production build to `dist/` |
| `pnpm preview` | Preview production build locally |
| `pnpm test` | Run Vitest unit tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm test:coverage` | Generate coverage report |
| `pnpm test:e2e` | Run Playwright E2E tests |
| `pnpm lint` | Run ESLint |
| `pnpm typecheck` | Run TypeScript compiler check |
| `pnpm format` | Format code with Prettier |

---

## Git Workflow

### Branch Naming
```
feature/[epic]-[story]-description
fix/[issue]-description
docs/[topic]-update

Examples:
feature/epic-2-story-3-mood-tracker
fix/issue-45-photo-upload-crash
docs/api-documentation-update
```

### Commit Messages
```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Scope: component name, service, feature area

Examples:
feat(MoodTracker): add mood history view
fix(PhotoService): handle upload timeout
docs(README): update setup instructions
```

### Feature Development Flow
```bash
# 1. Create feature branch
git checkout -b feature/epic-X-story-Y-description

# 2. Develop with frequent commits
git add .
git commit -m "feat(Component): add feature"

# 3. Run quality checks before PR
pnpm lint && pnpm typecheck && pnpm test

# 4. Push and create PR
git push -u origin feature/epic-X-story-Y-description
```

---

## Testing Strategy

### Test Types

| Type | Tool | Location | Purpose |
|------|------|----------|---------|
| Unit | Vitest | `__tests__/*.test.ts` | Functions, hooks, utilities |
| Component | Vitest + RTL | `__tests__/*.test.tsx` | React component behavior |
| E2E | Playwright | `tests/*.spec.ts` | User flows, integration |

### Test File Organization
```
src/
├── components/
│   └── MoodTracker/
│       ├── MoodTracker.tsx
│       └── __tests__/
│           └── MoodTracker.test.tsx
├── services/
│   └── MoodService.ts
│   └── __tests__/
│       └── MoodService.test.ts
└── utils/
    └── haptics.ts
    └── __tests__/
        └── haptics.test.ts
```

### Writing Unit Tests
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { triggerHaptic } from '../haptics';

describe('haptics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should trigger light haptic feedback', () => {
    const vibrateSpy = vi.spyOn(navigator, 'vibrate').mockReturnValue(true);

    triggerHaptic('light');

    expect(vibrateSpy).toHaveBeenCalledWith(10);
  });

  it('should handle missing vibrate API gracefully', () => {
    vi.spyOn(navigator, 'vibrate').mockReturnValue(false);

    // Should not throw
    expect(() => triggerHaptic('light')).not.toThrow();
  });
});
```

### Writing Component Tests
```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoodTracker } from '../MoodTracker';

// Mock Zustand store
vi.mock('@/stores/useAppStore', () => ({
  useAppStore: vi.fn(() => ({
    addMood: vi.fn(),
    moods: [],
  })),
}));

describe('MoodTracker', () => {
  it('should render mood selection', () => {
    render(<MoodTracker />);

    expect(screen.getByText('How are you feeling?')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /happy/i })).toBeInTheDocument();
  });

  it('should save mood on selection', async () => {
    const mockAddMood = vi.fn();
    vi.mocked(useAppStore).mockReturnValue({ addMood: mockAddMood });

    render(<MoodTracker />);
    fireEvent.click(screen.getByRole('button', { name: /happy/i }));

    expect(mockAddMood).toHaveBeenCalledWith(expect.objectContaining({
      mood: 'happy',
    }));
  });
});
```

### Common Mocks

#### Mocking Server-Only Modules
```typescript
vi.mock('server-only', () => ({}));
```

#### Mocking Prisma/Database
```typescript
import { beforeEach } from 'vitest';
import prisma from '@/utils/__mocks__/prisma';

vi.mock('@/utils/prisma');

describe('database tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should query data', async () => {
    prisma.mood.findMany.mockResolvedValue([{ id: '1', mood: 'happy' }]);
    // ... test implementation
  });
});
```

#### Mocking IndexedDB
```typescript
import { vi } from 'vitest';

const mockIDB = {
  put: vi.fn().mockResolvedValue('id'),
  get: vi.fn().mockResolvedValue({ id: '1', data: 'test' }),
  getAll: vi.fn().mockResolvedValue([]),
  delete: vi.fn().mockResolvedValue(undefined),
};

vi.mock('@/services/BaseIndexedDBService', () => ({
  BaseIndexedDBService: vi.fn().mockImplementation(() => mockIDB),
}));
```

### E2E Testing (Playwright)
```typescript
// tests/mood-tracking.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Mood Tracking', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should record a mood entry', async ({ page }) => {
    // Navigate to mood tracker
    await page.click('[data-testid="nav-mood"]');

    // Select a mood
    await page.click('[data-testid="mood-happy"]');

    // Add optional note
    await page.fill('[data-testid="mood-note"]', 'Great day!');

    // Save
    await page.click('[data-testid="save-mood"]');

    // Verify saved
    await expect(page.locator('[data-testid="mood-history"]')).toContainText('Great day!');
  });
});
```

---

## Code Quality

### Pre-Commit Checks
```bash
# Run before every commit
pnpm lint        # Check for lint errors
pnpm typecheck   # Verify TypeScript types
pnpm test        # Run unit tests
```

### ESLint Configuration
```javascript
// Key rules enforced
{
  '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',
  'no-console': 'warn', // Warn on console.log in production
}
```

### TypeScript Strictness
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

---

## Debugging

### Development Tools
- React DevTools browser extension
- Zustand DevTools (enable in development)
- Chrome DevTools Application tab for IndexedDB inspection

### Common Issues

#### IndexedDB Not Persisting
```typescript
// Check if database is initialized
const db = await openDB('my-love-db', 1);
console.log('Stores:', db.objectStoreNames);
```

#### Zustand State Not Updating
```typescript
// Ensure you're returning new object reference
set((state) => ({
  items: [...state.items, newItem], // Correct
}));

// NOT
set((state) => {
  state.items.push(newItem); // Wrong - mutation
  return state;
});
```

#### Offline Mode Not Working
```bash
# Verify service worker registration
# Application tab > Service Workers > Check status

# Clear service worker if needed
navigator.serviceWorker.getRegistrations().then((registrations) => {
  registrations.forEach((reg) => reg.unregister());
});
```

---

## Performance Optimization

### React Performance
```typescript
// Memoize expensive components
export const PhotoGallery = React.memo(function PhotoGallery({ photos }) {
  return (/* JSX */);
});

// Memoize expensive calculations
const sortedPhotos = useMemo(() =>
  photos.sort((a, b) => b.date - a.date),
  [photos]
);

// Memoize callbacks passed to children
const handleSelect = useCallback((id: string) => {
  setSelected(id);
}, []);
```

### Bundle Size
```bash
# Analyze bundle
pnpm build
npx vite-bundle-visualizer

# Check for large imports
# Prefer: import { specific } from 'library'
# Avoid: import * as lib from 'library'
```

### Image Optimization
```typescript
// Compress before storing in IndexedDB
async function compressImage(file: File): Promise<Blob> {
  const canvas = document.createElement('canvas');
  // ... compression logic
  return new Promise((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.8);
  });
}
```

---

## Deployment

### Build for Production
```bash
# Create optimized build
pnpm build

# Output in dist/ directory
# - index.html
# - assets/*.js (chunked)
# - assets/*.css
# - sw.js (service worker)
# - manifest.webmanifest
```

### Environment-Specific Builds
```bash
# Development
VITE_APP_ENV=development pnpm build

# Staging
VITE_APP_ENV=staging pnpm build

# Production
VITE_APP_ENV=production pnpm build
```

### Hosting Considerations
- Static hosting (Vercel, Netlify, Cloudflare Pages)
- HTTPS required for PWA features
- Proper cache headers for assets
- Service worker scope configuration

---

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
pnpm build

# Check for TypeScript errors
pnpm typecheck

# Verify all imports resolve
pnpm lint
```

### Test Failures
```bash
# Run specific test file
pnpm test src/utils/__tests__/haptics.test.ts

# Run with verbose output
pnpm test --reporter=verbose

# Update snapshots
pnpm test -- -u
```

### PWA Issues
```bash
# Rebuild service worker
pnpm build

# Force update in browser
# DevTools > Application > Service Workers > Update
```

---

## Documentation

### Code Documentation
```typescript
/**
 * Saves a mood entry to IndexedDB and syncs to Supabase if online.
 *
 * @param entry - The mood entry to save
 * @returns The ID of the saved entry
 * @throws {ValidationError} If entry fails Zod validation
 */
async function saveMood(entry: MoodEntry): Promise<string> {
  // Implementation
}
```

### Component Documentation
```typescript
/**
 * MoodTracker - Allows users to record their current mood.
 *
 * Features:
 * - 5 mood options (happy, content, neutral, sad, stressed)
 * - Optional note field
 * - Haptic feedback on selection
 * - Offline support with sync
 *
 * @example
 * <MoodTracker onSave={(mood) => console.log(mood)} />
 */
```

### README Updates
- Keep README.md updated with setup instructions
- Document environment variables
- Include troubleshooting section
- Add contribution guidelines
