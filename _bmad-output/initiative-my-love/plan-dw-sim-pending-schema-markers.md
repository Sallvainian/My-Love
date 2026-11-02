---
title: 'DW-365: sim pending requires the measured record schema markers'
type: 'bugfix'
ticket: ''
created: '2026-11-02'
status: 'built'
baseline_revision: '37b2734eb427634684563a59574087eefcb7006e'
route: 'oneshot'
route_source: 'auto'
risk: 'low'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: []
deferred: []
---

<intent-contract>

## Intent

**Problem:** `scripts/sim-driver/pending.py` maps each pending-notification record from only its identifier, text, thread and trigger keys and never checks `SchemaVersion` or `TriggerRepeatInterval`, so an iOS release that keeps the key names but changes their meaning would decode without error (DW-365; owner decision 2026-11-02: require the markers now).

**Approach:** In the record mapper (`pending()`), require each record's `SchemaVersion` to be the integer 11 (the value measured in the iOS 27 simulator fixture) and `TriggerRepeatInterval` to be 0, raising `Fail` otherwise so the script exits 1 with nothing on stdout and a stderr message naming the record's index and identifier, the key, and the value found — the same path as the decoder's existing unknown-shape failures. A missing or wrongly typed marker fails through the existing `need()` messages. Extend `scripts/sim-driver/test-pending.zsh` with cases for a changed `SchemaVersion`, a non-zero `TriggerRepeatInterval`, and each marker missing; every existing case keeps passing.

</intent-contract>

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/sim-driver/pending.py` -- add the two marker checks to `pending()` after the identifier is read, and note them in the module docstring -- the fix DW-365 asks for
- [ ] `scripts/sim-driver/test-pending.zsh` -- add `check` cases using the existing `edit … set-key` / `drop-key` helpers: `SchemaVersion` 12 and `TriggerRepeatInterval` 60 each exit 1, print nothing, and name the record, the key and the value found; a dropped marker exits 1 naming the key -- proves the refusal without a simulator

**Acceptance Criteria:**
- Given the shipped fixtures, when `zsh scripts/sim-driver/test-pending.zsh` runs, then every case prints `ok` (the 62 existing plus the new ones) and the script exits 0.
- Given a fixture copy whose `probe-yearly` record has `SchemaVersion` 12, when the decoder runs, then it exits 1, stdout is empty, and stderr contains `record 2 (probe-yearly)`, `SchemaVersion` and `12`.
- Given a fixture copy whose `probe-once` record has `TriggerRepeatInterval` 60, when the decoder runs, then it exits 1, stdout is empty, and stderr contains `record 1 (probe-once)`, `TriggerRepeatInterval` and `60`.

## Implementation Notes

Oneshot: about 30 changed lines across two files, both under `scripts/sim-driver/`, with an existing fixture-editing harness to test through.

- Measured before the change with `pending.py --raw` on the fixture: all three records (`probe-interval`, `probe-once`, `probe-yearly`) hold `SchemaVersion` 11 and `TriggerRepeatInterval` 0, both plain ints. Baseline `test-pending.zsh`: 62 `ok`, exit 0.
- `scripts/sim-driver/pending.py`: a `MARKERS` table (`SchemaVersion: 11`, `TriggerRepeatInterval: 0`) beside `DATE_EXTRAS`; `pending()` checks each marker with `need(…, int)` right after the identifier (so a missing or non-numeric marker reuses `need()`'s messages), then raises `Fail("<where>: <key> is <value>, not the measured <expected>")`. The module docstring names the rule.
- `scripts/sim-driver/test-pending.zsh`: six cases — `SchemaVersion` 12 on `probe-yearly`, `TriggerRepeatInterval` 60 on `probe-once`, and for each marker a dropped key and a string value. After: 68 `ok`, exit 0.
- Pyright flags lines in `resolve()` and `trigger_of()` that this change does not touch (pre-existing).

## Plan Change Log

## Review Triage Log

### 2026-11-02 — Review pass
- verdicts: 2 findings — high 0, medium 0, low 2, false 0, maybe-false 0
- findings:
  - `[low]` `[patch]` A marker stored as a plist real (`SchemaVersion` 11.0, `TriggerRepeatInterval` 0.0) passed, because `need(…, int)` accepts floats and `11.0 == 11` — confirmed at `need()` in `pending.py`; patched the marker check to require `type(value) is int`, and added the case `record-real-schema-version` (`SchemaVersion` 11.0 → exit 1, "SchemaVersion is 11.0, not the measured 11").
  - `[low]` `[patch]` The fixture-refresh procedure in `test-pending.zsh` still ended "so nothing else changes", but a refresh from a runtime with other marker values would now fail every decoding case — confirmed in the header; patched the header to say `MARKERS` and the marker cases must be updated to match.

## Verification

**Commands:**
- `zsh scripts/sim-driver/test-pending.zsh` -- expected: every line `ok`, exit 0

## Auto Run Result

Status: built

**Summary:** `sim pending`'s decoder now refuses any pending-notification record whose `SchemaVersion` is not the integer 11 or whose `TriggerRepeatInterval` is not the integer 0, the values measured in the iOS 27 simulator fixture (DW-365). It exits 1, prints nothing on stdout, and stderr names the record's index and identifier, the key and the value found. A missing or non-numeric marker fails through the existing `need()` messages.

**Files changed:**
- `scripts/sim-driver/pending.py` — `MARKERS` table, the marker check in `pending()`, and a docstring line.
- `scripts/sim-driver/test-pending.zsh` — seven marker cases (changed `SchemaVersion`, non-zero `TriggerRepeatInterval`, `SchemaVersion` stored as a real, each marker missing, each marker a string), plus a fixture-refresh note.
- `_bmad-output/initiative-my-love/plan-dw-sim-pending-schema-markers.md` — this plan.

**Review findings:** 2 findings from the quick lens, both `low`, both patched (float marker accepted; stale refresh-procedure line). Nothing deferred, nothing rejected.

**Follow-up review recommended:** false — patched: high 0, medium 0, low 2.

**Verification:** `zsh scripts/sim-driver/test-pending.zsh` — exit 0, 69 `ok`, 0 `FAIL` (62 before the change, so every existing case still passes).

**Residual risks:** The markers are pinned to one measured runtime (iOS 27 simulator). A later runtime that bumps `SchemaVersion` without changing anything else will now be refused until `MARKERS` is re-measured. That is the intended fail-loudly trade-off, and the refresh procedure says so.

