# MVP Constraints (Lock-Ins from Journeys)

Hard constraints derived from user journey requirements that shape implementation decisions.

1. **Save & Resume:** Solo mode only in MVP. Together mode uses best-effort rejoin to current authoritative phase; if partner ends session, it ends cleanly.

2. **Together Mode Invites:** No push notifications in MVP. Lobby presence only + optional in-app "Send invite" nudge (passive).

3. **Daily Prayer Report:**
   - Solo mode: Partner receives asynchronously (if linked)
   - Unlinked mode: Skip "send message" step entirely; reflections still saved

4. **No-Shame Copy:** All "partner didn't join" or "continue solo" messaging must be neutral and gentle.

5. **Completion Definition:** Session counts as "completed" only when step 17 reflections are submitted. Otherwise status is "in_progress" and resumable (solo).

---
