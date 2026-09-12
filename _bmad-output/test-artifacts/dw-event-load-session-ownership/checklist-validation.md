# TEA automate checklist validation

Validated against `.agents/skills/bmad-testarch-automate/checklist.md`.

| Checklist area | Outcome and evidence |
| --- | --- |
| Framework and context | Pass: existing API/Chromium/Vitest configuration, frozen spec, implementation diff, existing coverage and configured knowledge fragments loaded |
| Targets and priorities | Pass: one supporting API case, four P1 browser ownership cases, one P2 refresh case; existing lower-level coverage retained |
| Duplicate avoidance | Pass: browser cases add real auth/service/store integration; precise React scheduling and mutation permutations stay in existing tests |
| Test structure | Pass: priority tags, source-backed selectors, explicit response/store/UI assertions, no focus/skip/fixme or hard waits; multiple assertions establish one behavior per case |
| Fixtures and data | Pass: existing merged/auth fixtures reused, pure overridable row factory, two-window controller with checked teardown, exact-ID API cleanup |
| Playwright mandate | Pass with four documented deviations; 2/2 specs import merged fixtures; API/interception/polling/logging use installed utilities |
| Error handling | Pass: only intentional HTTP400 cases opt out of network monitoring; retries remain enabled in production code |
| Collection and execution | Pass: six discovered, six passed; 25 repeated browser executions passed without retries |
| Regression sensitivity | Pass: both new Home race cases reject the mutant that removes only the two session-version comparisons; source restored |
| Existing regression checks | Pass: 211 tests across eight files, full typecheck, full lint with three existing warnings |
| Documentation | Pass: run instructions, staging utility, priority/acceptance mapping, Definition of Done, machine-readable generation and verification summaries |
| Cleanup | Pass: staged files removed after equality checks; task browser/server stopped; zero generated API fixture rows remain; source and initial ledger diff unchanged |
| Artifact location | Pass: durable outputs under configured `_bmad-output/test-artifacts`; generation-worker JSON copied from required temporary paths into the bundle |

Pact, mobile, new unit/component generation, a new framework, package-script edits and broad CI changes are inapplicable to this scoped pack. Existing auth wiring is complete. No separate test-review or ATDD workflow ran. Generation-time interface and scheduling corrections are recorded in `evidence/generation-corrections.json`; no production behavior was changed to make tests pass.

Coverage percentages, a production build, live unmocked browser event reads, actual IndexedDB commit ordering and release approval are not measurements provided by this pack. The API case uses live PostgREST; browser event-response control is intentional and documented.
