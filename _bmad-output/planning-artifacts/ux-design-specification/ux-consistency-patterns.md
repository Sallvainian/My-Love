# UX Consistency Patterns

## Button Hierarchy

Scripture Reading uses a three-tier button hierarchy consistent with My-Love's existing patterns:

| Tier | Purpose | Style | Examples |
|------|---------|-------|----------|
| **Primary** | Advances session | Full-width, Lavender gradient, 56px | "Ready for next verse" |
| **Secondary** | Navigation within step | Outlined, transparent | "View Verse", "View Response" |
| **Tertiary** | Optional actions | Text-only, muted | Bookmark toggle, "Close for now" |

**Navigation symmetry:** "View Verse" ↔ "View Response"

### Lock-In Button States

| State | Button Text | Helper | Visual |
|-------|-------------|--------|--------|
| **Available** | "Ready for next verse" | — | Primary |
| **You're Ready** | "Ready ✓" | "Tap to undo" | Secondary + check |
| **Sync Paused** | "Holding your place" | "Reconnecting..." | Muted + indicator |
| **Both Ready** | "Continuing..." | — | Fade out, 300-400ms |

Below button when waiting: "We'll continue when you're both ready"

## Partner Presence Feedback

Three-state indicator extending existing color system:

| State | Color | Indicator |
|-------|-------|-----------|
| **Same page** | Yellow (#FCC419) | Lit |
| **Different pages** | Red (#FF6B6B) | Lit |
| **Both ready** | Green (#51CF66) | Lit |
| **Disconnected** | — | Off |

**Accessibility:** State changes announced via `aria-live="polite"`

## Form Patterns

### Verse Selection
- Display only bookmarked verses (not all 17)
- Uses `MoodButton` pattern with `aria-pressed`
- Min 48×48px touch targets
- If no bookmarks: "You didn't mark any verses — that's okay"

### Session Rating
- Prompt: "How meaningful was this for you today?"
- 1-5 numbered circles
- End labels: "A little" ↔ "A lot"
- Radiogroup with proper ARIA

### Textareas
- Uses `.input` class + `min-h-[80px]` + `resize-none`
- Auto-grow up to ~4 lines
- Character counter at 200+ (muted), soft limit at 1000

### Validation
- Required: Verse selection + Rating
- Timing: On "Continue" tap only
- Missing field: Quiet helper text, button stays disabled
- No red flashes

## Phase Transition Animations

| Transition | Animation | Duration |
|------------|-----------|----------|
| Lobby → Countdown | Fade + scale | 300ms |
| Countdown → Verse 1 | Crossfade | 400ms |
| Verse ↔ Response | Crossfade | 200ms |
| Step → Step | Slide left + fade | 300ms |
| Reading → Reflection | Fade through white | 400ms |

**Reduced motion:** All animations respect `prefers-reduced-motion` with instant swap fallback.

**Focus management:** Focus moves to logical target after each transition (verse heading, form heading, report heading).

**Timing principles:** Max 400ms, consistent rhythm, no bouncing or parallax.
