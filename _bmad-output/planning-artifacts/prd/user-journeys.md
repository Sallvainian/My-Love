# User Journeys

Six narrative scenarios illustrating how different users interact with Scripture Reading across various contexts and edge cases.

## Journey 1: Together Mode — The Repair Ritual

**Persona:** Maya & Jordan, married 4 years

**Opening Scene:**
It's 9:30pm. Maya and Jordan had a tense evening — a disagreement about household responsibilities that left them both quiet at dinner. They're in bed now, phones in hand, the silence heavy. Maya opens My-Love and sees the Scripture Reading feature. She's not sure Jordan will want to, but she taps "Start."

**Rising Action:**
Maya chooses "Together" and "Reader." A gentle prompt appears: *"Waiting for Jordan to join..."* She shows Jordan her phone. He sighs, but opens the app. He sees the invite, chooses "Responder," and joins the lobby. Both tap "Ready." A soft 3...2...1 countdown appears.

The first verse loads: *"He heals the brokenhearted and binds up their wounds."* Maya reads it aloud. Jordan hears her voice crack slightly. He taps "Done" when ready.

The response appears on Jordan's screen: *"Heal what we've wounded—bind up what's torn between us."* He reads it quietly. Something shifts in the room.

**Climax:**
At the reflection screen, Maya rates herself a 3 (struggling) and toggles "I'm sensitive to this." She doesn't write a note — she doesn't need to. The system doesn't judge. Jordan sees his own reflection screen. He rates 4, no flag. They both submit. Step 2 loads.

By step 10, they're both crying a little. Not solved, but softened.

**Resolution:**
At the end, Maya writes in her Daily Prayer Report: *"I'm sorry I got sharp tonight. Thank you for doing this with me."* Jordan writes: *"I love you. Let's try again tomorrow."*

They put their phones down and finally talk — gently this time.

**Capabilities Revealed:**
- Together mode lobby + ready states + countdown
- Role-based screens (Reader/Responder)
- Synchronized phase advancement
- Reflection with rating + help flag
- Daily Prayer Report messaging

---

## Journey 2: Solo Mode — The Quiet Reset

**Persona:** David, in a long-distance relationship

**Opening Scene:**
David's partner Ana is traveling for work, three time zones away. It's late, and David feels disconnected — they've been texting less, and he's anxious. He opens My-Love and taps "Scripture Reading." Ana isn't available, so he chooses "Solo."

**Rising Action:**
The first verse appears: *"The LORD is near to those who have a broken heart..."* David reads it slowly. The response follows: *"Draw near to us. Break our pride, soften our hearts, and rescue what's hurting."* He taps "Continue."

At the reflection, he rates 3 and toggles "I'm sensitive to this." He writes a short note: *"Missing her. Feeling far."*

He moves through the steps at his own pace — some quickly, some slowly. The app doesn't rush him.

**Climax:**
At step 11 (*"Be anxious for nothing..."*), something clicks. He feels his shoulders drop. He's still far from Ana, but he's grounded.

**Resolution:**
At the end, he writes a message for the Daily Prayer Report: *"Did this tonight thinking of you. Step 11 hit me. Love you."*

Ana sees it the next morning. She texts: *"I saw your prayer report. That means so much. Let's do it together when I'm back."*

**Capabilities Revealed:**
- Solo mode full flow
- Asynchronous Daily Prayer Report (partner sees later)
- Self-paced step progression
- Save & Exit / Resume (solo only)
- Optimistic UI with caching

---

## Journey 3: Reluctant Partner — The Graceful Fallback

**Persona:** Sam, whose partner Alex is exhausted

**Opening Scene:**
Sam opens Scripture Reading and chooses "Together." Alex is on the couch, half-asleep. Sam shows the invite. Alex mumbles, "Not tonight, babe. I'm wiped."

**Rising Action:**
Sam's in the lobby alone. The screen says: *"Waiting for your partner..."* with a gentle animation. Sam waits a moment, then sees the option: **"Continue solo"** — no guilt, no "Alex didn't join" shame.

Sam taps it. The app smoothly transitions to Solo mode. Sam completes the session alone.

**Climax:**
At the end, Sam still has the option to send a Daily Prayer Report message. Sam writes: *"Did this solo tonight. Just wanted you to know I'm thinking about us. No pressure."*

**Resolution:**
Alex wakes up the next morning and sees the report. It's not an accusation — it's an invitation. Alex texts: *"Thank you for doing that. Let's try together tomorrow."*

**Capabilities Revealed:**
- Lobby fallback to solo (no shame language)
- Daily Prayer Report still generated in solo
- Invitation without pressure
- Neutral copy: "Continue solo" / "Try together later"

---

## Journey 4: Unlinked User — The Solo-Only Path

**Persona:** Chris, newly signed up, partner not linked yet

**Opening Scene:**
Chris just installed My-Love but hasn't completed partner linking. They explore the app and find Scripture Reading. They tap "Start."

**Rising Action:**
The mode selection appears, but "Together" is grayed out with a message: *"Link your partner to do this together."* There's a small "Set up partner" link, but no pressure.

Chris taps "Solo" and begins the session.

**Climax:**
Chris completes the reading alone. At the end, the Daily Prayer Report message step is skipped (no partner to send to), but their reflections are still saved.

**Resolution:**
Later, Chris links their partner. The next time they start, Together mode is available. Their previous solo session stats are preserved.

**Capabilities Revealed:**
- Graceful degradation when partner_id is null
- Together mode disabled with clear explanation
- Solo mode fully functional
- Skip "send message" for unlinked users
- Stats persist across partner linking

---

## Journey 5: Time-Constrained — The Partial Session

**Persona:** Priya, interrupted mid-session

**Opening Scene:**
Priya starts a solo session at lunch break. She gets through 7 steps when her meeting reminder pops up. She needs to stop.

**Rising Action:**
Priya taps the exit button. A prompt appears: *"Save your progress? You can continue later."* She taps "Save & Exit."

**Climax:**
That evening, Priya opens Scripture Reading again. The Overview shows: *"Continue where you left off? (Step 8 of 17)"* She taps "Continue" and resumes.

**Resolution:**
She finishes the remaining 10 steps and completes her Daily Prayer Report. The session is marked complete. Her stats reflect one full session.

**Capabilities Revealed:**
- Partial session save/resume (Solo mode only in MVP)
- Progress indicator on Overview
- Resume prompt on return
- Session marked complete only when step 17 reflections submitted

---

## Journey 6: Reconnection — The Dropped Connection

**Persona:** Mia, whose phone loses signal mid-Together session

**Opening Scene:**
Mia and her partner Eli are in Together mode, on step 9. Mia's phone loses signal (elevator, tunnel, bad wifi). Her screen freezes.

**Rising Action:**
When Mia's connection returns, the app doesn't crash or reset. It shows: *"Reconnecting..."* briefly, then resyncs with the server-authoritative state.

The screen shows she's still on step 9, Reflection phase. Eli has already submitted. Mia submits hers.

**Climax:**
The session resumes seamlessly. They finish the remaining steps together.

**Resolution:**
At the end, neither knows there was a hiccup. The Daily Prayer Report shows all reflections intact.

**Capabilities Revealed:**
- Server-authoritative session state
- Reconnection without data loss
- Best-effort rejoin to current phase (Together mode)
- If partner ends session, it ends cleanly

---
