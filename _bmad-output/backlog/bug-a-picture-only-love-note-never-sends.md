---
id: 3
type: bug
title: "A love note with only a picture never sends, though the composer clears as if it had"
parent:
covers: []
after: []
refined: false
hitl: false
risk: medium
severity: P1
---

# A love note with only a picture never sends, though the composer clears as if it had

## Description

In Love Notes, sending a picture with no text looks like it worked: the phone vibrates and the composer clears. The note never reaches the server. It shows as failed, Retry fails the same way, and the partner gets neither the note nor its push. A picture sent on its own should arrive like any other note, and its push should say a picture was sent (epic-push-notifications R7).

## Reproduction

Found in story 3.10 (ledger DW-363); held on production in story 3.11.

1. Sign in on the website or the shell and open Love Notes.
2. Attach a picture, type nothing, and send.
3. Actual: the composer clears with the success vibration, the note is marked failed, and the page banner reads "Some values are not allowed - check length and format limits". Retry fails with the same message. The partner receives nothing.
4. Expected: the note and its picture arrive for the partner, and the partner's push reads "Sent you a picture".

On the local stack on 2026-11-01, a rolled-back insert of an empty `content` with an `image_url` failed `love_notes_content_check` with 23514. The hosted constraint is the same: `char_length(content) >= 1 AND <= 1000` (story 3.11).

## Cause Hypothesis

The app sends an empty string as the note's text beside the picture, and `love_notes_content_check` (from the 2025 schema) rejects any note shorter than one character. The send path treats the refusal as a failed note without throwing, so the composer's success handling runs anyway. Retry resends the same empty text.

## Acceptance Criteria

1. **A picture-only note arrives**
   **Given** a signed-in partner in Love Notes with a picture attached and no text
   **When** they send it
   **Then** the note and its picture show in both partners' threads, the partner's shell shows the push "Sent you a picture", and nothing is marked failed
2. **A refused send does not look like a success**
   **Given** a note the server refuses for any reason
   **When** it is sent
   **Then** the composer keeps its text and picture and gives no success vibration
3. **Tests cover the condition found and fixed**
   **Given** the test suite
   **When** it runs
   **Then** a test that fails on the defect and passes on the fix sends a picture-only note through the app, and one covers each related case the fix touched
4. **Or: no change is needed, with proof**
   **Given** the reproduction
   **When** it is run on the current code
   **Then** the expected behavior already holds, or the report was mistaken, with the evidence recorded in Notes — this supersedes 1, 2 and 3

## References

- parent — none
- epic — _bmad-output/initiative-my-love/tickets/epic-push-notifications/epic-push-notifications.md, Requirements R7
- ledger — _bmad-output/initiative-my-love/deferred-work.md, DW-363
- plan — _bmad-output/initiative-my-love/tickets/epic-push-notifications/tickets/story-push-ships-to-the-owner-s-iphone-plan.md, Found

## Notes

- Decision: 2026-11-01 recorded as a high-priority bug when epic-push-notifications closed; the owner set severity P1, though typing a caption works around it.
- Assumption: risk medium: the fix touches the note-send path and either the love-notes schema or what the partner sees as the note's text.
- Open question: allow empty text when a picture is attached (a migration, plus `love_notes_visible` and every reader of `content`), or have the app send stand-in text, which the push sender would then show as the note's text? Answered in this bug's work.
