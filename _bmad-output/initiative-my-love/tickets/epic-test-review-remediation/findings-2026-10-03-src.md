# Findings 2026-10-03: src/

Verbatim copy of the scored findings in the 2026-10-03 TEA test review of src/ (`test-review-target-src.md`, run against main at bab5120e). Every row is in scope. Rule ids (C#, H#, M#, L#) are defined in TEA's criteria registry, `.claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md`; the Knowledge Base links below still carry the v6 `bmad-testarch-test-review` path and do not resolve. `corrections.md` overrides any row or suggested fix it names. Line numbers are from bab5120e; locate each finding by its content.

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Build photo rows with `createPhotoInsert` instead of a double-cast literal

**Severity**: P2 (Medium)
**Location**: `src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx:35`
**Row**: M2
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
Six files build a photos row by hand, each with a different subset of columns, and cast it `as unknown as PhotoWithUrls`. The cast hides every missing column (`file_size`, `filename`, `mime_type`, and in two files `user_id` or `created_at`). A component that starts reading one of those columns therefore gets `undefined` in tests and a value in production, and the typecheck cannot warn. `tests/support/factories/photos.ts` exports `createPhotoInsert`, whose own comment says that, given `id` and `created_at`, "it is a whole row as the gallery's read returns it, for a spec that fakes that read". `tests/unit/stores/photosSlice.localCopy.test.ts` already uses it this way.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
function photo(index: number, isOwn = true): PhotoWithUrls {
  return {
    id: `photo-${index}`,
    user_id: isOwn ? 'me' : 'partner',
    storage_path: `${isOwn ? 'me' : 'partner'}/${index}.jpg`,
    caption: null,
    signedUrl: null,
    isOwn,
    created_at: '2026-09-01T10:00:00.000Z',
  } as unknown as PhotoWithUrls;
}
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
import { createPhotoInsert } from '../../../../tests/support/factories/photos';

function photo(index: number, isOwn = true): PhotoWithUrls {
  const owner = isOwn ? 'me' : 'partner';
  return {
    ...createPhotoInsert({
      id: `photo-${index}`,
      user_id: owner,
      storage_path: `${owner}/${index}.jpg`,
      file_size: 68,
      created_at: '2026-09-01T10:00:00.000Z',
    }),
    signedUrl: null,
    isOwn,
  } as PhotoWithUrls;
}
```

(`authServices.test.ts:3` reaches `tests/support` with the same relative form. The remaining cast is a single-step narrowing from the Insert type and no longer hides missing columns.)

**Benefits**:
A schema change to `photos` is then fixed in one factory instead of six literals. The fixtures also stop disagreeing with each other about which columns a photo has.

**Priority**:
P2. No test gives a wrong answer today; this is about drift.

**Related Violations**:
`PhotoGallery.pagination.test.tsx:87`, `PhotoGridItem.recovery.test.tsx:55`, `PhotoImageStates.test.tsx:40`, `PhotoViewer.focus.test.tsx:47`, `src/components/shared/__tests__/photoDialogsA11y.test.tsx:70`. Each is its own M2 finding.

---

### 2. Use the events kit's builders for store results

**Severity**: P2 (Medium)
**Location**: `src/components/Settings/__tests__/EventsSettings.errorIsolation.test.tsx:156`
**Row**: M2
**Criterion**: Data Factories
**Knowledge Base**: [data-factories.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
`errorIsolation` imports `loadOk`, `makeEvent` and `ok` from `eventsSettingsKit.tsx`, then hand-builds a refused write and casts it, although the same kit exports `writeFailure(code, error)`. `EventsSettings.test.tsx` builds the failed-load shape `{ status: 'failure', error }` inline 8 times (`:219`, `:239`, `:342`, `:393`, `:465`, `:473`, `:503`, `:511`) and writes `{ status: 'success' }` twice instead of the `loadOk` it imports. `EventsSettings.session.test.tsx` builds the failed-load shape 5 times (`:131`, `:174`, `:222`, `:232`, `:234`). The kit has no `loadFailure` builder for those two files to use.

**Current Code**:

```typescript
// ⚠️ errorIsolation.test.tsx:156
return { success: false, code: 'offline', error: saveMessage } as EventWriteResult;

// ⚠️ EventsSettings.test.tsx:219 (and seven more)
return { status: 'failure', error: 'Network error' } as const;
```

**Recommended Improvement**:

```typescript
// ✅ eventsSettingsKit.tsx — beside loadOk and writeFailure
export function loadFailure(error: string): EventLoadResult {
  return { status: 'failure', error };
}

// ✅ errorIsolation.test.tsx
return writeFailure('offline', saveMessage);

// ✅ EventsSettings.test.tsx / EventsSettings.session.test.tsx
return loadFailure('Network error');
```

**Benefits**:
The result type is then written down once, in the kit. A change to `EventLoadResult` or `EventWriteFailure` breaks one builder rather than 14 inline literals, and the casts go away.

**Priority**:
P2.

**Related Violations**:
`EventsSettings.test.tsx:219` and `EventsSettings.session.test.tsx:131` are separate M2 findings.

---

### 3. Locate elements by the role or test id they already have

**Severity**: P3 (Low)
**Location**: `src/components/love-notes/__tests__/MessageInput.test.tsx:502`
**Row**: L1
**Criterion**: Test IDs (selector resilience)
**Knowledge Base**: [selector-resilience.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)

**Issue Description**:
Five lookups find an element by its text even though the element has a role or test id that sibling tests in the same file already use:
- `MessageInput.test.tsx:502` (and `:483` for the absence check): the failure message sits inside the `role="alert"` block that `:121` and `:176` query by role.
- `PartnerMoodView.search.test.tsx:122` (and `:144`, `:153`, `:163`): the file uses the `partner-search-empty` test id elsewhere.
- `DisplayNameSetup.test.tsx:338`: the heading is located by role two lines earlier.
- `PhotoGallery.pagination.test.tsx:145` (and `:157`, `:206`, `:295`): `PhotoViewer.tsx:699` renders `data-testid="photo-viewer-position"`.
- `EventCountdown.test.tsx:199` (and `:123`, `:138`, `:200`, `:210`): `CountdownCard` renders `countdown-label`, `countdown-value` and `countdown-description` ids.

**Current Code**:

```typescript
// ⚠️ MessageInput.test.tsx:502
expect(await screen.findByText('Failed to send. Try again.')).toBeInTheDocument();
```

**Recommended Improvement**:

```typescript
// ✅ the role the sibling tests already use, with the copy as the asserted value
expect(await screen.findByRole('alert')).toHaveTextContent('Failed to send. Try again.');
```

**Benefits**:
The element is found the same way throughout the file, and a copy edit then fails one assertion about the copy instead of every lookup.

**Priority**:
P3.

---

### 4. Give class-checked elements a test id

**Severity**: P3 (Low)
**Location**: `src/components/LoginScreen/__tests__/LoginScreen.kit.test.tsx:115`
**Row**: L3
**Criterion**: Test IDs
**Knowledge Base**: [selector-resilience.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)

**Issue Description**:
Each of these elements is located by its rendered text and then asserted on its classes, and none has a role or test id. The "OR" divider in `LoginScreen.kit.test.tsx:115` is an `aria-hidden` div. The character counter in `MessageInput.test.tsx:108` is located by `'955/1000'`. In `LoveNotes.realtimeStatus.test.tsx:125`, the "Connected" line, the partner name and the avatar initial in the partner row are located by text; only the dot has an id. The convention is `emerging` (3 of 8 sampled), so the row is scored one step down, floored at LOW.

**Current Code**:

```typescript
// ⚠️
expect(screen.getByText('OR')).toHaveClass('text-muted', 'text-xs', 'font-semibold');
```

**Recommended Improvement**:

```typescript
// ✅ add data-testid="login-divider" in LoginScreen.tsx, then
expect(screen.getByTestId('login-divider')).toHaveClass('text-muted', 'text-xs', 'font-semibold');
```

**Benefits**:
A styling test then survives a copy change.

**Priority**:
P3. This needs one attribute each in `LoginScreen.tsx`, `MessageInput.tsx` and the partner row.

---

### 5. Name the haptics tests after the behavior

**Severity**: P3 (Low)
**Location**: `src/utils/__tests__/haptics.test.ts:60`
**Row**: L5
**Criterion**: BDD Format
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
`'calls navigator.vibrate with 50ms when supported'` (and the names at `:88` and `:114`) state the platform call rather than what the user gets.

**Current Code**:

```typescript
// ⚠️
it('calls navigator.vibrate with 50ms when supported', () => {
```

**Recommended Improvement**:

```typescript
// ✅
it('vibrates once for 50ms on a mood save', () => {
```

**Priority**:
P3. This is a rename only.

---

### 6. One matcher per check within a file

**Severity**: P3 (Low)
**Location**: `src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx:173`
**Row**: L7
**Criterion**: Explicit Assertions (assertion style)
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
Each of these files checks the same thing two different ways:
- `PhotoGallery.kit.test.tsx:164-181`: `className).toContain(...)` and `toHaveClass(...)` in the same test. A `className` substring check also passes on a partial class name, so `'h-5'` matches `'h-50'`.
- `kitSurfaces.test.tsx:113-114`: the same two styles on the same toast element.
- `OwnDisplayName.test.tsx:141`: `toHaveTextContent('Partner Name')`, a substring match, while every other name check in the file reads `.textContent).toBe(...)`. The comment at `:85-86` explains why the file avoids the substring matcher.

**Current Code**:

```typescript
// ⚠️ PhotoGallery.kit.test.tsx
expect(own.className).toContain('bg-fill');
expect(own.className).toContain('h-5');
// ...
expect(ownText).toHaveClass('sr-only');
```

**Recommended Improvement**:

```typescript
// ✅
expect(own).toHaveClass('bg-fill', 'text-white', 'h-5', 'w-5', 'left-1.5', 'bottom-1.5');
expect(ownText).toHaveClass('sr-only');
```

**Benefits**:
`toHaveClass` matches whole class tokens and reports every missing class at once.

**Priority**:
P3.

---

## Violation Summary by Location

| Location                                         | Severity | Criterion          | Issue                                                     | Fix                                   |
| ------------------------------------------------ | -------- | ------------------ | --------------------------------------------------------- | ------------------------------------- |
| `PhotoGallery.kit.test.tsx:35`                   | P2       | M2 Data Factories  | Partial photo row, double cast                            | `createPhotoInsert` + `signedUrl/isOwn` |
| `PhotoGallery.pagination.test.tsx:87`            | P2       | M2 Data Factories  | Partial photo row, double cast                            | `createPhotoInsert`                   |
| `PhotoGridItem.recovery.test.tsx:55`             | P2       | M2 Data Factories  | Partial photo row, double cast                            | `createPhotoInsert`                   |
| `PhotoImageStates.test.tsx:40`                   | P2       | M2 Data Factories  | Partial photo row, double cast                            | `createPhotoInsert`                   |
| `PhotoViewer.focus.test.tsx:47`                  | P2       | M2 Data Factories  | Partial photo row (no `user_id`/`created_at`)             | `createPhotoInsert`                   |
| `photoDialogsA11y.test.tsx:70`                   | P2       | M2 Data Factories  | Partial photo row (no `user_id`)                          | `createPhotoInsert`                   |
| `EventsSettings.errorIsolation.test.tsx:156`     | P2       | M2 Data Factories  | Hand-built write failure                                  | `writeFailure('offline', …)`          |
| `EventsSettings.test.tsx:219`                    | P2       | M2 Data Factories  | Failed-load shape inline ×8, success ×2                   | `loadFailure`, `loadOk`               |
| `EventsSettings.session.test.tsx:131`            | P2       | M2 Data Factories  | Failed-load shape inline ×5                               | `loadFailure`                         |
| `MessageInput.test.tsx:502`                      | P3       | L1 Selector        | Alert located by copy                                     | `findByRole('alert')`                 |
| `PartnerMoodView.search.test.tsx:122`            | P3       | L1 Selector        | Absence checked by copy                                   | `queryByTestId('partner-search-empty')` |
| `DisplayNameSetup.test.tsx:338`                  | P3       | L1 Selector        | Heading copy located by text                              | Assert on the role-located heading    |
| `PhotoGallery.pagination.test.tsx:145`           | P3       | L1 Selector        | Position line located by text                             | `getByTestId('photo-viewer-position')` |
| `EventCountdown.test.tsx:199`                    | P3       | L1 Selector        | Card parts located by text                                | `countdown-*` test ids                |
| `LoginScreen.kit.test.tsx:115`                   | P3       | L3 Test IDs        | Divider located by text, class-checked                    | Add `login-divider` id                |
| `MessageInput.test.tsx:108`                      | P3       | L3 Test IDs        | Counter located by text, class-checked                    | Add `message-input-counter` id        |
| `LoveNotes.realtimeStatus.test.tsx:125`          | P3       | L3 Test IDs        | Partner-row parts located by text                         | Add ids for status/name/avatar        |
| `haptics.test.ts:60`                             | P3       | L5 BDD Format      | Name states `navigator.vibrate` call                      | Name the behavior                     |
| `OwnDisplayName.test.tsx:141`                    | P3       | L7 Assertion style | Substring matcher where the file mandates exact           | `.textContent).toBe(...)`             |
| `PhotoGallery.kit.test.tsx:173`                  | P3       | L7 Assertion style | `className.toContain` mixed with `toHaveClass`            | `toHaveClass` throughout              |
| `kitSurfaces.test.tsx:114`                       | P3       | L7 Assertion style | `className.toContain` mixed with `toHaveClass`            | Fold into `toHaveClass`               |

