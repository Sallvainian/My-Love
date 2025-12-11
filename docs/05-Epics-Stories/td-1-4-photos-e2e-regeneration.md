# Story TD-1.4: Epic 6 (Photos) E2E Test Regeneration

**Story ID:** TD-1.4
**Epic:** TD-1 - Test Quality Remediation (Technical Debt)
**Status:** Ready for Dev
**Created:** 2025-12-10
**Priority:** HIGH

---

## Story Summary

As a **developer**, I want **comprehensive E2E tests for Epic 6 Photo Sharing features** so that **photo upload, gallery display, and viewer functionality are validated against TEA quality standards without anti-patterns**.

---

## Story Context

### Epic TD-1 Background
TEA test-review workflow (2025-12-07) identified critical anti-patterns across the E2E test suite, scoring only 52/100. The Photos E2E tests were particularly problematic with conditional flow control, error swallowing, and runtime test.skip() patterns throughout.

### Archived Test Analysis
The archived `photos.spec.ts` (158 lines) contained these specific anti-patterns:
- **Conditional navigation**: `if (await photosNav.first().isVisible())` - makes test non-deterministic
- **Error swallowing**: `.catch(() => false)` - hides real test failures
- **No-op assertion paths**: Test passes when photo content not found
- **CSS selector reliance**: Using `img[src*="photo"]` instead of accessibility selectors
- **No network interception**: Missing `waitForResponse` patterns

### Components Under Test

| Component | Location | Key Responsibilities |
|-----------|----------|---------------------|
| PhotoGallery | `src/components/PhotoGallery/PhotoGallery.tsx` | Grid display, infinite scroll, empty state |
| PhotoUpload | `src/components/PhotoUpload/PhotoUpload.tsx` | File selection, preview, upload form |
| PhotoViewer | `src/components/PhotoGallery/PhotoViewer.tsx` | Full-screen view, gestures, navigation |
| photoService | `src/services/photoService.ts` | Supabase operations, signed URLs |

---

## Acceptance Criteria

### AC-1: Photo Gallery E2E Tests
```gherkin
GIVEN I am authenticated
WHEN I navigate to the photos section
THEN I should see the photo gallery
AND the gallery should show loading skeleton during fetch
AND the gallery should show photos in a responsive grid
```

**Quality Requirements:**
- [ ] Network intercept for `/api/photos` registered BEFORE navigation
- [ ] Wait for `page.waitForResponse('**/api/photos')` explicitly
- [ ] Use `data-testid="photo-gallery"` or `data-testid="photo-gallery-empty-state"`
- [ ] Zero `.catch(() => false)` patterns
- [ ] Zero conditional `if/else` in test body

### AC-2: Photo Upload E2E Tests
```gherkin
GIVEN I am on the photo gallery
WHEN I click the upload button
THEN the upload modal should open
AND I should be able to select a photo file
AND I should see a preview before uploading
```

**Quality Requirements:**
- [ ] Use `getByRole('button', { name: /upload/i })` selector
- [ ] File input interaction via `page.setInputFiles()` on hidden input
- [ ] Intercept upload network call BEFORE triggering
- [ ] Assert on specific success indicators
- [ ] Test error state with mocked failure response

**File Input Strategy:**
```typescript
// Hidden file input - use locator directly, not getByRole
const fileInput = page.getByTestId('photo-upload-file-input');
await fileInput.setInputFiles('tests/fixtures/test-image.jpg');
```

### AC-3: Photo Viewer E2E Tests
```gherkin
GIVEN photos exist in the gallery
WHEN I click on a photo thumbnail
THEN the full-screen viewer should open
AND I should see navigation controls
AND I should be able to close the viewer
```

**Quality Requirements:**
- [ ] Pre-seed test photos via API or fixture
- [ ] Use `getByRole('dialog')` for modal detection
- [ ] Test keyboard navigation (Arrow keys, Escape)
- [ ] Assert on `aria-label` attributes for controls

### AC-4: Photo Deletion E2E Tests
```gherkin
GIVEN I am viewing my own photo
WHEN I click the delete button
THEN a confirmation dialog should appear
AND confirming should delete the photo
```

**Quality Requirements:**
- [ ] Intercept DELETE request before action
- [ ] Assert on confirmation dialog visibility
- [ ] Verify photo removal from gallery after delete

### AC-5: Empty State E2E Tests
```gherkin
GIVEN no photos exist
WHEN I view the photo gallery
THEN I should see the empty state message
AND I should see a call-to-action to upload
```

**Quality Requirements:**
- [ ] Mock empty API response explicitly
- [ ] Use `data-testid="photo-gallery-empty-state"` selector
- [ ] Assert on upload CTA button presence

**Mock Example:**
```typescript
await page.route('**/rest/v1/photos*', (route) => {
  route.fulfill({ status: 200, json: [] }); // Empty response
});
```

### AC-6: Pagination/Infinite Scroll E2E Tests
```gherkin
GIVEN many photos exist (>20)
WHEN I scroll to the bottom of the gallery
THEN more photos should load automatically
AND I should see a loading indicator during fetch
```

**Quality Requirements:**
- [ ] Mock paginated API responses
- [ ] Use Intersection Observer trigger element
- [ ] Assert on `data-testid="photo-gallery-load-trigger"`

**Mock Example:**
```typescript
let requestCount = 0;
await page.route('**/rest/v1/photos*', (route) => {
  const photos = requestCount === 0
    ? generatePhotos(20, 0)  // First page
    : generatePhotos(10, 20); // Second page
  requestCount++;
  route.fulfill({ status: 200, json: photos });
});
```

### AC-7: Gallery Error State E2E Tests
```gherkin
GIVEN the photos API is unavailable
WHEN I navigate to the photos section
THEN I should see an error message
AND I should see a retry button
```

**Quality Requirements:**
- [ ] Mock 500 error response
- [ ] Use `data-testid="photo-gallery-error"` selector
- [ ] Assert on retry button presence and functionality

**Mock Example:**
```typescript
await page.route('**/rest/v1/photos*', (route) => {
  route.fulfill({ status: 500, json: { error: 'Internal Server Error' } });
});
```

---

## Technical Implementation Notes

### Network-First Pattern (MANDATORY)

All tests MUST follow the intercept → navigate → await pattern:

```typescript
// CORRECT: Intercept BEFORE navigate
test('photo gallery loads', async ({ page }) => {
  // Step 1: Intercept API call FIRST
  const photosPromise = page.waitForResponse(
    (resp) => resp.url().includes('/rest/v1/photos') && resp.status() === 200
  );

  // Step 2: THEN navigate
  await page.goto('/photos');

  // Step 3: THEN await response
  const response = await photosPromise;
  const photos = await response.json();

  // Step 4: Assert on actual data
  expect(photos.length).toBeGreaterThan(0);
  await expect(page.getByTestId('photo-gallery')).toBeVisible();
});
```

### Selector Hierarchy (MANDATORY)

Use in this priority order:
1. `getByRole()` - Accessibility-first
2. `getByLabel()` - Form elements
3. `getByTestId()` - Last resort for custom components
4. **NEVER**: CSS selectors like `img[src*="photo"]`

### Available Test IDs

From component analysis:
- `photo-gallery` - Main gallery container
- `photo-gallery-empty-state` - Empty state container
- `photo-gallery-error` - Error state container
- `photo-gallery-grid` - Photo grid container
- `photo-gallery-upload-fab` - Floating upload button
- `photo-upload-modal` - Upload modal
- `photo-upload-file-input` - File input
- `photo-upload-preview-image` - Preview image
- `photo-upload-submit-button` - Submit button
- `photo-upload-close` - Close button
- `photo-viewer-prev-button` - Previous photo navigation
- `photo-viewer-next-button` - Next photo navigation
- `photo-viewer-close-button` - Close viewer button

### API Endpoints

From photoService analysis:
- `GET /rest/v1/photos` - Fetch photos (with pagination)
- `POST /storage/v1/object/photos/{user_id}/` - Upload photo
- `DELETE /storage/v1/object/photos/{path}` - Delete photo
- `POST /storage/v1/object/sign/photos` - Generate signed URLs

### Test Data Requirements

1. **Authenticated user** - Required for all tests
2. **Test image file** - Place in `tests/fixtures/test-image.jpg`
3. **Seeded photos** - For viewer/deletion tests

---

## File Structure

```
tests/e2e/
├── photos/
│   ├── photos.setup.ts           # Auth + photo seeding
│   ├── photo-gallery.spec.ts     # Gallery display tests
│   ├── photo-upload.spec.ts      # Upload flow tests
│   ├── photo-viewer.spec.ts      # Viewer/gesture tests
│   └── photo-delete.spec.ts      # Deletion flow tests
└── fixtures/
    └── test-image.jpg            # Test upload image
```

---

## Quality Gates

Before marking complete, verify:
- [ ] Zero instances of `.catch(() => false)`
- [ ] Zero `if/else` conditionals in test bodies
- [ ] All `test.skip()` at describe level only (if any)
- [ ] Every test has at least 1 guaranteed assertion
- [ ] All waits use `waitForResponse()` or `waitFor({ state })`
- [ ] No `waitForTimeout()` or `sleep()` calls
- [ ] Selector hierarchy respected (accessibility-first)
- [ ] Network intercepts registered BEFORE navigation/actions
- [ ] Tests pass in CI with 0 retries (burn-in validation)

---

## Story Dependencies

```
TD-1.0 (Standards & Archive) ✅ Complete
    └── TD-1.4 (Photos E2E) ← This story
              └── TD-1.6 (CI Quality Gates) - Blocked until complete
```

**Prerequisite:** TD-1.0 must be complete (standards established, old tests archived)

---

## Estimation

| Task | Estimate |
|------|----------|
| Test structure setup | 1h |
| Photo gallery tests (AC-1) | 2h |
| Photo upload tests (AC-2) | 2h |
| Photo viewer tests (AC-3) | 2h |
| Photo deletion tests (AC-4) | 1h |
| Empty state tests (AC-5) | 0.5h |
| Pagination tests (AC-6) | 1h |
| Error state tests (AC-7) | 0.5h |
| Quality gate validation | 1h |
| **Total** | **11h** |

---

## Test Scenarios Matrix

| Scenario | API Calls | Assertions | Risk |
|----------|-----------|------------|------|
| Gallery loads photos | GET /photos | Grid visible, photos rendered | Low |
| Gallery empty state | GET /photos (empty) | Empty state visible | Low |
| Gallery error state | GET /photos (500) | Error message, retry button visible | Medium |
| Upload flow | POST /storage, INSERT /photos | Success message, gallery refresh | Medium |
| Upload error handling | POST /storage (500) | Error message visible | Medium |
| Viewer opens | N/A (local state) | Dialog visible, photo displayed | Low |
| Viewer navigation | N/A | Arrow buttons work, keyboard works | Low |
| Photo deletion | DELETE /storage, DELETE /photos | Confirmation, photo removed | Medium |
| Infinite scroll | GET /photos (offset) | More photos load | Medium |

---

## Related Documentation

- **Epic TD-1 Tech Spec:** `docs/05-Epics-Stories/tech-spec-epic-td-1.md`
- **TEA Knowledge Base:** `.bmad/bmm/testarch/knowledge/`
- **E2E Quality Standards:** `docs/04-Testing-QA/e2e-quality-standards.md`
- **Archived Tests:** `tests/e2e-archive-2025-12/photos.spec.ts`

---

## Workflow Command

This story uses the `*atdd` workflow for test generation:

```
*atdd → *code-review → *story-done
```

**Do NOT use `*dev-story`** - TD-1 stories generate tests, not application code.

---

*Story created by create-story workflow - 2025-12-10*
