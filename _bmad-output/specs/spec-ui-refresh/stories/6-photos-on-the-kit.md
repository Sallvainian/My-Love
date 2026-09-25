---
title: 'Photos on the kit'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: 'a244ac0551cf21796180d44e8e87c8cdaba233b8'
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      whiteOnColorContrast guard cannot measure white text on kit tokens (bg-fill, bg-partner) in either theme.
    evidence: |-
      The guard's regex matches only palette swatches like bg-pink-600; a dark-mode white-on-#a78bfa badge (2.7:1) passed it until review caught it by screenshot.
    location: >-
      tests/unit/a11y/whiteOnColorContrast.test.ts
    severity: medium
  - summary: >-
      Deleting a photo in PhotoViewer leaves the gallery grid and its count stale.
    evidence: |-
      PhotoGallery passes its local paginated photos to PhotoViewer, which deletes through the store (PhotoViewer.tsx:383-400); nothing removes the row from PhotoGallery's local list. Predates story 6.
    location: >-
      src/components/PhotoGallery/PhotoGallery.tsx
    severity: medium
  - summary: >-
      PhotoViewer's inline delete confirm lacks role="dialog", aria-modal and aria-labelledby.
    evidence: |-
      The confirm renders inside the viewer's dialog without its own dialog semantics, unlike NoteRemoveConfirmation. Predates story 6.
    location: >-
      src/components/PhotoGallery/PhotoViewer.tsx:634
    severity: low
  - summary: >-
      whiteOnColorContrast.test.ts fails with ENOENT in loop worktrees.
    evidence: |-
      The worktree's node_modules has no tailwindcss/theme.css, so the guard cannot read the palette; it passes when tailwind is reachable.
    location: >-
      tests/unit/a11y/whiteOnColorContrast.test.ts:99
    severity: low
  - summary: >-
      A failed "load more" in the photo grid is silent, and the scroll trigger keeps retrying.
    evidence: |-
      loadMorePhotos sets error, but the grid branch never renders it (only the zero-photo branch does); hasMore stays true, so the subtitle keeps "20+" and the IntersectionObserver re-arms when isLoadingMore flips back. Same logic at the baseline; predates story 6.
    location: >-
      src/components/PhotoGallery/PhotoGallery.tsx:187-193
    severity: medium
  - summary: >-
      The upload modal has no dialog semantics, focus trap or Escape handling.
    evidence: |-
      PhotoUpload's panel has no role="dialog", aria-modal or aria-labelledby, and no useFocusTrap, unlike PhotoEditModal, PhotoDeleteConfirmation and NoteRemoveConfirmation. Absent at the baseline too; story 6 restyled it only.
    location: >-
      src/components/PhotoUpload/PhotoUpload.tsx:192
    severity: medium
  - summary: >-
      The photo viewer's "Photo N of M" counts only the loaded page, so it reads "of 20" for a larger album.
    evidence: |-
      PhotoViewer renders photos.length from the gallery's paginated list, while the gallery subtitle now shows "20+". Predates story 6.
    location: >-
      src/components/PhotoGallery/PhotoViewer.tsx:616
    severity: low
  - summary: >-
      Error text in the photo upload, edit and delete dialogs is not announced to screen readers.
    evidence: |-
      photo-upload-error, photo-upload-tag-error, photo-edit-modal-error and photo-delete-confirmation-error have no role="alert"; NoteRemoveConfirmation.tsx:203 has one. Absent at the baseline.
    location: >-
      src/components/PhotoUpload/PhotoUpload.tsx:375
    severity: low
  - summary: >-
      A grid tile's caption overlay shows on hover only, never on keyboard focus.
    evidence: |-
      The overlay uses group-hover:opacity-100 with no group-focus-visible variant, so a sighted keyboard user never sees captions. Same at the baseline. The tile keeps the browser's default focus outline.
    location: >-
      src/components/PhotoGallery/PhotoGridItem.tsx:128
    severity: low
---

<intent-contract>

## Intent

**Problem:** Photos is light-only and off-kit: an untitled grid, a gradient floating upload FAB, pink/blue "You/Partner" pills, a skeleton with a different column count than the grid, and four unrelated dialog styles (white upload modal, always-dark edit/delete, a white/grey inline viewer confirm, a red Close in the carousel).

**Approach:** Restyle the gallery to `mockups/Photos.dc.html` in both `hasPhotos` states (title + subtitle + header Upload secondary button carrying the FAB's testid; empty-state card only at zero photos) and move every photo dialog onto the one kit dialog pattern that `love-notes/NoteRemoveConfirmation.tsx` already uses. Presentational only.

## Boundaries & Constraints

**Always:** kit utilities only (`bg-card`, `bg-card2`, `text-ink`, `text-muted`, `bg-tint`/`text-accent`, `bg-fill`, `bg-partner`, `bg-dtint`/`text-danger`, `border-line`, `bg-field`, `shadow-card`, `shadow-float`, `font-serif` for the page title); every existing `data-testid`, `aria-label`, role and visible button name keeps working — `photo-gallery-upload-fab` moves to the header Upload button with `aria-label="Upload photo"`; lucide icons only; errors = `text-danger` on `bg-dtint`, warnings/notices = `text-ink` on `bg-card2`; the empty state stays gated on `photos.length === 0` after the first load.

**Never:** no floating FAB; no raw hex, `gray-*`/`pink-*`/`blue-*`/`red-*`/`orange-*`/`green-*` palette shades, `dark:` variants, or `from-*`/`to-*`/`via-*` gradients left in the touched files; no emoji in chrome ("Photo uploaded! ✨" loses the ✨); no store/service/API/schema change; do not delete `PhotoCarousel` (unreachable today — nothing but itself calls `selectPhoto`; deletion belongs to story 9); no new photo features.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Grid | ≥1 photo loaded | h1 "Photos"; subtitle "`N` photo(s) · shared with `{partner}`"; Upload pill (`photo-gallery-upload-fab`) opens upload modal; 3-col grid, gap 6px | — |
| Count while paging | `hasMore` true | N = loaded count suffixed "+" (e.g. "20+ photos"); exact once pagination ends | — |
| Singular | 1 photo | "1 photo" | — |
| No partner name | `getPartnerDisplayName()` → null | subtitle drops " · shared with …" | name reads fail silently to fallback |
| Empty | loaded, 0 photos | h1 "Photos" + "Your shared album"; no header Upload; card: 64px tint Camera tile, Playfair 22px "No photos yet", muted copy, primary "Upload a photo" (`photo-gallery-empty-upload-button`) inside `photo-gallery-empty-state` | — |
| Loading | first fetch pending | same header as Empty (no Upload), skeleton grid of identical columns/gap/radius, wrapper keeps `photo-gallery` | — |
| Load error | fetch threw, 0 photos | header + kit error card inside `photo-gallery-error-state`, retry button keeps testid | dtint/danger icon tile |
| Owner badge | photo own / partner's | 20px circle bottom-left, own `bg-fill` / partner `bg-partner`, white 10px bold initial of own / partner display name (fallback "Y" / "P"), sr-only "Uploaded by you" / "Uploaded by {partner}" | — |

</intent-contract>

## Code Map

- `src/components/PhotoGallery/PhotoGallery.tsx` -- error branch :197, skeleton branch :235, empty branch :245 (`photos.length === 0` gate stays), grid :267 (`grid-cols-3 gap-2 md:grid-cols-4`), load-more spinner/end message :285-305, FAB :308 to remove. Local `photos` is paginated (20/page); `hasMore` state already exists.
- `src/components/PhotoGallery/PhotoGridItem.tsx` -- `rounded-lg` + hover scale; owner pill :98-108 (keep testid `photo-grid-item-owner-badge`); loading placeholder `bg-gray-200`; caption overlay uses `bg-gradient-to-t from-black/60` (replace with flat `bg-black/55`).
- `src/components/PhotoGallery/PhotoGridSkeleton.tsx` -- `grid-cols-2 sm:3 lg:4` + shimmer gradient; own `min-h-screen p-4` wrapper.
- `src/components/PhotoGallery/PhotoViewer.tsx` -- lightbox stays black; top controls :505-528 and chevrons :532-547 (`bg-white/10`), caption bar :609, inline confirm :634-680. `__tests__/PhotoViewer.focus.test.tsx` queries labels "Delete photo"/"Close viewer"/"Previous photo"/"Next photo", buttons "Cancel"/"Delete", text "Delete Photo?" — keep all.
- `src/components/PhotoUpload/PhotoUpload.tsx` -- white modal :191, orange storage banner :223, pink/red/orange tag chips :350-362, error/warning boxes :386-399, buttons :407-428, success state :449-466. E2E needs heading /upload photo/i.
- `src/components/PhotoEditModal/PhotoEditModal.tsx`, `src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` -- always-dark `bg-gray-800`, blue Save.
- `src/components/PhotoCarousel/PhotoCarouselControls.tsx` -- Edit blue, Delete grey, Close red text buttons; `PhotoCarousel.tsx` caption :191.
- `src/components/love-notes/NoteRemoveConfirmation.tsx` -- golden kit dialog: `bg-black/50` scrim, panel `rounded-[20px] bg-card shadow-float`, header `border-b border-line` with dtint icon tile + `text-lg font-semibold text-ink`, secondary `h-12 rounded-full bg-tint text-accent`, destructive `bg-dtint text-danger`.
- `src/components/love-notes/LoveNotes.tsx:86-126` -- precedent for fetching `getOwnDisplayName()`/`getPartnerDisplayName()` (`src/api/supabaseClient.ts:448,579`) once on mount and taking the first code point as initial.
- `src/components/MoodTracker/MoodTracker.tsx:288-293` -- page-title markup precedent.
- `tests/e2e/navigation/dock.spec.ts:138-147` and `tests/e2e/photos/photo-upload.spec.ts:20-41` -- click `photo-gallery-upload-fab`; must still pass.

## Tasks & Acceptance

**Execution:**
- `src/components/PhotoGallery/PhotoGallery.tsx` -- shared page header in all four states; header Upload secondary pill (36px, Plus icon, "Upload") with the FAB's testid/label, rendered only when photos exist; fetch own + partner names once (cancel flag) and pass initials/partner name to grid items; empty/error states as kit cards; grid `gap-1.5` 3 cols at every width; load-more/end text on kit; delete the FAB.
- `src/components/PhotoGallery/PhotoGridItem.tsx` -- radius 14px, `bg-card2` placeholder, initial badge per matrix, no gradient.
- `src/components/PhotoGallery/PhotoGridSkeleton.tsx` -- exactly the gallery grid's columns/gap/radius, `bg-card2 animate-pulse`, no gradient, no own page padding/header.
- `src/components/PhotoGallery/PhotoViewer.tsx` -- controls become 44px kit icon buttons (`bg-card text-ink`; trash `bg-card text-danger`); caption bar `bg-card` sheet with `text-ink`/`text-muted`; inline confirm on the kit dialog pattern.
- `src/components/PhotoUpload/PhotoUpload.tsx`, `src/components/PhotoEditModal/PhotoEditModal.tsx`, `src/components/PhotoDeleteConfirmation/PhotoDeleteConfirmation.tsx` -- kit dialog pattern; inputs per kit (48px/`rounded-[14px]`/`bg-field`/inset line; textarea same minus height); primary = `bg-fill` pill, secondary = `bg-tint text-accent` pill, destructive = `bg-dtint text-danger` pill; tag chips `bg-tint text-accent` (over-limit `bg-dtint text-danger`).
- `src/components/PhotoCarousel/PhotoCarouselControls.tsx`, `PhotoCarousel.tsx` -- Edit/Close = kit icon buttons (`bg-card text-ink`), Delete = `bg-card text-danger`; visible labels become sr-only via existing aria-labels; caption text white on the black lightbox is allowed.
- `src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx` -- new unit tests for the matrix rows (grid header + testid, singular/"+" count, partner-less subtitle, empty state without header Upload, loading header + skeleton column classes equal grid's, error card with retry, badge colour classes/initials/sr-only text; every matrix row).

**Acceptance Criteria:**
- Given the grid state, when the gallery renders, then no element with `photo-gallery-upload-fab` is `position: fixed` and clicking it opens `photo-upload-modal`.
- Given each touched file, when grepped for `#[0-9a-fA-F]{3,6}|gray-|pink-|blue-|red-|orange-|green-|rose-|from-|via-|dark:`, then nothing matches except `bg-black/*` / `text-white` on the lightbox and on `bg-fill`/`bg-partner`.
- Given 390×844 in dark mode, when Photos (grid and empty) and every photo dialog are open, then no light surface appears.

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 25 findings — high 0, medium 5, low 14, false 6, maybe-false 0
- findings:
  - `[medium]` `[patch]` Partner owner badge is white on `bg-partner`, about 2.7:1 in dark mode, below the epic's 4.5:1 text-contrast constraint — confirmed in a dark screenshot; partner arm now `text-card` (LoveNotes.tsx:140 precedent), own arm keeps `text-white` on `bg-fill` (4.6:1); kit test updated.
  - `[medium]` `[patch]` Badge sr-only "Uploaded by …" text is overridden by the tile's own `aria-label` on `role="button"` — sr-only span now has id `photo-owner-${photo.id}`, tile has `aria-describedby` pointing at it, and the aria-label is unchanged; kit test asserts the description resolves for own and partner tiles.
  - `[medium]` `[defer]` whiteOnColorContrast guard only measures palette swatches, so white on kit tokens (`bg-fill`/`bg-partner`) goes unmeasured in both themes — a limitation of the guard itself, which predates this story (kit tokens arrived in story 1).
  - `[low]` `[patch]` dock.spec's FAB-above-dock test passes trivially for a header pill, and its name is stale — renamed; the bounding-box check is replaced by computed `position !== 'fixed'`; the click→modal check is kept.
  - `[low]` `[defer]` The PhotoViewer inline delete confirm lacks role="dialog"/aria-modal/aria-labelledby, and has no cursor-not-allowed on Delete — the missing semantics predate this story. Cancel staying enabled mid-delete is deliberate (commented in code, guarded by isDeletingRef).
  - `[low]` `[reject]` The kit dialog markup is copy-pasted across five dialogs rather than extracted — CAP-11 asks for one visual pattern, which is met, and extracting a shared component across photo and notes files is a refactor beyond this story that adds public surface.
  - `[false]` `[reject]` The header Upload pill scrolls away (no longer reachable deep in the grid), and it is 36px — the intent and mockup put Upload in the header and replace the FAB; design-tokens.md sets the small secondary button at 36px.
  - `[low]` `[reject]` Shows "20+ photos" for an album of exactly 20 until the load trigger fires — this is the behaviour the matrix specifies; an exact count needs a service change the story forbids, and it corrects itself once the next (empty) page loads.
  - `[low]` `[reject]` `initialOf` takes the first code point, splitting ZWJ, flag and combining-mark names, and its comment overclaims — names that start that way are unlikely in everyday use, and the fix would make this diverge from the identical LoveNotes and PartnerMoodDisplay helpers.
  - `[low]` `[reject]` Dialog/carousel restyles have no regression tests, and the tests assert class names — happy-dom loads no CSS; the visual check was done by screenshots (see Auto Run Result) and every testid/label consumer still passes.
  - `[low]` `[patch]` Stale doc comment "Loading spinner during fetch" in PhotoGallery.tsx — corrected to "Page header over a skeleton grid during the first fetch". The "hover/tap" overlay wording predates this story and was left alone.
  - `[medium]` `[patch]` (edge) Owner sr-only text is never announced (same root cause as row 2) — fixed by the aria-describedby patch above.
  - `[medium]` `[defer]` (edge) Deleting in PhotoViewer leaves the gallery's local paginated list unchanged, so the grid and the new count go stale — PhotoViewer receives the gallery's local `photos` and deletes via the store (PhotoViewer.tsx:383-400). The stale grid predates this story; the count only shows it.
  - `[low]` `[reject]` (edge) "20+" for exactly 20 — same as row 8.
  - `[low]` `[reject]` (edge) Grapheme-splitting initials — same as row 9.
  - `[low]` `[reject]` (edge) The `shimmer` animation and keyframes in tailwind.config.js:84,108 are now unused — dead config costs nothing at runtime; story 9 owns removing unused styles, and editing tailwind.config.js is outside this story's files.
  - `[false]` `[reject]` (edge) FAB removal leaves Upload unreachable when scrolled — same as row 7: the intent mandates the header button.
  - `[low]` `[patch]` (verification-gap) The new isDeleting spinner in the viewer's Delete button is untested — the double-tap test now asserts no `.animate-spin` before confirming and one while the delete is pending.
  - `[false]` `[reject]` (verification-gap) The spinner is scope drift — it is part of the kit dialog pattern the spec names (NoteRemoveConfirmation shows Loader2 while removing); no behaviour changes.
  - `[low]` `[defer]` (verification-gap) whiteOnColorContrast.test.ts fails with ENOENT in loop worktrees (no node_modules/tailwindcss/theme.css) — an environment issue, independent of this diff; the guard passes 6/6 on the new code in a scratch copy with tailwind reachable.
  - `[false]` `[reject]` (intent) Nothing compares the rendered page with the mockup — 390×844 screenshots were taken in light and dark, grid and empty, plus the upload dialog; they match both artboards.
  - `[low]` `[patch]` (intent) "Not fixed" was checked only by a className regex — dock.spec now asserts computed position (the patch in row 4).
  - `[low]` `[patch]` (intent) dock.spec's placement check is vacuous — same patch as row 4.
  - `[false]` `[reject]` (intent) The viewer is restyled beyond its inline confirm — CAP-1 requires no palette colours in components and CAP-2 requires dark mode for every surface; the viewer's old `gray-*`/`white/10` chrome failed both.
  - `[false]` `[reject]` (intent) The contrast test edit is outside the intent — required: removing palette pairings dropped counts below the guard's canary floors; floors were reset per the test's own rule and the conditional-idiom canary kept via a fixed line; verified 6/6.

### 2026-09-22 — Review pass
- verdicts: 25 findings — high 0, medium 4, low 13, false 7, maybe-false 1
- findings:
  - `[low]` `[defer]` Grid tile has no keyboard focus indicator, and its caption shows on hover only — the focus-ring claim is false (the tile has no outline-none, so the browser's default outline shows); the hover-only caption is real and predates this story (baseline tile had the same `group-hover` overlay). Deferred.
  - `[medium]` `[defer]` A failed "load more" is silent when photos are on screen; "20+" stays and the observer keeps retrying — confirmed: the grid branch never renders `error` and `hasMore` stays true (PhotoGallery.tsx:187-193); identical at the baseline. Deferred.
  - `[low]` `[defer]` Viewer's "Photo 3 of 20" contradicts the "20+" subtitle — confirmed at PhotoViewer.tsx:616; the viewer count was already the paged length before this story. A fix needs a new PhotoViewer prop. Deferred.
  - `[false]` `[reject]` The viewer says "Partner photo" instead of the partner's name — "Partner photo" is accurate, and naming the partner in the viewer would be a new feature, which the intent rules out.
  - `[low]` `[defer]` Error regions in the restyled dialogs (upload, tag, edit, delete) lack `role="alert"` — confirmed; none had it at the baseline, so this predates the story. Deferred.
  - `[medium]` `[defer]` PhotoUpload has no dialog semantics, focus trap or Escape handling — confirmed; the baseline had none either. The intent's "one kit dialog pattern" is visual, and adding a focus trap is behaviour, not presentation. Deferred.
  - `[low]` `[patch]` Comments in supabaseClient.ts:441 and partnerDisplayNameContract.test.ts:22 still say LoveNotes is getPartnerDisplayName's only caller — PhotoGallery now calls it too. Both comments now name both callers and their defaults.
  - `[low]` `[patch]` The "name reads throw" kit test mocks rejections that getOwnDisplayName/getPartnerDisplayName can never produce (both catch internally and return null), so the reachable null→"Y"/"P" badge path was untested — the test now resolves both names to null and asserts the same fallbacks. The component's defensive catch is kept.
  - `[low]` `[patch]` PhotoCarouselControls' new sr-only "Edit/Delete/Close" spans are never read, because each button's aria-label overrides its content — the three spans are deleted; aria-labels unchanged.
  - `[false]` `[reject]` The upload dialog lost status signals (success tile in accent rather than `good`, weaker caption-counter warning) — success is still shown by the Check icon and the "Photo uploaded!" heading; the counter keeps its number and follows the spec's notice rule (text-ink); `good` is not in this story's kit utility list.
  - `[false]` `[reject]` The contrast test's canary floors are not "just under" the count — `> 24` for 26 and `> 12` for 14 is a margin of 2, tighter than the baseline's `> 35` for 41. The guard's blindness to kit tokens is the already-deferred item.
  - `[false]` `[reject]` Two Loader2 spinners lack aria-hidden — lucide-react 1.47 adds `aria-hidden="true"` itself when an icon has no accessible prop (dist/cjs/lucide-react.js:64-65).
  - `[low]` `[reject]` The opaque caption sheet covers the bottom of tall photos — the spec asks for a `bg-card` sheet here; the baseline's `bg-black/80` sheet covered the same area almost opaquely. Moving it needs a layout change beyond this restyle.
  - `[low]` `[reject]` Names are read once on mount; "Your shared album" shows without a partner — a rename while Photos is open is rare, and re-reading would need a subscription; "Your shared album" is the matrix's text for those states.
  - `[maybe-false]` `[reject]` A failed load leaves no way to upload — the Upload button was already missing from the baseline error state. Whether it matters depends on whether upload would work while the photo read is failing; a network failure breaks both. If real, it would only be low.
  - `[low]` `[reject]` (edge) "20+" for an album of exactly 20 — carried: same claim as the earlier row; the matrix specifies it, and it corrects itself once the next page loads.
  - `[medium]` `[defer]` (edge) Deleting in PhotoViewer leaves the gallery's count stale — carried: already on the deferred list from the earlier pass; not deferred again.
  - `[low]` `[reject]` (edge) Grapheme-splitting initials (flags, ZWJ, combining marks) — carried: same claim as the earlier row.
  - `[low]` `[patch]` (verification-gap) The emoji-safe `initialOf` has no test — added "keeps a name that opens with an emoji whole on the badge" ('🌸[partner]' → '🌸').
  - `[low]` `[patch]` (verification-gap) supabaseClient.ts:441 "only caller" comment is stale — same root cause as the comment row above; fixed by that patch.
  - `[false]` `[reject]` (intent) The partner badge is `text-card`, not the matrix's "white" — in light mode `--kit-card` is #ffffff, so it is white. In dark mode, white on #a78bfa is about 2.7:1, below the epic's 4.5:1 floor, so the change is required.
  - `[low]` `[reject]` (intent) Tests assert class strings in a CSS-less DOM, and the skeleton/grid equality holds by construction — carried: same claim as the earlier "tests assert class names" row. Sharing one PHOTO_GRID_CLASS constant is what guarantees the match.
  - `[false]` `[reject]` (intent) The dark-mode "no light surface" AC is unverified for the viewer confirm, edit, delete and carousel — a grep of all nine photo components for `bg-white`, hex, palette shades, gradients and `dark:` finds nothing. Every surface is a kit token that switches under `prefers-color-scheme: dark`, so no light surface can render.
  - `[medium]` `[defer]` (intent) The contrast guard cannot measure the badge's kit-token pairing — carried: already on the deferred list; not deferred again.
  - `[false]` `[reject]` (intent) Renaming the empty-state button from "Upload Photo" to "Upload a photo" breaks "visible button name keeps working" — the matrix sets "Upload a photo", and no test or code looks the button up by its old name (the E2E `/upload photo/i` queries the dialog heading, which is unchanged).

## Verification

**Commands:**
- `npx vitest run src/components/PhotoGallery` -- expected: all pass, including the new kit tests and `PhotoViewer.focus.test.tsx`.
- `npm run typecheck && npm run lint` -- expected: clean.
- `npx playwright test tests/e2e/photos tests/e2e/navigation/dock.spec.ts` (needs `supabase start`) -- expected: pass.

**Manual checks:**
- Screenshot `/photos` at 390×844 light and dark with photos and with none; compare to both `hasPhotos` states of `mockups/Photos.dc.html`.

## Auto Run Result

### Follow-up review pass — 2026-09-22

**Summary:** Story 6 moves Photos onto the style kit:
- a serif page header with a count subtitle, and an Upload pill that replaces the floating button;
- 3-column grid tiles with initial badges;
- a skeleton that matches the grid;
- kit empty and error cards;
- every photo dialog (upload, edit, delete, the viewer's confirm, carousel controls) on the NoteRemoveConfirmation pattern.

This follow-up pass reviewed that change again. It found no high-severity problems and applied four small fixes.

**Files changed in this pass:**
- `src/components/PhotoCarousel/PhotoCarouselControls.tsx` — removed three sr-only labels that the buttons' aria-labels already override.
- `src/api/supabaseClient.ts` — the getPartnerDisplayName doc comment now names both callers (LoveNotes, PhotoGallery).
- `tests/unit/api/partnerDisplayNameContract.test.ts` — the same comment correction.
- `src/components/PhotoGallery/__tests__/PhotoGallery.kit.test.tsx` — the fallback test now uses the reachable null answers instead of impossible rejections; added an emoji-initial test.

**Files changed by the story overall:** PhotoGallery.tsx, PhotoGridItem.tsx, PhotoGridSkeleton.tsx, PhotoViewer.tsx, PhotoUpload.tsx, PhotoEditModal.tsx, PhotoDeleteConfirmation.tsx, PhotoCarouselControls.tsx, the new PhotoGallery.kit.test.tsx, PhotoViewer.focus.test.tsx (spinner assertion), dock.spec.ts (computed-position check) and whiteOnColorContrast.test.ts (floors reset, fixed-line idiom canary).

**Review findings (25):**
- **Patched (4 entries, all low):** the stale "only caller" comments (2 rows), the impossible-rejection test, the dead sr-only spans, and the untested emoji initial. Patched by verdict: high 0, medium 0, low 4.
- **Deferred (5 new):** silent load-more failure (medium), no dialog semantics on the upload modal (medium), viewer "of N" count (low), no `role="alert"` on dialog errors (low), captions on hover only (low). Two carried rows were already on the deferred list and were not added again.
- **Rejected:** see the triage log. The reasons, in short:
  - the partner name in the viewer would be a new feature;
  - success and counter signals are still present;
  - the canary margin is tighter than before;
  - lucide auto-hides icons;
  - the caption sheet's coverage comes from the spec and predates it;
  - reading names once is fine for rare renames;
  - the upload-on-error question is unverified and low at most;
  - 20+, graphemes and class-string tests are carried rejects;
  - the badge's text-card is white in light mode and required in dark;
  - no light-surface class remains;
  - the button rename is in the matrix and has no consumers.

**Follow-up review recommended:** false. This was a follow-up pass and it patched no high findings, so the work has converged.

**Verification:**
- `npx vitest run src/components/PhotoGallery tests/unit/api/partnerDisplayNameContract.test.ts`: 3 files, 42 tests passed.
- `tsc -b --force`: exit 0.
- eslint over the touched paths: exit 0. `npm run lint` printed no errors.
- `npx playwright test tests/e2e/photos tests/e2e/navigation/dock.spec.ts` against local Supabase: 11 passed.

**Residual risks:**
- The five deferred items above, plus the four from the first pass.
- No automated check covers the dark-mode look. It rests on the token grep and on the first pass's screenshots, which this pass did not re-take.
- `whiteOnColorContrast.test.ts` still cannot run in loop worktrees (already deferred).
