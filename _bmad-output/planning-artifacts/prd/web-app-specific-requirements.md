# Web App Specific Requirements

Technical requirements specific to this PWA feature, including responsive design, accessibility, performance, and offline behavior.

## Project-Type Overview

Scripture Reading is a **mobile-first PWA feature** within the existing My-Love SPA. Primary use case is intimate settings (bed, couch) on mobile devices, with graceful desktop support for flexibility.

---

## Responsive Design

| Breakpoint | Priority | Design Approach |
|------------|----------|-----------------|
| Mobile (< 768px) | Primary | Full design attention, touch-optimized |
| Tablet (768-1024px) | Secondary | Scale up gracefully |
| Desktop (> 1024px) | Tertiary | Works, not optimized |

**Mobile-First Principles:**
- Touch targets ≥ 44px
- Readable text without zoom
- Bottom-anchored actions (thumb-friendly)
- No hover-dependent interactions

---

## Accessibility Requirements

**Keyboard Navigation:**
- All controls keyboard accessible (Tab order logical)
- Focus visible on all interactive elements
- No keyboard traps

**Screen Reader Support:**
- Rating scale with clear aria-labels: `"Rating 3 of 5: Okay"` with scale context (Struggling → Strong)
- Phase transitions announced
- Partner status changes announced

**Focus Management:**
- On phase transitions, move focus to new screen header or primary action button
- Don't trap focus; allow natural navigation

**Visual Design:**
- No color-only state indicators (Ready/Not Ready, selected rating)
- Use icons, text labels, or patterns alongside color
- Sufficient contrast ratios (WCAG AA minimum)

**Motion:**
- **MUST** respect `prefers-reduced-motion`
- Disable countdown animations and fades if reduced motion enabled
- Provide instant transitions as alternative

---

## Performance Targets

| Metric | Target | Behavior on Failure |
|--------|--------|---------------------|
| Real-time sync latency | < 500ms typical | Show subtle "Syncing..." indicator |
| Phase transition | < 200ms perceived | Fade transition, don't block |
| Initial load | < 2s on 3G | Skeleton loading states |

**Calm UX over aggressive real-time:**
- Prioritize correctness over speed
- If latency spikes, show smooth "syncing..." not UI jitter
- No jarring state jumps

---

## Offline Behavior

**Solo Mode:**
- Optimistic UI with IndexedDB caching (server is source of truth)
- Changes appear instantly, sync in background
- Resume requires connectivity to fetch latest state
- Graceful degradation: show cached data with "Offline" indicator when disconnected

**Together Mode:**

| Scenario | MVP Behavior |
|----------|--------------|
| Partner goes offline | Show "Partner reconnecting..." indicator |
| Offline persists | Pause phase advancement |
| User wants to exit | Allow clean "End session" |
| Convert to solo | Post-MVP (complex shared state) |

**Post-MVP:** Add "Continue solo" option that properly handles shared state conversion.

---

## Browser Support

Inherited from existing My-Love app:
- Modern browsers with ES6 module support
- Chrome, Safari, Firefox, Edge (latest 2 versions)
- iOS Safari, Chrome for Android
- No IE11 support

---

## Implementation Considerations

**State Sync:**
- Server-authoritative for Together mode
- Supabase Broadcast for real-time events
- Reconnection logic with state resync

**Animation:**
- Framer Motion for transitions (existing pattern)
- Subtle, calming animations
- **MUST** respect `prefers-reduced-motion`

**Testing Priorities (MVP):**
1. Mobile viewport testing (primary)
2. Together-mode sync happy path
3. Reconnect recovery scenarios
4. Solo save/resume with caching

---
