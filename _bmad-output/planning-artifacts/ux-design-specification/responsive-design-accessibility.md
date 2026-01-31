# Responsive Design & Accessibility

## Responsive Strategy

### Breakpoint Approach

Use standard Tailwind breakpoints with single-column layout at all sizes:

| Breakpoint | Width | Layout |
|------------|-------|--------|
| **Mobile** | < 640px (default) | Single column, full-width cards |
| **sm** | 640px+ | Same layout, slightly more padding |
| **md** | 768px+ | Session Layout Contract, max-w-md centered |
| **lg** | 1024px+ | Same as md |

**No custom breakpoints.** Scripture Reading is single-column content designed for intimacy, not productivity.

### Desktop/Tablet Constraint

On `md+`, use the Session Layout Contract (from Step 11) with `max-w-md` container centered.

*Implementation example (pseudocode):*
```
container: max-w-md, mx-auto, px-4
```

### Safe Areas

Always apply safe-area utilities on mobile (`safe-top`, `safe-bottom`).

### Keyboard Overlap Handling

During reflection/message entry, ensure the bottom CTA doesn't get covered by the on-screen keyboard:

| Approach | Notes |
|----------|-------|
| Sticky CTA moves above keyboard | Use viewport-aware positioning |
| Or collapse CTA while typing | Hide "Continue" until textarea loses focus |
| Prevent scroll jumps | Scroll textarea into view smoothly on focus |

*Implementation note:* Use `window.visualViewport` when available; otherwise fall back to CSS-safe layout and scroll anchoring.

## Accessibility Strategy

### WCAG Level

**Target: WCAG AA** (per PRD requirement)

### Keyboard & Focus

Every interactive element must be keyboard-reachable:

| Element | Keyboard Access |
|---------|-----------------|
| Lock-in button | Tab + Enter/Space |
| Navigation buttons | Tab + Enter |
| Bookmark toggle | Tab + Enter/Space |
| Verse chips | Tab + Enter, arrow keys within group |
| Rating circles | Tab + arrow keys (radiogroup) |
| Textareas | Tab + standard input behavior |

**Focus visibility:** Ensure a visible focus ring on all Scripture Reading controls, matching the app's existing focus style. Do not introduce a new global focus rule unless approved.

### Reduced Motion

`prefers-reduced-motion` applies to **everything**, not just countdown:

| Animation | Normal | Reduced Motion |
|-----------|--------|----------------|
| Countdown numbers | Scale + fade | Static display |
| Phase transitions | Crossfade 200-400ms | Instant swap |
| Partner presence pulse | 2s pulse cycle | No pulse, static |
| Report reveal | Fade in | Instant display |
| Button state changes | Spring animation | Instant |

### Screen Reader Announcements

**Don't over-announce.** Rules:

| Event | Announcement | Throttle |
|-------|--------------|----------|
| Phase change | "Now on verse 5" | Once per change |
| Partner ready | "Jordan is ready" | Once |
| Partner position | "Jordan is viewing response" | Only on verse/response switch |
| Sync status | "Holding your place" | Once on state change |

**Critical rule:** Announce only when the semantic state changes, not when props re-render. This prevents repeated announcements due to state churn.

Use `aria-live="polite"` for all announcements — never `assertive`.

### Touch Target Requirements

Minimum 48×48px hit area for all interactive elements:

| Element | Requirement |
|---------|-------------|
| Lock-in button | Full-width, 56px height |
| Navigation buttons | Full-width or 48px+ height |
| Bookmark icon | Hit area must be 48×48px |
| Verse chips | Must be 48×48px minimum |
| Rating circles | Must be 48×48px each |
| Toggle row | Entire row must be tappable |

Spacing between touch targets: minimum 8px.

### Color Contrast

**Status:** Designed to meet WCAG AA (4.5:1 normal text, 3:1 large text)

**Caveat:** Gradients and glass blur surfaces can reduce contrast. Verify during implementation:
- Muted text (#9B7DB8) on Lavender gradient background
- Text on glass surfaces (white/80% + backdrop blur)
- Disabled/waiting state text

### Input Ergonomics

For reflection textareas:

| Property | Requirement |
|----------|-------------|
| Mobile keyboard hint | `enterKeyHint="done"` |
| Auto-grow | Up to 4 lines visible |
| Resize | Disabled (`resize-none`) |
| Scroll behavior | Smooth scroll into view on focus |

## Testing Strategy

### Responsive Testing

- [ ] 320px wide viewport — smallest supported
- [ ] iPhone 14 Pro (393px) — common size
- [ ] iPad (768px) — tablet layout
- [ ] Desktop (1024px+) — centered constraint

### Accessibility Testing

- [ ] Keyboard-only navigation through entire flow
- [ ] VoiceOver (iOS) / TalkBack (Android) full session
- [ ] `prefers-reduced-motion` enabled — verify no motion
- [ ] OS accessibility contrast settings where available; browser forced-colors if supported
- [ ] Zoom to 200% — verify layout doesn't break
