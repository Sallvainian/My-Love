---
id: SPEC-security-remediation
companions:
  - remediation.md
  - rollout.md
  - ../../../AGENTS.md
sources:
  - ../../../CLAUDE-SECURITY-20260912-132643/SECURITY-REPORT.md
---

> **Canonical contract.** This SPEC and its companions contain the requirements for implementation and verification. The source report is retained for traceability; downstream work does not depend on its presence.

# Security Remediation

## Why

The September 12 security report identifies credential exposure, unauthorized couple communication, shared-device data leaks and integrity/availability defects in My Love. Close the ten findings outside scripture reading while preserving legitimate couple interactions. Sallvain excluded the seven scripture findings on September 12 because the feature is planned for removal separately; exclusion is not evidence of remediation.

## Capabilities

- **CAP-1** (F1)
  - **intent:** Invalidate the exposed bot credential and keep replacement credentials out of published source.
  - **success:** The old password no longer authenticates, replacement bot access works through the approved secret mechanism, and a fresh database setup contains no hardcoded live credential.

- **CAP-2** (F2)
  - **intent:** Keep love-note broadcasts private to their intended couple and reject forged note data.
  - **success:** An unrelated client cannot receive or inject notes; mismatched sender/recipient data and untrusted image previews never enter the chat; legitimate text and image notes still arrive.

- **CAP-3** (F3)
  - **intent:** Keep mood broadcasts private to their intended couple and safe to render.
  - **success:** Unrelated clients cannot receive or inject moods; malformed payloads are ignored without toasts or render failures; linked partners still receive valid updates.

- **CAP-4** (F4)
  - **intent:** Allow pokes and kisses only between linked partners.
  - **success:** Direct inserts targeting self or an unrelated account fail; valid partner interactions arrive once; non-partner incoming rows do not alter the feed or badge.

- **CAP-5** (F5)
  - **intent:** Preserve interaction authorship and content after creation.
  - **success:** A recipient can mark an interaction viewed but cannot change its sender, recipient, type or other immutable identity/content fields through the Data API.

- **CAP-8** (F8)
  - **intent:** Keep custom messages isolated to the account that owns them.
  - **success:** On a shared browser, account B cannot list, rotate, read by id, modify, delete or export A's custom messages; imports belong to the signed-in account and delayed work cannot cross accounts.

- **CAP-9** (F9)
  - **intent:** Keep editable profile names separate from the login identity.
  - **success:** Profile names can be changed without an auth metadata write and survive later auth updates; clients cannot change the email mirror; signup, setup gating and name displays remain correct.

- **CAP-10** (F10)
  - **intent:** Bound upload request memory before an oversized body is buffered.
  - **success:** The Edge Function rejects over-limit bodies during streaming with 413 and cancels reading without a Storage write; supported uploads at or below the existing 5 MiB cap still succeed.

- **CAP-12** (F12)
  - **intent:** Keep photo upload and deletion continuations within their originating account.
  - **success:** After A switches to B during a pending success, failure or retry, A's continuation changes none of B's gallery, error or loading state.

- **CAP-13** (F13)
  - **intent:** Accept authentication redirects only for a flow initiated in that browser.
  - **success:** A link carrying an attacker's complete implicit token set cannot establish or replace the user's session; supported password login, signup and Google OAuth still work with PKCE callbacks.

## Constraints

- Treat the report as source-reviewed evidence. Recheck each affected boundary against the current code and latest migration definitions; establish regression evidence before marking a finding closed.
- Enforce authorization and integrity at the server or account-scoped persistence boundary. UI filtering and payload identity claims cannot substitute for that boundary.
- Preserve the F9 product decision: editable profile names, an auth-owned email mirror and the existing partner-link protections; no email-change feature.
- Preserve legitimate delivery, offline custom messages, upload retries and account switching. Finding-specific invariants and tests are in `remediation.md`.
- Follow the adopted `AGENTS.md`, including secret handling, migration-plan approval, centralized IndexedDB upgrades, generated types, Realtime lifecycle management and account-state resets.
- Scripture exclusion depends on separate removal of its app surface, database objects and local cached data; hiding its screen is insufficient. Recheck shared references if that removal changes the implementation baseline.
- Implement through bmad-loop using the agreed story queue. Keep operational work open until its verification evidence exists, as specified in `rollout.md`.

## Non-goals

- F6, F7, F11 and F14–F17; scripture removal itself; or repairs to the excluded scripture flows.
- Reopening rejected report claims, completing the unfinished audit, repository hygiene cleanup or redesigning authentication/token storage.
- Git-history rewriting, additional admin roles, a new profile/email-change feature or unrelated async-store cleanup.

## Success signal

Each in-scope finding has a regression test or recorded operational demonstration showing that its reported failure is prevented, with the legitimate counterpart still working. Required local checks pass, and credential rotation, deployment and hosted verification are recorded before the corresponding finding is called closed.

## Assumptions

- Ownerless legacy custom messages remain stored but are hidden from all ordinary account operations; they are never assigned to whichever account next signs in. Recovery or deletion is outside this change.
- The upload endpoint follows the report's strict Content-Length precheck. If real browser/gateway traffic omits it, a bounded-stream-only compatibility exception needs to be recorded before accepting such requests.
- Reject the unused multipart upload format; allow only locally created image previews, discarding preview URLs from broadcasts.
