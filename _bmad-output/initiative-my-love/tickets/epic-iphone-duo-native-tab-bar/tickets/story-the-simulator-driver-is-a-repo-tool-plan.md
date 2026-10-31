---
title: 'The simulator driver is a repo tool'
type: 'feature'
ticket: '9'
created: '2026-10-30'
status: done
baseline_revision: '99104223bf3092cf17fe6df13419a59b38b5dd65'
route: 'full'
route_source: 'auto'
risk: 'medium'
review: 'quick'
review_source: 'pinned'
lenses_ran: ['quick']
review_loop_iteration: 0
followup_review_recommended: false
context: ['{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/tickets/story-find-how-the-web-code-learns-the-side-column-s-position-and-plan.md', '{project-root}/_bmad-output/initiative-my-love/tickets/epic-iphone-duo-native-tab-bar/sim-driver-prototype/']
warnings: ['oversized']
deferred:
  - summary: >-
      The sim driver's default work dir is shared by every run, so two stories driving two simulator clones at once (which AGENTS.md now allows) would clobber each other's stage, runner, drive log and serve.pid.
    evidence: |-
      sync_stage empties $WORK/stage/tree, ensure_runner removes $WORK/runner/src, the app's derived data is always $WORK/derived/app, drive writes and parses $WORK/logs/drive.log, and serve.pid is one file; none is keyed on the device. The fix edits AGENTS.md (or keys the work dir on the UDID), so it is deferred; recorded as DW-329 in the deferred-work ledger.
    location: >-
      scripts/sim-driver/sim (WORK, sync_stage, ensure_runner, drive, SERVE_PID); AGENTS.md Maintained by hand
    severity: medium
---

<intent-contract>

## Intent

**Problem:** Stories 2, 8, 3.x and 4.x must check the shell on the iPhone Duo simulator with no person, but the only driver is the scratch prototype in `sim-driver-prototype/`, and nothing builds a local-stack shell, signs it in, or proves a live update without hand steps; DW-328 (both side insets on a non-Duo iPhone) is still unmeasured.

**Approach:** Port the prototype's Drive half into `scripts/sim-driver/`: one zsh entry point `scripts/sim-driver/sim` whose subcommands build and install the shell from a staged copy of the working tree (or an earlier commit) outside the repo, provision and sign in a local fixture pair, and drive the simulator through `ax`, `xcrun simctl` and an XCUITest runner with a minimal host app. Then use it to run the ticket's checks, close DW-328, and add the operating lines to AGENTS.md.

## Boundaries & Constraints

**Always:**
- Every build happens in a staged copy outside the repo: the work dir `${SIM_DRIVER_WORK:-$HOME/Library/Caches/my-love-sim-driver}`. The working tree is staged with `git ls-files -co --exclude-standard` (rsync, keeping the stage's `node_modules`, re-running `npm ci` only when `package-lock.json` changed); an earlier commit with `git archive <rev> | tar -x` (no `git worktree`). The stage's own `dist/` and `ios/App/App/public/` take the test build; the repo's `dist/`, `ios/App/App/public/` and `ios/App/App/capacitor.config.json` are never written. This also gives `ios/App/CapApp-SPM` the `node_modules` its relative package paths need, which a loop worktree lacks.
- Web build: `npx vite build --mode test` in the stage with `GITHUB_SHA` set to a `sim-…` id and `VITE_LIVE_UPDATE_URL` set; unset any inherited `VITE_SUPABASE_*` first so fnox's production values never reach the bundle (Vite gives `process.env` priority over `.env.test`). Then `npx cap sync ios` in the stage, `xcodebuild` the `App` scheme for the simulator into the work dir, `xcrun simctl uninstall <udid> dev.sallvain.mylove`, install, launch.
- A working-tree shell's `VITE_LIVE_UPDATE_URL` is unreachable (`http://127.0.0.1:9/updates/latest.json`) unless an update server is the point, so it stays on its own web code (story 7 Setup).
- The readout is story 7's Setup `<script>` verbatim, kept in the tool's folder and injected before `</head>` of a stage's built `index.html` only when asked (`--readout`).
- Device: `--device <udid|name>`, else `$SIM_DEVICE`, else the only booted simulator; refuse when ambiguous.
- Fixture pair: `simdriver@test.example.com` and `simdriver-partner@test.example.com`, fictional display names (`Casey`, `Jessie`), password `TEST_USER_PASSWORD` from `tests/support/test-credentials.ts`, linked to each other, local stack only (refuse any non-`127.0.0.1`/`localhost` URL). Provisioning is idempotent, like `ensureUser`/`linkUserPair` in `tests/support/auth/global-setup.ts`.
- Taps are page points offset from `app.webViews.firstMatch`'s origin; `dump` reports element frames in that same space plus the web view frame, so a frame's centre can be fed back to `tap`.
- Comment style matches the prototype and `scripts/package-live-update.sh`: a header saying what and why, short lines.

**Never:**
- Change `ios/App` (the Xcode project, `Info.plist`, `capacitor.config.ts`, `Package.swift`) or anything else the shipped app builds from; a test-only native tweak (e.g. `httpsOnly: false`) is written into the stage's generated `capacitor.config.json` only.
- Port `Notify.swift`, `notify.sh`, the host app's notification probes or its `aps-environment` entitlement (story 3.12).
- Use production, fnox secrets or the claude-bot couple; use an E2E pool account (`testworker*`, `testuser1/2`).
- Leave a process running at the end (update server, `wrangler`), or rotate with `XCUIDevice.orientation` on the Duo (it takes effect only once; use `ax rotate`).
- Commit screenshots of anything but the fixture accounts; commit the work dir, the generated `.xcodeproj` or derived data.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Build from working tree | `sim build --readout` | Shell from the working tree installed fresh on the device, local stack, readout shown | Non-zero exit naming the failed stage (npm ci, vite, cap, xcodebuild, simctl) |
| Build from earlier commit | `sim build --from main --update-port 8790` | Shell from `main` installed; its update URL is `http://127.0.0.1:8790/updates/latest.json`; stage's `capacitor.config.json` has `httpsOnly: false` | Unknown rev → exit non-zero before touching the device |
| Serve update | `sim serve-update --port 8790 --readout` / `--stop` | Working tree's bundle packaged with the stage's `scripts/package-live-update.sh` and served on 127.0.0.1; pid recorded in work dir; `--stop` kills it | Port busy → exit non-zero |
| Local stack down | any command needing Supabase | Exit non-zero: "run supabase start" | No partial provisioning |
| Ambiguous device | two booted simulators, no `--device` | Exit 2 listing them | — |
| Runner sources changed | Swift or `project.yml` newer than last build | Runner regenerated (xcodegen) and rebuilt before running | Build failure printed |

</intent-contract>

## Code Map

- `_bmad-output/.../sim-driver-prototype/` -- source to port: `project.yml` (drop entitlements), `Runner/App.swift` (keep only a plain SwiftUI host), `RunnerUITests/Drive.swift` (environment-driven actions; `TEST_RUNNER_` prefix stripped by xcodebuild), `drive.sh` (`test-without-building -only-testing:`). Leave the prototype folder as is (story 3.12 ports Notify from it).
- Story 7 plan (context) -- Setup's readout `<script>` (copy verbatim) and Findings' "Sim shell" rows (the values the checks compare against).
- `scripts/package-live-update.sh` -- reused unchanged inside the stage (`GITHUB_SHA`, `UPDATE_BASE_URL`; writes the stage's `dist/updates/`).
- `src/services/nativeUpdates.ts` -- `VITE_LIVE_UPDATE_URL`, `__BUILD_ID__` comparison; `next()` swaps on background.
- `vite.config.ts:19` -- `__BUILD_ID__` from `GITHUB_SHA`.
- `.env.test` -- local URL and publishable key (equal to `supabase status`'s `PUBLISHABLE_KEY` today).
- `tests/support/auth/global-setup.ts:30-118` -- `ensureUser`/`linkUserPair` pattern (admin API, profile `display_name` reset, `partner_id` both ways); `playwright.config.ts:39-87` -- reading `supabase status -o env` and ES256 re-signing of the service key, for the provisioning client.
- `src/components/LoginScreen/LoginScreen.tsx:286-343` -- `#email`, `#password`, button "Sign in".
- `tsconfig.node.json:24` -- add the provisioning `.ts` here if written in TypeScript so `npm run typecheck` covers it; `knip.json` `entry` -- add it so Knip does not flag it.
- `AGENTS.md` "Maintained by hand" -- the section a context refresh never rewrites.
- `_bmad-output/initiative-my-love/deferred-work.md:2828` -- DW-328.

## Tasks & Acceptance

**Execution:**
- [x] `scripts/sim-driver/project.yml`, `Runner/App.swift`, `RunnerUITests/Drive.swift`, `.gitignore` -- port the runner: Drive reads `ACTION` (`tap X Y`, `scroll up|down`, `dump`, `signin EMAIL PASSWORD`, `background`, `activate`) for bundle `dev.sallvain.mylove`; `dump` prints one JSON line of web view descendants (type, label, value, frame) -- the driver's XCUITest half.
- [x] `scripts/sim-driver/sim` -- zsh entry with `help` and subcommands `provision`, `build [--from REV] [--readout] [--update-port N]`, `serve-update [--port N] [--readout] | --stop`, `signin [partner]`, `pose closed|partial|open`, `rotate [N]`, `state`, `tap X Y`, `scroll up|down`, `dump`, `readout` (the readout's text lines), `background`, `launch`, `screenshot PATH [--display inner|outer]`, `uninstall`; builds the runner on demand -- one tool a loop session calls.
- [x] `scripts/sim-driver/readout.html` -- story 7's readout verbatim.
- [x] `scripts/sim-driver/provision.ts` + `tsconfig.node.json` (`include`), `knip.json` (`entry`) -- idempotent local fixture pair, run by `sim provision` as `node scripts/sim-driver/provision.ts` (Node 24 strips types; `allowImportingTsExtensions` is already on, so it imports `tests/support/test-credentials.ts` with its extension) -- sign-in needs an account no E2E slot touches, and `npm run typecheck` then covers it.
- [x] `AGENTS.md` "Maintained by hand" -- the lines the ticket lists: where the tool lives and its entry point; prerequisites (`ax` and `xcodegen` installed, every `ax doctor` line ok, Mac unlocked, Device Hub open, not minimised, on the current Space or assigned to All Desktops though not necessarily in front, `supabase start`); one Duo story at a time or on a `simctl clone`; simulator results trusted for the shell only (story 7: the simulator's Safari and Home Screen web app differ from the Duo); the fixture pair is the driver's.
- [x] Matrix runs -- exercise every I/O matrix row with the tool itself and record each command with its exit code and the lines that show the expected behaviour in Implementation Notes: "local stack down" through an override the tool honours for its Supabase URL (e.g. `SIM_SUPABASE_URL=http://127.0.0.1:1`), never by stopping the shared stack; "ambiguous device" with the non-Duo simulator booted beside the Duo; "runner sources changed" by touching `Drive.swift`; "unknown rev" with `--from no-such-rev`; "port busy" by serving twice -- the tool has no unit-test harness (ESLint and Vitest do not reach `scripts/`), so these recorded runs are its tests.
- [x] Run the checks below; record readings in Implementation Notes; rewrite or close DW-328 in `_bmad-output/initiative-my-love/deferred-work.md` with the measured insets.

**Acceptance Criteria:**
- Given the Duo simulator and the local stack, when `sim provision`, `sim build --readout`, `sim signin` run with no person, then `sim readout` in folded portrait, folded landscape-secondary, folded landscape-primary, unfolded portrait and unfolded landscape prints insets and page size equal to story 7's Sim shell rows (0/84/34/0 466×678; 0/84/34/0 678×466; 0/0/34/84 678×466; 82/0/34/0 669×951; 0/84/34/0 951×669), and the signed-in home view's elements appear in `sim dump`.
- Given folded landscape-secondary, folded landscape-primary and unfolded landscape, when `sim tap` hits a point inside the 84 pt column near its bottom, then the readout's last tap reports that point.
- Given a non-Duo iPhone simulator that renders the shell, when the readout is read in portrait and both landscapes, then both side insets are recorded in Implementation Notes and DW-328 is closed or rewritten with them; if none renders, HALT blocked naming each simulator tried.
- Given `sim build --from main --update-port N` and `sim serve-update --port N --readout`, when the shell is launched, backgrounded and relaunched, then `sim readout` prints readout text (present only in the working tree's bundle) and the app container's updater preferences name that bundle with `status: success`.
- Given every check above has run, when the session ends, then `git status --short` shows only the tool, AGENTS.md, tsconfig/knip, DW-328 and this plan; `grep -rl "inset T/R/B/L"` over `dist/`, `ios/App/App/public/`, `src/` and `index.html` finds nothing; `dist/` (if present) holds no `sim-` build id; no update server runs; the Duo simulator holds the working tree's shell without the readout.

## Implementation Notes

Run 2026-10-30 on the iPhone Duo simulator (iOS 27.1, `A0A486ED…`), Xcode 27.2, `ax` 0.2.2, Supabase CLI 2.122.0; every command below is `scripts/sim-driver/sim …`, with no person acting. A first build (npm ci included) took 41 s; later builds about 20 s; one Drive step about 6–12 s.

**Shell checks (AC 1 and 2).** `provision` (exit 0: both accounts `created`, `linked as partners`; a second run printed `reset` for both, exit 0), `build --readout` (exit 0, `installed sim-tree-… (readout: 1, update URL: http://127.0.0.1:9/updates/latest.json)`), `signin` (exit 0, `signed in as simdriver@…`, `dismissed the welcome splash`). `dump` then listed the signed-in home view: buttons Settings, Home, Mood, Love Notes, Photos, Partner, Add event, Add to favorites, Share message, and texts such as "Together for", "Casey's birthday", "Jessie's birthday", "Wedding". Readout per pose, against story 7's Sim shell rows:

| Pose (reached with) | `readout` insets T/R/B/L | page | Column tap (`tap X Y`) → readout's last tap |
|---|---|---|---|
| Folded portrait (`pose closed`) | 0/84/34/0 | 466×678 | — |
| Folded landscape-secondary (`rotate`, ax: landscapeRight) | 0/84/34/0 | 678×466 | `tap 636 420` → `last tap 636,420` |
| Folded landscape-primary (`rotate` twice more, ax: landscapeLeft) | 0/0/34/84 | 678×466 | `tap 42 420` → `last tap 42,420` |
| Unfolded portrait (`pose open`) | 82/0/34/0 | 669×951 | — |
| Unfolded landscape (`rotate`, landscape-secondary) | 0/84/34/0 | 951×669 | `tap 908 620` → `last tap 908,620` |

All five equal story 7's rows. `screenshot <scratch>/x.png` saved the inner display's PNG (fixture account; kept in the session scratchpad, not committed). `scroll down` moved "Wedding" from y 474 to y 103 in `dump`.

**Live update (AC 4).** `serve-update --port 8790 --readout` (exit 0, `serving sim-tree-1793405318 at http://127.0.0.1:8790/updates/latest.json`; the response carries `Access-Control-Allow-Origin: capacitor://localhost`), then `build --from main --update-port 8790` (exit 0, `installed sim-99104223-… (readout: 0 …)`; the stage's `capacitor.config.json` has `"httpsOnly": false`). The server log shows the launch fetching `latest.json` and `GET /updates/bundle-sim-tree-1793405318.zip 200`. `readout` before the swap: exit 1, `no readout on screen`; then `background`, `launch`, `readout`: exit 0, `inset T/R/B/L 0/84/34/0 … inner 951x669`. The app container's `Library/Preferences/dev.sallvain.mylove.plist` has `serverBasePath` ending `ionic_built_snapshots/CLW5GlfgR3`, and `CLW5GlfgR3_info` decodes to `"status":"success","version":"sim-tree-1793405318"`. `serve-update --stop` (exit 0, `stopped the update server`); `pgrep -fl "http.server|wrangler"` then printed nothing (exit 1).

**DW-328 (AC 3).** The iPhone 17 simulator (iOS 27.2, `73CC7947…`) renders the readout shell. Device Hub was switched to it for the reading and back to the Duo afterwards; that window offers only Rotate Left, hence the `rotate` fallback in the change log. Portrait 62/0/34/0, page 402×874; landscape-primary (ax: landscapeLeft) 0/62/20/62, page 874×402; landscape-secondary (ax: landscapeRight) 0/62/20/62, page 874×402; portraitUpsideDown keeps the previous landscape layout. Both side insets are non-zero in each landscape, so the exactly-one-side rule gives no column there. DW-328 closed with these values. The readout shell was then uninstalled from the iPhone 17 (`--device … uninstall`) and the simulator shut down.

**I/O matrix runs.**
- Build from working tree: `build --readout` → exit 0 (above). The failure path names the stage: each step runs through `stage <name>`, which prints `sim: <name> failed (full log: …)`.
- Build from earlier commit: `build --from main --update-port 8790` → exit 0 (above). `build --from no-such-rev` → exit 1, `sim: build: unknown revision no-such-rev`, printed before staging or touching the device.
- Serve update: as above; a second `serve-update --port 8790` while it ran → exit 1, `sim: port 8790 is busy: sim serve-update --stop stops the driver's server`. After review the driver's own server is refused first, on any port: `serve-update --port 8791` while it ran on 8790 → exit 1, `sim: the driver's update server already runs (pid 58869): sim serve-update --stop stops it`; another process on the port still gives `port N is busy`. `--stop` with `serve.pid` naming a live process that is not the server (a `sleep 30`) → exit 0, `no update server running`, the file removed and that process left alone. `SIM_SUPABASE_URL=https://example.supabase.co sim serve-update --port 8791` → exit 1, `refusing https://example.supabase.co: the driver uses the local stack only`.
- Local stack down: `SIM_SUPABASE_URL=http://127.0.0.1:1` with `provision`, `signin` and `build` → each exit 1, `sim: the local stack does not answer at http://127.0.0.1:1: run supabase start`, before any provisioning or staging. `SIM_SUPABASE_URL=https://example.supabase.co sim provision` → exit 1, `refusing https://example.supabase.co: the driver uses the local stack only`.
- Ambiguous device: with the iPhone 17 booted beside the Duo, `state` → exit 2, `more than one simulator matches; pass --device or set SIM_DEVICE:` followed by both UDIDs, names and runtimes.
- Runner sources changed: `touch scripts/sim-driver/RunnerUITests/Drive.swift`, then `dump` → `sim: runner sources changed since the last build; regenerating`, `sim: xcodegen...`, `sim: runner-build...`, exit 0. The same happened after each real edit to Drive.swift.

**End state (AC 5).** The last Duo build is `build` without `--readout` (`installed sim-tree-1793405870 … (readout: 0 …)`), signed in as the first fixture account; `readout` there → exit 1, `no readout on screen`. The repo has no `dist/` or `ios/App/App/public/`; `grep -rl "inset T/R/B/L" dist ios/App/App/public src index.html` printed nothing. `npm run typecheck` exit 0 (no TS2883 this time); `npm run lint` exit 0; Knip, run in the stage (which has its own `node_modules`) with this change's `knip.json`, reported nothing, and flagged `provision.ts` as unused without the new `entry` line. The work dir keeps the stages, derived data, logs and the last served bundle (`serve/`, with the readout) under `~/Library/Caches/my-love-sim-driver`, outside the repo.

## Plan Change Log

- `provision` authenticates with `supabase status`'s `SECRET_KEY` (`sb_secret_…`), not an ES256 re-signed `SERVICE_ROLE_KEY` as `playwright.config.ts` does: on CLI 2.122.0 the local gateway accepts it for both the Auth admin API and PostgREST (200 on each), so no `docker inspect` is needed.
- `sim background` presses Device Hub's Home through `ax control Home`, and Drive has no `background` or `activate` step: `XCUIDevice.shared.press(.home)` ran ("Pressing Home button" in the log) but left the shell in front on the Duo (state 4, screenshot unchanged), while `ax control Home` showed the Home Screen. `sim launch` uses `xcrun simctl launch`, which also brings a backgrounded shell to the front, so an `activate` step had no caller.
- `sim rotate` falls back to `ax control 'Rotate Left'` (waiting for `ax state`'s orientation to change) when the device's Device Hub window has no Rotate Right button, as the iPhone 17's does not; `ax rotate` presses only Rotate Right. Stories 2 and 8 need a non-Duo iPhone in both landscapes.
- `signin` also dismisses the welcome splash ("Welcome to Your App", Continue) when it shows, and waits for the Home button, so it ends on the home view.
- The web build drops every inherited `VITE_*` variable, not only `VITE_SUPABASE_*`, so no fnox value reaches the bundle; `SIM_SUPABASE_URL`, when set, becomes the build's `VITE_SUPABASE_URL` too, so the shell and the tool's checks use one stack.
- `serve-update` serves with a small Python server adding `Access-Control-Allow-Origin: capacitor://localhost` and `Cache-Control: no-cache` (what `public/_headers` gives `/updates/*` on the live site), because the shell's fetch of `latest.json` is cross-origin and a plain `http.server` sends neither header. It builds in the working-tree stage and serves a copy of its `dist/` from the work dir's `serve/`, so a later `sim build` does not change what is being served.

## Review Triage Log

### 2026-10-30 — Review pass
- verdicts: 8 findings — high 0, medium 2, low 4, false 1, maybe-false 0
- findings:
  - `[false]` `[reject]` Realtime handshakes are rejected with 403 because the build keeps `.env.test`'s key instead of a re-signed anon JWT — refuted: a Realtime websocket join on the local stack with `.env.test`'s `sb_publishable_…` key (equal to `supabase status`'s `PUBLISHABLE_KEY`) answered `phx_reply` `status: ok`; the AGENTS.md pitfall describes the old placeholder value. The `SIM_SUPABASE_URL`-without-key part does not occur either: CLI local stacks use the deterministic key `.env.test` records, and the override exists for the stack-down check.
  - `[low]` `[patch]` `serve-update` skips `require_stack`, so a non-local `SIM_SUPABASE_URL` reaches a served bundle — patched: `cmd_serve_update` calls `require_stack` before staging; a remote URL now exits 1 with the refusal.
  - `[medium]` `[patch]` `serve-update` on a second port orphans the first server, and `--stop` kills a stale reused pid — patched: new `serve_running` (live pid whose command line is the driver's `ThreadingHTTPServer`) refuses a second server and gates `--stop`'s kill; a stale file is only removed.
  - `[medium]` `[defer]` The work dir is shared, so concurrent runs on simulator clones (allowed by the new AGENTS.md line) clobber each other — real by inspection of `sync_stage`, `ensure_runner`, `drive`, `SERVE_PID`; the fix edits AGENTS.md or reshapes the work dir, so deferred to the frontmatter and DW-329.
  - `[low]` `[patch]` `producer | grep -q` under `pipefail` can fail with SIGPIPE in `booted` and `cmd_rotate` — patched: `booted` greps to `/dev/null` reading all input; `cmd_rotate` captures `ax controls` first.
  - `[low]` `[patch]` `ensure_runner` touches its stamp after copying sources, missing an edit made during the copy — patched: stamp touched before the copy.
  - `[low]` `[patch]` DW-328's `status: done` carries no date, unlike every resolved ledger entry — patched to `status: done 2026-10-30`.
  - `[low]` `[reject]` The plan's Boundaries name the fixture emails in `_bmad-output/`, against AGENTS.md Policy — real (fictional `test.example.com` addresses), but the only fix edits this build's plan, inside its read-only intent contract; raised under Auto Run Result residual risks for the orchestrator.

## Design Notes

Why a staged copy rather than building in place: `cap sync` reads `webDir: 'dist'`, so an in-place test build would land in the repo's `dist/`, which `npx wrangler deploy` ships; and `CapApp-SPM/Package.swift` resolves `../../../node_modules`, absent in a loop worktree. The stage fixes both and makes `--from REV` the same code path.

`sim readout` vs `sim dump`: the readout is a `<pre>` with `pointer-events:none`; XCUITest exposes it as static text (the prototype matched `label CONTAINS 'inset'`). `readout` prints that element's lines, `dump` everything.

## Verification

**Commands:**
- `scripts/sim-driver/sim help` -- expected: usage listing every subcommand, exit 0
- `npm run typecheck` -- expected: no errors other than the worktree's known TS2883 in `tests/support/merged-fixtures.ts`
- `npm run lint` -- expected: exit 0
- `git status --short` and `grep -rl "inset T/R/B/L" dist ios/App/App/public src index.html 2>/dev/null` -- expected: only the planned files; no grep output
- `pgrep -fl "http.server|wrangler"` -- expected: no server started by the driver

## Auto Run Result

Status: built

**Summary:** Story 9's simulator driver is a repo tool, `scripts/sim-driver/sim`, ported from the prototype's Drive half. It builds and installs the shell from the working tree or an earlier commit in a staged copy outside the repo (never the repo's `dist/` or `ios/App/App/public/`), against the local stack; provisions and signs in its own fixture pair; folds and rotates with `ax`; taps, scrolls, dumps the web view's elements as JSON and reads story 7's readout through an XCUITest runner; and serves the working tree as a local live update. Its checks ran with no person: all five Duo poses matched story 7's shell rows, column taps in the three landscape poses reached the page, a shell built from `main` took the working tree's bundle by live update, and DW-328 is closed with the iPhone 17 simulator's insets (landscape 0/62/20/62 — both sides, so no column).

**Files changed:**
- `scripts/sim-driver/sim` — the zsh entry point and every subcommand.
- `scripts/sim-driver/project.yml`, `Runner/App.swift`, `RunnerUITests/Drive.swift`, `.gitignore` — the XCUITest runner and its empty host app (no notification code; story 3.12's).
- `scripts/sim-driver/readout.html` — story 7's readout, injected only into staged builds.
- `scripts/sim-driver/provision.ts` — idempotent local fixture pair, linked as partners.
- `tsconfig.node.json`, `knip.json` — typecheck and Knip cover `provision.ts`.
- `AGENTS.md` — Maintained by hand: where the tool lives, its prerequisites, one Duo story at a time, simulator results trusted for the shell only, the fixture pair.
- `_bmad-output/initiative-my-love/deferred-work.md` — DW-328 closed with measurements; DW-329 added.

**Review findings:** 8 from the quick lens. Patched 5 (medium 1, low 4): `serve-update` stack guard, second-server and stale-pid handling, `pipefail`/`grep -q`, runner stamp order, DW-328 status date. Deferred 1 (medium): shared work dir under concurrent clone runs (frontmatter `deferred`, DW-329). Rejected 2: Realtime 403 (false — a join with `.env.test`'s key answered ok); fixture emails in this plan (fix would edit this build's plan).

**Follow-up review recommended:** false — first pass patched no high and one medium.

**Verification:** `sim help` exit 0; `zsh -n` on `sim` ok; `npm run typecheck` and `npm run lint` clean; `git status --short` shows only the planned files; no `dist/` or `ios/App/App/public/` in the repo and no readout under `src/` or `index.html`; no update server or `wrangler` running; the Duo simulator holds the working tree's shell without the readout (`sim readout` exits 1, `sim dump` lists the home view). Matrix rows each exercised with recorded exit codes (Implementation Notes).

**Residual risks:**
- `stack_secret` runs `supabase status` in the caller's directory, so `sim provision` run from outside the repo reports no `SECRET_KEY`; loop sessions run from the repo root.
- A non-Duo phone is reachable by `ax` only while Device Hub's window shows it; the tool does not switch Device Hub's window, so stories 2 and 8 must select their non-Duo phone there.
- Realtime between partners in the shell was not exercised end to end (only the anonymous join was checked).
- The plan's Boundaries name the two fixture emails (fictional `test.example.com`) in `_bmad-output/`, which AGENTS.md Policy forbids; editing the intent contract is the orchestrator's call.
- The work dir `~/Library/Caches/my-love-sim-driver` keeps stages, logs and the last served bundle (with the readout), all outside the repo; the Duo's Home Screen shows a "Runner" app (the runner's host).
