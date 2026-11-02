---
title: 'The simulator driver lists an app''s scheduled reminders'
type: 'feature'
ticket: '7'
created: '2026-11-01'
status: done
baseline_revision: '58da06ce37c6e7e4a0dc826e8b468cbbad484034'
route: 'full'
route_source: 'auto'
risk: 'high'
review: 'thorough'
review_source: 'pinned'
lenses_ran: [blind-hunter, edge-case-hunter, verification-gap, intent-alignment]
review_loop_iteration: 0
followup_review_recommended: false
context: []
warnings: [oversized]
deferred:
  - summary: >-
      pending.py checks no record-level schema marker (SchemaVersion, TriggerRepeatInterval and about 55 other keys), so an iOS release that keeps the key names but changes their meaning would decode without error.
    evidence: |-
      maybe-false. The fixture records carry SchemaVersion 11 and TriggerRepeatInterval 0, and the mapper reads neither. Whether any iOS release changes a key's meaning while keeping its name is unverified. To settle it, decode a pending archive from a later simulator runtime and compare its keys and values against the fixture.
    location: >-
      scripts/sim-driver/pending.py (pending, trigger_of)
    severity: medium (unverified)
  - summary: >-
      The AGENTS.md sim-driver sentence on schedule/unschedule omits two side effects later stories will hit: both launch the host and bring it to the front, and `sim permission reset --host` uninstalls the host and wipes its pending requests.
    evidence: |-
      host_apply runs `xcrun simctl launch --terminate-running-process` on the host, and cmd_permission reset runs `simctl uninstall`. Both facts are in `sim help` and the plan's Implementation Notes, but not in AGENTS.md. The fix edits AGENTS.md, so it is deferred.
    location: >-
      AGENTS.md (Maintained by hand, sim-driver paragraph)
    severity: low
  - summary: >-
      The AGENTS.md sentence on `sim schedule` does not say the host needs `sim permission allow --host` first, so a later story's first schedule exits 1 and has to be rerun.
    evidence: |-
      host_apply dies with "the host has no notification permission: run sim permission allow --host" when the host's result file reads "not authorized", and `sim help` says so, but AGENTS.md's sim-driver paragraph does not. The fix edits AGENTS.md, so it is deferred.
    location: >-
      AGENTS.md (Maintained by hand, sim-driver paragraph)
    severity: low
---

<intent-contract>

## Intent

**Problem:** Stories 4.1, 4.6, 4.2 and 4.3 must check, with no person, which date reminders the shell has scheduled on the simulator, and the driver (`scripts/sim-driver/sim`) has no way to read an app's pending local notifications.

**Approach:** Add `sim pending`, which decodes the simulator's `UserNotifications/<folder>/PendingNotifications.plist` (NSKeyedArchiver; `Library.plist` maps bundle id → folder) into one JSON line, and give the driver's host app (`dev.sallvain.simdriver.runner`) a way to schedule and remove requests on command (`sim schedule FILE`, `sim unschedule ID…`), so the reader is proven against an interval, a one-off dated 9:00 and a yearly repeating 9:00 request it scheduled itself.

## Boundaries & Constraints

**Always:**
- Output of `sim pending` on stdout is exactly one JSON line: an array, sorted by identifier, of `{"identifier","title","body","threadId","trigger"}`; `trigger` is `{"type":"calendar","dateComponents":{…only the components set…},"repeats":bool}` or `{"type":"interval","seconds":number,"repeats":bool}`. Progress and notes go to stderr (`say`), as elsewhere in `sim`.
- The reader fails loudly (non-zero exit, stderr names the record and the missing key or unknown trigger class) on any record whose shape it does not recognise — never prints a partial or guessed record, because the archive format is private and can change between iOS releases.
- The device's data folder comes from `xcrun simctl list devices -j` (`dataPath`) for the resolved UDID, not a hand-built `~/Library/...` path.
- `sim schedule` / `sim unschedule` act on the host app only and return only once `sim pending --host` shows the change (poll with a timeout), so a following `sim pending` is consistent; a host that lacks notification permission exits non-zero with a hint to run `sim permission allow --host`.
- Python for the decoder (`plistlib` reads binary plists and `UID`s), run as `python3 -I` like `SERVE_PY`; no new npm or pip dependency.
- Match surrounding style by hand in every file (comments explain why; zsh idioms as in `sim`); never run Prettier.

**Never:**
- No change to the shell (`ios/`, `src/`), its build, or `capacitor.config.ts`; no push-related behaviour change to existing `sim` commands.
- No XCUITest step for scheduling or reading — the host is launched with `xcrun simctl launch` and `SIMCTL_CHILD_*` environment.
- No real names, emails or personal data in fixtures; titles/bodies are made-up test strings.
- No work on the reminder planner itself (stories 4.1+).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Three requests | host scheduled interval, one-off 9:00 on a date, yearly 9:00 | 3 entries with the scheduled identifier, title, body, threadId and trigger values | none |
| One removed | `sim unschedule probe-once` after the above | the other 2 entries only | none |
| App never registered | bundle absent from `Library.plist` | `[]` on stdout, stderr note naming the bundle | exit 0 |
| Folder but no pending file / empty archive | all requests removed, or none ever scheduled | `[]` | exit 0 |
| Unknown record shape | archived record lacks an expected key, or trigger class unrecognised | nothing on stdout | exit 1, stderr names key/class |
| Host without permission | `sim schedule` before `sim permission allow --host` | nothing scheduled | exit 1 with the permission hint |
| Bad schedule file | not JSON / missing fields | nothing launched | exit 2 naming the problem |

</intent-contract>

## Code Map

- `scripts/sim-driver/sim` -- the driver (zsh). Reuse `resolve_device`/`require_booted`, `ensure_runner` (builds the host into `$RUNNER/dd/Build/Products/Debug-iphonesimulator/Runner.app`), `target_args` (`--host` → `TARGET=$HOST_BUNDLE`), `say`/`die`, the `SERVE_PY` inline-python pattern. Add commands to `usage()` (Notifications section), the header comment and the main `case`.
- `scripts/sim-driver/Runner/App.swift` -- host app. Today: `PROBE=request` asks permission; `status` text. Add: on launch, an env `SCHEDULE` (JSON array) adds `UNNotificationRequest`s and/or `REMOVE` (ids) calls `removePendingNotificationRequests`, then writes a result line (ok / the add error) to a file in its Documents folder that `sim` reads via `xcrun simctl get_app_container $UDID $HOST_BUNDLE data`. `UNUserNotificationCenter.add` fails with `notificationsNotAllowed` when the host is not authorized.
- `scripts/sim-driver/project.yml` -- header comment lists what the host does; update it.
- `_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/sim-driver-prototype/Runner/App.swift` -- prototype's interval-only `PROBE=schedule`; read-only reference, do not edit.
- `~/Library/Developer/CoreSimulator/Devices/<udid>/data/Library/UserNotifications/Library.plist` -- verified on this Mac: decodes (resolve `$objects` UIDs; `NS.keys`/`NS.objects` → dict) to `{bundleId: folderUUID}`; `dev.sallvain.simdriver.runner` is present on the booted Duo `A0A486ED-…`. The pending file's record and trigger keys are not yet observed — discover them from a real archive.
- `scripts/sim-driver/test-center-exit.zsh` -- precedent for a hand-run zsh test beside the driver.
- `AGENTS.md` -- "Maintained by hand" sim-driver paragraph lists the commands; add the three new ones in one sentence.

## Tasks & Acceptance

**Execution:**
- [ ] `scripts/sim-driver/Runner/App.swift` -- add `SCHEDULE`/`REMOVE` launch handling and the result file; update the header comment -- the host is the only app whose requests are known, so it proves the reader.
- [ ] `scripts/sim-driver/pending.py` -- new decoder: args `USERNOTIFICATIONS_DIR BUNDLE`; generic NSKeyedArchiver resolver, then map each pending record to the output shape; drop unset date components (NSDateComponents' undefined value); strict failure on unknown shapes -- the reader stories 4.1–4.3 check through.
- [ ] `scripts/sim-driver/fixtures/host-requests.json` -- the three proving requests, identifiers `probe-interval` (3600 s, not repeating), `probe-once` (`{year:2031,month:6,day:15,hour:9,minute:0}`, not repeating) and `probe-yearly` (`{month:6,day:15,hour:9,minute:0}`, repeating), each with its own made-up title, body and threadId -- later stories reuse it as a known-good schedule.
- [ ] `scripts/sim-driver/sim` -- add `pending [BUNDLE|--host]` (default the shell), `schedule FILE` and `unschedule ID…` (host only: install `Runner.app` if absent, validate FILE, delete the old result file, launch with `--terminate-running-process` and `SIMCTL_CHILD_SCHEDULE`/`SIMCTL_CHILD_REMOVE`, wait for the result, then poll `pending --host` until the ids appear/disappear); update usage and header -- the driver's interface.
- [ ] `scripts/sim-driver/fixtures/` + `scripts/sim-driver/test-pending.zsh` -- copy the simulator's real `Library.plist` as-is (check first that it holds only bundle ids and folder UUIDs) and the three-request `PendingNotifications.plist` captured after `sim schedule`, into `fixtures/UserNotifications/` with the same folder layout; the test asserts one case per matrix row that needs no simulator: the three requests' exact JSON; after a copy with `probe-once`'s record dropped, the two others; a bundle absent from `Library.plist` (`[]`, exit 0, stderr note); a folder with no pending file and one with an empty archive (`[]`); a record with a key removed and one with an unknown trigger class (exit 1, nothing on stdout); and `sim schedule` with a non-JSON file and with a request missing a field (exit 2 before any device lookup, so it needs no simulator) -- guards the decoder and validation without a simulator.
- [ ] `project.yml`, `AGENTS.md` -- comment and one-sentence doc of the new commands -- durable agent prose.

**Acceptance Criteria:**
- Given the booted iPhone Duo simulator and the host authorized (`sim permission allow --host`), when `sim schedule scripts/sim-driver/fixtures/host-requests.json` then `sim pending --host` run with no person, then the JSON line lists exactly `probe-interval`, `probe-once` and `probe-yearly` with their scheduled titles, bodies, threadIds and triggers (interval seconds; one-off calendar 2031-06-15 9:00 `repeats:false`; yearly month 6 day 15 9:00 `repeats:true`).
- Given that state, when `sim unschedule probe-once` then `sim pending --host`, then only the other two are listed.
- Given `sim pending` for the shell (default bundle), when the shell has scheduled nothing, then it prints `[]` and exits 0.
- Given `scripts/sim-driver/test-pending.zsh`, when run, then every case passes.

## Implementation Notes

- Archive shape measured on the iOS 27 Duo simulator: `PendingNotifications.plist` is an NSKeyedArchiver NSMutableArray of flat dicts; keys used are `AppNotificationIdentifier`, `AppNotificationTitle`, `AppNotificationMessage`, `SBSPushStoreNotificationThreadKey`, `UNNotificationTriggerType` (`TimeInterval`/`Calendar`), `TriggerRepeats`, `TriggerTimeInterval`, `TriggerDateComponents` (NSDateComponents, `NS.<name>` keys). iOS omits the body and thread keys when empty (an empty title keeps its key), so those two default to `""` instead of failing.
- iOS silently drops a request with both title and body empty, so `sim schedule` refuses one (exit 2).
- The pending file reflects a change within about 0.5 s; `schedule`/`unschedule` take about 2 s end to end.
- `host_apply` reinstalls `Runner.app` before each launch (keeps data and permission) so a rebuilt host is never stale; `permission reset --host` uninstalls the host and so wipes its pending requests.
- Files: `scripts/sim-driver/Runner/App.swift`, `scripts/sim-driver/pending.py` (new), `scripts/sim-driver/sim`, `scripts/sim-driver/fixtures/` (new: `host-requests.json`, `UserNotifications/Library.plist`, the host folder's `PendingNotifications.plist`, `pending-empty.plist`), `scripts/sim-driver/test-pending.zsh` (new, 16 cases), `scripts/sim-driver/project.yml`, `AGENTS.md`.

## Plan Change Log

## Review Triage Log

### 2026-11-01 — Review pass
- verdicts: 39 findings — high 0, medium 9, low 19, false 8, maybe-false 3
- findings:
  - `[medium]` `[patch]` (blind) `sim pending BUNDLE` glob `##` needs extendedglob, so every bundle id is rejected — confirmed: `sim pending dev.sallvain.mylove` exited 2; replaced with a check that needs no extendedglob and added parsing cases.
  - `[low]` `[patch]` (blind) a `die` inside `$(data_path)` used as an argument yields `/Library/UserNotifications` and a false `[]` exit 0 — confirmed in zsh; the path is now resolved once with `dir=$(data_path) || exit $?`.
  - `[medium]` `[patch]` (blind) a missing UserNotifications dir or Library.plist prints `[]` exit 0, hiding a moved path or format change — now exits 1, with tests.
  - `[medium]` `[patch]` (blind) NS.timeZone, NS.calendar, NS.leapMonth and NS.repeatedDay were accepted and dropped — now fails by key when one is set, with tests.
  - `[maybe-false]` `[defer]` (blind) SchemaVersion is ignored — settle by decoding a later runtime's archive; deferred as medium (unverified).
  - `[low]` `[patch]` (blind) data race on `failure` in the add completions — now guarded by an NSLock.
  - `[low]` `[patch]` (blind) the fixture refresh steps were not spelled out and FOLDER was hard-coded — exact steps written out, and FOLDER is read from the fixture folder.
  - `[low]` `[patch]` (blind) untested decoder branches; `edit()` found the array without going through the root — cases added; `edit()` now goes through `$top.root`.
  - `[false]` `[reject]` (blind) the output lacks userInfo/RequestDate — the intent lists exactly identifier, title, body, thread id and trigger, and the reminder's title names its date.
  - `[low]` `[reject]` (blind) plan checkboxes, change log and the NS.time design note were not updated — the fix edits this build's plan.
  - `[low]` `[defer]` (blind) AGENTS.md omits two side effects: the host comes to the front, and permission reset wipes its pending requests — the fix edits an agent-context file.
  - `[low]` `[patch]` (blind) REMOVE was applied before SCHEDULE was parsed — both are now parsed before any change.
  - `[low]` `[patch]` (blind) the timeout messages understated the wait because simctl ran on every try — `$SECONDS` deadlines, path resolved once.
  - `[medium]` `[patch]` (edge) the glob, the same root cause as the first row — fixed there.
  - `[low]` `[patch]` (edge) data_path in a command substitution, the same as the second row — fixed there.
  - `[medium]` `[patch]` (edge) a missing UserNotifications folder gives `[]` — the same root cause as the third row; fixed there.
  - `[low]` `[patch]` (edge) the race on `failure` — fixed with the NSLock.
  - `[low]` `[patch]` (edge) unschedule of an id that was never pending said "removed N" — reworded so it is true either way.
  - `[maybe-false]` `[reject]` (edge) a past one-off calendar date may never be listed, so the poll times out with no cause — iOS behaviour unverified and low even if true; the timeout message now prints the last list.
  - `[low]` `[patch]` (edge) the test eval set `$0` to "sim", which failed outside the checkout — now passes `$SIM`; checked from /tmp.
  - `[low]` `[patch]` (edge) a poll timeout gave no reason — now includes the last list and the decoder error.
  - `[medium]` `[patch]` (edge, claim) the dateComponents extras were dropped — the same as the fourth row; fixed there.
  - `[maybe-false]` `[defer]` (edge, claim) record-level keys are never checked — grouped with the SchemaVersion entry; deferred.
  - `[medium]` `[patch]` (edge, claim) the BUNDLE form never matches — the same as the first row.
  - `[medium]` `[patch]` (verification-gap) `sim pending BUNDLE` parsing was untested and broken — fixed, with parsing cases.
  - `[low]` `[patch]` (verification-gap) sorted output was not pinned — a `reverse` edit case was added.
  - `[low]` `[patch]` (verification-gap) the empty body/threadId default was untested — drop-key cases added.
  - `[low]` `[patch]` (verification-gap) pending_satisfies was untested — present/absent cases added.
  - `[low]` `[patch]` (verification-gap) schedule validation rules were untested — refuse cases added for seconds 0, a repeat under 60 s, empty title and body, a duplicate id and an extra key.
  - `[low]` `[reject]` (verification-gap) test-pending.zsh is not run by CI — sim-driver tooling is Mac-only and hand-run, as test-center-exit.zsh is; AGENTS.md names the command; wiring a CI job is more than a direct correction.
  - `[medium]` `[patch]` (verification-gap, other) the BUNDLE glob — the same as the first row.
  - `[low]` `[patch]` (verification-gap, other) the race on `failure` — the same as above.
  - `[false]` `[reject]` (intent) the diff holds no evidence that the live run happened — this session ran schedule, pending, unschedule and pending on the booted iPhone Duo before and after the patches (Auto Run Result).
  - `[false]` `[reject]` (intent) unschedule's absent-mode poll does not check that the other two remain — its contract is removal; the Verify's "only the other two" is the following `sim pending --host`, which was run and listed two.
  - `[false]` `[reject]` (intent) nothing ties the run to the Duo — the driver works on any simulator by design, and the verification ran on the booted iPhone Duo A0A486ED.
  - `[false]` `[reject]` (intent) the path comes from dataPath rather than the hand-built one — the plan requires dataPath, and it resolves to the same folder in the default device set.
  - `[false]` `[reject]` (intent) the strictness was relaxed for body/threadId — measured: iOS omits those keys when empty, so `""` is the true value.
  - `[false]` `[reject]` (intent) the bundle-id charset is narrow — bundle ids are limited to alphanumerics, hyphen and period.
  - `[false]` `[reject]` (intent) the default shell `[]` has no offline case — it needs a device; it was run live and printed `[]` with exit 0.

### 2026-11-01 — Review pass (follow-up)
- verdicts: 31 findings — high 0, medium 0, low 18, false 9, maybe-false 4
- findings:
  - `[low]` `[reject]` (blind) DW-365 and DW-367 are the same ledger entry — real (a sweep triages it twice), but the invocation forbids modifying existing ledger entries and gives their status to the orchestrator; reported in the Auto Run Result.
  - `[low]` `[reject]` (blind) DW-366 and DW-368 are the same entry, and DW-368's heading stops at "uninstalls the" — same reason: the ledger entries are the orchestrator's; reported in the Auto Run Result.
  - `[low]` `[defer]` (blind) the deferral reason for the AGENTS.md side effects does not hold, and the new sentence also omits that `schedule` needs `sim permission allow --host` — the side-effect half is carried from the logged AGENTS.md row (deferred, DW-366); the permission prerequisite is new and deferred, since the fix edits AGENTS.md.
  - `[low]` `[patch]` (blind) `unschedule`'s help omits that it launches the host to the front — added "Launches the host, so it comes to the front." to its usage text in `sim`.
  - `[low]` `[reject]` (blind) a mistyped BUNDLE gives `[]` exit 0 — the intent-contract's "App never registered" row specifies this, the stderr note names the bundle, and every planned consumer uses the default shell or `--host`; a new exit code or flag is more than a direct correction.
  - `[low]` `[patch]` (blind) a registered folder with no PendingNotifications.plist gives `[]` with no stderr note — measured on the booted Duo: the shell's and the host's folders hold no pending file until something is scheduled, so `[]` is right and common; pending.py now names the missing file on stderr, and the folder-without-pending-file case checks the note.
  - `[false]` `[reject]` (blind) the host crashes on `seconds <= 0` or a repeat under 60 s — `check_schedule` refuses both before `host_apply` launches anything (`sim`, the interval branch), and the host is launched only through `host_apply`.
  - `[false]` `[reject]` (blind) REMOVE drops non-string identifiers — `cmd_unschedule` builds REMOVE as `JSON.stringify(process.argv.slice(1))`, so every identifier is a string.
  - `[low]` `[patch]` (blind) decoder and validator branches untested — added cases for a missing TriggerTimeInterval, the self-reference guard, a non-string Library.plist folder, `--raw`, four `check_schedule` refusals (unknown type, unknown component, unknown trigger key, non-object trigger) and `unschedule` with no ids.
  - `[false]` `[reject]` (blind) the argument cases are not hermetic — they assert only that parsing accepted the argument; whatever a booted simulator answers is read-only and passes, so the test still needs no simulator.
  - `[low]` `[patch]` (blind) `UNDEFINED` is 2**62 while the comment names NSIntegerMax — the comment now says it is a threshold, since no real component comes near 2**62.
  - `[maybe-false]` `[reject]` (blind) the 2031 one-off fixture expires — whether iOS keeps a past one-off is unverified (as the logged past-date row), it is years away and low even if true, and the poll timeout prints the last list.
  - `[low]` `[patch]` (blind) test-pending.zsh is mode 644 while its sibling is 755 — made executable.
  - `[maybe-false]` `[patch]` (edge) a registered folder missing altogether gives a silent `[]` — whether iOS ever registers a bundle without its folder is unverified; grouped with the missing-file row, whose stderr note now covers it.
  - `[low]` `[patch]` (edge) the main() comment says only a bundle missing from Library.plist gives `[]`, contradicting the code and docstring — comment rewritten to name both cases.
  - `[maybe-false]` `[defer]` (edge) a record archived as a keyed class rather than an NSDictionary would decode — the same root cause as the deferred record-level marker entry (no record-level shape check); grouped with it, no second item.
  - `[low]` `[patch]` (edge) a failed `edit` leaves cases whose expected output is the unedited fixture passing — `edit` now reports `FAIL edit …` and sets `failed=1`; checked by forcing a failed edit.
  - `[maybe-false]` `[reject]` (edge) out-of-range components (month 13) pass `check_schedule` — whether iOS keeps such a request is unverified, low even if true, and the poll timeout prints the last list, as the logged past-date row.
  - `[low]` `[reject]` (edge, claim) DW-367 repeats DW-365 — same as the first row.
  - `[low]` `[reject]` (edge, claim) DW-368 repeats DW-366 and is truncated — same as the second row.
  - `[low]` `[patch]` (verification-gap) a present key of the wrong type and a non-integer date component are never tested — added `set-key` to `edit` and cases for TriggerRepeats 1, a numeric title, a string TriggerTimeInterval, and NS.hour 9.5 and true.
  - `[low]` `[patch]` (verification-gap) `pending_satisfies present` never sees extra listed requests or an unsorted schedule — added `wait-extra-listed` and `wait-unordered-schedule`.
  - `[low]` `[reject]` (verification-gap, other) the ledger records each finding twice — same as the first row.
  - `[low]` `[reject]` (verification-gap, other) DW-368's title is cut off — same as the second row.
  - `[false]` `[reject]` (intent) the Verify is a live run and the tests never touch a simulator — the live run is the plan's Verification, not a committed test; this pass ran it again on the booted iPhone Duo and listed three, then two, as recorded below.
  - `[false]` `[reject]` (intent) the only evidence of the live run is the plan prose, which the working tree deletes — carried: the logged live-run row; this pass's Auto Run Result records the re-run.
  - `[false]` `[reject]` (intent) nothing ties the run to the Duo — carried: the logged Duo row; this pass ran on iPhone Duo A0A486ED again.
  - `[false]` `[reject]` (intent) unschedule waits for absence only — carried: the logged unschedule row; the following `sim pending --host` listed the other two.
  - `[false]` `[reject]` (intent) the reader may refuse what the shell's plugin schedules — a refusal names the key and exits 1, the designed loud failure; no local-notifications plugin is installed yet (package.json has only push-notifications), and the intent proves the reader on the host's requests.
  - `[false]` `[reject]` (intent) the empty body/threadId and unchecked SchemaVersion relax "lists each request's values" — carried: the logged body/threadId row (measured) and the deferred SchemaVersion row.
  - `[low]` `[reject]` (intent) the ledger holds two pairs of duplicates — same as the first row; the other additions are within the intent.

## Design Notes

The decoder is two layers so a format change breaks loudly in one place: a generic resolver (UID → object, `NS.keys`/`NS.objects` → dict/list, `NS.string`, `NS.time` → date, `$class` → class name) and a mapper that knows the record's keys. Find the keys by dumping the generic form of the real archive first (`python3 -I pending.py --raw …` or a scratch script); write the mapper from that, not from memory.

If iOS writes the pending file lazily, `schedule`'s poll covers it; measure the delay and note it. If the daemon never writes the file within ~15 s, or a calendar trigger's date components cannot be decoded, stop and report it as incomplete — the epic's decision is that stories 4.1–4.3's scheduled-list checks then move to story 8.

## Verification

**Commands:**
- `zsh scripts/sim-driver/test-pending.zsh` -- expected: all cases pass.
- `scripts/sim-driver/sim permission allow --host && scripts/sim-driver/sim schedule scripts/sim-driver/fixtures/host-requests.json && scripts/sim-driver/sim pending --host` -- expected: the three requests, values as scheduled.
- `scripts/sim-driver/sim unschedule probe-once && scripts/sim-driver/sim pending --host` -- expected: two requests.
- `scripts/sim-driver/sim pending` -- expected: `[]` or the shell's list, exit 0.
- `scripts/sim-driver/sim permission reset --host && scripts/sim-driver/sim schedule scripts/sim-driver/fixtures/host-requests.json` -- expected: exit 1 with the `sim permission allow --host` hint (host-without-permission row); then `sim permission allow --host` again.
- `zsh scripts/sim-driver/test-center-exit.zsh` -- expected: still passes (the driver's existing hand-run test).

## Auto Run Result

Status: built

**Summary:** a follow-up review pass on the simulator driver's pending-notification reader. `sim pending [BUNDLE|--host]` decodes the simulator's `UserNotifications/<folder>/PendingNotifications.plist` into one JSON line; `sim schedule FILE` and `sim unschedule ID…` have the host add or remove requests and return once `pending --host` shows the change. This pass made two behaviour changes. When an app's folder has no pending file, the reader now says so on stderr; it still prints `[]`. `unschedule`'s help now says it brings the host to the front. The rest of the pass fixed comments and added test cases.

**Files changed (this pass):**
- `scripts/sim-driver/pending.py`: names the missing pending file on stderr; two comments corrected (the `[]` cases, `UNDEFINED` as a threshold).
- `scripts/sim-driver/sim`: `unschedule` help says it launches the host to the front.
- `scripts/sim-driver/test-pending.zsh`: now executable. A failed `edit` fails the run. New `set-key` and `self-ref` edits, and `set-folder` takes JSON. Cases went from 46 to 62.

**Review:** 31 findings from 4 lenses.
- Patched: 14 rows (13 low, 1 maybe-false grouped with a low), in 11 entries.
- Deferred: 1 new item, the permission prerequisite missing from AGENTS.md (low). One maybe-false finding (a record archived as a keyed class) joined the existing record-level-marker item, so no second item was added.
- Rejected:
  - 9 false, each refuted in the triage log: the host crash on bad seconds (`check_schedule` refuses those first); non-string REMOVE ids (built from argv); hermeticity (the cases are read-only); four carried intent rows; the live-run evidence (re-run this pass); the plugin refusal (a designed loud failure, and no plugin is installed yet).
  - 2 maybe-false, each low even if true: the 2031 fixture expiry, and out-of-range components.
  - 1 low: a mistyped BUNDLE gives `[]` exit 0. The contract specifies it, and every planned consumer uses the default or `--host`.
  - 7 low ledger rows: DW-365/DW-367 and DW-366/DW-368 are duplicate pairs, and DW-368's heading is cut off at "uninstalls the". The invocation forbids editing existing ledger entries, so they are left for the orchestrator to merge.

**Follow-up review recommended:** false. This is a follow-up pass and it patched no high (patched entries by verdict: high 0, medium 0, low 11).

**Verification:**
- `zsh scripts/sim-driver/test-pending.zsh`: 62/62 ok. A forced failed edit printed `FAIL edit …` and set `failed=1`.
- `zsh scripts/sim-driver/test-center-exit.zsh`: 8/8 ok.
- Live on the booted iPhone Duo (A0A486ED), with no person acting:
  - `sim schedule fixtures/host-requests.json` then `sim pending --host` listed all three requests with their exact titles, bodies and threadIds. Triggers: interval 3600 s; calendar `{year:2031,month:6,day:15,hour:9,minute:0}` not repeating; calendar `{month:6,day:15,hour:9,minute:0}` repeating.
  - `sim unschedule probe-once` then `sim pending --host` listed the other two.
  - `sim pending` and `sim pending dev.sallvain.mylove` printed `[]` with exit 0, plus the new stderr note.
  - `sim permission reset --host` then `sim schedule` exited 1 with the `permission allow --host` hint, and `sim permission allow --host` then tapped Allow.
  - The host is left authorized with nothing pending.
  - The first `sim permission allow --host` of the run exited 1 ("no permission alert"), because the host had already answered. This is existing behaviour, already described in `sim help`.

**Residual risks:**
- The archive format is private, and the fixtures come from one iOS 27 runtime.
- The shell's own requests are first read in story 4.1, and a plugin that sets `NS.calendar` or `NS.timeZone` will be refused by name.
- The two duplicate ledger pairs remain until the orchestrator merges them.
