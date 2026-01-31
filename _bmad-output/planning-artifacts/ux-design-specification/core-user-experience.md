# Core User Experience

## Platform Strategy

| Aspect | Decision | Rationale |
|--------|----------|-----------|
| **Primary Platform** | Mobile PWA | Intimate settings (bed, couch) demand mobile-first |
| **Interaction Model** | Touch-first | Bottom-anchored actions, thumb-friendly targets |
| **Offline Resilience** | Cached data viewable; writes require connectivity | Graceful degradation with optimistic UI |
| **Together Mode** | Online-required | Real-time sync requires network |
| **Desktop** | Works but not optimized | Secondary use case |

**Technical Integration:**
- Zustand state (new scriptureReadingSlice)
- Supabase Broadcast for real-time sync
- IndexedDB for read caching and optimistic UI (server is source of truth)
- Framer Motion animations with `prefers-reduced-motion` support

## Effortless Interactions

**Natural & Automatic:**
- Phase progression updates instantly across devices without jarring transitions
- Reflection submission requires no confirmation dialogs
- Solo progress saves continuously without explicit action
- Online sync happens silently in background
- Reconnection restores Together mode to current phase automatically
- Focus management moves appropriately after phase transitions

**Pain Points We Avoid:**
- Slow or unreliable sync
- Excessive confirmation dialogs
- Unexpected progress loss
- Broken reconnection flows

## Critical Success Moments

| Moment | Experience | Stakes |
|--------|------------|--------|
| **First countdown** | Both ready, 3...2...1 appears together | The "together" magic is established |
| **First lock-in** | Both tap "Ready for next verse" | Trust in sync is built |
| **Bookmark flag** | User marks a verse that matters | Personal reflection is supported |
| **Daily Prayer Report reveal** | Session ends, messages revealed | Emotional payoff is delivered |
| **Resume after interruption** | User returns, picks up seamlessly | Trust in reliability is maintained |

## Experience Principles

1. **Calm Over Engagement** — Never gamify, pressure, or guilt. The UI is a quiet sanctuary, not a productivity app.

2. **Synchronized Intimacy** — Together mode feels like being in the same room. Phase transitions are smooth, waiting feels purposeful.

3. **Invisible Reliability** — Optimistic UI, background sync, reconnection just work. Users never think about them. Cached data available when offline; writes sync when connectivity returns.

4. **Vulnerability is Invited, Not Demanded** — Bookmarks, notes, and reflections are invitations. Nothing required. Nothing judged.

5. **Mobile-First, Touch-Native** — Every interaction designed for thumbs on a phone. Bottom-anchored actions, generous touch targets.
