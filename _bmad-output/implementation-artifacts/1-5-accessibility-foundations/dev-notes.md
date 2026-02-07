# Dev Notes

## Implementation Status — What Exists vs What's New

Story 1.5 is a cross-cutting accessibility enhancement story. It touches every Scripture Reading component but builds on substantial accessibility work already done in Stories 1.2-1.4.

| Capability | Status | Gap |
|-----------|--------|-----|
| `aria-label` on exit button | ✅ Done (Story 1.3) | None |
| `aria-label` on progress indicator | ✅ Done (Story 1.3) | None |
| `role="dialog"` + `aria-labelledby/describedby` on exit dialog | ✅ Done (Story 1.3) | Need focus trap |
| `aria-hidden="true"` on decorative emoji | ✅ Done (Story 1.3) | None |
| `role="status"` + `aria-live="polite"` on offline indicator | ✅ Done (Story 1.4) | None |
| `role="alert"` on error display | ✅ Done (Story 1.3) | Need icon for color independence |
| `useReducedMotion()` inline usage | ✅ Done (Stories 1.2-1.3) | Refactor to centralized `useMotionConfig` |
| `autoFocus` on dialog Save button | ✅ Done (Story 1.3) | Need full focus trap |
| Escape key handler for dialog | ✅ Done (Story 1.4) | None |
| 48x48px+ touch targets | ✅ Done (Stories 1.2-1.3) | Verify "Setup partner link" |
| `type="button"` on all buttons | ✅ Done (Stories 1.2-1.4) | None |
| `<main>` semantic element | ✅ Done (SoloReadingFlow) | ScriptureOverview missing |
| `aria-label` on section elements | ✅ Done (ScriptureOverview) | None |
| **useMotionConfig hook** | ❌ New | Create + wire into all components |
| **Focus-visible ring styles** | ❌ New | Add to all buttons |
| **Phase transition announcements** | ❌ New | aria-live announcer region |
| **Focus management on transitions** | ❌ New | Refs + programmatic focus |
| **Dialog focus trap** | ❌ New | Trap + restore pattern |
| **Color independence (error icon)** | ❌ New | Add icons to color indicators |
| **Contrast fixes** | ❌ Audit needed | Verify purple-400/500 on lavender bg |
| **Disabled reason text** | ❌ New | Show text when button disabled |

## Existing ARIA Inventory

**SoloReadingFlow.tsx (11 ARIA attributes):**
| Attribute | Element | Value |
|-----------|---------|-------|
| `aria-hidden="true"` | Completion emoji (🙏) | Decorative |
| `aria-label="Exit reading"` | Exit (X) button | ✅ |
| `aria-label="Currently on verse X of 17"` | Progress indicator | ✅ |
| `role="status"` | Offline indicator | ✅ |
| `aria-live="polite"` | Offline indicator | ✅ |
| `role="alert"` | Error display | ✅ |
| `role="dialog"` | Exit confirmation dialog | ✅ |
| `aria-labelledby="exit-dialog-title"` | Exit dialog | ✅ |
| `aria-describedby="exit-dialog-desc"` | Exit dialog | ✅ |
| `autoFocus` | Save & Exit button | ✅ |
| (Escape handler) | Dialog keydown listener | ✅ |

**ScriptureOverview.tsx (5 ARIA attributes):**
| Attribute | Element | Value |
|-----------|---------|-------|
| `aria-label="Partner status"` | Partner status section | ✅ |
| `aria-label="Resume session"` | Resume prompt section | ✅ |
| `role="status"` + `aria-live="polite"` | Offline indicator | ✅ |
| `role="alert"` | Error display | ✅ |
| `aria-label="Choose reading mode"` | Mode selection section | ✅ |

## ARIA Gaps to Fill

| Gap | Component | Fix |
|-----|-----------|-----|
| No phase transition announcements | SoloReadingFlow | Add sr-only aria-live announcer region |
| No session state announcements | ScriptureOverview | Add sr-only aria-live announcer region |
| No focus-visible ring styles | Both | Add `focus-visible:ring-2 ring-purple-400` classes |
| No focus management on step/view transitions | SoloReadingFlow | Add refs + programmatic focus |
| No focus trap in exit dialog | SoloReadingFlow | Add focus trap pattern |
| No focus restoration on dialog close | SoloReadingFlow | Store + restore previous focus |
| Error indicator lacks icon | Both | Add warning icon SVG |
| Disabled button lacks reason text | SoloReadingFlow | Add helper text when offline |
| `text-purple-400` may fail contrast | Both | Audit and darken if needed |
| ScriptureOverview lacks `<main>` | ScriptureOverview | Add semantic `<main>` element |
| No `aria-current="step"` on progress | SoloReadingFlow | Add to progress indicator |

## useMotionConfig Design

The architecture spec (Decision 5: Component Architecture) defines `useMotionConfig` as a centralized motion configuration hook. Currently, both `SoloReadingFlow` and `ScriptureOverview` use `useReducedMotion()` from Framer Motion inline with duplicated transition objects.

**Before (inline duplication):**
```typescript
// SoloReadingFlow.tsx
const shouldReduceMotion = useReducedMotion();
const crossfadeTransition = shouldReduceMotion ? { duration: 0 } : { duration: 0.2 };
const slideTransition = shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' };

// ScriptureOverview.tsx
const shouldReduceMotion = useReducedMotion();
const fadeTransition = shouldReduceMotion ? { duration: 0 } : { duration: 0.2 };
```

**After (centralized):**
```typescript
// src/hooks/useMotionConfig.ts
import { useReducedMotion } from 'framer-motion';

export function useMotionConfig() {
  const shouldReduceMotion = useReducedMotion();

  return {
    shouldReduceMotion: !!shouldReduceMotion,
    crossfade: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
    slide: shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: 'easeInOut' as const },
    spring: shouldReduceMotion ? { duration: 0 } : { type: 'spring' as const, stiffness: 100, damping: 15 },
    fadeIn: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
    modeReveal: shouldReduceMotion ? { duration: 0 } : { duration: 0.2 },
  };
}
```

**Location:** `src/hooks/useMotionConfig.ts` (architecture originally specified `src/components/scripture-reading/useMotionConfig.ts`, but since it's a general-purpose hook, `src/hooks/` is more appropriate and consistent with existing hooks like `useAutoSave`, `useNetworkStatus`).

[Source: architecture/core-architectural-decisions.md#Decision 5: Component Architecture]
[Source: architecture/project-structure-boundaries.md#Complete Project Directory Structure]

## Focus Management Pattern

Focus management on transitions is the most complex part of this story. The pattern:

```typescript
// Refs
const verseHeadingRef = useRef<HTMLParagraphElement>(null);
const backToVerseRef = useRef<HTMLButtonElement>(null);
const completionHeadingRef = useRef<HTMLHeadingElement>(null);

// Track previous values to detect changes
const prevStepIndexRef = useRef(session?.currentStepIndex);
const prevSubViewRef = useRef(subView);
const prevIsCompletedRef = useRef(isCompleted);

useEffect(() => {
  // Step change → focus verse heading
  if (session && prevStepIndexRef.current !== session.currentStepIndex) {
    requestAnimationFrame(() => {
      verseHeadingRef.current?.focus();
    });
  }
  prevStepIndexRef.current = session?.currentStepIndex;
}, [session?.currentStepIndex]);

useEffect(() => {
  // Sub-view change
  if (prevSubViewRef.current !== subView) {
    requestAnimationFrame(() => {
      if (subView === 'response') {
        backToVerseRef.current?.focus();
      } else {
        verseHeadingRef.current?.focus();
      }
    });
  }
  prevSubViewRef.current = subView;
}, [subView]);
```

**Important:** Use `requestAnimationFrame` to defer focus until after Framer Motion has completed its render/animation.

## Screen Reader Announcer Pattern

```typescript
const [announcement, setAnnouncement] = useState('');
const prevStepRef = useRef(session?.currentStepIndex);
const prevSubViewRef = useRef(subView);

useEffect(() => {
  if (session && prevStepRef.current !== session.currentStepIndex) {
    setAnnouncement(`Now on verse ${session.currentStepIndex + 1}`);
    // Clear after screen reader has time to announce
    const timer = setTimeout(() => setAnnouncement(''), 1000);
    return () => clearTimeout(timer);
  }
  prevStepRef.current = session?.currentStepIndex;
}, [session?.currentStepIndex]);

useEffect(() => {
  if (prevSubViewRef.current !== subView) {
    if (subView === 'response') {
      setAnnouncement(`Viewing response for verse ${(session?.currentStepIndex ?? 0) + 1}`);
    } else if (prevSubViewRef.current === 'response') {
      setAnnouncement(`Back to verse ${(session?.currentStepIndex ?? 0) + 1}`);
    }
    const timer = setTimeout(() => setAnnouncement(''), 1000);
    prevSubViewRef.current = subView;
    return () => clearTimeout(timer);
  }
}, [subView, session?.currentStepIndex]);
```

**Critical rule from UX spec:** "Announce only when the semantic state changes, not when props re-render." Using refs to track previous values ensures announcements fire exactly once per semantic change.

[Source: ux-design-specification/responsive-design-accessibility.md#Screen Reader Announcements]

## Dialog Focus Trap Pattern

```typescript
const dialogRef = useRef<HTMLDivElement>(null);
const previousFocusRef = useRef<HTMLElement | null>(null);

// Store focus before dialog opens
const handleExitRequest = useCallback(() => {
  previousFocusRef.current = document.activeElement as HTMLElement;
  setShowExitConfirm(true);
}, []);

// Restore focus when dialog closes
const handleExitCancel = useCallback(() => {
  setShowExitConfirm(false);
  requestAnimationFrame(() => {
    previousFocusRef.current?.focus();
  });
}, []);

// Focus trap: Tab/Shift+Tab cycle within dialog
useEffect(() => {
  if (!showExitConfirm || !dialogRef.current) return;

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleExitCancel();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = dialogRef.current!.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [showExitConfirm, handleExitCancel]);
```

## Contrast Audit Notes

Colors to verify against lavender background (`#F3E5F5`):

| Element | Color | Background | Ratio Needed | Likely Status |
|---------|-------|------------|-------------|---------------|
| Verse reference | `text-purple-500` (#A855F7) | `#F3E5F5` | 4.5:1 (small text) | ⚠️ Needs check |
| Response reference | `text-purple-400` (#C084FC) | `#F3E5F5` | 4.5:1 (small text) | ❌ Likely fails |
| Section theme | `text-purple-400` (#C084FC) | `#F3E5F5` | 4.5:1 (small text) | ❌ Likely fails |
| Progress text | `text-purple-600` (#9333EA) | `#F3E5F5` | 4.5:1 | ✅ Likely passes |
| Verse text | `text-purple-900` (#581C87) | `bg-white/80` | 4.5:1 | ✅ Passes |
| Response text | `text-purple-800` (#6B21A8) | `bg-white/80` | 4.5:1 | ✅ Passes |
| Body text | `text-purple-700` (#7E22CE) | `#F3E5F5` | 4.5:1 | ✅ Likely passes |
| Syncing text | `text-purple-400` (#C084FC) | `#F3E5F5` | 4.5:1 | ❌ Likely fails |
| Primary button | `text-white` (#FFF) | purple-500 (#A855F7) | 4.5:1 | ✅ Passes |
| Secondary button | `text-purple-700` (#7E22CE) | `bg-white/80` | 4.5:1 | ✅ Passes |

**Fix:** Bump `text-purple-400` → `text-purple-600` and `text-purple-500` → `text-purple-600` where contrast fails. The visual impact is slightly darker muted text — still thematically consistent with Lavender Dreams.

## Source Files to Touch

| File | Action | Notes |
|------|--------|-------|
| `src/hooks/useMotionConfig.ts` | **CREATE** | Centralized motion config hook |
| `src/hooks/index.ts` | **MODIFY** | Add useMotionConfig export |
| `src/hooks/__tests__/useMotionConfig.test.ts` | **CREATE** | Hook tests |
| `src/components/scripture-reading/containers/SoloReadingFlow.tsx` | **MODIFY** | Focus styles, focus management, announcer, useMotionConfig, dialog focus trap, contrast fixes, error icon, disabled text |
| `src/components/scripture-reading/containers/ScriptureOverview.tsx` | **MODIFY** | Focus styles, useMotionConfig, semantic HTML, contrast fixes, error icon, announcer |
| `src/components/scripture-reading/__tests__/SoloReadingFlow.test.tsx` | **MODIFY** | Update mocks for useMotionConfig, add accessibility tests |
| `src/components/scripture-reading/__tests__/ScriptureOverview.test.tsx` | **MODIFY** | Update mocks for useMotionConfig, add accessibility tests |

## Architecture Compliance Checklist

- [x] **useMotionConfig** created in `src/hooks/` and exported from barrel
- [x] **Container/Presentational:** No new container components — all changes are within existing containers
- [x] **Zustand Selector Pattern:** No new slice state needed — all changes are UI-layer
- [x] **No `any`:** Use proper HTMLElement types for refs
- [x] **No React Router:** No routing changes
- [x] **Pure Client SPA:** No server directives
- [x] **Touch Targets:** All interactive elements ≥ 48x48px with ≥ 8px spacing
- [x] **Focus-visible:** Use `focus-visible` (not `focus`) for keyboard-only rings

## Technology Versions (Locked)

| Technology | Version | Notes |
|-----------|---------|-------|
| React | 19.2.3 | Hooks, refs, useEffect |
| TypeScript | 5.9.3 | Strict mode |
| Zustand | 5.0.10 | No new slice state needed |
| Framer Motion | 12.27.1 | useReducedMotion (wrapped by useMotionConfig) |
| Vitest | 4.0.17 | Unit tests |
| Testing Library | 16.3.2 | Component tests, a11y queries |
| Tailwind CSS | 4.1.17 | focus-visible: utilities |

## Project Structure Notes

- `useMotionConfig.ts` goes in `src/hooks/` alongside `useAutoSave.ts`, `useNetworkStatus.ts`
- Tests follow co-located pattern: `src/hooks/__tests__/useMotionConfig.test.ts`
- No new components created — all work is modifications to existing files
- All existing test mocks for `useReducedMotion` must be updated to mock `useMotionConfig`

## Testing Strategy

**Unit test coverage targets:**

| Area | Test Count (est.) | Priority |
|------|-------------------|----------|
| `useMotionConfig` hook | 3-5 tests | P0 |
| Keyboard navigation (SoloReadingFlow) | 4 tests | P0 |
| Screen reader announcements | 5 tests | P0 |
| Focus management on transitions | 5 tests | P0 |
| Dialog focus trap + restore | 4 tests | P0 |
| Color independence (icons, text) | 3 tests | P1 |
| Reduced motion via useMotionConfig | 3 tests | P1 |
| ScriptureOverview accessibility | 4 tests | P1 |
| Touch target verification | 2 tests | P2 |
| **Total** | **~35 tests** | |

**Mock strategy for useMotionConfig:**
```typescript
vi.mock('../../../hooks/useMotionConfig', () => ({
  useMotionConfig: () => ({
    shouldReduceMotion: false,
    crossfade: { duration: 0.2 },
    slide: { duration: 0.3, ease: 'easeInOut' },
    spring: { type: 'spring', stiffness: 100, damping: 15 },
    fadeIn: { duration: 0.2 },
    modeReveal: { duration: 0.2 },
  }),
}));
```

**Focus testing pattern:**
```typescript
import { fireEvent, screen } from '@testing-library/react';

it('focuses verse heading after Next Verse click', async () => {
  // Render with session at step 0
  // Click Next Verse
  fireEvent.click(screen.getByTestId('scripture-next-verse-button'));
  // Wait for focus
  await waitFor(() => {
    expect(document.activeElement).toBe(screen.getByTestId('scripture-verse-reference'));
  });
});
```

**Screen reader testing pattern:**
```typescript
it('announces step change via aria-live region', async () => {
  // Render with session at step 0
  // Advance step (mock advanceStep updates session.currentStepIndex)
  // Check announcer content
  await waitFor(() => {
    expect(screen.getByTestId('sr-announcer')).toHaveTextContent('Now on verse 2');
  });
});
```

## Functional Requirements Traceability

| AC | PRD Requirement | UX Spec Section |
|----|----------------|----------------|
| #1 Keyboard Navigation | NFR-A1 (WCAG AA keyboard) | Responsive Design & Accessibility → Keyboard & Focus |
| #2 Screen Reader | NFR-A1 (WCAG AA), NFR-A2 (screen reader testing) | Responsive Design & Accessibility → Screen Reader Announcements |
| #3 Focus Management | NFR-A1 (WCAG AA focus management) | Responsive Design & Accessibility → Keyboard & Focus |
| #4 Reduced Motion | NFR-A1 (prefers-reduced-motion) | Responsive Design & Accessibility → Reduced Motion |
| #5 Color Independence | NFR-A1 (WCAG AA contrast), NFR-A3 (color independence) | Responsive Design & Accessibility → Color Contrast, Touch Target Requirements |

## Validation Gates (Before Marking Complete)

1. **TypeScript:** `npx tsc --noEmit` — zero errors
2. **Unit tests:** `npx vitest run` — all pass, zero regressions
3. **New test count:** ≥30 new/updated tests covering all 5 ACs
4. **useMotionConfig:** Hook exists, exported, used by both components, tests pass
5. **Focus rings:** All buttons have `focus-visible:ring-*` classes
6. **Announcer:** `sr-announcer` region exists with correct announcements
7. **Focus management:** Programmatic focus moves on step/view transitions
8. **Dialog trap:** Focus cycles within dialog, restores on close
9. **Contrast:** All `text-purple-400` bumped to `text-purple-600` where needed
10. **Manual a11y test:** Tab through entire flow with keyboard only — no traps, visible focus on everything

## References

- [Source: _bmad-output/planning-artifacts/epics/epic-1-foundation-solo-scripture-reading.md#Story 1.5]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Accessibility Strategy]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Keyboard & Focus]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Reduced Motion]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Screen Reader Announcements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Touch Target Requirements]
- [Source: _bmad-output/planning-artifacts/ux-design-specification/responsive-design-accessibility.md#Color Contrast]
- [Source: _bmad-output/planning-artifacts/architecture/core-architectural-decisions.md#Decision 5: Component Architecture]
- [Source: _bmad-output/planning-artifacts/architecture/project-structure-boundaries.md#Complete Project Directory Structure]
- [Source: _bmad-output/planning-artifacts/architecture/implementation-patterns-consistency-rules.md#Structure Patterns]
- [Source: _bmad-output/implementation-artifacts/1-3-solo-reading-flow.md — existing ARIA, useReducedMotion, touch targets]
- [Source: _bmad-output/implementation-artifacts/1-4-save-resume-and-optimistic-ui.md — offline indicator, retry UI accessibility]
- [Source: src/components/scripture-reading/containers/SoloReadingFlow.tsx — current accessibility state]
- [Source: src/components/scripture-reading/containers/ScriptureOverview.tsx — current accessibility state]
- [Source: src/hooks/index.ts — existing hooks barrel exports]
