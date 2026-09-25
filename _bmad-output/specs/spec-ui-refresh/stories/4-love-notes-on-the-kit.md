---
title: 'Love Notes on the kit'
type: 'feature'
created: '2026-09-22'
status: 'done'
baseline_revision: 'c9faed773a8ba46b13d0b13444b9f098a4c14a4e'
review_loop_iteration: 0
followup_review_recommended: false
context:
  - '{project-root}/_bmad-output/specs/spec-ui-refresh/design-tokens.md'
  - '{project-root}/_bmad-output/specs/spec-ui-refresh/mockups/Notes.dc.html'
warnings: []
deferred:
  - summary: >-
      The Love Notes error banner has no role or aria-live, so an error that appears without user action is shown but never announced; the realtime notice comment in LoveNotes.tsx claims it matches the banner's treatment.
    evidence: |-
      Pre-existing at baseline c9faed77: LoveNotes.tsx error banner motion.div carries no role/aria-live; this story only restyled it. Fix is role="alert" on the banner plus correcting the comment.
    location: >-
      src/components/love-notes/LoveNotes.tsx (error banner)
    severity: low
  - summary: >-
      The white-on-colour contrast guard only matches palette shades (bg-<colour>-<shade>), so text-white on a kit token such as bg-partner or bg-fill is never checked in either theme.
    evidence: |-
      tests/unit/a11y/whiteOnColorContrast.test.ts:241 pattern ignores kit tokens introduced in story 1; this story shipped text-white on bg-partner at 2.72:1 in dark mode before review caught it. The guard should resolve the --kit-* values from src/index.css for both themes.
    location: >-
      tests/unit/a11y/whiteOnColorContrast.test.ts:241
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Love Notes still draws its own chrome and palette: an in-view header bar (back arrow + "Love Notes") under the app top bar, a `#FFF5F5` ground, coral `#FF6B6B`/grey `#E9ECEF` bubbles, a `coral-500` rectangular Send button, 💕 emoji and a light-only grey dialog — so it ignores dark mode and matches no other screen (CAP-5, CAP-2).

**Approach:** Restyle the Love Notes components on the kit tokens already in `src/index.css` (`bg-page`, `bg-card`, `bg-fill`, `text-ink`, `text-muted`, `border-line`, `bg-partner`, `bg-good`, `bg-dtint`, `text-danger`…), replacing the header bar with the artboard's partner row, and match `mockups/Notes.dc.html` in both themes. Presentational only.

## Boundaries & Constraints

**Always:** Keep the height at `calc(100dvh-4rem-env(safe-area-inset-top)-var(--dock-clearance))` so at 390×844 the page does not scroll and the composer sits fully above the dock. Keep every testid, aria-label and role (`love-note-message`, `note-remove-button`, `note-remove-confirm`, `note-remove-confirmation`, `new-message-indicator`, `beginning-of-conversation`, `loading-spinner`, `virtualized-list`, `image-preview`, `fullscreen-image-viewer`, `realtime-connection-status-notes`, "Love note message input", "Send message", "Attach image", "Retry sending message"). Keep a level-1 "Love Notes" heading, visually hidden. Own bubble and Send button are both `bg-fill`. lucide icons only.

**Never:** No raw hex, `coral-*`, palette shades (`gray-*`, `red-*`, `amber-*`, `yellow-*`, `green-*`) or gradients in `src/components/love-notes/`. No `dark:` variants (kit vars switch themselves). No data, store, hook or API change; no presence feature (the dot reflects the existing feed status, not partner presence); no date separators or message grouping; do not change `calculateRowHeight` budgets or the caption line's fixed 16px box.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Feed connected | `realtimeStatus='connected'` | Partner row: `good` dot + "Connected" in `muted`; no `realtime-connection-status-notes` element | — |
| Feed reconnecting | `'reconnecting'` | `muted` dot + "Reconnecting…" in `text-muted`, `role=status` `aria-live=polite`, testid kept | — |
| Feed gave up | `'disconnected'` | `danger` dot + "Not receiving new notes" in `text-danger`, same live region | — |
| Idle / connecting | `'idle'`/`'connecting'` | Name only, no status line | — |
| Partner name unknown | `getPartnerDisplayName()` → null | Name "Partner", avatar initial "P" | — |

</intent-contract>

## Code Map

- `src/components/love-notes/LoveNotes.tsx:126-166` -- container ground `bg-[#FFF5F5]` and the header bar (ArrowLeft/"Go back home", h1, realtime notice) to replace with the partner row; `:168-184` red error banner; `navigateHome` becomes unused. `partnerName` state already fetched (`:87-116`).
- `src/components/love-notes/LoveNoteMessage.tsx:238-345` -- caption (`text-gray-500`, trash `hover:text-red-500`), bubble classes `:271-277` (`#FF6B6B`/`#E9ECEF`, `border-red-500` on error), image loading/error fills `bg-gray-200`, `focus:ring-coral-500`, text `px-4 py-3 text-base leading-relaxed`, "Sending..." and retry colours.
- `src/components/love-notes/MessageList.tsx:132-154` -- `BeginningOfConversation` 💕 and `text-gray-400`, spinner `#FF6B6B`; `:341-370` empty state (`#FFF5F5`, `#FF6B6B`, `gray-*`, 💕) and initial spinner; `:390-401` new-message pill `#FF6B6B`/`#FF5252`.
- `src/components/love-notes/MessageInput.tsx:193-198` counter colours; `:208` composer `border-t bg-white p-4`; `:230-272` image button, textarea, text "Send"/"Sending..." button with `coral-*`; `:276-285` `text-red-500` errors.
- `src/components/love-notes/ImagePreview.tsx:84-126` -- `rounded-lg border-gray-200 bg-gray-50`, `text-gray-500`/`green-600`/`amber-600`.
- `src/components/love-notes/NoteRemoveConfirmation.tsx:170-230` -- always-dark `gray-800` panel, `red-*` icon/button. Reference pattern: `src/components/MoodHistory/MoodDetailModal.tsx:58-90` (kit dialog, 44px `bg-card2 text-muted` icon button).
- `src/components/love-notes/FullScreenImageViewer.tsx:96-117` -- close button `bg-black/50 p-2`, image `rounded-lg`.
- `src/components/love-notes/__tests__/LoveNotes.realtimeStatus.test.tsx:118,129`, `LoveNoteMessage.test.tsx:89,99,289-293`, `MessageInput.test.tsx:96` -- assert old classes; update to kit classes.
- `tests/e2e/navigation/dock.spec.ts:73-92` -- existing no-scroll/composer-above-dock check (must stay green). `tests/e2e/notes/love-notes.spec.ts:27` expects h1 "Love Notes". `tests/e2e/home/home-kit.spec.ts` -- pattern for a both-themes kit E2E (`emulateMedia`, rgb constants).

## Tasks & Acceptance

**Execution:**
- `src/components/love-notes/LoveNotes.tsx` -- ground `bg-page`; sr-only h1 "Love Notes"; partner row (40px `bg-partner` avatar with white initial, 16px 600 `text-ink` name, 13px status line per matrix) with testid `notes-partner-row`, followed by a full-width 1px `bg-line` divider; error banner on `bg-dtint`/`text-danger`; remove header bar and unused imports.
- `src/components/love-notes/LoveNoteMessage.tsx` -- bubble `max-w-[78%] rounded-[20px]` with 6px tail corner (own `rounded-br-[6px] bg-fill text-white`; partner `rounded-bl-[6px] bg-card text-ink` + inset 1px `line`), text `px-3.5 py-2.5 text-[15px] leading-[1.4]`; error ring `danger`; caption/status/retry on `muted`/`danger`; image placeholders `bg-card2 text-muted`; focus ring `accent`.
- `src/components/love-notes/MessageList.tsx` -- spinners `text-accent`; beginning marker lucide `Heart` in `text-accent` + `text-muted` copy (no emoji); empty state as kit icon tile (`bg-tint text-accent`) + `text-ink` title + `text-muted` copy without 💕; new-message pill `bg-fill text-white`.
- `src/components/love-notes/MessageInput.tsx` -- composer transparent over `page` (`px-4 pt-2 pb-3`, no border/white); image button 44px circle `bg-card2 text-muted`; textarea 44px min, `rounded-[22px] bg-card text-ink` inset `line`, 15px, placeholder `muted`, focus ring `accent`; Send = 44px circle `bg-fill text-white` with lucide `Send` icon (Loader2 while sending), aria-label unchanged; counter `muted` → near-limit `text-ink font-medium` → over `text-danger font-semibold`; errors `text-danger`.
- `src/components/love-notes/ImagePreview.tsx` -- `rounded-[14px] border-line bg-card2`; size row `muted`, compressed size `text-good`, "(large file)" `muted`.
- `src/components/love-notes/NoteRemoveConfirmation.tsx` -- kit dialog: `bg-black/50` backdrop, `bg-card rounded-[20px] shadow-float` panel, `bg-dtint text-danger` icon tile, Inter 600 18px `text-ink` title, preview on `bg-card2 text-muted`, body `text-ink`/`muted`, Cancel = secondary pill (`bg-tint text-accent`), Remove = `bg-dtint text-danger` pill; hairlines `border-line`.
- `src/components/love-notes/FullScreenImageViewer.tsx` -- close = 44px circle `bg-card text-ink` icon button; image `rounded-[14px]`.
- `src/components/love-notes/__tests__/*` -- update the class assertions above to kit classes; add realtime-status cases for the connected "Connected" line.
- `tests/e2e/notes/notes-kit.spec.ts` -- new: at 390×844 in light and dark, the partner row is visible, no "Go back home" control, page ground/composer computed colours are the kit values, Send button background equals own-bubble fill after sending a note, and `scrollHeight - innerHeight <= 0`.

**Acceptance Criteria:**
- Given Love Notes at 390×844 in either OS theme, when it loads, then the partner row replaces the header bar, the page does not scroll, the composer ends above the dock, and every surface uses kit colours (no light surface in dark mode).
- Given a sent note, when it renders, then its bubble and the Send button share the `fill` pink and a partner bubble is `card` with a `line` inset edge.
- Given `grep -rnE "#[0-9a-fA-F]{3,6}|coral-|(gray|red|amber|yellow|green)-[0-9]|from-|to-|💕" src/components/love-notes/*.tsx`, when run, then it finds nothing.

## Spec Change Log

## Review Triage Log

### 2026-09-22 — Review pass
- verdicts: 20 findings — high 0, medium 1, low 13, false 5, maybe-false 1
- findings:
  - `[low]` `[patch]` (blind) Failed-send `ring-danger` is invisible on the own `bg-fill` bubble (1.17:1 light, 1.66:1 dark) — measured; failure text still shows, so the ring is a secondary cue. Fixed: error state is now an outer `outline-2 outline-offset-2 outline-danger` against the page.
  - `[medium]` `[patch]` (blind) Avatar initial `text-white` on `bg-partner` is 2.72:1 in dark mode, below SPEC's 4.5:1 — measured. Fixed: `text-card` (6.45:1 dark, 5.70:1 light), matching PartnerMoodDisplay.tsx:137. The guard-test gap it exposed is deferred (pre-existing from story 1).
  - `[low]` `[patch]` (blind) Comments reworded to pass the AC grep; "Automatic resize textarea" is ungrammatical — the grammar is fixed ("Textarea that grows with its content"); restoring the original wording would require editing this spec's grep, which triage rejects.
  - `[low]` `[reject]` (blind) Cancel (`tint`) and Remove (`dtint`) pills look alike — real but prescribed by design-tokens.md (secondary = tint/accent; destructive = danger on dtint); changing it contradicts the kit.
  - `[low]` `[defer]` (blind) Error banner not announced and a comment claims it is — pre-existing at baseline; this story only restyled it. Deferred.
  - `[low]` `[reject]` (blind) E2E does not check rendered colour for the partner bubble, dialog, viewer, banner and empty state — unit tests pin the kit classes; adding partner-authored E2E fixtures is more than a direct correction for a low gap.
  - `[low]` `[reject]` (blind) Bubble located by DOM depth / radius class in tests — fragile but works; the fix adds a new testid surface for a low maintainability gain.
  - `[false]` `[reject]` (blind) Row-height comments inaccurate — MessageList's breakdown documents the unchanged `calculateRowHeight` budget, which the spec keeps on purpose; the bubble comment was rewritten with the outline patch.
  - `[low]` `[reject]` (blind) Near-limit counter and "(large file)" lose their warning colours — the kit has no warning token and the spec prescribes these mappings; the counter still turns `danger` over the limit.
  - `[low]` `[patch]` (blind) Leftover `navigateHome` mock in the realtime-status test — deleted.
  - `[low]` `[reject]` (blind) Viewer close button's `bg-card` barely shows on the black overlay in dark mode, and its hover was dropped — the `ink` X glyph stays clearly visible; a cosmetic edge case.
  - `[low]` `[patch]` (edge) Image children paint over the inset error ring and partner hairline — same root cause as the first row. Fixed: outlines paint above descendants (partner hairline is now `outline-1 -outline-offset-1 outline-line`).
  - `[low]` `[patch]` (edge) `charAt(0)` splits an emoji-led partner name into a lone surrogate — fixed: `Array.from(partnerName.trim())[0]`, keeping the 'P' fallback.
  - `[maybe-false]` `[reject]` (edge) Whitespace-only partner display name renders a blank name line — the truthy check is pre-existing; it needs a DB check on whether `display_name` can be whitespace-only. If true, only low.
  - `[low]` `[patch]` (edge, claim) Spec/comment say every failed bubble is outlined, but image-only failures were not — same root cause as the first row; fixed by the outline change.
  - `[low]` `[patch]` (verification-gap) Send button's in-flight Loader2 is untested — added a MessageInput test that holds `sendNote` pending, asserts `.animate-spin` plus disabled, then resolves and waits for the spinner to go.
  - `[false]` `[reject]` (intent) Diff departs from the artboard ("Online", date separator, grouped timestamps, placeholder/labels) — screens.md says mock text is placeholder; "Online" would state partner presence that does not exist; separators and grouping are a new feature, which SPEC's non-goals exclude; testids and labels must keep working.
  - `[false]` `[reject]` (intent) No-scroll is only measured at rest, not with banner, preview or grown textarea — the container has a fixed height and its only flexible child is `min-h-0 flex-1`; the worst case of fixed children (~520px) fits the ~684px container at 390×844.
  - `[false]` `[reject]` (intent) Safe-area terms are never exercised on desktop — the diff does not touch the height formula or `--dock-clearance`; this belongs to the dock spec.
  - `[false]` `[reject]` (intent) Contrast of `text-muted`/`text-danger` notice is unverified after the DW-134 comment was removed — index.css:37-43 records muted 4.97:1 on page, and danger measures 5.00:1 on page.

## Design Notes

The artboard's "Online" line implies partner presence, which does not exist; showing it would be false. The row's status line reuses the feed status the header showed, so `connected` shows "Connected" (the Partner screen's own word) while the announced live region stays limited to reconnecting/disconnected, as the existing test requires. The artboard's per-message caption-less layout, "19 March" separator and grouped timestamps would change `calculateRowHeight`'s virtualized row budget and add a grouping feature; the per-message caption line (which hosts the remove button) stays.

## Verification

**Commands:**
- `npm run typecheck && npm run lint` -- expected: clean.
- `npx vitest run src/components/love-notes` -- expected: all pass.
- `npx playwright test tests/e2e/notes tests/e2e/navigation/dock.spec.ts` (with `supabase start`, local dev server) -- expected: all pass.

## Auto Run Result

Status: done

**Summary:** Love Notes is restyled on the style kit in both OS themes. The in-view header bar is replaced by the artboard's partner row: a partner-violet avatar, the name, and a feed-status line reading Connected, Reconnecting… or Not receiving new notes. A visually hidden h1 is kept. Bubbles, the pill composer with a round `fill` Send button, the empty and beginning states, the new-message pill, the remove-note dialog, the image preview and the full-screen viewer all use kit tokens. The height formula built on `--dock-clearance` is unchanged, and the page does not scroll at 390×844.

**Files changed:**
- `src/components/love-notes/LoveNotes.tsx` -- adds the partner row, hidden h1 and kit error banner; removes the header bar.
- `src/components/love-notes/LoveNoteMessage.tsx` -- kit bubbles with a 6px tail; failure and partner edges are drawn as outlines.
- `src/components/love-notes/MessageList.tsx` -- kit empty and beginning states (lucide Heart instead of emoji), spinners and new-message pill.
- `src/components/love-notes/MessageInput.tsx` -- transparent composer, round image button, rounded textarea, round `fill` Send with Send/Loader2 icons.
- `src/components/love-notes/ImagePreview.tsx` -- kit radius and colours.
- `src/components/love-notes/NoteRemoveConfirmation.tsx` -- rebuilt as a kit dialog (card panel, dtint/danger destructive pill).
- `src/components/love-notes/FullScreenImageViewer.tsx` -- 44px kit close button, 14px image radius.
- `src/components/love-notes/__tests__/{LoveNotes.realtimeStatus,LoveNoteMessage,MessageInput}.test.tsx` -- kit class assertions, partner-row cases, in-flight Send test.
- `tests/e2e/notes/notes-kit.spec.ts` -- new: both themes at 390×844, partner row, kit colours, Send pink equals the own bubble, no page scroll.

**Review:** 20 findings. 8 rows patched, covering 6 fixes: avatar contrast (medium); failure/partner edge outlines (3 rows, low); emoji initial (low); comment grammar (low); leftover mock (low); Send in-flight test (low). Patched counts by entry verdict: medium 1, low 5. Deferred: the unannounced error banner (pre-existing) and the contrast guard's blind spot for kit tokens. Rejected: 10, each with its reason recorded in the triage log above.

**Follow-up review recommended:** false. Only one medium entry was patched and no high entry, and the patch is a one-token class swap that the unit test pins.

**Verification:**
- `npm run typecheck` exit 0; `npm run lint` exit 0.
- `npx vitest run src/components/love-notes`: 7 files, 116 tests passed.
- `npx playwright test tests/e2e/notes tests/e2e/navigation/dock.spec.ts`: 14 passed against local Supabase.
- The AC grep over `src/components/love-notes/*.tsx` finds 0 matches.

**Residual risks:**
- Partner-bubble and dialog colours are pinned only at the class level; no E2E checks them as rendered colours.
- Safe-area insets are never exercised in desktop Chromium.
- Outline border-radius following needs Safari 16.4 or newer; older Safari shows square failure outlines.
