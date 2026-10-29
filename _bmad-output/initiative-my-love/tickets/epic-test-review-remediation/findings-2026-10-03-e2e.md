# Findings 2026-10-03: tests/e2e/

Verbatim copy of the scored findings in the 2026-10-03 TEA test review of tests/e2e/ (`test-review-target-tests-e2e.md`, run against main at bab5120e). Every row is in scope. Rule ids (C#, H#, M#, L#) are defined in TEA's criteria registry, `.claude/skills/bmad-tea-test-review/steps-c/criteria-registry.md`; the Knowledge Base links below still carry the v6 `bmad-testarch-test-review` path and do not resolve. `corrections.md` overrides any row or suggested fix it names. Paths in the summary table are relative to tests/e2e/. Line numbers are from bab5120e; locate each finding by its content.

## Critical Issues (Must Fix)

No critical issues detected. ✅

---

## Recommendations (Should Fix)

### 1. Await the Settings events load before reading the store and the list

**Severity**: P2 (Medium)
**Location**: `tests/e2e/errors/empty-database-error-fallback.spec.ts:32`
**Row**: M1
**Criterion**: Network-First Pattern
**Knowledge Base**: [intercept-network-call.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/intercept-network-call.md)

**Issue Description**:
The test arms only the POST create stub, then navigates straight to `/settings`. Settings' own events mount read (`UPCOMING_EVENTS_READ` / `PAST_EVENTS_READ`) is never armed or awaited; the only wait is a `recurse` on the store's `userId`, which waits on auth, not on the events data. The test then reads data that depends on that load: the store's `events` array (lines 64-69) and an absence check in `events-settings-load-region` (line 78). Both can pass before the list has loaded. `events-crud.spec.ts` and `events-check-constraint.spec.ts` open Settings through `openSettingsFromHome`, which waits for that read.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await page.goto('/settings');
const userId = await recurse(
  () => page.evaluate(() => window.__APP_STORE__?.getState().userId),
  (id) => typeof id === 'string' && id.length > 0,
  { timeout: 10000 }
);
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended): settle Home's read, then Settings' own read
await openSettingsFromHome(page, interceptNetworkCall); // tests/support/helpers/settings-screen.ts
const userId = await page.evaluate(() => window.__APP_STORE__?.getState().userId);
```

**Benefits**:
The store and list absence checks then read a settled load, and the spec matches its siblings.

**Priority**:
P2: the race is narrow and the stubbed create is what the test is about, but an assertion on unloaded state proves less than it appears to.

---

### 2. Rule out error and empty states by the test ids that already exist

**Severity**: P3 (Low)
**Location**: `tests/e2e/offline/interactions-offline-copy.spec.ts:108`
**Row**: L1
**Criterion**: Test IDs
**Knowledge Base**: [selector-resilience.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)

**Issue Description**:
Absence checks located by display copy pass vacuously once the copy changes, because the locator then matches nothing. The elements already carry test ids.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await expect(sheet.getByText('No interactions yet')).toHaveCount(0);
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
await expect(sheet.getByTestId('interaction-history-empty')).toHaveCount(0);
```

**Benefits**:
The negative assertion keeps meaning after a copy edit.

**Priority**:
P3: cheap to fix, no current false pass.

**Related Violations** (same row, same fix):

- `tests/e2e/offline/love-notes-offline-copy.spec.ts:189` — `getByText('Failed to load image')` → `getByTestId('love-note-image-error')` (`src/components/love-notes/LoveNoteMessage.tsx:380`)
- `tests/e2e/offline/photos-offline.spec.ts:280` — `getByText('Failed to load photo')` → `getByTestId('photo-viewer-load-error')` (`src/components/PhotoGallery/PhotoViewer.tsx:649`)
- `tests/e2e/partner/partner-connect.spec.ts:319` — `page.getByText(MISSING)` → `page.getByTestId('partner-search-empty')`, already used for the positive case at line 325
- `tests/e2e/partner/partner-connect.spec.ts:382` (and `bPage` at line 420) — `getByText('Unknown User')` → `getByTestId('sent-requests-list')` / `'received-requests-list'` with `not.toContainText('Unknown User')`

---

### 3. Give the sync-status, wordmark and retired-title lookups a stable anchor

**Severity**: P3 (Low)
**Location**: `tests/e2e/offline/network-status.spec.ts:25`
**Row**: L3
**Criterion**: Test IDs
**Knowledge Base**: [selector-resilience.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/selector-resilience.md)

**Issue Description**:
These lookups use copy with neither a test id nor a role. The `testIds` convention is emerging (1 of 8 sampled), so L3 applies one step lower, floored at LOW. The `'Online'` lookup repeats at lines 45 and 57, `'Offline'` at line 50.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await expect(page.getByTestId('mood-tracker').getByText('Online')).toBeVisible();
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended): add data-testid="mood-sync-status" to the span in MoodTracker.tsx:446
await expect(page.getByTestId('mood-sync-status')).toHaveText('Online');
```

**Benefits**:
The assertion checks the status value rather than finding any element with that word.

**Priority**:
P3: needs a one-attribute component change per element.

**Related Violations**:

- `tests/e2e/offline/network-status.spec.ts:32` — `'Offline'`, same span
- `tests/e2e/navigation/kit-chrome.spec.ts:54` — `wordmark.getByText('My Love', { exact: true })`; the inner span in `AppNavigation.tsx:100` has no test id
- `tests/e2e/settings/settings-kit.spec.ts:56` and `:57` — `view.getByText('Event Countdowns')` / `'Anniversary Countdowns'`; scope the absence to `getByRole('heading', { name: ... })` or a test-id container with `not.toContainText`

---

### 4. Name the outcome, not the mechanism

**Severity**: P3 (Low)
**Location**: `tests/e2e/auth/bootstrap-notification-order.spec.ts:153`
**Row**: L5
**Criterion**: BDD Format (Given-When-Then)
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
The house convention (8 of 8 sampled) names the behaviour. These names state SDK or store internals, so a failure line does not say what broke for the user.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
test('[P1] DW-81-E2E-005 retains the listener session when the SDK bootstrap rejects', async ({
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended)
test('[P1] DW-81-E2E-005 stays signed in on Home when the initial session lookup fails after a sign-in arrived', async ({
```

**Benefits**:
The failure report reads as the bug report.

**Priority**:
P3: rename only.

**Related Violations**:

- `tests/e2e/auth/bootstrap-notification-order.spec.ts:191` — `installs an authenticated bootstrap without a notification` → e.g. `opens the app signed in from a stored session when no auth event arrives`
- `tests/e2e/auth/bootstrap-notification-order.spec.ts:221` — `clears old store auth for null bootstrap without a notification` → e.g. `shows Login with no trace of the previous account when no session is stored`
- `tests/e2e/auth/token-persistence-overlap.spec.ts:337` — `characterizes native auth token persistence: sequential` → name the guarantee
- `tests/e2e/auth/token-persistence-overlap.spec.ts:343` — the generated `'characterizes native auth token persistence: ' + scenario` names; carry a behaviour sentence per scenario in `overlapping`

---

### 5. Tie the forbidden CHECK-message fragments to the factory

**Severity**: P3 (Low)
**Location**: `tests/e2e/errors/check-error-path-consistency.spec.ts:225`
**Row**: L6
**Criterion**: Explicit Assertions
**Knowledge Base**: [data-factories.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/data-factories.md)

**Issue Description**:
`'dw38_unique_length_check'` and `'new row'` (line 226) retype fragments of the message `createCheckErrorPathData()` builds (`tests/support/factories/check-error-path-data.ts:10`). A factory edit would leave these negative assertions checking strings that no longer occur.

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await expect(banner).not.toContainText('dw38_unique_length_check');
await expect(banner).not.toContainText('new row');
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended): export the fragments from the factory and assert on them
for (const fragment of CHECK_ERROR_LEAK_FRAGMENTS) {
  await expect(banner).not.toContainText(fragment);
}
```

**Benefits**:
The leak check follows the factory.

**Priority**:
P3.

**Related Violations**:

- `tests/e2e/partner/interaction-record-ownership.spec.ts:256` — `expect(v).toBe(20)`: 20 is the badge's full-size height in px with no name; use `const BADGE_FULL_SIZE_PX = 20; // <source of the size class>`

---

### 6. Use one matcher for "login screen gone"

**Severity**: P3 (Low)
**Location**: `tests/e2e/auth/login.spec.ts:135`
**Row**: L7
**Criterion**: Explicit Assertions
**Knowledge Base**: [test-quality.md](../../../.claude/skills/bmad-testarch-test-review/resources/knowledge/test-quality.md)

**Issue Description**:
The same check is written as `not.toBeVisible({ timeout: 5000 })` here and `toHaveCount(0)` at lines 154 and 162 (assertion style established, 7 of 8 sampled).

**Current Code**:

```typescript
// ⚠️ Could be improved (current implementation)
await expect(page.getByTestId('login-screen')).not.toBeVisible({ timeout: 5000 });
```

**Recommended Improvement**:

```typescript
// ✅ Better approach (recommended): the app unmounts the login screen
await expect(page.getByTestId('login-screen')).toHaveCount(0);
```

**Benefits**:
One dialect for one check; drops a per-call timeout.

**Priority**:
P3.

---

## Violation Summary by Location

| File:Line | Severity | Criterion | Issue | Fix |
| --- | --- | --- | --- | --- |
| `errors/empty-database-error-fallback.spec.ts:32` | P2 | Network-First (M1) | Reads store and list without awaiting Settings' events load | `openSettingsFromHome` |
| `offline/interactions-offline-copy.spec.ts:108` | P3 | Test IDs (L1) | Absence by copy `'No interactions yet'` | `getByTestId('interaction-history-empty')` |
| `offline/love-notes-offline-copy.spec.ts:189` | P3 | Test IDs (L1) | Absence by copy `'Failed to load image'` | `getByTestId('love-note-image-error')` |
| `offline/photos-offline.spec.ts:280` | P3 | Test IDs (L1) | Absence by copy `'Failed to load photo'` | `getByTestId('photo-viewer-load-error')` |
| `partner/partner-connect.spec.ts:319` | P3 | Test IDs (L1) | Absence by full copy page-wide | `getByTestId('partner-search-empty')` |
| `partner/partner-connect.spec.ts:382` | P3 | Test IDs (L1) | `'Unknown User'` page-wide (also :420) | `not.toContainText` on the request-list test ids |
| `offline/network-status.spec.ts:25` | P3 | Test IDs (L3) | `'Online'` by copy (also :45, :57) | Add `mood-sync-status` test id |
| `offline/network-status.spec.ts:32` | P3 | Test IDs (L3) | `'Offline'` by copy (also :50) | Same test id |
| `navigation/kit-chrome.spec.ts:54` | P3 | Test IDs (L3) | Wordmark text span by copy | Add a wordmark-text test id |
| `settings/settings-kit.spec.ts:56` | P3 | Test IDs (L3) | `'Event Countdowns'` by plain text | Scope to heading role or test-id container |
| `settings/settings-kit.spec.ts:57` | P3 | Test IDs (L3) | `'Anniversary Countdowns'` by plain text | Same |
| `auth/bootstrap-notification-order.spec.ts:153` | P3 | BDD (L5) | Name states SDK mechanism | Name the outcome |
| `auth/bootstrap-notification-order.spec.ts:191` | P3 | BDD (L5) | Name states store transition | Name the outcome |
| `auth/bootstrap-notification-order.spec.ts:221` | P3 | BDD (L5) | Name states store internals | Name the outcome |
| `auth/token-persistence-overlap.spec.ts:337` | P3 | BDD (L5) | "characterizes ... persistence: sequential" | Name the guarantee |
| `auth/token-persistence-overlap.spec.ts:343` | P3 | BDD (L5) | Generated mechanism names | Behaviour sentence per scenario |
| `errors/check-error-path-consistency.spec.ts:225` | P3 | Magic value (L6) | Retyped factory message fragments | Derive from the factory |
| `partner/interaction-record-ownership.spec.ts:256` | P3 | Magic value (L6) | Unnamed `20` px badge height | Named constant |
| `auth/login.spec.ts:135` | P3 | Assertion style (L7) | `not.toBeVisible` vs `toHaveCount(0)` elsewhere | `toHaveCount(0)` |

