# Non-Functional Requirements

*Quality attributes specifying HOW WELL the system must perform.*

## Performance

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-P1:** Real-time sync latency | < 500ms typical | Together mode phase sync |
| **NFR-P2:** Phase transition perceived speed | < 200ms | No blocking, use fade transitions |
| **NFR-P3:** Initial feature load time | < 2s on 3G | Skeleton loading states |
| **NFR-P4:** UI responsiveness under latency | Show "Syncing..." indicator | No UI jitter or jarring state jumps |

**Principle:** Calm UX over aggressive real-time. Prioritize correctness over speed.

---

## Security & Privacy

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-S1:** Reflection data access | User + linked partner only | RLS policies consistent with existing model |
| **NFR-S2:** Session data access | Participants only | No external visibility |
| **NFR-S3:** Daily Prayer Report visibility | Sender + recipient only | Private couple communication |
| **NFR-S4:** Data encryption | At rest and in transit | Supabase default + HTTPS |
| **NFR-S5:** Prior solo data privacy | Private by default after partner linking | Only explicit messages shared retroactively; reflections remain private |

---

## Reliability

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-R1:** Session state recovery | 100% | Reconnects resume correctly |
| **NFR-R2:** Data sync reliability | 99.9% | No lost reflections |
| **NFR-R3:** Race condition prevention | Zero double-advances | Server-authoritative state |
| **NFR-R4:** Cache integrity | 100% | IndexedDB cache persists; on corruption, clear and refetch from server |
| **NFR-R5:** Graceful degradation | Feature remains usable | If partner offline, allow clean exit |
| **NFR-R6:** Reflection write idempotency | Unique constraint per session_id + step_index + user_id | No double submits under retries/reconnect |

---

## Accessibility

*Detailed in Functional Requirements (FR50-FR54). Summary:*

| Requirement | Target |
|-------------|--------|
| **NFR-A1:** WCAG compliance | AA minimum |
| **NFR-A2:** Keyboard navigation | Full feature access |
| **NFR-A3:** Screen reader support | All interactive elements labeled |
| **NFR-A4:** Motion sensitivity | Respect `prefers-reduced-motion` |
| **NFR-A5:** Color independence | No color-only indicators |

---

## Integration

| Requirement | Target | Context |
|-------------|--------|---------|
| **NFR-I1:** Supabase compatibility | Full compatibility with existing patterns | Auth, RLS, Realtime Broadcast |
| **NFR-I2:** Existing app integration | Seamless navigation | Use existing ViewType pattern |
| **NFR-I3:** Caching pattern | Consistent with existing services | IndexedDB for read caching |
| **NFR-I4:** State management pattern | Zustand slice composition | Consistent with existing slices |

---

*Scalability: Not a priority for MVP. Couples app with gradual growth. Standard Supabase scaling sufficient.*

---
