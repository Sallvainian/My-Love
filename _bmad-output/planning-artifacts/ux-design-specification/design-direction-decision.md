# Design Direction Decision

## Design Directions Explored

An interactive HTML mockup was created (`ux-design-directions.html`) showcasing 7 key screens:

1. **Lobby** — Partner presence, dual ready buttons
2. **Countdown** — 3-2-1 shared anticipation animation
3. **Verse Screen (Reader)** — Role indicator, bookmark flag, Playfair typography
4. **Response Screen** — Partner role indicator, back navigation
5. **Lock-in Waiting** — "You're ready" with partner presence indicator
6. **Reflection** — Bookmarked verses, rating, message composition
7. **Daily Prayer Report** — Partner message reveal, side-by-side comparison

## Chosen Direction

**Single unified direction** based on Lavender Dreams theme with the following characteristics:

**Visual Style:**
- Lavender Dreams purple gradient backgrounds
- Glass morphism cards (white/80% + backdrop blur)
- Playfair Display for scripture, Inter for UI, Dancing Script for partner messages
- Soft shadows and rounded-3xl corners

**Interaction Patterns:**
- Role indicators as pill badges with microphone icons
- Bookmark flag with instant toggle (amber when active)
- Partner position indicator with subtle pulse animation
- Lock-in button with waiting state transformation
- "Stood out to you" / "Stood out to [Partner]" labels for verse comparison

**Information Hierarchy:**
- "Verse X of 17" as progress indicator
- Scripture text largest and most prominent
- Role and partner position as secondary information
- Actions bottom-anchored in thumb zone

## Design Rationale

1. **Lavender Dreams theme** supports the spiritual, contemplative mood — distinct from the app's energetic default
2. **Glass morphism cards** maintain consistency with existing My-Love design language
3. **Clear role indicators** prevent "whose turn?" confusion without being intrusive
4. **Partner position visibility** reinforces "we're doing this together" without requiring verbal coordination
5. **Bottom-anchored actions** respect mobile ergonomics (thumb zone)
6. **Dancing Script for partner messages** creates intimate, personal reveal moment

## Implementation Approach

**Reuse existing patterns:**
- Card, button, and input styling from My-Love design system
- Framer Motion animation patterns
- Safe-area and responsive utilities

**Create new components (8 total):**
- `<Countdown>` with reduced-motion fallback
- `<RoleIndicator>` pill badge
- `<BookmarkFlag>` toggle with instant feedback
- `<PartnerPosition>` with pulse animation
- `<LockInButton>` with waiting state
- `<SessionProgress>` text-only position indicator
- `<ReflectionSummary>` form layout
- `<DailyPrayerReport>` reveal layout

**Reference mockup:** `_bmad-output/planning-artifacts/ux-design-directions.html`

## Implementation Roadmap

| Phase | Components | Priority | Rationale |
|-------|------------|----------|-----------|
| **Phase 1 — Core Sync** | Countdown, RoleIndicator, LockInButton, PartnerPosition, SessionProgress | P0 | Required for Together mode to function |
| **Phase 2 — Session Completion** | BookmarkFlag, ReflectionSummary, DailyPrayerReport | P1 | MVP scope; Daily Prayer Report is the emotional payoff |

**P0 (Core Sync):** Without these, Together mode doesn't work. Users can't see roles, can't progress together, can't track position.

**P1 (Session Completion):** All MVP scope per PRD. BookmarkFlag supports reflection; ReflectionSummary captures session response; DailyPrayerReport delivers the emotional payoff that makes the feature meaningful.

**Note:** DailyPrayerReport is P1 (not P2) because it's explicitly MVP scope in the PRD. The partner message reveal is the "why" of the feature — where couples actually connect.
