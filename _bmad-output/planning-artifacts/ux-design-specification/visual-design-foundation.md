# Visual Design Foundation

## Color System

**Primary Theme:** Lavender Dreams

Scripture Reading will use the Lavender Dreams theme to create a spiritual, contemplative atmosphere distinct from the app's default Sunset Romance energy.

**Lavender Dreams Palette:**
- **Primary:** #A855F7 (Purple)
- **Secondary:** #C084FC (Light purple)
- **Background:** #F3E5F5 (Pale lavender)
- **Text:** #4A1F6F (Dark purple)
- **Accent:** #D8B4FE (Lighter purple)

**Semantic Color Mapping for Scripture Reading:**

| Purpose | Color | Usage |
|---------|-------|-------|
| **Background** | Lavender gradient | Reading screens, reflection |
| **Card surface** | White/80% + blur | Verse cards, input fields |
| **Primary text** | #4A1F6F | Verse text, headings |
| **Secondary text** | #6B4D8A | Response text, labels |
| **Muted text** | #9B7DB8 | Partner position, hints |
| **Role indicator (Reader)** | #A855F7 | "You read this" badge |
| **Role indicator (Responder)** | #C084FC | "You respond" badge |
| **Bookmark active** | #F59E0B (Amber) | Filled bookmark icon |
| **Bookmark inactive** | #D8B4FE | Empty bookmark outline |
| **Lock-in button** | Primary gradient | "Ready for next verse" |
| **Waiting state** | Secondary with pulse | "You're ready ✓ (tap to undo)" |

**Accessibility:**
- Designed to meet WCAG AA (4.5:1 normal text, 3:1 large text); verify with contrast checks during implementation, especially muted text on gradients and glass surfaces
- #4A1F6F on #F3E5F5 = 7.2:1 contrast ratio ✓
- Interactive elements have visible focus states

## Typography System

**Font Stack:**
- **UI/Body:** Inter (400, 500, 600)
- **Scripture:** Playfair Display (400, 500)
- **Personal touches:** Dancing Script (for partner messages in Daily Prayer Report)

**Type Scale for Scripture Reading:**

| Element | Font | Weight | Size | Line Height |
|---------|------|--------|------|-------------|
| **Verse reference** | Inter | 500 | 12px (xs) | 1.5 |
| **Verse text** | Playfair Display | 400 | 20px (xl) | 1.75 |
| **Response text** | Inter | 400 | 16px (base) | 1.6 |
| **Role indicator** | Inter | 500 | 14px (sm) | 1.4 |
| **Partner position** | Inter | 400 | 12px (xs) | 1.5 |
| **Button text** | Inter | 500 | 16px (base) | 1.5 |
| **Reflection prompts** | Inter | 500 | 18px (lg) | 1.6 |
| **Partner message (report)** | Dancing Script | 400 | 18px (lg) | 1.6 |

**Typography Principles:**
- Verse text is largest and most prominent — it's the focus
- UI elements (buttons, indicators) use Inter for clarity
- Partner messages in Daily Prayer Report use Dancing Script for personal warmth
- Generous line-height on scripture for breathable reading

## Spacing & Layout Foundation

**Base Unit:** 4px (Tailwind default)

**Spacing Scale:**
- `1` = 4px — Tight spacing (icon gaps)
- `2` = 8px — Small spacing (inline elements)
- `3` = 12px — Medium-small (button padding vertical)
- `4` = 16px — Medium (card internal margins)
- `6` = 24px — Large (card padding, section gaps)
- `8` = 32px — Extra-large (between major sections)

**Layout Principles:**

1. **Generous white space** — Scripture reading should feel airy, not cramped. Err on the side of more space.

2. **Single-column mobile** — Full-width cards, bottom-anchored actions. No side-by-side layouts on mobile.

3. **Thumb-zone actions** — Primary buttons ("Ready for next verse") positioned in bottom 40% of screen.

4. **Safe areas respected** — Use `safe-top` and `safe-bottom` utilities for notch-aware layouts.

**Card Layout:**
- Padding: 24px (p-6)
- Border radius: 24px (rounded-3xl)
- Background: white/80% with backdrop-blur
- Shadow: subtle (shadow-lg)

**Touch Targets:**
- Minimum 44×44px for all interactive elements
- Bookmark flag: 48×48px hit area
- Lock-in button: Full-width, 56px height

## Accessibility Considerations

**Visual Accessibility:**
- WCAG AA contrast compliance for all text
- Focus indicators on all interactive elements (ring-2 ring-purple-400)
- No color-only information (icons accompany color states)

**Motion Accessibility:**
- `prefers-reduced-motion` support required
- Countdown: Static display fallback
- Transitions: Instant swap fallback
- No auto-playing animations without user control

**Screen Reader Support:**
- Semantic HTML (headings, buttons, landmarks)
- ARIA labels for icon-only buttons (bookmark flag)
- Live regions for partner position updates
- Focus management on screen transitions

**Touch Accessibility:**
- 44px minimum touch targets
- Adequate spacing between interactive elements (≥8px)
- No hover-only interactions
