# E2E preflight: dw-source-test-contract-comments

Date: 2026-09-12. This is source inspection evidence, not an execution result.

## Existing prioritized cases

| Priority | Test | Observable contract | Limit of the assertion |
| --- | --- | --- | --- |
| P1 | `tests/e2e/settings/events-persistence.spec.ts:161`, DE.5-E2E-004 | Create through Settings with `ring`; reload Settings; read the date and prefilled radio; visit Home and assert the Gem icon and amber treatment. | Covers one icon and a reload of the created event. It does not exercise every allowed icon. |
| P1 | `tests/e2e/settings/events-persistence.spec.ts:227`, DE.5-E2E-005 | Create distinct future dates in late/soon/middle order; reload; assert three labels and dates in chronological order. | Establishes display order after reload. It cannot identify which layer supplied that order, and distinct dates do not exercise the `created_at` tiebreak. |
| P2 | `tests/e2e/settings/events-persistence.spec.ts:286`, DE.5-E2E-006 | Create with a description; observe a pass-through PATCH carrying `description: null` and HTTP 200; assert no description element on the Settings row and no description text on Home. | The test does not reload after clearing. The PATCH response status and updated UI do not constitute a separate read-after-reload persistence assertion. |

The priorities already recorded in the suite are retained. Icon and date display connect Settings, service mapping, store state, and Home. Description clearing is a secondary optional-field case.

## Implementation correspondence

- `src/services/eventsService.ts:356` reads upcoming and past windows separately. Upcoming sorts `event_date` and `created_at` ascending; past sorts both descending and is reversed before joining. The distinct-date E2E sequence is consistent with that behavior.
- `src/stores/slices/eventsSlice.ts:77` copies and sorts by date, then `createdAt`. `replayCompletedMutations` at line 168 invokes that sort at line 186. A correct display sequence therefore does not isolate server sorting.
- `src/components/Settings/EventsSettings.tsx:727` sends `trimmedDescription || null`; its edit handler at line 310 forwards `input.description ?? null`. `src/services/eventsService.ts:563` includes any defined description in the update payload, including null. Settings renders the description paragraph only for a truthy value at line 485.
- `src/components/RelationshipTimers/EventCountdown.tsx:32` maps `ring` to Gem; the color map starts at line 38. The label-derived Home test ID is built at line 237.

## Reusable fixtures

| Existing module | Reuse |
| --- | --- |
| `tests/support/merged-fixtures.ts` | The one project test/expect entry point. Composes API requests, interception, recurse, logging, network monitoring, authentication, and custom fixtures. |
| `tests/support/helpers/events.ts` | Single-row `seedEvent`, `resolveOwnPair`, checked pair cleanup, anchored local calendar dates, and local date parsing. Import the deep module path, because the helpers barrel only exports navigation. |
| `tests/support/factories/events.ts` | Pure batch factory; one caller-supplied clock anchor; explicit `createdAt`; self/partner ownership; result mapping by unique labels. It supplements the single-row helper. |
| `tests/support/fixtures/index.ts:130` | `coupleEvents` clears this worker's own pair before and after use; exposes the captured anchor and seed/clear functions. |
| `tests/support/fixtures/auth.ts` | Existing authentication fixture owns user tokens and browser storage state. Generated specs should reuse it. |
| `tests/support/auth/worker-pool.ts` | Worker identity comes from `TEST_WORKER_INDEX`; never select or modify another worker's pair. |
| `tests/support/helpers/navigation.ts` | Existing `navigateTo` navigation helper. |

The persistence spec already creates rows through Settings because creation is part of its subject. Read-only or ordering preconditions should reuse the existing batch fixture; they do not justify another merged-fixtures module or another event setup implementation.

## Applicable TEA guidance

Read `playwright-utils-mandate.md` first, then `library-integration-mandate.md`, `intercept-network-call.md`, `network-first.md`, `test-priorities-matrix.md`, `fixture-architecture.md`, `network-recorder.md`, `network-error-monitor.md`, `fixtures-composition.md`, and `log.md` from this workflow's `resources/knowledge` directory.

Both mandate gates hold: TEA enables Playwright Utils and package.json installs the package. Generated Playwright code must import test/expect from the existing merged fixtures, observe application requests with `interceptNetworkCall`, use `apiRequest` for application HTTP calls, use `recurse` for eventual conditions, and log through the reporting utility. Set up interception before the action and await the response before subsequent state/UI assertions. After a mutation, the repository additionally requires waiting for the store before the UI assertion.

Network monitoring stays active for these successful real-backend cases. Opt out only for specifically intentional error cases, preserving explicit failure assertions. The configured monitor excludes several background endpoints and caps duplicate errors; its presence is not a guarantee that every HTTP failure always fails every later test.

HAR recording is recommended when adding offline UI coverage. This task does not need offline playback; no recorder fixture or reviewed HAR corpus is currently composed in the project entry point, so adding that setup would be separate work. A HAR replay would not prove live persistence.

Keep helpers focused and compose fixtures once. No new fixture wrapper is needed merely to restate existing setup. Do not copy illustrative raw Playwright APIs from the principle fragments when the utility mandate supplies the mechanism.

## Scope decision

This bundle changes source/test contract comments, with executable behavior preserved. The existing three cases are the appropriate prioritized E2E regression selection for an artifact-only package. No test should assert comment wording. New copies of these scenarios would duplicate existing coverage without testing changed behavior.

The lack of a reload after description clearing and the inability of the distinct-date E2E case to identify a sorting layer are documented coverage limits. They are not new failures caused by these comment changes. Same-date wire order is separately covered by `tests/api/events-wire-contract.spec.ts` DE.5-API-005; the past-window tiebreak is covered by `tests/api/events-read-window.spec.ts:291`. Do not claim either as a same-date E2E assertion.
