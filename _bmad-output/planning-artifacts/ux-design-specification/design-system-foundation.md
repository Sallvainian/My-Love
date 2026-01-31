# Design System Foundation

## Design System Choice

**Decision:** Extend the existing My-Love design system (Tailwind CSS + Framer Motion + Lucide) rather than introducing new tooling.

The current utility-first setup with custom pastel themes, rounded glass-like surfaces, and established component patterns provides a flexible foundation. Scripture Reading will reuse existing infrastructure while introducing targeted new components for its unique interactions.

## Existing System Analysis

**Visual Language:**
- Soft gradients (pink, rose, sunset, ocean, lavender) with rounded, glass-like surfaces
- `Inter` (sans) for UI, `Playfair Display` (serif) for elegance, `Dancing Script` (cursive) for personal touches
- Glass morphism: white/80% backgrounds with backdrop blur
- Consistent hover/tap feedback with scale transforms

**Themes Available:**

| Theme | Mood | Scripture Reading Fit |
|-------|------|----------------------|
| **Ocean Breeze** | Calm, trust, peace | Strong — sanctuary feel |
| **Lavender Dreams** | Spiritual, intimate | Strong — contemplative |
| Sunset Romance | Playful, energetic | Default app theme — slightly energetic for reflection |
| Rose Garden | Classic, sophisticated | Neutral |

**Recommendation:** Scripture Reading screens should prefer `ocean` or `lavender` backgrounds (or muted variants) to signal a calm, contemplative mood distinct from the app's more energetic default. Same typography and card shapes; only subtle gradient adjustments needed.

## Components to Reuse

| Existing Component | Scripture Reading Usage |
|--------------------|------------------------|
| `.btn-primary`, `.btn-secondary` | "Continue," "Reflect" actions |
| `.input` (soft blurred field) | Optional note textarea |
| `.card` (rounded-3xl + backdrop blur) | Step cards, reflection prompts |
| `MoodDetailModal` pattern | Reflection modal, step detail overlays |
| `MoodButton` selection pattern | Adapt for verse selection in reflection |
| `MessageInput` | Daily Prayer Report message composition |
| `SyncToast` | Feedback on reflection save, sync status |
| `NetworkStatusIndicator` | Offline/reconnecting states |
| `BottomNavigation` | Add "Scripture" tab to ViewType |
| `CountdownTimer` celebration animations | Inspiration for 3-2-1 countdown |
| Safe-area utilities (`safe-top`, `safe-bottom`) | Notch-aware layout |

## New Components Required

Scripture Reading introduces **8 custom components** to support synchronized reading, role clarity, and emotional payoff moments:

| Component | Purpose | Implementation Notes |
|-----------|---------|---------------------|
| `<Countdown>` | 3-2-1 synchronized start | Framer Motion variants; static fallback for `prefers-reduced-motion` |
| `<RoleIndicator>` | "You read this" / "Partner reads this" | Pill-style badge on verse/response; subtle styling |
| `<BookmarkFlag>` | Per-verse "this matters to me" toggle | Small icon, instant toggle, resurfaces at reflection |
| `<PartnerPosition>` | Shows where partner is viewing | "Jordan is viewing the response" — subtle text |
| `<LockInButton>` | "Ready for next verse" with both-must-confirm | Shows waiting state when one has locked in |
| `<SessionProgress>` | Show current verse position | Text-only ("Verse 5 of 17"), no progress bar |
| `<ReflectionSummary>` | End-of-session: verse selection, rating, note, message | Bookmarked verses highlighted |
| `<DailyPrayerReport>` | Partner message reveal, side-by-side comparison | Two-column layout, card styling |

## Session Layout Contract

Even without a dedicated shell component, all reading screens follow consistent layout rules:

```
┌────────────────────────────────────┐
│ safe-top padding                   │
├────────────────────────────────────┤
│ TOP AREA                           │
│ - SessionProgress (left)           │
│ - PartnerPosition (right/below)    │
├────────────────────────────────────┤
│ CENTER AREA                        │
│ - Content cards (verse/response)   │
│ - Vertically centered              │
│ - Max-width constrained            │
├────────────────────────────────────┤
│ BOTTOM AREA                        │
│ - Primary CTA (LockInButton, etc.) │
│ - Full-width, thumb-zone position  │
├────────────────────────────────────┤
│ safe-bottom padding                │
└────────────────────────────────────┘
```

**Layout Rules:**
- All reading screens use this three-zone layout
- Safe-area utilities applied consistently (`safe-top`, `safe-bottom`)
- Primary actions always bottom-anchored in thumb zone
- Progress always visible at top
- Content cards vertically centered with max-width constraint

## Component Specifications

### `<SessionProgress>` (Text-Only)

**Purpose:** Show current verse position without task-like pressure

**Implementation:**
- Content: "Verse 5 of 17" (text only, NO progress bar)
- Rationale: Progress bars emphasize completion over presence; text feels informational, not task-y
- Position: Top-left of reading screens
- Typography: Inter 500, 12px (xs), muted purple (#9B7DB8)
- Accessibility: `aria-label="Currently on verse 5 of 17"`

**Why text-only:** Progress bars feel task-oriented ("how much is left?"). Text aligns with "ritual, not task" principle — it's informational without pressure.

### `<Countdown>` Accessibility

**Motion behavior:**
- Default: Animated number transitions with scale/fade
- Reduced motion: Static number display, no animation

**Accessibility:**
- Single `aria-live="polite"` announcement: "Session starting in 3 seconds"
- Visual countdown numbers: `aria-hidden="true"` (to prevent per-number announcements)
- Final announcement: "Session started"
- Focus: Container receives focus when countdown begins

**Why polite, not assertive:** `aria-live="assertive"` per number is too aggressive for screen reader users. One announcement at start, one at completion.

### `<BookmarkFlag>` Design Decision

> **Design Decision:** BookmarkFlag replaces the PRD's "help/sensitive flag" per stakeholder decision (Step 7).
>
> **What we lose:**
> - Explicit empathy signal to partner ("I'm struggling here")
> - Vulnerability sharing in Daily Prayer Report
> - Direct request for partner's attention/care
>
> **What we gain:**
> - Simpler emotional dynamics (no pressure on partner to "help")
> - Personal reflection tool (not a communication signal)
> - Lower stakes — marking interest, not vulnerability
> - Aligns with "safe" principle — no risk of feeling exposed
>
> **Rationale:** The feature should feel safe. Vulnerability signals could backfire in sensitive moments. Bookmarks achieve the "this matters to me" goal without emotional complexity.

### Waiting State Guidelines (No-Blame Copy)

When one partner has locked in and is waiting for the other:

**Primary line (blame-free):** "We'll continue when you're both ready"

**Secondary line (subtle status):**
- "Jordan is viewing the verse"
- "Jordan is reconnecting..."

**Never use as primary:** "Waiting for Jordan..." (subtly makes partner the bottleneck, can feel pressuring in conflict contexts)

**Animation:**
- Subtle pulse animation (2s cycle)
- Respects `prefers-reduced-motion` (no pulse when enabled)

**Tone:** Presence-aware, never problem-focused. The UI communicates togetherness, not waiting.

## Phase Transition Accessibility

**Focus Management Rules:**

| Transition | Focus Target |
|------------|--------------|
| Lobby → Countdown | Countdown container |
| Countdown → Verse 1 | Verse heading |
| Verse ↔ Response | Navigation button that was used |
| Step N → Step N+1 | Verse heading |
| Reading → Reflection | Reflection form heading |
| Reflection → Report | Report heading |

**ARIA Announcement Strategy:**
- Use `aria-live="polite"` region for phase changes
- Announce: "Moved to verse 5" / "Now in reflection" / "Report ready"
- Partner status: polite region for "Jordan is ready"
- Never interrupt with assertive (except critical errors)

**Screen Reader Experience:**
- Phase changes announced once, not repeatedly
- Focus moves to logical starting point for each phase
- Partner actions announced subtly (polite), never disruptively

## Accessibility Gap: Reduced Motion

**Finding:** The codebase currently has no `prefers-reduced-motion` support.

**Required for Scripture Reading (per PRD):**
- Add `useReducedMotion()` hook from Framer Motion
- Countdown: Fall back to static count display
- Phase transitions: Instant swap instead of crossfade
- Floating/pulsing elements: Disable or simplify

**Implementation Pattern:**
```typescript
import { useReducedMotion } from 'framer-motion';

const shouldReduceMotion = useReducedMotion();
const transition = shouldReduceMotion
  ? { duration: 0 }
  : { type: 'spring', stiffness: 100, damping: 15 };
```

## Customization Strategy

**What stays the same:**
- Font stack (Inter/Playfair/Dancing Script)
- Card styling (rounded-3xl, glass morphism)
- Button shapes and interaction patterns
- Icon library (Lucide React)
- Animation library (Framer Motion)

**What adapts:**
- Background gradients: Muted/cooler for reflection screens
- Color intensity: Softer during reading phases
- Animation timing: Slower, more deliberate transitions to match calm mood

**What's new:**
- Bookmark flag component (per-verse)
- Lock-in button with dual-confirm pattern
- Partner position indicator
- Two-person state machine UI patterns
