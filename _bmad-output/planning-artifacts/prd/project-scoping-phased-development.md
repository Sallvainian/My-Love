# Project Scoping & Phased Development

Phased delivery strategy from MVP through growth to vision, with explicit risk mitigation.

## MVP Strategy & Philosophy

**MVP Approach:** Experience MVP — deliver the core emotional value (connection, repair, safety) with minimal feature set. Prove the concept works for couples before adding complexity.

**Guiding Principle:** Calm and minimal. Every feature question defaults to "post-MVP" unless essential for core value delivery.

---

## MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- Together Mode — Repair Ritual ✓
- Solo Mode — Quiet Reset ✓
- Reluctant Partner — Graceful Fallback ✓
- Unlinked User — Solo-Only Path ✓
- Time-Constrained — Partial Session (solo) ✓
- Reconnection — Dropped Connection ✓

**Must-Have Capabilities:**

| Capability | Scope |
|------------|-------|
| Overview Page | Basic stats (sessions, steps, avg rating, help count, last completed) |
| Mode Selection | Solo / Together (Together disabled if unlinked) |
| Solo Flow | Full 17 steps, self-paced, resumable with optimistic UI |
| Together Flow | Lobby, roles, countdown, synchronized phases (online-required) |
| Reflections | Rating (1-5), help flag, optional note (200 chars) |
| Daily Prayer Report | Send message (300 chars), view partner's message |
| Save/Resume | Solo only |
| Reconnection | Server-authoritative, rejoin to current phase |
| Accessibility | Keyboard nav, aria labels, focus management, reduced motion |

**Network Requirements:**
- **Solo Mode:** Online-required with optimistic UI; IndexedDB provides read caching for performance
- **Together Mode:** Online-required; if either partner offline, show "Reconnecting..." + pause; allow clean "End session"

**Explicitly NOT in MVP:**

| Feature | Reason |
|---------|--------|
| Streak tracking | Avoid pressure |
| Push notifications | Keep calm |
| Partner invite/ping from lobby | Keep passive |
| "Did this help?" prompt | Per-step reflection is enough |
| Convert Together → Solo mid-session | Complex state handling |
| Admin UI | Direct Supabase management |
| Multiple scripture sets | One fixed set first |
| Detailed analytics/trends | Basic stats sufficient |

---

## Phase 2: Growth (Post-MVP)

| Feature | Value |
|---------|-------|
| Partner invite nudge from lobby | Gentle ping option |
| "Did this help you feel closer?" prompt | Aggregate quality signal |
| Convert Together → Solo | Handle interrupted sessions |
| Reflection history view | See past sessions privately |
| Additional scripture sets | Topical variations |

---

## Phase 3: Expansion (Vision)

| Feature | Value |
|---------|-------|
| Admin UI for content | Non-technical content management |
| Custom scripture sets | User-curated readings |
| Scheduled sessions | "Every Sunday at 8pm" |
| Gentle nudges | "It's been a week..." |
| Mood integration | Correlate with mood tracking |
| Multiple activity types | Scripture Reading is first of many |
| Couples devotional partnerships | Content expansion |

---

## Risk Mitigation Strategy

**Technical Risks:**

| Risk | Mitigation |
|------|------------|
| Real-time sync complexity | Server-authoritative state; simple broadcast events |
| State machine bugs | Clear phase transitions; extensive Together-mode testing |
| Offline/online edge cases | Solo = optimistic UI with caching; Together = online-required |

**Market Risks:**

| Risk | Mitigation |
|------|------------|
| Couples don't use it | Start with existing My-Love users; low friction |
| Too religious for some | Framing as "connection ritual" not "Bible study" |
| Too basic | Core emotional value first; features follow |

**Resource Risks:**

| Risk | Mitigation |
|------|------------|
| Scope creep | Strict "post-MVP" default for all new ideas |
| Testing coverage | Prioritized: mobile, sync, reconnect, offline |
| Implementation time | Together-mode is bulk of complexity; solo is simpler |

---
