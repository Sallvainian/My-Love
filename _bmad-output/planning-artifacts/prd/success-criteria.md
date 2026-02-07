# Success Criteria

This section defines how we measure success across user experience, business outcomes, and technical performance.

## North Star

Create a calm, "safe-to-be-honest" couples ritual that turns Scripture into a shared moment of connection + repair. The feature succeeds when it helps couples soften toward each other, communicate better (especially after conflict), and build trust through repeated, gentle practice.

---

## User Success

**Emotional Safety & Connection**
- Couples feel closer after a session (even if nothing is "solved")
- Partners can be vulnerable without it escalating into conflict
- The experience feels special, peaceful, and supportive — not clinical or gamified

**Practical Relationship Impact**
- Helps reset tone (less yelling, sarcasm, silent treatment)
- Provides a structured way to "repair" after conflict
- Makes it easier to ask for help or say "I'm sensitive here" without shame

**Spiritual Impact**
- Couples consistently pray/read together (or solo when needed) and feel grounded
- Reflections show growth over time (ratings improve), but the system never pressures

---

## Business Success

**Engagement Targets**

| Metric | Target | Notes |
|--------|--------|-------|
| Meaningful completion rate | ≥85% complete 10+ steps | Primary metric — prevents "homework" feeling |
| Full completion rate | ≥60-70% complete all 17 | Secondary metric |
| Together mode adoption | 25-40% of sessions | Trust signal, not a failure if lower |
| Together used at least once | Per couple in 30 days | Indicates willingness to connect |
| 7-day return rate | ≥50% | Habit forming |
| 30-day retention | ≥30% | Sustained value |

**Connection Signals**

| Metric | Target | Interpretation |
|--------|--------|----------------|
| "Help/sensitive" flag usage | 15-40% of sessions | Shows safety to be vulnerable (not a failure metric) |
| Prayer report messages sent | ≥30% of sessions | Soft bridge being used |
| Both reflections submitted (Together) | ≥90% | Sync working, both engaged |

**Quality (Post-MVP)**
- End-of-session prompt: "Did this help you feel closer?" (Yes/Somewhat/No)
- Stored privately per user, used for aggregate health signals only
- *Deferred to Post-MVP to keep MVP minimal; per-step reflections sufficient initially*

---

## Technical Success

| Requirement | Target | Rationale |
|-------------|--------|-----------|
| Real-time sync latency | <500ms | Together mode feels instant |
| Session state recovery | 100% | Reconnects resume correctly |
| Offline resilience | Cached data viewable; writes require connectivity | Graceful degradation with optimistic UI |
| Race condition prevention | Zero double-advances | Server-authoritative state |
| Data sync reliability | 99.9% | No lost reflections |

---

## Measurable Outcomes

**At 1 Month:**
- Feature adopted by active couples
- Session completion rates meet targets
- Together mode used at least once by majority

**At 3 Months:**
- Sustained weekly usage (2-4x/week pattern)
- "Help" flag usage normalizes (indicates established safety)
- Prayer report messages showing meaningful content

**At 6 Months:**
- Couples report improved communication (qualitative feedback)
- Reflection ratings show gradual positive trend
- Feature becomes part of regular relationship maintenance

---
