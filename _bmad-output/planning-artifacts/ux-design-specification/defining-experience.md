# Defining Experience

## The Core Interaction

**Scripture Reading in one sentence:** *"A shared prompter for couples reading scripture aloud together."*

Partners are **hearing each other** — either on a phone call or in the same room. The app serves as a synchronized reading guide that shows what to read, who reads it, and ensures both partners progress together.

**The defining moment:** Both partners tap "Ready," the 3-2-1 countdown completes, and the first verse appears on both screens simultaneously. They're reading together.

## User Mental Model

**How users think about this:**
- "It's like a shared teleprompter for our devotional"
- "It's karaoke but for scripture — shows us the words, we read aloud"
- "It keeps us on the same page, literally"

**What they bring from other experiences:**
- Shared screen experiences (watching together, video calls)
- Turn-based conversation (one speaks, one listens)
- Physical Bible reading together (but now works when apart)

**Where confusion could happen:**
- "Whose turn is it?" → Role indicator must be clear
- "Where is my partner?" → Position indicator shows what screen they're on
- "Can I go back?" → Free navigation within each step, clear affordance

## Session Flow (Free Navigation with Lock-In)

**1. Lobby & Start**
- Both partners enter lobby
- Both tap "Ready"
- 3-2-1 countdown → Session begins

**2. Per-Verse Flow (repeated 17 times)**

```
┌─────────────────────────────────────────────────────────────┐
│                     VERSE STEP N                            │
├─────────────────────────────────────────────────────────────┤
│  Both see: Verse text                                       │
│  Reader indicator: "You read this" / "Partner reads this"   │
│                                                             │
│  [Bookmark flag] - tap to mark "this matters to me"         │
│                                                             │
│  ← Back    [View Response →]                                │
├─────────────────────────────────────────────────────────────┤
│  Both see: Response text                                    │
│  Responder indicator: "You respond" / "Partner responds"    │
│                                                             │
│  [← Back to Verse]                                          │
├─────────────────────────────────────────────────────────────┤
│  Partner position: "Jordan is viewing the response"         │
│                                                             │
│  [Ready for next verse]  ← Both must lock in to proceed     │
└─────────────────────────────────────────────────────────────┘
```

**Free navigation rules:**
- Either partner can move between verse ↔ response freely
- Partner position indicator shows where they are (subtle)
- "Ready for next verse" button available on either screen
- Both must tap "Ready" to advance — can't skip ahead alone
- Roles alternate: Reader on verse N becomes Responder on verse N+1

**3. End-of-Session Reflection**

After verse 17, both enter reflection phase:

| Element | Description |
|---------|-------------|
| **Bookmarked verses** | Show list of verses user flagged during session |
| **"Which verse stood out?"** | Select from all 17 (bookmarked ones highlighted) |
| **Session rating** | 1-5 scale — "How meaningful was this session?" |
| **Optional note** | Free text reflection |
| **Message to partner** | "Write something for [Name]" |

**4. Daily Prayer Report**

Both submit → Report reveals:
- Partner's message (unveiled)
- Which verse they selected as standout
- Their session rating (side-by-side)
- Which verses they bookmarked (if they opted to share)

## Bookmark Flag (Per-Verse)

**Purpose:** Personal reminder during session — "this one matters to me."

**UX:**
- Small flag/bookmark icon on verse screen
- Tap to toggle (filled = bookmarked)
- No confirmation, instant toggle
- Bookmarked verses highlighted in reflection phase

**Language:**
- Simple bookmark icon (no label needed)
- At reflection: "Verses you marked" with list

**Bookmark Privacy Rule:**
- Bookmarks are **private by default** (partner cannot see during session)
- At reflection time: Single global toggle — "Share the verses you marked in today's report? (optional)"
- In Daily Prayer Report: Only show partner's bookmarks if they opted in
- Rationale: "Exposure" is an avoided emotion. Private-by-default with opt-in aligns with "safe" principle.
- MVP scope: One toggle for all bookmarks (not per-verse sharing)

## Lock-In Mechanism

**The "both must confirm" pattern:**

This ensures synchronized progression without allowing one partner to rush ahead.

**States:**
1. Neither locked in → Button shows "Ready for next verse"
2. You locked in, partner hasn't → Button shows "You're ready ✓ (tap to undo)" (secondary style, tappable) + Secondary line: "We'll continue when you're both ready"
3. Both locked in → Auto-advance to next verse with brief transition

**Why it works:**
- Prevents rushing
- Creates natural pause points for conversation
- Both actively choose to move forward together
- Reinforces "we're doing this together" feeling

## Success Criteria

| Criterion | What it means |
|-----------|---------------|
| **"Same page"** | Both partners always know where the other is |
| **"Natural pace"** | Free to re-read, no rushing, lock-in prevents skipping |
| **"Clear turns"** | Role indicators remove "whose turn?" confusion |
| **"Together"** | Lock-in mechanism ensures synchronized progression |
| **"Remembered"** | Bookmarks resurface at reflection, nothing lost |
